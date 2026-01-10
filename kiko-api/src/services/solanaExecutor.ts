
import { getSolanaConnection, SOLANA_CONFIG } from '../config/solanaConfig.js';
import { AppError } from '../middleware/errorHandler.js';
import { getServerSolanaWalletAddress, sendSolanaTransaction } from './privyWallet.js';
import { getSolanaQuote } from './solanaSwap.js';

export interface SolanaSwapParams {
    userId: string;
    tokenInMint: string;
    tokenOutMint: string;
    amountIn: string; // Atomic units (lamports/etc)
    slippageBps?: number;
}

export async function executeSolanaSwap(params: SolanaSwapParams): Promise<string> {
    const { userId, tokenInMint, tokenOutMint, amountIn, slippageBps = 100 } = params;

    // Get the server wallet address for executing swaps
    const walletAddress = await getServerSolanaWalletAddress();

    console.log(`[SolanaExecutor] Executing Swap: ${amountIn} of ${tokenInMint} -> ${tokenOutMint} using auto-router...`);

    // 1. Get Quote & Transaction (Unified)
    // using 'auto' aggregator to try Jupiter first, then Raydium
    const quote = await getSolanaQuote(
        tokenInMint,
        tokenOutMint,
        amountIn,
        slippageBps,
        'auto', // Try all aggregators
        walletAddress // Providing address builds the transaction immediately
    );

    if (!quote) {
        throw new AppError(400, 'Solana Swap Failed: No valid quotes found from Jupiter or Raydium', 'QUOTE_FAILED');
    }

    if (!quote.swapTransaction) {
        throw new AppError(500, `Solana Swap Failed: Quote found from ${quote.aggregator} but failed to build transaction`, 'SWAP_BUILD_FAILED');
    }

    console.log(`[SolanaExecutor] Swap prepared via ${quote.aggregator} (Out: ${quote.outAmount})`);

    // 2. Execute Transaction
    const signature = await sendSolanaTransaction(userId, quote.swapTransaction);

    console.log(`[SolanaExecutor] Swap Executed: https://solscan.io/tx/${signature}`);
    return signature;
}

