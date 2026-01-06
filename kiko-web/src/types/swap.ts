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
    availableQuotes?: SwapQuote[];
    selectedDex?: string;
    mevProtection?: any;
}
