
import { getSolanaConnection, SOLANA_CONFIG } from '../config/solanaConfig.js';
import { AppError } from '../middleware/errorHandler.js';
import { getServerSolanaWalletAddress, sendSolanaTransaction, getDelegatedSolanaWallet } from './privyWallet.js';
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

    // === SIMULATION MODE ===
    if (process.env.SIMULATION_MODE === 'true') {
        console.log('[SolanaExecutor] 🧪 SIMULATION MODE: Skipping actual trade execution');
        return `5SimulatedSignature${Date.now()}${Math.random().toString(36).substring(7)}`;
    }

    // CRITICAL: Use the SAME wallet for building and signing!
    // Try user's delegated wallet first, fallback to server wallet
    let walletAddress: string;
    const delegatedWallet = await getDelegatedSolanaWallet(userId);
    if (delegatedWallet) {
        walletAddress = delegatedWallet.address;
        console.log(`[SolanaExecutor] Using user's delegated wallet: ${walletAddress.slice(0, 10)}...`);
    } else {
        walletAddress = await getServerSolanaWalletAddress();
        console.log(`[SolanaExecutor] Using server wallet (no delegation): ${walletAddress.slice(0, 10)}...`);
    }

    console.log(`[SolanaExecutor] Executing Swap: ${amountIn} of ${tokenInMint} -> ${tokenOutMint} using auto-router...`);

    // 1. Get Quote & Transaction (Unified)
    // using 'auto' aggregator to try Jupiter first, then Raydium
    const quote = await getSolanaQuote(
        tokenInMint,
        tokenOutMint,
        amountIn,
        slippageBps,
        'auto', // Try all aggregators
        walletAddress // Build transaction for the SAME wallet that will sign
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

    console.log(`[SolanaExecutor] Transaction sent: ${signature}. Confirming...`);

    // 3. Wait for confirmation
    const connection = getSolanaConnection();
    try {
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
            console.error(`[SolanaExecutor] ❌ Transaction FAILED on-chain: ${signature}`, confirmation.value.err);
            throw new AppError(500, `Solana swap failed on-chain: ${signature}`, 'TRANSACTION_FAILED');
        }

        console.log(`[SolanaExecutor] ✅ Swap confirmed: https://solscan.io/tx/${signature}`);
    } catch (confirmErr: any) {
        // If confirmation times out or fails, still return signature but log warning
        if (confirmErr?.code === 'TRANSACTION_FAILED') throw confirmErr;
        console.warn(`[SolanaExecutor] ⚠️ Could not confirm tx (may still succeed): ${confirmErr.message}`);
    }

    return signature;
}

