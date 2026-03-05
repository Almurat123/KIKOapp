
import { getSolanaConnection, SOLANA_CONFIG } from '../config/solanaConfig.js';
import { AppError } from '../middleware/errorHandler.js';
import { getSolanaSigningContext, sendSolanaTransactionWithContext } from './privyWallet.js';
import { getSolanaQuote, getSolanaQuoteFromAggregator, SolanaAggregator, type SolanaQuote } from './solanaSwap.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getLatestSolanaBlockhash } from './solana/blockhashProvider.js';
import type { ResolvedSolanaSigningContext } from './solana/solanaSigningContext.js';

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
    launchpadProvider?: 'pumpfun' | 'pumpswap' | 'bonkfun' | 'meteora' | 'zora' | 'fourmeme' | 'flap' | 'clanker' | 'virtuals' | 'doppler' | 'flaunch' | 'creatorbid';
    preferredAggregator?: Exclude<SolanaAggregator, 'auto'>;
}

export interface SolanaSwapExecutionResult {
    signature: string;
    quoteOutAmountBase?: string;
    quoteInAmountBase?: string;
    quoteAggregator?: SolanaQuote['aggregator'] | SolanaAggregator;
    quoteSlippageBps?: number;
    usedAmountInBase?: string;
}

type SolanaExecutorDeps = {
    getSolanaSigningContext: typeof getSolanaSigningContext;
    getSolanaQuote: typeof getSolanaQuote;
    getSolanaQuoteFromAggregator: typeof getSolanaQuoteFromAggregator;
    getSolanaConnection: typeof getSolanaConnection;
    deserializeTransaction: typeof VersionedTransaction.deserialize;
    sendSolanaTransactionWithContext: typeof sendSolanaTransactionWithContext;
    getLatestSolanaBlockhash: typeof getLatestSolanaBlockhash;
};

const defaultSolanaExecutorDeps: SolanaExecutorDeps = {
    getSolanaSigningContext,
    getSolanaQuote,
    getSolanaQuoteFromAggregator,
    getSolanaConnection,
    deserializeTransaction: VersionedTransaction.deserialize,
    sendSolanaTransactionWithContext,
    getLatestSolanaBlockhash,
};

function resolveSelectedAggregator(
    preferredAggregator: SolanaSwapParams['preferredAggregator'],
    executionMode: NonNullable<SolanaSwapParams['executionMode']>,
    launchpadProvider?: SolanaSwapParams['launchpadProvider']
): SolanaAggregator {
    if (launchpadProvider === 'meteora') return 'meteora';
    return preferredAggregator
        || (executionMode === 'turbo' || launchpadProvider === 'pumpswap' || launchpadProvider === 'pumpfun' ? 'jupiter' : 'auto');
}

function resolveJupiterDexFiltersForLaunchpad(
    launchpadProvider?: SolanaSwapParams['launchpadProvider']
): string[] | undefined {
    if (launchpadProvider === 'pumpfun' || launchpadProvider === 'pumpswap') {
        // Jupiter dex label for pAMM routes (label is case-sensitive in practice).
        // Keep aliases for compatibility across API variants.
        return ['Pump.fun Amm', 'Pump.fun AMM', 'Pump.fun'];
    }
    if (launchpadProvider === 'meteora') {
        return ['Meteora DLMM', 'Meteora'];
    }
    return undefined;
}

function applyCopyTradePriorityFee(quote: SolanaQuote | null, feeContext?: SolanaSwapParams['feeContext']): SolanaQuote | null {
    if (quote && feeContext === 'copyTrade') {
        quote.priorityFeeMaxLamports = 100000;
        quote.computeUnitPriceMicroLamports = quote.priorityFeeMaxLamports;
    }
    return quote;
}

function shouldRetryAlternativeRoute(error: any): boolean {
    const message = String(error?.message || error || '').toLowerCase();
    return (
        message.includes('0x1771') ||
        message.includes('transaction simulation failed') ||
        message.includes('custom program error') ||
        message.includes('slippage')
    );
}

async function executeSolanaSwapWithDepsDetailed(
    params: SolanaSwapParams,
    deps: SolanaExecutorDeps
): Promise<SolanaSwapExecutionResult> {
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
        return {
            signature: `5SimulatedSignature${Date.now()}${Math.random().toString(36).substring(7)}`
        };
    }

    // CRITICAL: Use the SAME wallet for building and signing!
    // Try user's delegated wallet first, fallback to server wallet
    const signingContext = await deps.getSolanaSigningContext(userId);
    const walletAddress = signingContext.address;
    logger.info(
        LogCode.SYS_INFO,
        `SolanaExecutor: Using signing context source=${signingContext.walletSource} reason=${signingContext.reasonCode} address=${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`,
        {
        address: walletAddress,
        walletSource: signingContext.walletSource,
        reasonCode: signingContext.reasonCode,
        }
    );

    logger.info(LogCode.EXE_TX_BROADCAST, 'SolanaExecutor: Executing Swap', { tokenInMint, tokenOutMint, amountIn });
    const blockhashConnection = deps.getSolanaConnection();

    // 1) Quote + send with adaptive aggregator fallback on simulation failures.
    const selectedAggregator = resolveSelectedAggregator(preferredAggregator, executionMode, launchpadProvider);
    const launchpadDexFilters = resolveJupiterDexFiltersForLaunchpad(launchpadProvider);
    const aggregatorCandidates: SolanaAggregator[] = selectedAggregator === 'auto'
        ? ['auto', 'meteora', 'raydium', 'jupiter']
        : [selectedAggregator];

    let signature = '';
    let lastError: any = null;
    let selectedQuote: SolanaQuote | null = null;
    let selectedAttemptAmount: string | undefined;
    let selectedAttemptSlippageBps: number | undefined;
    let selectedCandidateAggregator: SolanaAggregator | undefined;

    candidateLoop:
    for (let idx = 0; idx < aggregatorCandidates.length; idx++) {
        const candidate = aggregatorCandidates[idx];
        const baseSlippageBps = Math.min(slippageBps + (idx * 300), 3500);
        const maxSameAggregatorRetries = 1;

        let attemptAmount = amountIn;
        try {
            const amountBigInt = BigInt(amountIn);
            const reductionBps = idx === 0 ? 0n : idx === 1 ? 50n : idx === 2 ? 100n : 200n; // 0%, 0.5%, 1%, 2%
            const reduced = (amountBigInt * (10000n - reductionBps)) / 10000n;
            attemptAmount = reduced > 0n ? reduced.toString() : amountIn;
        } catch {
            attemptAmount = amountIn;
        }
        for (let retry = 0; retry <= maxSameAggregatorRetries; retry++) {
            const attemptSlippageBps = Math.min(baseSlippageBps + (retry * 250), 5000);
            let retryAmount = attemptAmount;
            if (retry > 0) {
                try {
                    const base = BigInt(attemptAmount);
                    const reduced = (base * 9950n) / 10000n; // additional 0.5% reduction on retry
                    retryAmount = reduced > 0n ? reduced.toString() : attemptAmount;
                } catch {
                    retryAmount = attemptAmount;
                }
            }

            const quote = candidate === 'auto'
                ? await deps.getSolanaQuote(
                    tokenInMint,
                    tokenOutMint,
                    retryAmount,
                    attemptSlippageBps,
                    'auto',
                    walletAddress,
                    undefined,
                    params.feeContext
                )
                : await deps.getSolanaQuoteFromAggregator(
                    candidate,
                    tokenInMint,
                    tokenOutMint,
                    retryAmount,
                    attemptSlippageBps,
                    walletAddress,
                    undefined,
                    params.feeContext,
                    {
                        forcePublicApi: executionMode === 'turbo',
                        dexes: candidate === 'jupiter' ? launchpadDexFilters : undefined,
                    }
                );

            const adjustedQuote = applyCopyTradePriorityFee(quote, params.feeContext);
            if (!adjustedQuote) {
                lastError = new AppError(400, `Solana quote unavailable for aggregator=${candidate}`, 'QUOTE_FAILED');
                continue;
            }
            if (!adjustedQuote.swapTransaction) {
                lastError = new AppError(500, `Solana swap tx missing for aggregator=${candidate}`, 'SWAP_BUILD_FAILED');
                continue;
            }

            logger.debug(LogCode.SYS_INFO, 'SolanaExecutor: Swap prepared', {
                aggregator: adjustedQuote.aggregator,
                outAmount: adjustedQuote.outAmount,
                attempt: idx + 1,
                candidate,
                attemptSlippageBps,
                attemptAmount: retryAmount,
                retry
            });

                try {
                const transactionBuffer = Buffer.from(adjustedQuote.swapTransaction, 'base64');
                const transaction = deps.deserializeTransaction(transactionBuffer);
                const blockhashResult = await deps.getLatestSolanaBlockhash(blockhashConnection, 'swap_executor');
                transaction.message.recentBlockhash = blockhashResult.blockhash;
                const freshTransactionBase64 = Buffer.from(transaction.serialize()).toString('base64');
                    signature = await deps.sendSolanaTransactionWithContext(userId, freshTransactionBase64, signingContext);
                    selectedQuote = adjustedQuote;
                    selectedAttemptAmount = retryAmount;
                    selectedAttemptSlippageBps = attemptSlippageBps;
                    selectedCandidateAggregator = candidate;
                    break candidateLoop;
                } catch (sendErr: any) {
                lastError = sendErr;
                const retryable = shouldRetryAlternativeRoute(sendErr);
                if (retryable && retry < maxSameAggregatorRetries) {
                    logger.warn(LogCode.EXE_TX_REVERTED, 'SolanaExecutor: route send failed, retrying same aggregator with relaxed params', {
                        candidate,
                        attempt: idx + 1,
                        retry,
                        nextSlippageBps: Math.min(baseSlippageBps + ((retry + 1) * 250), 5000),
                        error: sendErr?.message || String(sendErr)
                    });
                    continue;
                }

                if (idx < aggregatorCandidates.length - 1 && retryable) {
                    logger.warn(LogCode.EXE_TX_REVERTED, 'SolanaExecutor: route send failed, trying fallback aggregator', {
                        candidate,
                        nextCandidate: aggregatorCandidates[idx + 1],
                        attempt: idx + 1,
                        error: sendErr?.message || String(sendErr)
                    });
                    break;
                }
                throw sendErr;
            }
        }
    }

    if (!signature) {
        if (lastError) throw lastError;
        throw new AppError(400, 'Solana Swap Failed: No valid quotes found from Jupiter Metis/Swap, Raydium, or Meteora', 'QUOTE_FAILED');
    }

    logger.info(LogCode.EXE_TX_BROADCAST, 'SolanaExecutor: Transaction sent', { signature });

    // Fast path for copytrade/sniper: return immediately after broadcast.
    if (!waitForConfirmation) {
        return {
            signature,
            quoteOutAmountBase: selectedQuote?.outAmount,
            quoteInAmountBase: selectedQuote?.inAmount,
            quoteAggregator: selectedQuote?.aggregator || selectedCandidateAggregator,
            quoteSlippageBps: selectedAttemptSlippageBps,
            usedAmountInBase: selectedAttemptAmount
        };
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

    return {
        signature,
        quoteOutAmountBase: selectedQuote?.outAmount,
        quoteInAmountBase: selectedQuote?.inAmount,
        quoteAggregator: selectedQuote?.aggregator || selectedCandidateAggregator,
        quoteSlippageBps: selectedAttemptSlippageBps,
        usedAmountInBase: selectedAttemptAmount
    };
}

async function executeSolanaSwapWithDeps(
    params: SolanaSwapParams,
    deps: SolanaExecutorDeps
): Promise<string> {
    const result = await executeSolanaSwapWithDepsDetailed(params, deps);
    return result.signature;
}

export async function executeSolanaSwapWithResult(params: SolanaSwapParams): Promise<SolanaSwapExecutionResult> {
    return executeSolanaSwapWithDepsDetailed(params, defaultSolanaExecutorDeps);
}

export async function executeSolanaSwap(params: SolanaSwapParams): Promise<string> {
    const result = await executeSolanaSwapWithResult(params);
    return result.signature;
}

export const __solanaExecutorTest = {
    applyCopyTradePriorityFee,
    executeSolanaSwapWithDepsDetailed,
    executeSolanaSwapWithDeps,
    resolveSelectedAggregator,
};
