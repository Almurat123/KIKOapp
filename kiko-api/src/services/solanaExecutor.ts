
import { getSolanaConnection, SOLANA_CONFIG } from '../config/solanaConfig.js';
import { AppError } from '../middleware/errorHandler.js';
import { getServerSolanaWalletAddress, sendSolanaTransaction, getDelegatedSolanaWallet } from './privyWallet.js';
import { getSolanaQuote } from './solanaSwap.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getPlatformFee, type FeeContext } from './platformFeeService.js';
import { PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '../utils/solanaToken.js';

export interface SolanaSwapParams {
    userId: string;
    tokenInMint: string;
    tokenOutMint: string;
    amountIn: string; // Atomic units (lamports/etc)
    slippageBps?: number;
    feeContext?: FeeContext;
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

    // Optional platform fee:
    // - If input is SOL, charge fee in lamports via a separate transfer tx, then swap the remainder.
    // - If input is an SPL token, charge fee via token transfer from user's ATA to fee recipient's ATA.
    const fee = getPlatformFee(params.feeContext || 'swap');
    let effectiveAmountIn = amountIn;
    if (fee.bps > 0 && fee.solanaRecipient && tokenInMint === SOLANA_CONFIG.TOKENS.SOL) {
        const amountBI = BigInt(amountIn || '0');
        const feeLamports = (amountBI * BigInt(fee.bps)) / 10000n;

        if (feeLamports > 0n && amountBI > feeLamports) {
            const payer = new PublicKey(walletAddress);
            const recipient = new PublicKey(fee.solanaRecipient);
            const blockhashConnection = getSolanaConnection();
            const { blockhash } = await blockhashConnection.getLatestBlockhash('finalized');

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

    if (fee.bps > 0 && fee.solanaRecipient && tokenInMint !== SOLANA_CONFIG.TOKENS.SOL) {
        const amountBI = BigInt(amountIn || '0');
        const feeAmount = (amountBI * BigInt(fee.bps)) / 10000n;

        if (feeAmount > 0n && amountBI > feeAmount) {
            const payer = new PublicKey(walletAddress);
            const recipient = new PublicKey(fee.solanaRecipient);
            const mint = new PublicKey(tokenInMint);

            const sourceAta = await getAssociatedTokenAddress(mint, payer);
            const destAta = await getAssociatedTokenAddress(mint, recipient);

            const connection = getSolanaConnection();
            const [sourceInfo, destInfo] = await Promise.all([
                connection.getAccountInfo(sourceAta, 'confirmed'),
                connection.getAccountInfo(destAta, 'confirmed'),
            ]);

            if (!sourceInfo) {
                throw new AppError(400, `Solana fee transfer failed: missing source ATA for mint ${tokenInMint}`, 'FEE_TRANSFER_FAILED');
            }

            const instructions: TransactionInstruction[] = [];

            if (!destInfo) {
                instructions.push(new TransactionInstruction({
                    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
                    keys: [
                        { pubkey: payer, isSigner: true, isWritable: true },
                        { pubkey: destAta, isSigner: false, isWritable: true },
                        { pubkey: recipient, isSigner: false, isWritable: false },
                        { pubkey: mint, isSigner: false, isWritable: false },
                        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                    ],
                    data: Buffer.alloc(0),
                }));
            }

            // SPL Token Transfer instruction (3) with u64 amount (little-endian)
            const data = Buffer.alloc(9);
            data[0] = 3;
            data.writeBigUInt64LE(feeAmount, 1);

            instructions.push(new TransactionInstruction({
                programId: TOKEN_PROGRAM_ID,
                keys: [
                    { pubkey: sourceAta, isSigner: false, isWritable: true },
                    { pubkey: destAta, isSigner: false, isWritable: true },
                    { pubkey: payer, isSigner: true, isWritable: false },
                ],
                data,
            }));

            const { blockhash } = await connection.getLatestBlockhash('finalized');
            const messageV0 = new TransactionMessage({
                payerKey: payer,
                recentBlockhash: blockhash,
                instructions,
            }).compileToV0Message();

            const feeTx = new VersionedTransaction(messageV0);
            const feeTxB64 = Buffer.from(feeTx.serialize()).toString('base64');

            logger.info(LogCode.EXE_TX_BROADCAST, 'SolanaExecutor: Charging platform fee (SPL)', {
                bps: fee.bps,
                amount: feeAmount.toString(),
                mint: tokenInMint,
                recipient: fee.solanaRecipient,
                createdAta: !destInfo,
            });

            await sendSolanaTransaction(userId, feeTxB64);

            effectiveAmountIn = (amountBI - feeAmount).toString();
        }
    }

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

    return signature;
}
