
import { getSolanaConnection, SOLANA_CONFIG } from '../config/solanaConfig.js';
import { AppError } from '../middleware/errorHandler.js';
import { getServerSolanaWalletAddress, sendSolanaTransaction, getDelegatedSolanaWallet } from './privyWallet.js';
import { getSolanaQuote } from './solanaSwap.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getPlatformFee, type FeeContext } from './platformFeeService.js';
import { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';

export interface SolanaSwapParams {
    userId: string;
    tokenInMint: string;
    tokenOutMint: string;
    amountIn: string; // Atomic units (lamports/etc)
    slippageBps?: number;
    feeContext?: FeeContext;
    accessToken?: string;
}

export async function executeSolanaSwap(params: SolanaSwapParams): Promise<string> {
    const { userId, tokenInMint, tokenOutMint, amountIn, slippageBps = 300, accessToken } = params;

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

    // Optional platform fee:
    // - If input is SOL, charge fee in lamports via a separate transfer tx, then swap the remainder.
    // - If input is an SPL token, charge fee via token transfer from user's ATA to fee recipient's ATA.
    const fee = getPlatformFee(params.feeContext || 'swap');
    let effectiveAmountIn = amountIn;
    if (fee.bps > 0 && fee.solanaRecipient && tokenInMint === SOLANA_CONFIG.TOKENS.SOL) {
        const amountBI = BigInt(amountIn || '0');
        const feeLamports = (amountBI * BigInt(fee.bps)) / BigInt(10000);

        if (feeLamports > BigInt(0) && amountBI > feeLamports) {
            const payer = new PublicKey(walletAddress);
            const recipient = new PublicKey(fee.solanaRecipient);
            const blockhashConnection = getSolanaConnection();
            const { blockhash } = await blockhashConnection.getLatestBlockhash('finalized');

            if (feeLamports > BigInt(Number.MAX_SAFE_INTEGER)) {
                throw new AppError(400, 'Solana fee amount too large', 'FEE_TRANSFER_FAILED');
            }
            const ix = SystemProgram.transfer({
                fromPubkey: payer,
                toPubkey: recipient,
                lamports: Number(feeLamports),
            });

            const messageV0 = new TransactionMessage({
                payerKey: payer,
                recentBlockhash: blockhash,
                instructions: [ix],
            }).compileToV0Message();

            const feeTx = new VersionedTransaction(messageV0);
            const feeTxB64 = Buffer.from(feeTx.serialize()).toString('base64');

            logger.info(LogCode.EXE_TX_BROADCAST, 'SolanaExecutor: Charging platform fee (SOL)', {
                bps: fee.bps,
                lamports: feeLamports.toString(),
                recipient: fee.solanaRecipient,
            });

            await sendSolanaTransaction(userId, feeTxB64);

            effectiveAmountIn = (amountBI - feeLamports).toString();
        }
    }

    // NOTE: For token->SOL sells, fee is charged in SOL after the swap (see below).

    // 1. Get Quote & Transaction (Unified)
    // using 'auto' aggregator to try Jupiter first, then Raydium
    const quote = await getSolanaQuote(
        tokenInMint,
        tokenOutMint,
        effectiveAmountIn,
        slippageBps,
        'auto', // Try all aggregators
        walletAddress // Build transaction for the SAME wallet that will sign
    );

    // [Expert Logic]: Add explicit priority fee context for copytrading
    // Competitive environment requires > 50th percentile of recent fees
    if (quote && params.feeContext === 'copyTrade') {
        quote.computeUnitPriceMicroLamports = 100000; // 100k microLamports (Aggressive base)
    }

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

    // Platform fee: charge in SOL after sell (token -> SOL)
    if (fee.bps > 0 && fee.solanaRecipient && tokenOutMint === SOLANA_CONFIG.TOKENS.SOL && tokenInMint !== SOLANA_CONFIG.TOKENS.SOL) {
        try {
            const outLamports = BigInt(quote.outAmount || '0');
            const feeLamports = (outLamports * BigInt(fee.bps)) / BigInt(10000);
            if (feeLamports > BigInt(0)) {
                const payer = new PublicKey(walletAddress);
                const recipient = new PublicKey(fee.solanaRecipient);
                const { blockhash } = await getSolanaConnection().getLatestBlockhash('finalized');
                const messageV0 = new TransactionMessage({
                    payerKey: payer,
                    recentBlockhash: blockhash,
                    instructions: [
                        SystemProgram.transfer({
                            fromPubkey: payer,
                            toPubkey: recipient,
                            lamports: Number(feeLamports),
                        }),
                    ],
                }).compileToV0Message();
                const feeTx = new VersionedTransaction(messageV0);
                const feeTxB64 = Buffer.from(feeTx.serialize()).toString('base64');
                await sendSolanaTransaction(userId, feeTxB64);
                logger.info(LogCode.EXE_TX_BROADCAST, 'SolanaExecutor: Collected platform fee (SOL sell)', {
                    bps: fee.bps,
                    lamports: feeLamports.toString(),
                    recipient: fee.solanaRecipient,
                });
            }
        } catch (feeErr: any) {
            logger.warn(LogCode.EXE_TX_REVERTED, 'SolanaExecutor: Fee collection failed', { error: feeErr.message });
        }
    }

    return signature;
}
