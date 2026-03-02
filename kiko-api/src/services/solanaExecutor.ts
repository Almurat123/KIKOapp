
import { getSolanaConnection, SOLANA_CONFIG } from '../config/solanaConfig.js';
import { AppError } from '../middleware/errorHandler.js';
import { getServerSolanaWalletAddress, sendSolanaTransaction, getDelegatedSolanaWallet } from './privyWallet.js';
import { getSolanaQuote, getSolanaQuoteFromAggregator, SolanaAggregator, type SolanaQuote } from './solanaSwap.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getLatestSolanaBlockhash } from './solana/blockhashProvider.js';

export interface SolanaSwapParams {
    userId: string;
    tokenInMint: string;
    tokenOutMint: string;
    amountIn: string; // Atomic units (lamports/etc)
    slippageBps?: number;
    feeContext?: 'swap' | 'copyTrade';
    accessToken?: string;
    waitForConfirmation?: boolean;
    executionMode?: 'safe' | 'normal' | 'turbo';
    launchpadProvider?: 'pumpfun' | 'pumpswap' | 'bonkfun' | 'zora' | 'fourmeme' | 'flap' | 'clanker' | 'virtuals' | 'doppler' | 'flaunch' | 'creatorbid';
    preferredAggregator?: Exclude<SolanaAggregator, 'auto'>;
}

type SolanaExecutorDeps = {
    getDelegatedSolanaWallet: typeof getDelegatedSolanaWallet;
    getServerSolanaWalletAddress: typeof getServerSolanaWalletAddress;
    getSolanaQuote: typeof getSolanaQuote;
    getSolanaQuoteFromAggregator: typeof getSolanaQuoteFromAggregator;
    getSolanaConnection: typeof getSolanaConnection;
    deserializeTransaction: typeof VersionedTransaction.deserialize;
    sendSolanaTransaction: typeof sendSolanaTransaction;
    getLatestSolanaBlockhash: typeof getLatestSolanaBlockhash;
};

const defaultSolanaExecutorDeps: SolanaExecutorDeps = {
    getDelegatedSolanaWallet,
    getServerSolanaWalletAddress,
    getSolanaQuote,
    getSolanaQuoteFromAggregator,
    getSolanaConnection,
    deserializeTransaction: VersionedTransaction.deserialize,
    sendSolanaTransaction,
    getLatestSolanaBlockhash,
};

function resolveSelectedAggregator(
    preferredAggregator: SolanaSwapParams['preferredAggregator'],
    executionMode: NonNullable<SolanaSwapParams['executionMode']>,
    launchpadProvider?: SolanaSwapParams['launchpadProvider']
): SolanaAggregator {
    return preferredAggregator
        || (executionMode === 'turbo' || launchpadProvider === 'pumpswap' ? 'jupiter' : 'auto');
}

function applyCopyTradePriorityFee(quote: SolanaQuote | null, feeContext?: SolanaSwapParams['feeContext']): SolanaQuote | null {
    if (quote && feeContext === 'copyTrade') {
        quote.priorityFeeMaxLamports = 100000;
        quote.computeUnitPriceMicroLamports = quote.priorityFeeMaxLamports;
    }
    return quote;
}

async function executeSolanaSwapWithDeps(
    params: SolanaSwapParams,
    deps: SolanaExecutorDeps
): Promise<string> {
    const {
        userId,
        tokenInMint,
        tokenOutMint,
        amountIn,
        slippageBps = 300,
        accessToken,
        waitForConfirmation = true,
        executionMode = 'normal',
        launchpadProvider,
        preferredAggregator
    } = params;

    // === SIMULATION MODE ===
    if (process.env.SIMULATION_MODE === 'true') {
        logger.info(LogCode.EXE_TX_BROADCAST, 'SolanaExecutor: SIMULATION MODE swap', { tokenOutMint });
        return `5SimulatedSignature${Date.now()}${Math.random().toString(36).substring(7)}`;
    }

    // CRITICAL: Use the SAME wallet for building and signing!
    // Try user's delegated wallet first, fallback to server wallet
    let walletAddress: string;
    const delegatedWallet = await deps.getDelegatedSolanaWallet(userId);
    if (delegatedWallet) {
        walletAddress = delegatedWallet.address;
        logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Using delegated wallet', { address: walletAddress });
    } else {
        walletAddress = await deps.getServerSolanaWalletAddress();
        logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Using server wallet', { address: walletAddress });
    }

    logger.info(LogCode.EXE_TX_BROADCAST, 'SolanaExecutor: Executing Swap', { tokenInMint, tokenOutMint, amountIn });
    const blockhashConnection = deps.getSolanaConnection();

    // 1. Get Quote & Transaction (mode-aware)
    // - turbo: single-route Jupiter Metis/Swap for lowest latency
    // - normal/safe: auto route comparison
    const selectedAggregator = resolveSelectedAggregator(preferredAggregator, executionMode, launchpadProvider);

    const quote = selectedAggregator === 'auto'
        ? await deps.getSolanaQuote(
            tokenInMint,
            tokenOutMint,
            amountIn,
            slippageBps,
            'auto',
            walletAddress,
            undefined,
            params.feeContext
        )
        : await deps.getSolanaQuoteFromAggregator(
            selectedAggregator,
            tokenInMint,
            tokenOutMint,
            amountIn,
            slippageBps,
            walletAddress,
            undefined,
            params.feeContext,
            // For turbo, keep the low-latency public Metis/Swap path explicit.
            executionMode === 'turbo' ? { forcePublicApi: true } : undefined
        );

    const adjustedQuote = applyCopyTradePriorityFee(quote, params.feeContext);

    if (!adjustedQuote) {
        throw new AppError(400, 'Solana Swap Failed: No valid quotes found from Jupiter Metis/Swap, Raydium, or Meteora', 'QUOTE_FAILED');
    }

    if (!adjustedQuote.swapTransaction) {
        throw new AppError(500, `Solana Swap Failed: Quote found from ${adjustedQuote.aggregator} but failed to build transaction`, 'SWAP_BUILD_FAILED');
    }

    logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Swap prepared', { aggregator: adjustedQuote.aggregator, outAmount: adjustedQuote.outAmount });

    // 2. Refresh Blockhash & Execute Transaction
    // CRITICAL: Raydium/Jupiter quotes might have stale blockhashes (TTL ~1min)
    // To prevent "Blockhash not found" errors, we deserialize and inject a FRESH blockhash
    logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Refreshing blockhash before sending');

    // We need to pass the base64 string to sendSolanaTransaction first
    // But since sendSolanaTransaction handles deserialization, we should modify it there or do it here.
    // Let's do it here for clarity and control:

    // Deserialize
    const transactionBuffer = Buffer.from(adjustedQuote.swapTransaction, 'base64');
    let transaction = deps.deserializeTransaction(transactionBuffer);

    // Fetch fresh blockhash
    const blockhashResult = await deps.getLatestSolanaBlockhash(blockhashConnection, 'swap_executor');
    logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Fresh blockhash obtained', {
        blockhash: blockhashResult.blockhash,
        commitmentUsed: blockhashResult.commitmentUsed,
        fallbackUsed: blockhashResult.fallbackUsed,
    });

    // Update blockhash
    transaction.message.recentBlockhash = blockhashResult.blockhash;

    // Reserialize to base64
    const freshTransactionBase64 = Buffer.from(transaction.serialize()).toString('base64');

    const signature = await deps.sendSolanaTransaction(userId, freshTransactionBase64);

    logger.info(LogCode.EXE_TX_BROADCAST, 'SolanaExecutor: Transaction sent', { signature });

    // Fast path for copytrade/sniper: return immediately after broadcast.
    if (!waitForConfirmation) {
        return signature;
    }

    // Alchemy HTTP RPC doesn't support WebSocket methods like signatureSubscribe
    const connection = deps.getSolanaConnection();
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

export async function executeSolanaSwap(params: SolanaSwapParams): Promise<string> {
    return executeSolanaSwapWithDeps(params, defaultSolanaExecutorDeps);
}

export const __solanaExecutorTest = {
    applyCopyTradePriorityFee,
    executeSolanaSwapWithDeps,
    resolveSelectedAggregator,
};
