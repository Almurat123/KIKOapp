
import { getSolanaConnection, SOLANA_CONFIG } from '../config/solanaConfig.js';
import { AppError } from '../middleware/errorHandler.js';
import { getServerSolanaWalletAddress, sendSolanaTransaction, getDelegatedSolanaWallet } from './privyWallet.js';
import { getSolanaQuote } from './solanaSwap.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

export interface SolanaSwapParams {
    userId: string;
    tokenInMint: string;
    tokenOutMint: string;
    amountIn: string; // Atomic units (lamports/etc)
    slippageBps?: number;
}

export async function executeSolanaSwap(params: SolanaSwapParams): Promise<string> {
    const { userId, tokenInMint, tokenOutMint, amountIn, slippageBps = 300 } = params;

    // === SIMULATION MODE ===
    if (process.env.SIMULATION_MODE === 'true') {
        logger.info(LogCode.EXE_TX_BROADCAST, 'SolanaExecutor: SIMULATION MODE swap', { tokenOutMint });
        return `5SimulatedSignature${Date.now()}${Math.random().toString(36).substring(7)}`;
    }

    // CRITICAL: Use the SAME wallet for building and signing!
    // Try user's delegated wallet first, fallback to server wallet
    let walletAddress: string;
    const delegatedWallet = await getDelegatedSolanaWallet(userId);
    if (delegatedWallet) {
        walletAddress = delegatedWallet.address;
        logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Using delegated wallet', { address: walletAddress });
    } else {
        walletAddress = await getServerSolanaWalletAddress();
        logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Using server wallet', { address: walletAddress });
    }

    logger.info(LogCode.EXE_TX_BROADCAST, 'SolanaExecutor: Executing Swap', { tokenInMint, tokenOutMint, amountIn });

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

    logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Swap prepared', { aggregator: quote.aggregator, outAmount: quote.outAmount });

    // 2. Refresh Blockhash & Execute Transaction
    // CRITICAL: Raydium/Jupiter quotes might have stale blockhashes (TTL ~1min)
    // To prevent "Blockhash not found" errors, we deserialize and inject a FRESH blockhash
    logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Refreshing blockhash before sending');

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
    logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Fresh blockhash obtained', { blockhash });

    // Update blockhash
    transaction.message.recentBlockhash = blockhash;

    // Reserialize to base64
    const freshTransactionBase64 = Buffer.from(transaction.serialize()).toString('base64');

    const signature = await sendSolanaTransaction(userId, freshTransactionBase64);

    logger.info(LogCode.EXE_TX_BROADCAST, 'SolanaExecutor: Transaction sent', { signature });

    // Alchemy HTTP RPC doesn't support WebSocket methods like signatureSubscribe
    const connection = getSolanaConnection();
    try {
        logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Polling for confirmation', { signature });

        let confirmed = false;
        const maxAttempts = 30; // 30 seconds max

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

            const status = await connection.getSignatureStatus(signature);

            if (status?.value?.confirmationStatus === 'confirmed' ||
                status?.value?.confirmationStatus === 'finalized') {
                confirmed = true;

                if (status.value.err) {
                    logger.error(LogCode.EXE_TX_REVERTED, 'SolanaExecutor: Transaction FAILED on-chain', { signature, error: status.value.err });
                    throw new AppError(500, `Solana swap failed on-chain: ${signature}`, 'TRANSACTION_FAILED');
                }

                logger.info(LogCode.EXE_TX_CONFIRMED, 'SolanaExecutor: Swap confirmed', { signature });
                break;
            }
        }

        if (!confirmed) {
            logger.warn(LogCode.EXE_TX_REVERTED, 'SolanaExecutor: Confirmation timeout', { signature });
        }
    } catch (confirmErr: any) {
        // If confirmation times out or fails, still return signature but log warning
        if (confirmErr?.code === 'TRANSACTION_FAILED') throw confirmErr;
        logger.warn(LogCode.SYS_ERROR, 'SolanaExecutor: Could not confirm tx', { signature, error: confirmErr.message });
    }

    return signature;
}

