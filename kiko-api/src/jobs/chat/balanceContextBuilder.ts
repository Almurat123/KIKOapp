export type BuildBalanceContextParams = {
    toolContext: any;
    toolResultsCache: Map<string, any>;
    nativeSymbol?: string;
    nativePriceUsd?: number;
    nativePriceSource?: string;
    nativePriceFetchedAt?: string;
    balanceSnapshotAt?: string;
    requestedAddressSet?: Set<string>;
    requestedTokens?: string[];
    includePortfolioBlock?: boolean;
    includeRequestedTokenBlock?: boolean;
    includeExecutionRule?: boolean;
    chainLabel?: string;
    stableStringify: (v: any) => string;
    filterBalanceEntriesForAi: (
        entries: Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }> | undefined,
        chainId?: number,
        allowContracts?: Set<string>
    ) => Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }> | undefined;
    isStableSymbolForChain: (chainId: number | undefined, symbol: string) => boolean;
    isNativeSymbol: (symbol: string) => boolean;
    limitLines: (lines: string[], limit: number) => { lines: string[]; hiddenCount: number };
};

export type BuildBalanceContextResult = {
    cacheHit: boolean;
    tokenCount: number;
    tokenContextBlock: string;
    requestedTokenBlock: string;
    tokensInPortfolio: string[];
    requestedMatched: string[];
    requestedMissing: string[];
    resolvedBalances: Record<string, string>;
};

export function buildBalanceContextBlock(params: BuildBalanceContextParams): BuildBalanceContextResult {
    const toolContext = params.toolContext || {};
    const chainId = toolContext?.chainId;
    const walletAddress = toolContext?.walletAddress;
    const includePortfolioBlock = !!params.includePortfolioBlock;
    const includeRequestedTokenBlock = !!params.includeRequestedTokenBlock;
    const includeExecutionRule = !!params.includeExecutionRule;
    const requestedAddressSet = params.requestedAddressSet || new Set<string>();
    const requestedTokens = new Set<string>((params.requestedTokens || []).filter(Boolean).map(v => String(v)));
    const chainLabel = params.chainLabel || String(chainId || 'Unknown');
    const nativeSymbol = params.nativeSymbol || 'NATIVE';

    const result: BuildBalanceContextResult = {
        cacheHit: false,
        tokenCount: 0,
        tokenContextBlock: '',
        requestedTokenBlock: '',
        tokensInPortfolio: [],
        requestedMatched: [],
        requestedMissing: [],
        resolvedBalances: {},
    };

    if (!walletAddress) return result;

    const balanceKey = `get_wallet_info:${params.stableStringify({
        address: walletAddress,
        chainId,
    })}`;

    if (!params.toolResultsCache.has(balanceKey)) {
        result.tokenContextBlock = `\n\n[USER_BALANCE_CONTEXT]
User Wallet: ${walletAddress}
Status: unavailable (balance data not available from cache).
CRITICAL: Do not infer wallet USD value or token balances without an explicit trusted price/balance source.`;
        return result;
    }

    result.cacheHit = true;
    const balanceData = params.toolResultsCache.get(balanceKey);
    const rawTokens = Array.isArray(balanceData?.tokens) ? balanceData.tokens : [];
    const nativeBalanceRaw = balanceData?.ethBalance || toolContext?.nativeBalance || 'Unknown';
    const nativeBalanceNum = Number(nativeBalanceRaw);
    const hasNativePrice = Number.isFinite(params.nativePriceUsd || NaN) && (params.nativePriceUsd || 0) > 0;
    const nativePriceLine = hasNativePrice
        ? `Native Price Reference (${params.nativePriceSource || 'Coinbase'}): 1 ${nativeSymbol} ≈ $${Number(params.nativePriceUsd).toFixed(2)}${params.nativePriceFetchedAt ? ` (as of ${params.nativePriceFetchedAt})` : ''}`
        : `Native Price Reference: unavailable`;
    const nativeValueLine = hasNativePrice && Number.isFinite(nativeBalanceNum)
        ? `Estimated Native USD Value: ≈ $${(nativeBalanceNum * Number(params.nativePriceUsd)).toFixed(2)}`
        : `Estimated Native USD Value: unknown (no trusted native price reference)`;
    const snapshotAtLine = params.balanceSnapshotAt
        ? `Balance Snapshot Time: ${params.balanceSnapshotAt}`
        : `Balance Snapshot Time: unknown`;

    result.tokenContextBlock += `\n\n[NATIVE_PRICE_CONTEXT]
Native Balance: ${nativeBalanceRaw} ${nativeSymbol}
${nativePriceLine}
${nativeValueLine}
${snapshotAtLine}
CRITICAL: NEVER infer USD value for native balance unless Native Price Reference is explicitly provided above.`;
    const filteredTokens = params.filterBalanceEntriesForAi(rawTokens, chainId, requestedAddressSet) || [];
    result.tokenCount = filteredTokens.length || 0;
    result.tokensInPortfolio = rawTokens
        .map((t: any) => (t?.contractAddress || t?.contract)?.toLowerCase())
        .filter(Boolean);

    if (includePortfolioBlock) {
        const portfolioLineItems = filteredTokens.length > 0
            ? filteredTokens.map((t: any) => {
                const symbol = t.symbol || 'Unknown';
                const balance = t.balance || '0';
                const contract = t.contractAddress || t.contract;
                const contractInfo = contract && !contract.startsWith('0x0000000000000000000000000000000000000000')
                    ? ` (${contract})`
                    : '';
                return `- ${symbol}: ${balance}${contractInfo}`;
            })
            : [];
        const limitedPortfolio = params.limitLines(portfolioLineItems, 12);
        const portfolioLines = limitedPortfolio.lines.join('\n')
            + (limitedPortfolio.hiddenCount > 0 ? `\n... (+${limitedPortfolio.hiddenCount} more)` : '');

        result.tokenContextBlock += `\n\n[USER_BALANCE_CONTEXT] ✅ CACHED DATA AVAILABLE
User Wallet: ${walletAddress}
Chain: ${chainLabel}
Native Balance: ${nativeBalanceRaw} ${nativeSymbol}
${portfolioLines ? `\nToken Holdings:\n${portfolioLines}` : '\nNo tokens found.'}
`;
        if (includeExecutionRule) {
            result.tokenContextBlock += `\nCRITICAL: When user says "sell all 0xABC..." or "sell SYMBOL", extract the balance from above and use it as amount_in (NOT "all").`;
        }
    }

    if (includeRequestedTokenBlock && requestedTokens.size > 0 && rawTokens.length > 0) {
        const requestedLines: string[] = [];
        for (const request of requestedTokens) {
            const requestLower = request.toLowerCase();
            const requestIsAddress = requestLower.startsWith('0x') || requestLower.length >= 32;
            const requestSymbol = requestIsAddress ? '' : request.toUpperCase();
            if (!requestIsAddress && !params.isStableSymbolForChain(chainId, requestSymbol) && !params.isNativeSymbol(requestSymbol)) {
                requestedLines.push(`- ${request}: hidden (unverified token; provide contract address)`);
                result.requestedMissing.push(request);
                continue;
            }
            const aliasSymbols: string[] = (() => {
                if (!requestIsAddress && requestSymbol === 'USDC' && chainId === 137) {
                    return ['usdc', 'usdc.e'];
                }
                return [requestLower];
            })();

            const matches = rawTokens.filter((t: any) => {
                const symbol = t?.symbol ? String(t.symbol).toLowerCase() : '';
                const contract = (t?.contractAddress || t?.contract) ? String(t.contractAddress || t.contract).toLowerCase() : '';
                return aliasSymbols.includes(symbol) || contract === requestLower;
            });

            const match = matches.find((t: any) => Number(t.balance ?? t.tokenBalance ?? 0) > 0) || matches[0];
            if (match) {
                const matchBalance = match.balance ?? match.tokenBalance ?? '0';
                const matchName = String(match.symbol || request);
                requestedLines.push(`- ${matchName}: ${matchBalance}${match.decimals !== undefined ? ` (decimals: ${match.decimals})` : ''}`);
                result.requestedMatched.push(matchName);
                result.resolvedBalances[matchName] = String(matchBalance);
            } else {
                requestedLines.push(`- ${request}: not present in provided balance snapshot`);
                result.requestedMissing.push(request);
            }
        }
        result.requestedTokenBlock = `\n\n[REQUESTED_TOKEN_BALANCE]
${requestedLines.join('\n')}
Rule: If a token is marked "not present", you must say the balance is unknown or zero and MUST NOT infer or guess.
Rule: For USD conversions, use Native Price Reference above or fetch trusted price data first.`;
        result.tokenContextBlock += result.requestedTokenBlock;
    }

    return result;
}
