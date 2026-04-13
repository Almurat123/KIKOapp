/**
 * Swap System - Core Types
 * Shared interfaces for all swap providers and executors
 */

export interface SwapQuote {
    /** Provider name (e.g., '0x', 'jupiter') */
    provider: string;

    /** Input amount in base units (wei/lamports) */
    amountInBase: string;

    /** Expected output amount in base units */
    amountOutBase: string;

    /** Human-readable output amount */
    amountOutHuman?: string;

    /** Price impact percentage (0-100) */
    priceImpact: number;

    /** Estimated gas (EVM) or compute units (Solana) */
    gasEstimate?: string;

    /** Transaction target address */
    to: string;

    /** Transaction calldata */
    data: string;

    /** Native token value to send (EVM only) */
    value: string;

    /** Address to approve tokens to (if needed) */
    allowanceTarget?: string;

    /** Quote expiration timestamp */
    expiresAt?: number;

    /** Additional provider-specific data */
    metadata?: Record<string, any>;
}

export interface SwapRequest {
    /** User ID for wallet access */
    userId: string;

    /** User's wallet address */
    walletAddress: string;

    /** Input token address or symbol */
    tokenIn: string;

    /** Output token address or symbol */
    tokenOut: string;

    /** Input amount (human readable, e.g., "0.1") */
    amountIn: string;

    /** Chain ID */
    chainId: number;

    /** Slippage tolerance in basis points (default: 50 = 0.5%) */
    slippageBps?: number;

    /** Fee context for platform fees */
    feeContext?: 'swap' | 'launchpad' | 'copy_trade';

    /** Whether this is a sell operation (token → native) */
    isSell?: boolean;
}

export interface SwapResult {
    /** Whether the swap succeeded */
    success: boolean;

    /** Transaction hash */
    txHash?: string;

    /** Actual output amount received */
    amountOut?: string;

    /** Error message if failed */
    error?: string;

    /** Provider that executed the swap */
    provider: string;

    /** Whether transaction was confirmed on-chain */
    confirmed: boolean;

    /** Block number where tx was included (if confirmed) */
    blockNumber?: number;
}

export interface SwapProvider {
    /** Provider name */
    readonly name: string;

    /** Supported chain IDs */
    readonly supportedChains: number[];

    /**
     * Get a quote for a swap
     * Returns null if provider cannot handle this swap
     */
    getQuote(request: SwapRequest): Promise<SwapQuote | null>;

    /**
     * Check if provider supports a specific token on a chain
     */
    supportsToken(token: string, chainId: number): Promise<boolean>;
}

export interface SwapExecutor {
    /**
     * Execute a swap transaction and wait for confirmation
     */
    execute(
        userId: string,
        quote: SwapQuote,
        request: SwapRequest
    ): Promise<SwapResult>;

    /**
     * Check if executor supports a chain
     */
    supportsChain(chainId: number): boolean;
}
