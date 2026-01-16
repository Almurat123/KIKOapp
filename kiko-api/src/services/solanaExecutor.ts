
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

    // 2. Refresh Blockhash & Execute Transaction
    // CRITICAL: Raydium/Jupiter quotes might have stale blockhashes (TTL ~1min)
    // To prevent "Blockhash not found" errors, we deserialize and inject a FRESH blockhash
    console.log('[SolanaExecutor] Refreshing blockhash before sending...');

    // We need to pass the base64 string to sendSolanaTransaction first
    // But since sendSolanaTransaction handles deserialization, we should modify it there or do it here.
    // Let's do it here for clarity and control:

    const { VersionedTransaction } = await import('@solana/web3.js');
    const blockhashConnection = getSolanaConnection();

    // Deserialize
    const transactionBuffer = Buffer.from(quote.swapTransaction, 'base64');
    let transaction = VersionedTransaction.deserialize(transactionBuffer);

    // Fetch fresh blockhash
    const { blockhash, lastValidBlockHeight } = await blockhashConnection.getLatestBlockhash('finalized');
    console.log(`[SolanaExecutor] Fresh blockhash: ${blockhash}`);

    // Update blockhash
    transaction.message.recentBlockhash = blockhash;

    // Reserialize to base64
    const freshTransactionBase64 = Buffer.from(transaction.serialize()).toString('base64');

    const signature = await sendSolanaTransaction(userId, freshTransactionBase64);

    console.log(`[SolanaExecutor] Transaction sent: ${signature}. Confirming...`);

    // 3. Wait for confirmation using polling (HTTP-compatible)
    // Alchemy HTTP RPC doesn't support WebSocket methods like signatureSubscribe
    const connection = getSolanaConnection();
    try {
        console.log(`[SolanaExecutor] Polling for confirmation (max 30s)...`);

        let confirmed = false;
        const maxAttempts = 30; // 30 seconds max

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

            const status = await connection.getSignatureStatus(signature);

            if (status?.value?.confirmationStatus === 'confirmed' ||
                status?.value?.confirmationStatus === 'finalized') {
                confirmed = true;

                if (status.value.err) {
                    console.error(`[SolanaExecutor] ❌ Transaction FAILED on-chain: ${signature}`, status.value.err);
                    throw new AppError(500, `Solana swap failed on-chain: ${signature}`, 'TRANSACTION_FAILED');
                }

                console.log(`[SolanaExecutor] ✅ Swap confirmed: https://solscan.io/tx/${signature}`);
                break;
            }
        }

        if (!confirmed) {
            console.warn(`[SolanaExecutor] ⚠️ Confirmation timeout after 30s, but tx may still succeed: ${signature}`);
        }
    } catch (confirmErr: any) {
        // If confirmation times out or fails, still return signature but log warning
        if (confirmErr?.code === 'TRANSACTION_FAILED') throw confirmErr;
        console.warn(`[SolanaExecutor] ⚠️ Could not confirm tx (may still succeed): ${confirmErr.message}`);
    }

    return signature;
}

