import { LogCode } from '../../config/logRegistry.js';
import { logger } from '../../utils/logger.js';

type FastSwapDecisionInput = {
    parsedIntent: any;
    lastUserMessage: string;
    toolContext: any;
};

type FastSwapDecision = {
    fastSwapModeEnabled: boolean;
    fastSwapMode: boolean;
    isSwapIntent: boolean;
    hasSwapTarget: boolean;
    hasExplicitSwapVerb: boolean;
    hasResolvableAddressTarget: boolean;
    requiresAddressForFastSwap: boolean;
    shouldAttempt: boolean;
};

type FastSwapPrepareInput = {
    parsedIntent: any;
    lastUserMessage: string;
    taskToolContext: any;
    chainIdMap: Record<number, string>;
    findSnapshotBalance: (tokenIn: string, chainName: string, isNative: boolean) => number | null;
    fetchOnchainBalance: (walletAddress: string, chainName: string, tokenIn: string, isNative: boolean) => Promise<number>;
    resolveSolWallet: (userId: string) => Promise<string | null>;
    resolveEvmWallet: (userId: string) => Promise<string | null>;
};

export type FastSwapPrepared = {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    actualChainName: string;
    resolvedWalletAddress: string | undefined;
    shouldFallbackToLlm: boolean;
};

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FAST_SWAP_NATIVE_WHITELIST = new Map<number, Set<string>>([
    [8453, new Set(['ETH', 'WETH'])],
    [1, new Set(['ETH', 'WETH'])],
    [56, new Set(['BNB', 'WBNB'])],
    [137, new Set(['POL', 'MATIC', 'WMATIC'])],
    [10, new Set(['ETH', 'WETH'])],
    [42161, new Set(['ETH', 'WETH'])],
    [900, new Set(['SOL', 'WSOL'])],
]);

function isAddressLike(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return EVM_ADDRESS_PATTERN.test(trimmed) || SOLANA_ADDRESS_PATTERN.test(trimmed);
}

function isWhitelistedFastSwapToken(symbol: unknown, chainId?: number): boolean {
    if (typeof symbol !== 'string') return false;
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return false;

    const scoped = chainId ? FAST_SWAP_NATIVE_WHITELIST.get(chainId) : undefined;
    if (scoped?.has(normalized)) return true;

    return Array.from(FAST_SWAP_NATIVE_WHITELIST.values()).some((set) => set.has(normalized));
}

export function getFastSwapDecision(input: FastSwapDecisionInput): FastSwapDecision {
    const fastSwapModeEnabled = input.toolContext?.toolConfig?.fastSwapMode === true;
    const fastSwapMode = fastSwapModeEnabled;
    const isSwapIntent = input.parsedIntent?.detailed?.action === 'swap';
    const hasSwapTarget = !!input.parsedIntent?.swapIntent?.tokenOut || !!input.parsedIntent?.contractAddress;
    const hasExplicitSwapVerb = /\b(swap|buy|sell|trade|买|卖)\b/i.test(input.lastUserMessage || '');
    const chainId = input.parsedIntent?.chainId || input.toolContext?.chainId;
    const tokenOut = input.parsedIntent?.swapIntent?.tokenOut;
    const contractAddress = input.parsedIntent?.contractAddress;
    const hasResolvableAddressTarget =
        isAddressLike(contractAddress) ||
        isAddressLike(tokenOut) ||
        isWhitelistedFastSwapToken(tokenOut, chainId);
    const requiresAddressForFastSwap =
        fastSwapMode && isSwapIntent && hasSwapTarget && hasExplicitSwapVerb && !hasResolvableAddressTarget;
    const shouldAttempt =
        fastSwapMode && isSwapIntent && hasSwapTarget && hasExplicitSwapVerb && hasResolvableAddressTarget;

    logger.info(LogCode.AI_ORCHESTRATOR, 'Fast swap gating evaluated', {
        fastSwapModeEnabled,
        fastSwapMode,
        isSwapIntent,
        hasSwapTarget,
        hasExplicitSwapVerb,
        hasResolvableAddressTarget,
        requiresAddressForFastSwap,
        shouldAttempt,
    });

    return {
        fastSwapModeEnabled,
        fastSwapMode,
        isSwapIntent,
        hasSwapTarget,
        hasExplicitSwapVerb,
        hasResolvableAddressTarget,
        requiresAddressForFastSwap,
        shouldAttempt,
    };
}

function resolveInitialSwapParams(parsedIntent: any, lastUserMessage: string, defaultChainId?: number): {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
} {
    let tokenIn = parsedIntent?.swapIntent?.tokenIn || 'ETH';
    let tokenOut = parsedIntent?.swapIntent?.tokenOut || parsedIntent?.contractAddress || '';
    const amountIn = parsedIntent?.swapIntent?.amount || '0.001';
    const chainId = parsedIntent?.chainId || defaultChainId || 8453;

    const tokenInLower = tokenIn.toLowerCase();
    const tokenOutLower = tokenOut.toLowerCase();
    if (tokenInLower === tokenOutLower || (tokenIn.startsWith('0x') && tokenOut.startsWith('0x') && tokenInLower === tokenOutLower)) {
        const isSellOperation = /\b(sell|卖)\b/i.test(lastUserMessage || '');
        const isBuyOperation = /\b(buy|买|get)\b/i.test(lastUserMessage || '');
        const isSolana = chainId === 900;
        const isBsc = chainId === 56 || /\bBNB\b/i.test(lastUserMessage || '');
        const isPolygon = chainId === 137;
        const nativeToken = isSolana ? 'SOL' : (isBsc ? 'BNB' : (isPolygon ? 'POL' : 'ETH'));

        if (isSellOperation && !isBuyOperation) {
            tokenIn = parsedIntent?.contractAddress || tokenIn;
            tokenOut = nativeToken;
        } else {
            tokenIn = nativeToken;
            tokenOut = parsedIntent?.contractAddress || tokenOut;
        }
    }

    return { tokenIn, tokenOut, amountIn: String(amountIn), chainId };
}

function resolveActualChainName(tokenIn: string, tokenOut: string, chainId: number, chainIdMap: Record<number, string>): string {
    const isEvmToken = tokenIn.startsWith('0x');
    const isSolanaToken = !isEvmToken && tokenIn.length >= 32 && tokenIn.length <= 44;
    if (isSolanaToken) return 'solana';
    if (!isEvmToken) return chainIdMap[chainId] || 'base';

    const userChainName = chainIdMap[chainId] || 'base';
    if (userChainName !== 'solana') return userChainName;
    if (tokenOut === 'BNB') return 'bsc';
    if (tokenOut === 'ETH') return 'base';
    return 'base';
}

async function resolveWalletAddressForChain(input: {
    taskToolContext: any;
    actualChainName: string;
    resolveSolWallet: (userId: string) => Promise<string | null>;
    resolveEvmWallet: (userId: string) => Promise<string | null>;
}): Promise<string | undefined> {
    let walletAddress = input.taskToolContext?.walletAddress;
    const userId = input.taskToolContext?.userId;
    if (!userId) return walletAddress;

    if (input.actualChainName === 'solana') {
        const solAddress = await input.resolveSolWallet(userId);
        if (solAddress) walletAddress = solAddress;
        return walletAddress;
    }

    if (walletAddress && walletAddress.startsWith('0x')) return walletAddress;
    const evmAddress = await input.resolveEvmWallet(userId);
    if (evmAddress) walletAddress = evmAddress;
    return walletAddress;
}

async function resolveAmountByBalance(input: {
    amountIn: string;
    tokenIn: string;
    actualChainName: string;
    walletAddress: string;
    findSnapshotBalance: (tokenIn: string, chainName: string, isNative: boolean) => number | null;
    fetchOnchainBalance: (walletAddress: string, chainName: string, tokenIn: string, isNative: boolean) => Promise<number>;
}): Promise<string> {
    const raw = String(input.amountIn);
    if (!(raw === 'all' || raw.endsWith('%'))) return raw;

    const isNative = ['ETH', 'BNB', 'SOL'].includes(input.tokenIn.toUpperCase()) && !input.tokenIn.startsWith('0x');
    let balance = input.findSnapshotBalance(input.tokenIn, input.actualChainName, isNative);
    if (balance === null) {
        balance = await input.fetchOnchainBalance(input.walletAddress, input.actualChainName, input.tokenIn, isNative);
    }
    if (isNative && raw === 'all') {
        balance = balance * 0.95;
    }
    if (raw === 'all') {
        return balance.toString();
    }
    const percent = parseFloat(raw) || 0;
    const safeAmount = balance * (percent / 100) * 0.9999;
    return safeAmount.toString();
}

export async function prepareFastSwapExecution(input: FastSwapPrepareInput): Promise<FastSwapPrepared> {
    const initial = resolveInitialSwapParams(
        input.parsedIntent,
        input.lastUserMessage,
        input.taskToolContext?.chainId
    );
    const actualChainName = resolveActualChainName(initial.tokenIn, initial.tokenOut, initial.chainId, input.chainIdMap);

    const resolvedWalletAddress = await resolveWalletAddressForChain({
        taskToolContext: input.taskToolContext,
        actualChainName,
        resolveSolWallet: input.resolveSolWallet,
        resolveEvmWallet: input.resolveEvmWallet,
    });

    if (!resolvedWalletAddress) {
        return {
            tokenIn: initial.tokenIn,
            tokenOut: initial.tokenOut,
            amountIn: '0',
            chainId: initial.chainId,
            actualChainName,
            resolvedWalletAddress,
            shouldFallbackToLlm: true,
        };
    }

    let amountIn = initial.amountIn;
    try {
        amountIn = await resolveAmountByBalance({
            amountIn: initial.amountIn,
            tokenIn: initial.tokenIn,
            actualChainName,
            walletAddress: resolvedWalletAddress,
            findSnapshotBalance: input.findSnapshotBalance,
            fetchOnchainBalance: input.fetchOnchainBalance,
        });
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Fast swap balance resolution failed', {
            error: error?.message || String(error),
            tokenIn: initial.tokenIn,
            chain: actualChainName,
        });
        amountIn = '0';
    }

    const shouldFallbackToLlm = amountIn === 'all' || amountIn === '0' || parseFloat(amountIn) <= 0;
    logger.info(LogCode.AI_ORCHESTRATOR, 'Fast swap prepared', {
        tokenIn: initial.tokenIn,
        tokenOut: initial.tokenOut,
        chainId: initial.chainId,
        actualChainName,
        amountIn,
        shouldFallbackToLlm,
    });

    return {
        tokenIn: initial.tokenIn,
        tokenOut: initial.tokenOut,
        amountIn,
        chainId: initial.chainId,
        actualChainName,
        resolvedWalletAddress,
        shouldFallbackToLlm,
    };
}
