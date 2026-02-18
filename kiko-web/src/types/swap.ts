/**
 * Swap Types
 */

export interface SwapParams {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    slippageBps?: number;
    maxPriceImpact?: number;
    userAddress?: string;
}

export interface SwapQuote {
    success: boolean;
    dex: string;
    dexName?: string;
    amountIn: string;
    amountOut: string;
    minAmountOut: string;
    amountOutBase?: string;
    gasEstimate: number;
    priceImpact: number;
    fee?: number;
    path: string[];
    router: string;
    deadline: number;
    to: string;
    data: string;
    value: string;
    allowanceTarget?: string;
    tokenInDecimals?: number;
    tokenOutDecimals?: number;
    swapTransaction?: string;
}

export interface TradeExecutionResult {
    success: boolean;
    txHash?: string;
    error?: string;
}

export interface PriceData {
    tokenInPrice: number;
    tokenOutPrice: number;
    nativeTokenPrice: number;
}

export interface SwapQuoteResponse {
    success: boolean;
    data?: SwapQuote;
    quotes?: any[];
    error?: string;
}

export interface TokenBalance {
    contractAddress: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: string;
    formatted: string;
    price?: number;
    value?: number;
}

export interface Token {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoUrl?: string;
    emoji?: string;
    chainId?: number;
}

export interface SwapState {
    status: SwapStatus;
    tokenIn: Token | null;
    tokenOut: Token | null;
    amountIn: string;
    amountOut: string;
    quote: SwapQuote | null;
    isLoading: boolean;
    isExecuting: boolean;
    error: string | null;
    priceImpactUSD: number;
    gasCostUSD: number;
    isApproved: boolean;
    lastTxHash?: string;
    availableQuotes?: SwapQuote[];
    selectedDex?: string;
    mevProtection?: any;
}

export type SwapStatus =
    | 'idle'
    | 'quoting'
    | 'quote_ready'
    | 'approval_checking'
    | 'needs_approval'
    | 'submitting'
    | 'success'
    | 'error';

export interface SwapDisplayInfo {
    status: SwapStatus;
    tokenInSymbol: string;
    tokenOutSymbol: string;
    tokenInEmoji: string;
    tokenOutEmoji: string;
    amountIn: string;
    amountOut: string;
    amountInUSD: string;
    amountOutUSD: string;
    isLoading: boolean;
    isExecuting: boolean;
    error: string | null;
    isApproved: boolean;
    needsApproval: boolean;
    actionLabel: string;
    isActionDisabled: boolean;
    priceImpact: number;
    gasEstimate: number;
    gasCostUSD: string;
    minAmountOut: string;
    dexName: string;
    userBalance: string;
    isBalanceLoading: boolean;
    hasEnoughBalance: boolean;
    availableQuotes: SwapQuote[];
    selectedDex?: string;
    mevProtection: any;
}
