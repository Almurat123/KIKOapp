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
    /** When true, inject trade-critical guardrails (sell-all extraction, USD inference). */
    isExecutionIntent?: boolean;
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
    const isExec = !!params.isExecutionIntent;
    const requestedAddressSet = params.requestedAddressSet || new Set<string>();
    const requestedTokens = new Set<string>((params.requestedTokens || []).filter(Boolean).map(v => String(v)));
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
        result.tokenContextBlock = `\n\n[WALLET_STATE] unavailable`;
        return result;
    }

    result.cacheHit = true;
    const balanceData = params.toolResultsCache.get(balanceKey);
    const rawTokens = Array.isArray(balanceData?.tokens) ? balanceData.tokens : [];
    const nativeBalanceRaw = balanceData?.ethBalance || toolContext?.nativeBalance || 'Unknown';
    const hasNativePrice = Number.isFinite(params.nativePriceUsd || NaN) && (params.nativePriceUsd || 0) > 0;
    const nativeBalanceNum = Number(nativeBalanceRaw);
    const nativeUsdStr = hasNativePrice && Number.isFinite(nativeBalanceNum)
        ? ` ≈ $${(nativeBalanceNum * Number(params.nativePriceUsd)).toFixed(2)}`
        : '';
    const nativePriceStr = hasNativePrice
        ? `1 ${nativeSymbol} ≈ $${Number(params.nativePriceUsd).toFixed(2)}`
        : '';

    // ── Single [WALLET_STATE] block (replaces old NATIVE_PRICE_CONTEXT + USER_BALANCE_CONTEXT) ──
    // Wallet address & chain are already in [CONTEXT], so we only emit balance data here.
    const lines: string[] = [
        `\n\n[WALLET_STATE]`,
        `Native: ${nativeBalanceRaw} ${nativeSymbol}${nativeUsdStr}`,
        `Rule: Use this as the default balance source for this turn. Do not re-fetch wallet balances unless missing/stale or user explicitly asks to refresh.`,
    ];
    if (nativePriceStr) lines.push(`Price ref: ${nativePriceStr}`);
    if (params.balanceSnapshotAt) lines.push(`Snapshot: ${params.balanceSnapshotAt}`);

    // Only inject USD guardrail for execution intents where it actually matters
    if (isExec && !hasNativePrice) {
        lines.push(`Note: No native price ref — fetch before USD conversions.`);
    }

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
        const portfolioBlock = limitedPortfolio.lines.join('\n')
            + (limitedPortfolio.hiddenCount > 0 ? `\n... (+${limitedPortfolio.hiddenCount} more)` : '');
        if (portfolioBlock) lines.push(`Holdings:\n${portfolioBlock}`);

        if (includeExecutionRule && isExec) {
            lines.push(`Rule: For "sell all SYMBOL", extract exact balance above as amount_in.`);
        }
    }

    result.tokenContextBlock += lines.join('\n');

    if (includeRequestedTokenBlock && requestedTokens.size > 0 && rawTokens.length > 0) {
        const requestedLines: string[] = [];
        for (const request of requestedTokens) {
            const requestLower = request.toLowerCase();
            const requestIsAddress = requestLower.startsWith('0x') || requestLower.length >= 32;
            const requestSymbol = requestIsAddress ? '' : request.toUpperCase();
            if (!requestIsAddress && !params.isStableSymbolForChain(chainId, requestSymbol) && !params.isNativeSymbol(requestSymbol)) {
                requestedLines.push(`- ${request}: hidden (provide contract address)`);
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
                requestedLines.push(`- ${request}: not found`);
                result.requestedMissing.push(request);
            }
        }
        result.requestedTokenBlock = `\n\n[REQUESTED_BALANCES]\n${requestedLines.join('\n')}`;
        if (isExec) {
            result.requestedTokenBlock += `\nRule: "not found" = unknown or zero; do not guess.`;
        }
        result.tokenContextBlock += result.requestedTokenBlock;
    }

    return result;
}
