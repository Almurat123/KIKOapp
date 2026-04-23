
import { ethers } from 'ethers';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { getChainConfig, getProvider } from '../../config/chainConfig.js';
import { sendTransaction, signTypedData } from '../privyWallet.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getBestQuote, QuoteResult } from '../quoteService.js';
import { getPlatformFee, isValidEvmAddress, FeeContext } from '../platformFeeService.js';
import { toWei } from '../zeroEx.js';
import { getDexPrice } from '../dexPriceService.js';
import { getTokenInfo } from '../tokenService.js';
import { executeSolanaSwapWithResult } from '../solanaExecutor.js';
import { walletService } from '../walletService.js';
import { SOLANA_CONFIG } from '../../config/solanaConfig.js';
import { NATIVE_TOKEN_ADDRESS, SOLANA_NATIVE_MINT, TOKEN_REGISTRY, isNativeToken } from '../../config/tokenRegistry.js';
import { handleSwapError } from './handleSwapError.js';
import { callRpc, getErc20Balance, getErc20Decimals, getErc20Allowance, getNativeBalance } from '../../services/rpcManager.js';
import { monitorEvmTransaction, scheduleSpeedUp, waitForReceipt, waitForTransactionConfirmation } from './confirmationCoordinator.js';
import { appendPermit2SignatureToCalldata, executeApproval, validatePermit2Payload } from './permitHelpers.js';
import type { OrderRuntimeContext } from '../order-runtime/types.js';
import { extendFailoverSendContext, type FailoverSendContext } from './failover/failoverSendContext.js';
import { scoreEvmSellReliability } from './reliability/evmSellReliabilityScorer.js';
import { emitCopytradeDomainAudit } from '../copytrade-v2/audit/copytradeDomainAudit.js';
import { resolveAdaptiveMinAnchorRatioBps } from '../dex/directSwap/domain/guards.js';
import type { CopytradeFallbackPricingGuardContext, QuoteDex } from '../MainSwapService.js';

// ⚡ In-process decimals cache: avoids repeated RPC calls for the same token
// Keyed by "chainId:tokenAddress" (lowercase). Decimals are immutable once deployed.
const ERC20_DECIMALS_PROCESS_CACHE = new Map<string, number>();
const DECIMALS_CACHE_MAX_SIZE = 5000;
function setCachedDecimals(chainId: number, address: string, decimals: number): void {
    if (ERC20_DECIMALS_PROCESS_CACHE.size >= DECIMALS_CACHE_MAX_SIZE) {
        // Evict oldest 500 entries when cache is full
        const keys = ERC20_DECIMALS_PROCESS_CACHE.keys();
        for (let i = 0; i < 500; i++) {
            const k = keys.next();
            if (k.done) break;
            ERC20_DECIMALS_PROCESS_CACHE.delete(k.value);
        }
    }
    ERC20_DECIMALS_PROCESS_CACHE.set(`${chainId}:${address.toLowerCase()}`, decimals);
}
function getCachedDecimals(chainId: number, address: string): number | undefined {
    return ERC20_DECIMALS_PROCESS_CACHE.get(`${chainId}:${address.toLowerCase()}`);
}
import { recordProviderReliabilityOutcome } from '../copytrade-v2/learning/quoteReliability.js';
import { resolveEthCopytradeFeePolicy } from '../copytrade-v2/eth/ethFeePolicy.js';
import { resolveEthCopytradeRelayPolicy } from '../copytrade-v2/eth/ethRelayPolicy.js';
import { setOrderMetadata } from '../order-runtime/context.js';
import { resolveTradeSendNonce } from './swapNoncePolicy.js';
import { getApprovalQuoteRefreshDelayMs, shouldRetryApprovalQuoteRefresh } from './approvalQuoteRefreshPolicy.js';
import { waitForApprovalReady, type ApprovalReadinessResult } from './approvalReadiness.js';
import { clearApprovalPreheatState, getApprovalPreheatState, upsertApprovalPreheatState } from './approvalPreheatState.js';
import { getSellQuotePreheatState, getUsableWarmSellQuote } from './sellQuotePreheatState.js';
import { getExecutionFeeSnapshot } from './executionFeeSnapshot.js';
import { shouldRetryPermit2AsAllowanceHolder, shouldUseSignedPermitForSell } from './permitFallbackPolicy.js';
import {
    getUsableNativeBalanceEvidence,
    nativeBalanceEvidenceToBigInt,
    type NativeBalanceEvidence,
} from './nativeBalanceEvidence.js';

// 0x AllowanceHolder address (Base). If a token already has sufficient allowance here,
// we can skip Permit2 first-try and reduce sell failure risk for problematic tokens.
const ZEROX_ALLOWANCE_HOLDER_BY_CHAIN: Record<number, string> = {
    8453: '0x0000000000001ff3684f28c67538d4d072c22734'
};
const KNOWN_PERMIT2_SPENDERS = new Set([
    '0x000000000022d473030f116ddee9f6b43ac78ba3',
    '0x000000000022d473030f116ddee9dad608d18000',
]);

export interface SwapParams {
    userId: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string; // Human readable (e.g. "0.1")
    chainId: number;
    slippageBps?: number;
    feeContext?: FeeContext;
    feeBpsOverride?: number;
    isSell?: boolean; // Explicit flag for SELL operations
    messageId?: string; // For WebSocket transaction progress updates
    excludeDex?: string; // Exclude this DEX from quote selection (for retry after failure)
    accessToken?: string; // User JWT for Privy user signer
    waitForConfirmation?: boolean; // Wait for on-chain confirmation before returning (for copytrade)
    confirmationTimeoutMs?: number; // Override confirmation wait timeout
    returnOnConfirmTimeout?: boolean; // If true, return success on timeout and monitor in background
    allowPostBroadcastRetry?: boolean; // If false, visible on-chain failures stop after the first broadcast attempt
    speedUpAfterMs?: number; // Attempt replacement if tx is still pending
    speedUpBumpBps?: number; // Gas bump in bps for replacement
    transferRetry?: boolean; // Internal: prevent repeat retry after transfer failure
    preferPermit2?: boolean; // Internal: force non-permit2 quote path on retry
    permit2ExecutionFallbackTried?: boolean; // Internal: avoid permit2 fallback loops
    executionMode?: 'safe' | 'normal' | 'turbo';
    disableTokenInfo?: boolean;
    mevProtection?: boolean;
    allowedDexes?: QuoteDex[];
    zeroExQuoteTimeoutMs?: number;
    preferredDexes?: QuoteDex[];
    /** Pre-warmed nonce promise (copy-trade path); when set, used for the swap tx to save one RPC round-trip. */
    preWarmedNonce?: Promise<string | undefined>;
    launchpadProvider?: 'pumpfun' | 'pumpswap' | 'bonkfun' | 'meteora' | 'zora' | 'fourmeme' | 'flap' | 'clanker' | 'virtuals' | 'doppler' | 'flaunch' | 'creatorbid';
    preferredSolanaAggregator?: 'jupiter' | 'raydium' | 'meteora';
    sourceAnchor?: {
        sourceTxHash?: string;
        sourceTokenIn?: string | null;
        sourceTokenOut?: string | null;
        sourceAmountIn?: string | null;
        sourceAmountOut?: string | null;
    };
    copytradeFallbackPricingGuard?: CopytradeFallbackPricingGuardContext;
    // CONTEXT MEMORY
    // Updated: 2026-04-13
    // Author: Mira Chen
    // Reason: Copytrade hot-path execution must not silently expand into broad wallet portfolio hydration or heavy token metadata fetches after upstream mode policy already selected turbo/no-token-info behavior.
    // Goal: SwapExecutor may consume fresh upstream native balance evidence and a scoped disable-token-info signal; it must keep turbo copytrade buy on a narrow address/decimals-only path.
    // Owns: Hot-path gas reserve adjustment and whether EVM execution resolves full token info versus address/decimals-only metadata.
    // Does Not Own: Copytrade guard admission policy, wallet portfolio display hydration, config-to-mode derivation, or external quote provider scoring.
    // Design Language:
    // - Native gas reserve is a single-balance read, not a portfolio read.
    // - Guard evidence is authoritative only when fresh and wallet/chain scoped.
    // - Turbo copytrade buy may skip tokenInfo only when an upstream owner explicitly passes the disable-token-info signal.
    // - Forbidden local patch patterns: broad walletService balance hydration or hybrid tokenInfo fetch inside turbo copytrade buy execution.
    // Document Provenance:
    // - Source: /Users/almurat/Downloads/logs.1775999977570.json
    // - Kind: runtime observation
    // - Retrieved: 2026-04-13
    // - Applied To: EVM native gas-reserve balance source and turbo copytrade buy token-info bypass
    // - Verification: verified in runtime logs and local reproduction
    // See also:
    // - system-journal/INDEX.md
    // - system-journal/design-language/copytrade-race-recovery.md
    // - system-journal/owner-map/backend-swap-validation.md
    // - system-journal/fix-log/2026-04-13-copytrade-native-balance-evidence.md
    // - system-journal/fix-log/2026-04-13-copytrade-turbo-tokeninfo-bypass.md
    nativeBalanceEvidence?: NativeBalanceEvidence;
    runtimeContext?: OrderRuntimeContext;
    failoverSendContext?: FailoverSendContext;
}

export interface SwapResult {
    success: boolean;
    txHash?: string;
    status?: 'SUCCESS' | 'ACTION_REQUIRED' | 'FAILED';
    finalityState?: 'confirmed_success' | 'retryable_unresolved' | 'confirmed_failed';
    amountOut?: string;
    error?: string;
    method: string;
    approvalTx?: {
        to: string;
        data: string;
        value: string;
        chainId: number;
    };
    metadata?: {
        allowanceTarget?: string;
        amountOutBase?: string;
        amountOutDecimals?: number;
    };
}

function evaluateCopytradeFallbackEntryDeviation(params: {
    guard: CopytradeFallbackPricingGuardContext;
    quote: QuoteResult;
    tokenOutDecimals: number;
}): {
    evaluated: boolean;
    fallbackExecutionPrice?: number;
    deviationBps?: number;
    rejected: boolean;
    rejectReason?: string;
} {
    const guard = params.guard;
    const referencePrice = Number(guard.referencePrice || 0);
    const inputValueUsd = Number(guard.inputValueUsd || 0);
    const maxEntryDeviationBps = Number(guard.maxEntryDeviationBps || 0);

    if (!(referencePrice > 0) || !(inputValueUsd > 0) || !(maxEntryDeviationBps > 0)) {
        return { evaluated: false, rejected: false };
    }

    const amountOutBase = BigInt(params.quote.amountOutBase || '0');
    if (amountOutBase <= 0n) {
        return {
            evaluated: true,
            rejected: true,
            rejectReason: 'quote_amount_out_unavailable',
        };
    }

    const amountOutHuman = Number(ethers.formatUnits(amountOutBase, params.tokenOutDecimals));
    if (!Number.isFinite(amountOutHuman) || amountOutHuman <= 0) {
        return {
            evaluated: true,
            rejected: true,
            rejectReason: 'quote_amount_out_invalid',
        };
    }

    const fallbackExecutionPrice = inputValueUsd / amountOutHuman;
    if (!Number.isFinite(fallbackExecutionPrice) || fallbackExecutionPrice <= 0) {
        return {
            evaluated: true,
            rejected: true,
            rejectReason: 'fallback_execution_price_invalid',
        };
    }

    const deviationBps = Math.abs(fallbackExecutionPrice - referencePrice) / referencePrice * 10000;
    if (!Number.isFinite(deviationBps)) {
        return {
            evaluated: true,
            rejected: true,
            rejectReason: 'fallback_deviation_invalid',
        };
    }

    if (deviationBps > maxEntryDeviationBps && !guard.allowUnreliablePriceBypass) {
        return {
            evaluated: true,
            fallbackExecutionPrice,
            deviationBps,
            rejected: true,
            rejectReason: 'entry_deviation_exceeded',
        };
    }

    return {
        evaluated: true,
        fallbackExecutionPrice,
        deviationBps,
        rejected: false,
    };
}

type ApprovalBoundExecutionDecision = {
    quoteToExecute: QuoteResult;
    refreshApplied: boolean;
    refreshFailureCode?: string;
    mustAbortExecution?: boolean;
};

const EXECUTION_REF_PRICE_TIMEOUT_MS = Math.max(
    150,
    Number(process.env.SWAP_EXECUTION_REF_PRICE_TIMEOUT_MS || '900')
);

function isPermit2Quote(quote: QuoteResult | null | undefined): boolean {
    if (!quote) return false;
    const allowanceTarget = String(quote.allowanceTarget || '').toLowerCase();
    const permit2Spender = String(quote.permit2Spender || '').toLowerCase();
    return quote.approvalKind === 'permit2_24h'
        || quote.requiresTypedSignature === true
        || Boolean(quote.permit2Payload)
        || KNOWN_PERMIT2_SPENDERS.has(allowanceTarget)
        || KNOWN_PERMIT2_SPENDERS.has(permit2Spender);
}

function requiresExplicitApprovalQuote(params: {
    chainId: number;
    quote: QuoteResult | null | undefined;
    preferPermit2: boolean;
}): boolean {
    if (params.preferPermit2) return false;
    if (String(params.quote?.dex || '').toLowerCase() !== '0x') return false;
    if (isPermit2Quote(params.quote)) return true;

    const expectedAllowanceTarget = String(ZEROX_ALLOWANCE_HOLDER_BY_CHAIN[params.chainId] || '').toLowerCase();
    const actualAllowanceTarget = String(params.quote?.allowanceTarget || '').toLowerCase();
    return Boolean(expectedAllowanceTarget && actualAllowanceTarget && expectedAllowanceTarget !== actualAllowanceTarget);
}

function finalizeApprovedSellQuote(params: {
    originalQuote: QuoteResult;
    refreshedQuote: QuoteResult | null;
}): ApprovalBoundExecutionDecision {
    const { originalQuote, refreshedQuote } = params;
    if (!refreshedQuote || !refreshedQuote.to || !refreshedQuote.data) {
        return {
            quoteToExecute: originalQuote,
            refreshApplied: false,
            refreshFailureCode: 'fresh_quote_missing_after_approval',
        };
    }

    if (String(refreshedQuote.dex || '').toLowerCase() !== String(originalQuote.dex || '').toLowerCase()) {
        return {
            quoteToExecute: originalQuote,
            refreshApplied: false,
            refreshFailureCode: 'fresh_quote_dex_changed_after_approval',
        };
    }

    const originalAllowanceTarget = String(originalQuote.allowanceTarget || '').toLowerCase();
    const refreshedAllowanceTarget = String(refreshedQuote.allowanceTarget || '').toLowerCase();
    if (originalAllowanceTarget && refreshedAllowanceTarget && originalAllowanceTarget !== refreshedAllowanceTarget) {
        return {
            quoteToExecute: originalQuote,
            refreshApplied: false,
            refreshFailureCode: 'fresh_quote_allowance_changed_after_approval',
            mustAbortExecution: true,
        };
    }

    return {
        quoteToExecute: refreshedQuote,
        refreshApplied: true,
    };
}

function shouldSkipCopytradeTokenInfoHotPath(params: Pick<SwapParams, 'feeContext' | 'disableTokenInfo' | 'isSell'>): boolean {
    return params.feeContext === 'copyTrade'
        && params.disableTokenInfo === true
        && params.isSell !== true;
}

function isInteractiveWalletSwap(params: Pick<SwapParams, 'feeContext' | 'runtimeContext'>): boolean {
    const mode = String(params.runtimeContext?.mode || '').trim().toLowerCase();
    return params.feeContext === 'swap'
        && (mode === 'swap-card' || mode === 'allowance' || mode === 'fast-swap');
}

async function withSoftTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
    return await Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
}

/**
 * Unified Swap Executor
 * Handles both EVM and Solana swaps with robust error handling and gas management.
 */
export class SwapExecutor {

    /**
     * Execute a swap with full lifecycle management
     */
    static async execute(params: SwapParams): Promise<SwapResult> {
        const { userId, walletAddress, tokenIn, tokenOut, amountIn, chainId, isSell } = params;
        const logContext = { userId, chainId, tokenIn, tokenOut, amount: amountIn };

        logger.info(LogCode.EXE_TX_BROADCAST, 'Initiating Unified Swap Execution', logContext);

        try {
            // 1. Validation
            if (!tokenIn || !tokenOut || tokenIn === tokenOut) {
                throw new Error('Invalid token pair');
            }

            // 2. Route by Chain Family
            const chainConfig = getChainConfig(chainId);
            const isSolana = chainId === SOLANA_CONFIG.CHAIN_ID;

            if (isSolana) {
                return await this.executeSolana(params);
            } else {
                // 3. Pre-check Balance
                await this.preCheckBalance(params);
                return await this.executeEvm(params);
            }

        } catch (error: any) {
            logger.error(LogCode.EXE_TX_REVERTED, 'Swap Execution Failed', { ...logContext, error: error.message });
            return {
                success: false,
                error: handleSwapError(error),
                method: 'failed'
            };
        }
    }

    /**
     * Handle EVM Swaps (Ethereum, Base, BSC, etc.)
     */
    private static async executeEvm(params: SwapParams): Promise<SwapResult> {
        const { userId, walletAddress, tokenIn, tokenOut, amountIn, chainId, slippageBps: requestedSlippage, feeContext } = params;
        const isCopytradeSellHotPath = feeContext === 'copyTrade' && (params.isSell === true || !tokenOut);
        const skipCopytradeTokenInfoHotPath = shouldSkipCopytradeTokenInfoHotPath(params);
        const skipWalletTokenInfoHotPath = isInteractiveWalletSwap({
            feeContext,
            runtimeContext: params.runtimeContext,
        });

        // 1. Resolve Token Addresses & Metadata
        const resolveToken = async (token: string) => {
            if (!token) return '';
            const isNative = isNativeToken(token, chainId);
            if (isNative) {
                return chainId === SOLANA_CONFIG.CHAIN_ID ? SOLANA_NATIVE_MINT : NATIVE_TOKEN_ADDRESS;
            }
            if (isCopytradeSellHotPath && ethers.isAddress(token)) {
                return ethers.getAddress(token);
            }
            if (skipCopytradeTokenInfoHotPath && ethers.isAddress(token)) {
                return ethers.getAddress(token);
            }
            if (skipWalletTokenInfoHotPath && ethers.isAddress(token)) {
                return ethers.getAddress(token);
            }
            const info = await getTokenInfo(token, chainId);
            return info?.address || token;
        };
        const [resolvedTokenIn, resolvedTokenOut] = await Promise.all([
            resolveToken(tokenIn),
            resolveToken(tokenOut)
        ]);
        const actualTokenIn = resolvedTokenIn;
        let actualTokenOut = resolvedTokenOut;

        if (params.isSell && !tokenOut) {
            actualTokenOut = chainId === SOLANA_CONFIG.CHAIN_ID ? SOLANA_NATIVE_MINT : NATIVE_TOKEN_ADDRESS;
        }

        const isNativeIn = isNativeToken(actualTokenIn, chainId);
        const actualTokenInFixed = isNativeIn && chainId !== SOLANA_CONFIG.CHAIN_ID ? NATIVE_TOKEN_ADDRESS : actualTokenIn;
        const actualTokenOutFixed = actualTokenOut;
        const isNativeOut = isNativeToken(actualTokenOutFixed, chainId);
        const isSellTx = params.isSell ?? (isNativeOut && !isNativeIn);
        // Use user's requested slippage or a sensible default.
        // 10% for buys, 15% for sells (sells face higher price impact / approval delays).
        const slippageBps = requestedSlippage ?? (isSellTx ? 1500 : 1000);
        const isSellForFee = isSellTx;

        if (skipCopytradeTokenInfoHotPath || skipWalletTokenInfoHotPath) {
            logger.info(LogCode.SYS_INFO, 'Swap token-info bypass enabled for latency-sensitive path', {
                chainId,
                tokenIn: actualTokenInFixed,
                tokenOut: actualTokenOutFixed,
                reason: skipWalletTokenInfoHotPath ? 'interactive_wallet_swap' : 'turbo_copytrade_buy',
            });
        }

        const [tokenInInfo, tokenOutInfo] = await Promise.all([
            skipCopytradeTokenInfoHotPath || skipWalletTokenInfoHotPath
                ? Promise.resolve(isNativeIn ? { decimals: 18 } : null)
                : isCopytradeSellHotPath
                ? Promise.resolve(null)
                : getTokenInfo(actualTokenInFixed, chainId, { verbose: false }),
            isNativeOut || isCopytradeSellHotPath || skipCopytradeTokenInfoHotPath || skipWalletTokenInfoHotPath
                ? Promise.resolve(isNativeOut ? { decimals: 18 } : null)
                : getTokenInfo(actualTokenOutFixed, chainId, { verbose: false }),
        ]);

        // SAFETY: Detect incorrect cached decimals for USDC/USDT (often cached as 18 but are 6)
        // This forces the logic below to fetch true decimals from chain
        if (tokenInInfo?.decimals === 18 &&
            ['USDC', 'USDT'].includes(tokenInInfo?.symbol?.toUpperCase() || '')) {
            logger.warn(LogCode.SYS_INFO, 'Suspicious 18 decimals for stablecoin, forcing chain fetch', { token: actualTokenInFixed, symbol: tokenInInfo.symbol });
            if (tokenInInfo) tokenInInfo.decimals = undefined as any;
        }

        let decimalsIn = tokenInInfo?.decimals;
        if (typeof decimalsIn !== 'number') {
            // Check in-process cache before going to RPC
            const cached = isNativeIn ? undefined : getCachedDecimals(chainId, actualTokenInFixed);
            if (typeof cached === 'number') {
                decimalsIn = cached;
            } else {
                try {
                    if (isNativeIn) {
                        decimalsIn = 18;
                    } else {
                        decimalsIn = await getErc20Decimals(actualTokenInFixed, chainId, 'latest', { lane: 'critical' });
                        setCachedDecimals(chainId, actualTokenInFixed, decimalsIn);
                        logger.info(LogCode.SYS_INFO, 'Fetched missing decimals on-chain', { token: actualTokenInFixed, decimals: decimalsIn });
                    }
                } catch (e: any) {
                    // ⚡ TURBO FALLBACK: If RPC is down and this is a standard ERC20 (not stablecoin),
                    // fall back to 18 decimals rather than hard-aborting the swap.
                    // 99%+ of new tokens use 18 decimals; stablecoins are pre-cached in TOKEN_REGISTRY.
                    const isKnownStablecoin = ['USDC', 'USDT'].includes(tokenInInfo?.symbol?.toUpperCase() || '');
                    if (!isKnownStablecoin) {
                        decimalsIn = 18;
                        logger.warn(LogCode.SYS_ERROR, 'tokenIn decimals RPC failed — falling back to 18 (turbo safe default)', {
                            token: actualTokenInFixed,
                            chainId,
                            error: e?.message?.slice(0, 80) || String(e)
                        });
                    } else {
                        logger.error(LogCode.SYS_ERROR, 'Failed to fetch tokenIn decimals from chain; aborting swap', {
                            token: actualTokenInFixed,
                            chainId,
                            error: e?.message || String(e)
                        });
                        throw new AppError(400, `token_metadata_unavailable:tokenIn_decimals:${actualTokenInFixed}`, 'TOKEN_METADATA_UNAVAILABLE');
                    }
                }
            }
        } else {
            // Store tokenInfo decimals in process cache for future RPC-miss scenarios
            if (!isNativeIn) setCachedDecimals(chainId, actualTokenInFixed, decimalsIn);
        }
        let decimalsOut = tokenOutInfo?.decimals;
        // SAFETY: Detect incorrect cached decimals for USDC/USDT (often cached as 18 but are 6)
        if (decimalsOut === 18 &&
            ['USDC', 'USDT'].includes(tokenOutInfo?.symbol?.toUpperCase() || '')) {
            logger.warn(LogCode.SYS_INFO, 'Suspicious 18 decimals for stablecoin (tokenOut), forcing 6', {
                token: actualTokenOutFixed,
                symbol: tokenOutInfo?.symbol
            });
            decimalsOut = 6;
        }
        if (typeof decimalsOut !== 'number') {
            // Check in-process cache before going to RPC
            const cachedOut = isNativeOut ? undefined : getCachedDecimals(chainId, actualTokenOutFixed);
            if (typeof cachedOut === 'number') {
                decimalsOut = cachedOut;
            } else {
                try {
                    if (isNativeOut) {
                        decimalsOut = 18;
                    } else {
                        decimalsOut = await getErc20Decimals(actualTokenOutFixed, chainId, 'latest', { lane: 'critical' });
                        setCachedDecimals(chainId, actualTokenOutFixed, decimalsOut);
                        logger.info(LogCode.SYS_INFO, 'Fetched missing tokenOut decimals on-chain', { token: actualTokenOutFixed, decimals: decimalsOut });
                    }
                } catch (e: any) {
                    // ⚡ TURBO FALLBACK: same logic as tokenIn — fall back to 18 for non-stablecoins
                    const isKnownStablecoin = ['USDC', 'USDT'].includes(tokenOutInfo?.symbol?.toUpperCase() || '');
                    if (!isKnownStablecoin) {
                        decimalsOut = 18;
                        logger.warn(LogCode.SYS_ERROR, 'tokenOut decimals RPC failed — falling back to 18 (turbo safe default)', {
                            token: actualTokenOutFixed,
                            chainId,
                            error: e?.message?.slice(0, 80) || String(e)
                        });
                    } else {
                        logger.error(LogCode.SYS_ERROR, 'Failed to fetch tokenOut decimals from chain; aborting swap', {
                            token: actualTokenOutFixed,
                            chainId,
                            error: e?.message || String(e)
                        });
                        throw new AppError(400, `token_metadata_unavailable:tokenOut_decimals:${actualTokenOutFixed}`, 'TOKEN_METADATA_UNAVAILABLE');
                    }
                }
            }
        } else {
            // Store tokenInfo decimals in process cache for future RPC-miss scenarios
            if (!isNativeOut) setCachedDecimals(chainId, actualTokenOutFixed, decimalsOut);
        }

        // 1.5 Gas Reservation for Native Token
        let amountInHuman = amountIn;
        let amountInBase = toWei(amountInHuman, decimalsIn);
        if (isNativeIn) {
            try {
                const usableNativeBalanceEvidence = getUsableNativeBalanceEvidence({
                    evidence: params.nativeBalanceEvidence,
                    chainId,
                    walletAddress,
                });
                const balanceBigInt = usableNativeBalanceEvidence
                    ? nativeBalanceEvidenceToBigInt(usableNativeBalanceEvidence)
                    : BigInt(await getNativeBalance(walletAddress, chainId, 'latest', { lane: 'critical' }));
                const amountInBigInt = BigInt(amountInBase);

                const config = getChainConfig(chainId);
                const reserveStr = config.gasReserve || '0.01';
                const reserve = ethers.parseEther(reserveStr);

                if (amountInBigInt >= balanceBigInt - (reserve / BigInt(2))) {
                    const newAmountIn = balanceBigInt - reserve;
                    if (newAmountIn <= BigInt(0)) throw new Error(`Insufficient ${config.name.toUpperCase()} for gas reserve (${reserveStr})`);
                    amountInBase = newAmountIn.toString();
                    amountInHuman = ethers.formatEther(newAmountIn);
                    logger.info(LogCode.SYS_INFO, 'Gas Reserve Applied', { chain: config.name.toLowerCase(), reserve: reserveStr, newAmount: ethers.formatEther(newAmountIn) });
                }
            } catch (err: any) {
                logger.warn(LogCode.SYS_ERROR, 'Gas reserve check failed', { error: err.message });
                // Continue with original amount if balance check fails
            }
        } else {
            // For ERC20 sells, ensure amountInBase does not exceed on-chain balance.
            // Sell retries must keep the same user-visible amount; do not shrink the amount
            // here to manufacture a higher success rate or leave deterministic leftovers.
            try {
                const balanceBigInt = await getErc20Balance(actualTokenInFixed, walletAddress, chainId, 'latest', { lane: 'critical' });
                const amountInBigInt = BigInt(amountInBase);
                if (amountInBigInt > balanceBigInt) {
                    amountInBase = balanceBigInt.toString();
                    amountInHuman = ethers.formatUnits(balanceBigInt, decimalsIn);
                    logger.warn(LogCode.SYS_INFO, 'Adjusted amountIn to on-chain balance', {
                        token: actualTokenInFixed,
                        amountIn: amountInHuman
                    });
                }
            } catch (err: any) {
                logger.warn(LogCode.SYS_ERROR, 'ERC20 balance check failed', { error: err.message });
            }
        }

        // 2. Get Best Quote
        const fee = getPlatformFee(feeContext || 'swap', params.feeBpsOverride);
        const affiliateFee = fee.bps > 0 && isValidEvmAddress(fee.evmRecipient)
            ? { affiliateAddress: fee.evmRecipient!, buyTokenPercentageFeeBps: fee.bps }
            : undefined;

        // 2.5 Fetch token prices for price impact calculation
        let refPrice: number | null = null;
        const skipRefPriceFetch =
            (params.executionMode === 'turbo' && feeContext === 'copyTrade')
            || skipWalletTokenInfoHotPath;
        if (!skipRefPriceFetch) {
            try {
                const [tokenInPrice, tokenOutPrice] = await Promise.all([
                    withSoftTimeout(getDexPrice(actualTokenInFixed, chainId), EXECUTION_REF_PRICE_TIMEOUT_MS),
                    withSoftTimeout(getDexPrice(actualTokenOutFixed, chainId), EXECUTION_REF_PRICE_TIMEOUT_MS)
                ]);

                if (tokenInPrice && tokenOutPrice && tokenOutPrice > 0) {
                    // refPrice = how many tokenOut you get per 1 tokenIn (based on market price)
                    refPrice = tokenInPrice / tokenOutPrice;
                    logger.debug(LogCode.SYS_INFO, 'SwapExecutor: refPrice calculated', {
                        tokenInPrice, tokenOutPrice, refPrice
                    });
                } else {
                    logger.info(LogCode.SYS_INFO, '[SwapExecutor] Ref price fetch skipped after execution timeout budget', {
                        chainId,
                        tokenIn: actualTokenInFixed,
                        tokenOut: actualTokenOutFixed,
                        timeoutMs: EXECUTION_REF_PRICE_TIMEOUT_MS
                    });
                }
            } catch (priceErr: any) {
                logger.warn(LogCode.SYS_ERROR, 'SwapExecutor: Failed to fetch token prices for impact calc', {
                    error: priceErr.message
                });
                // Continue without refPrice - impact calc will fall back to 0
            }
        } else {
            logger.info(LogCode.SYS_INFO, '[SwapExecutor] Skipping refPrice fetch on latency-sensitive path', {
                reason: skipWalletTokenInfoHotPath ? 'interactive_wallet_swap' : 'turbo_copytrade'
            });
        }

        const sellReliability = scoreEvmSellReliability({
            chainId,
            isSellTx,
            tokenInRequiresApproval: !isNativeIn,
            waitForConfirmation: params.waitForConfirmation,
            runtimeContext: params.runtimeContext
        });
        const sellQuotePreheatState = feeContext === 'copyTrade' && isSellForFee
            ? await getSellQuotePreheatState({
                chainId,
                walletAddress,
                tokenAddress: actualTokenInFixed,
            }).catch(() => null)
            : null;
        const warmedQuote = feeContext === 'copyTrade' && isSellForFee
            ? getUsableWarmSellQuote({
                state: sellQuotePreheatState,
                amountInBase,
            })
            : null;
        const preheatedProviderOrder = sellQuotePreheatState?.preferredDexes?.length
            ? sellQuotePreheatState.preferredDexes
            : params.preferredDexes;
        const sellQuotePolicy = feeContext === 'copyTrade' && isSellForFee
            ? 'first_executable'
            : 'fast_window';
        const zeroExQuoteTimeoutMs = feeContext === 'copyTrade' && isSellForFee
            ? Math.min(Number(params.zeroExQuoteTimeoutMs || 1200), 1200)
            : params.zeroExQuoteTimeoutMs;

        let preferPermit2 = params.preferPermit2 !== false && sellReliability.preferPermit2;
        if (preferPermit2 && !isNativeIn) {
            const holder = ZEROX_ALLOWANCE_HOLDER_BY_CHAIN[chainId];
            if (holder) {
                try {
                    const existingAllowance = await getErc20Allowance(actualTokenInFixed, walletAddress, holder, chainId, 'latest', { lane: 'critical' });
                    if (existingAllowance >= BigInt(amountInBase)) {
                        preferPermit2 = false;
                        logger.info(LogCode.SYS_INFO, 'Detected sufficient 0x allowance-holder allowance; bypassing permit2 for ERC20 input', {
                            chainId,
                            token: actualTokenInFixed,
                            spender: holder
                        });
                    }
                } catch (allowanceErr: any) {
                    logger.warn(LogCode.SYS_ERROR, 'Failed to check 0x allowance-holder allowance; keep current approval preference', {
                        chainId,
                        token: actualTokenInFixed,
                        error: allowanceErr?.message || String(allowanceErr)
                    });
                }
            }
        } else if (params.preferPermit2 !== false && !isNativeIn && !sellReliability.preferPermit2) {
            logger.info(LogCode.SYS_INFO, 'Approval policy disabled permit2 preference for ERC20 input', {
                chainId,
                token: actualTokenInFixed,
                reasonCode: sellReliability.reasonCode || 'sell_reliability_explicit_approval'
            });
        }

        const quoteParams = {
            tokenIn: actualTokenInFixed,
            tokenOut: actualTokenOutFixed,
            actualTokenIn: actualTokenInFixed,
            actualTokenOut: actualTokenOutFixed,
            amountInBase,
            amountInHuman: parseFloat(amountInHuman),
            tokenInDecimals: decimalsIn,
            tokenOutDecimals: decimalsOut,
            chainId,
            slippageBps,
            userAddress: walletAddress,
            affiliateFee,
            refPrice,
            excludeDex: params.excludeDex,
            feeContext,
            isSell: isSellForFee,
            executionMode: params.executionMode,
            preferPermit2,
            sellQuotePolicy,
            allowedDexes: params.allowedDexes,
            zeroExQuoteTimeoutMs,
            preferredDexes: preheatedProviderOrder,
        } satisfies Parameters<typeof getBestQuote>[0];

        let best = warmedQuote
            ? { ...warmedQuote }
            : (await getBestQuote(quoteParams)).best;
        const initialQuoteWasPrewarmed = !!warmedQuote;

        if (!best) {
            throw new Error('No valid quotes found');
        }

        if (initialQuoteWasPrewarmed) {
            logger.info(LogCode.SYS_INFO, '[SwapExecutor] Reusing exact-match prewarmed sell quote', {
                chainId,
                token: actualTokenInFixed,
                dex: best.dexName,
                amountInBase
            });
        }

        if (!isNativeIn && requiresExplicitApprovalQuote({
            chainId,
            quote: best,
            preferPermit2,
        })) {
            const expectedAllowanceTarget = ZEROX_ALLOWANCE_HOLDER_BY_CHAIN[chainId] || null;
            logger.warn(LogCode.SYS_INFO, 'Confirmed sell received non-explicit 0x approval quote; forcing allowance-holder requote', {
                chainId,
                currentApprovalKind: best.approvalKind || null,
                currentAllowanceTarget: best.allowanceTarget || null,
                expectedAllowanceTarget,
                currentPermit2Spender: best.permit2Spender || null,
            });

            const { best: explicitApprovalQuote } = await getBestQuote({
                ...quoteParams,
                preferPermit2: false,
                skipCache: true,
            });
            if (!explicitApprovalQuote) {
                throw new Error('Could not obtain an explicit approval quote for this sell. No swap transaction was sent.');
            }
            if (requiresExplicitApprovalQuote({
                chainId,
                quote: explicitApprovalQuote,
                preferPermit2: false,
            })) {
                throw new Error('Quote changed after approval policy enforcement. No swap transaction was sent. Please retry the swap.');
            }

            best = explicitApprovalQuote;
            logger.info(LogCode.SYS_INFO, 'Using explicit approval quote for confirmed sell', {
                chainId,
                allowanceTarget: best.allowanceTarget || null,
                approvalKind: best.approvalKind || null,
                dex: best.dexName,
            });
        }

        const canonicalAnchorToken = (token: string | null | undefined): string => {
            const value = String(token || '').toLowerCase();
            if (!value) return '';
            if (isNativeToken(value, chainId) || value === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
                return getChainConfig(chainId).wrappedNativeAddress.toLowerCase();
            }
            return value;
        };
        let anchorRatioBps: number | null = null;
        const sourceAnchor = params.sourceAnchor;
        if (feeContext === 'copyTrade' && sourceAnchor?.sourceAmountIn && sourceAnchor?.sourceAmountOut) {
            try {
                const sourceAmountInBase = BigInt(sourceAnchor.sourceAmountIn);
                const sourceAmountOutBase = BigInt(sourceAnchor.sourceAmountOut);
                const amountInBaseBig = BigInt(amountInBase);
                const quotedOutBase = BigInt(best.amountOutBase || '0');
                const sourcePairMatches =
                    canonicalAnchorToken(sourceAnchor.sourceTokenIn) === canonicalAnchorToken(actualTokenInFixed)
                    && canonicalAnchorToken(sourceAnchor.sourceTokenOut) === canonicalAnchorToken(actualTokenOutFixed);
                if (sourcePairMatches && sourceAmountInBase > 0n && sourceAmountOutBase > 0n && amountInBaseBig > 0n) {
                    const expectedOutFromSource = (sourceAmountOutBase * amountInBaseBig) / sourceAmountInBase;
                    if (expectedOutFromSource > 0n && quotedOutBase > 0n) {
                        anchorRatioBps = Number((quotedOutBase * 10000n) / expectedOutFromSource);
                        const configuredMinAnchorRatioBps = Math.max(1, Number(process.env.COPYTRADE_SOURCE_ANCHOR_MIN_RATIO_BPS || '7000'));
                        const adaptiveMin = resolveAdaptiveMinAnchorRatioBps({
                            configuredMinAnchorRatioBps,
                            sourceAmountIn: sourceAmountInBase,
                            requestAmountIn: amountInBaseBig
                        });
                        const minAnchorRatioBps = adaptiveMin.effectiveMinAnchorRatioBps;
                        logger.info(LogCode.SYS_INFO, '[SwapExecutor] Source anchor quote check', {
                            sourceTxHash: sourceAnchor.sourceTxHash || null,
                            provider: best.dex,
                            sourceAmountInBase: sourceAmountInBase.toString(),
                            sourceAmountOutBase: sourceAmountOutBase.toString(),
                            requestAmountInBase: amountInBaseBig.toString(),
                            quotedOutBase: quotedOutBase.toString(),
                            expectedOutFromSource: expectedOutFromSource.toString(),
                            anchorRatioBps,
                            configuredMinAnchorRatioBps,
                            minAnchorRatioBps,
                            amountScaleBps: adaptiveMin.amountScaleBps,
                            adaptiveMinApplied: adaptiveMin.adaptiveApplied
                        });
                        if (anchorRatioBps < minAnchorRatioBps) {
                            await recordProviderReliabilityOutcome({
                                chainId,
                                tokenIn: actualTokenInFixed,
                                tokenOut: actualTokenOutFixed,
                                provider: best.dex,
                                anchorRatioBps,
                                accepted: false
                            }).catch(() => { });
                            throw new AppError(
                                400,
                                `quote_anchor_guard_reject:${best.dex}:${anchorRatioBps}:${minAnchorRatioBps}`,
                                'QUOTE_ANCHOR_GUARD_REJECT'
                            );
                        }
                    }
                }
            } catch (anchorErr: any) {
                if (anchorErr instanceof AppError) throw anchorErr;
                logger.warn(LogCode.SYS_ERROR, '[SwapExecutor] Source anchor check skipped', {
                    error: anchorErr?.message || String(anchorErr),
                    sourceTxHash: sourceAnchor?.sourceTxHash || null
                });
            }
        }
        const reportAnchorAcceptance = () => {
            if (anchorRatioBps === null) return;
            void recordProviderReliabilityOutcome({
                chainId,
                tokenIn: actualTokenInFixed,
                tokenOut: actualTokenOutFixed,
                provider: best.dex,
                anchorRatioBps,
                accepted: true
            }).catch(() => { });
        };

        const fallbackPricingGuard = params.copytradeFallbackPricingGuard;
        if (feeContext === 'copyTrade' && fallbackPricingGuard?.stage === '0x_fallback' && best.dex === '0x') {
            const fallbackEntryCheck = evaluateCopytradeFallbackEntryDeviation({
                guard: fallbackPricingGuard,
                quote: best,
                tokenOutDecimals: decimalsOut,
            });
            if (fallbackEntryCheck.evaluated) {
                logger.info(LogCode.SYS_INFO, '[SwapExecutor] Copytrade 0x fallback price guard', {
                    sourceTxHash: sourceAnchor?.sourceTxHash || null,
                    provider: best.dex,
                    targetExecutionPrice: fallbackPricingGuard.targetExecutionPrice || null,
                    referencePrice: fallbackPricingGuard.referencePrice || null,
                    referencePriceSource: fallbackPricingGuard.referencePriceSource || 'reference_unavailable',
                    fallbackExecutionPrice: fallbackEntryCheck.fallbackExecutionPrice || null,
                    deviationBps: fallbackEntryCheck.deviationBps || null,
                    maxEntryDeviationBps: fallbackPricingGuard.maxEntryDeviationBps || null,
                    thresholdSource: fallbackPricingGuard.thresholdSource || null,
                    thresholdReasonCode: fallbackPricingGuard.thresholdReasonCode || null,
                    thresholdPolicy: fallbackPricingGuard.thresholdPolicy || null,
                    modeFloorBps: fallbackPricingGuard.modeFloorBps ?? null,
                    allowUnreliablePriceBypass: Boolean(fallbackPricingGuard.allowUnreliablePriceBypass),
                    rejected: fallbackEntryCheck.rejected,
                    rejectReason: fallbackEntryCheck.rejectReason || null,
                });
            } else {
                logger.info(LogCode.SYS_INFO, '[SwapExecutor] Copytrade 0x fallback price guard skipped', {
                    sourceTxHash: sourceAnchor?.sourceTxHash || null,
                    provider: best.dex,
                    targetExecutionPrice: fallbackPricingGuard.targetExecutionPrice || null,
                    referencePrice: fallbackPricingGuard.referencePrice || null,
                    referencePriceSource: fallbackPricingGuard.referencePriceSource || 'reference_unavailable',
                    maxEntryDeviationBps: fallbackPricingGuard.maxEntryDeviationBps || null,
                });
            }

            if (fallbackEntryCheck.rejected) {
                throw new AppError(
                    400,
                    `copytrade_fallback_guard_reject:entry_deviation:${best.dex}:${fallbackEntryCheck.rejectReason || 'unknown'}`,
                    'COPYTRADE_FALLBACK_ENTRY_DEVIATION_GUARD_REJECT'
                );
            }
        }

        let approvalExecutedOnChain = false;

        // 3. Check & Approve
        // FIXED: Standard AllowanceHolder flow - needs proper approval
        if (best.allowanceTarget && best.allowanceTarget !== '0x0000000000000000000000000000000000000000') {
            logger.info(LogCode.EXE_TX_BROADCAST, 'Checking approval for swap', {
                token: actualTokenIn,
                spender: best.allowanceTarget,
                amount: amountInBase,
                isNative: actualTokenIn.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
            });

            const needsApproval = await this.checkNeedsApproval(
                walletAddress,
                actualTokenIn,
                best.allowanceTarget,
                amountInBase,
                chainId
            );

            const signedPermitAllowed = shouldUseSignedPermitForSell({
                dex: best.dex,
                allowSignedPermit: sellReliability.allowSignedPermit,
                isSellTx,
                isNativeIn,
            });
            const requiresPermitSignature = signedPermitAllowed
                && best.approvalKind === 'permit2_24h'
                && best.requiresTypedSignature
                && !!best.permit2Payload;
            let permitApprovalCovered = false;

            if (requiresPermitSignature) {
                try {
                    validatePermit2Payload(best.permit2Payload as any, chainId, best.permit2Expiry ?? null);
                    const signature = await signTypedData(userId, best.permit2Payload as any, chainId);
                    best.data = appendPermit2SignatureToCalldata(best.data, signature);
                    permitApprovalCovered = true;
                    logger.info(LogCode.EXE_TX_BROADCAST, '0x sell permit2 signature attached', {
                        chainId,
                        dex: best.dexName,
                        permit2Expiry: best.permit2Expiry || null
                    });
                } catch (permitErr: any) {
                    logger.warn(LogCode.EXE_TX_BROADCAST, '0x permit2 sign failed, falling back to approve', {
                        chainId,
                        error: permitErr?.message || String(permitErr)
                    });
                }
            }

            if (needsApproval) {
                if (
                    !permitApprovalCovered
                    && isSellTx
                    && !isNativeIn
                    && best.dex === '0x'
                    && !signedPermitAllowed
                ) {
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Sell path prefers explicit approval over signed permit', {
                        chainId,
                        dex: best.dexName,
                        reasonCode: sellReliability.reasonCode || 'sell_reliability_explicit_approval'
                    });
                }

                if (permitApprovalCovered) {
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Sell approval covered by signed permit; skipping on-chain approve', {
                        dex: best.dexName,
                        token: actualTokenIn,
                        spender: best.allowanceTarget
                    });
                } else {
                logger.info(LogCode.EXE_TX_BROADCAST, 'Approval required, auto-executing', { token: actualTokenIn, spender: best.allowanceTarget, amount: amountInBase });

                // Update transaction card: approval started
                try {
                    const messageId = (params as any).messageId;
                    if (messageId) {
                        const { getMessage, updateMessage } = await import('../../repositories/chatRepository.js');
                        const { chatWS } = await import('../../services/chatWebSocket.js');
                        const currentMessage = await getMessage(messageId);
                        if (currentMessage) {
                            const currentData = typeof currentMessage.data === 'object' && currentMessage.data
                                ? currentMessage.data
                                : {};
                            const updatedData = {
                                ...currentData,
                                status: 'approving',
                                message: '⏳ Approving token...',
                                isLoading: true
                            };
                            await updateMessage(messageId, { data: updatedData });
                            chatWS.broadcastToUser(userId, {
                                type: 'transaction_update',
                                sessionId: currentMessage.sessionId,
                                data: {
                                    messageId: messageId,
                                    status: 'approving',
                                    message: '⏳ Approving token...',
                                    isLoading: true
                                }
                            });
                        }
                    }
                } catch (wsError) {
                    console.warn('[SwapExecutor] Failed to update approval status card:', wsError);
                }

                // Auto-execute approval for instant swaps (exact amount + 1 unit buffer)
                const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
                const exactApproval = (BigInt(amountInBase || '0') + 1n).toString();
                const approvalData = iface.encodeFunctionData('approve', [best.allowanceTarget, exactApproval]);

                try {
                    const finalizeApprovalReady = async (approvalTxHash: string, approvalReady: ApprovalReadinessResult): Promise<void> => {
                        approvalExecutedOnChain = true;

                        logger.info(LogCode.EXE_TX_BROADCAST, 'Approval ready for swap, proceeding with quote refresh', {
                            txHash: approvalTxHash,
                            readyBy: approvalReady.readyBy,
                            allowance: approvalReady.allowance?.toString(),
                            blockNumber: approvalReady.receipt?.blockNumber,
                            elapsedMs: approvalReady.elapsedMs
                        });

                        await upsertApprovalPreheatState({
                            userId,
                            chainId,
                            walletAddress,
                            tokenAddress: actualTokenIn,
                            spenderAddress: best.allowanceTarget,
                            txHash: approvalTxHash,
                            status: 'confirmed'
                        }).catch(() => undefined);

                        // Update transaction card: approval confirmed
                        try {
                            const messageId = (params as any).messageId;
                            if (messageId) {
                                const { getMessage, updateMessage } = await import('../../repositories/chatRepository.js');
                                const { chatWS } = await import('../../services/chatWebSocket.js');
                                const currentMessage = await getMessage(messageId);
                                if (currentMessage) {
                                    const currentData = typeof currentMessage.data === 'object' && currentMessage.data
                                        ? currentMessage.data
                                        : {};
                                    const updatedData = {
                                        ...currentData,
                                        status: 'approval_confirmed',
                                        approvalTxHash,
                                        message: '✅ Approval confirmed. Executing swap...',
                                        isLoading: true
                                    };
                                    await updateMessage(messageId, { data: updatedData });
                                    chatWS.broadcastToUser(userId, {
                                        type: 'transaction_update',
                                        sessionId: currentMessage.sessionId,
                                        data: {
                                            messageId: messageId,
                                            status: 'approving',
                                            message: '⏳ Waiting for approval...',
                                            txHash: approvalTxHash,
                                            isLoading: true
                                        }
                                    });
                                }
                            }
                        } catch (wsError) {
                            console.warn('[SwapExecutor] Failed to update approval confirmed card:', wsError);
                        }

                        const originalQuote = { ...best };
                        const originalDex = best.dex;
                        const approvalRefreshAllowedDexes = originalDex ? [originalDex as QuoteDex] : undefined;
                        let refreshDecision: ApprovalBoundExecutionDecision = {
                            quoteToExecute: originalQuote,
                            refreshApplied: false,
                            refreshFailureCode: 'refresh_skipped_after_approval',
                        };
                        for (let refreshAttempt = 1; refreshAttempt <= 2; refreshAttempt++) {
                            const propagationDelayMs = approvalReady.readyBy === 'allowance' && refreshAttempt === 1
                                ? 0
                                : getApprovalQuoteRefreshDelayMs(refreshAttempt);
                            if (propagationDelayMs > 0) {
                                logger.info(LogCode.EXE_TX_BROADCAST, 'Waiting for approval state propagation across network...', {
                                    delayMs: propagationDelayMs,
                                    attempt: refreshAttempt
                                });
                                await new Promise(resolve => setTimeout(resolve, propagationDelayMs));
                            }

                            logger.info(LogCode.EXE_TX_BROADCAST, 'Re-fetching pinned quote after approval confirmation', {
                                originalDex: best.dexName,
                                attempt: refreshAttempt
                            });

                            const { best: freshQuote } = await getBestQuote({
                                tokenIn: actualTokenInFixed,
                                tokenOut: actualTokenOutFixed,
                                actualTokenIn: actualTokenInFixed,
                                actualTokenOut: actualTokenOutFixed,
                                amountInBase,
                                amountInHuman: parseFloat(amountInHuman),
                                tokenInDecimals: decimalsIn,
                                tokenOutDecimals: decimalsOut,
                                chainId,
                                slippageBps,
                                userAddress: walletAddress,
                                affiliateFee,
                                refPrice,
                                feeContext,
                                isSell: isSellForFee,
                                executionMode: 'normal',
                                preferPermit2: false,
                                skipCache: true,
                                allowedDexes: approvalRefreshAllowedDexes,
                                preferredDexes: approvalRefreshAllowedDexes,
                            });

                            refreshDecision = finalizeApprovedSellQuote({
                                originalQuote,
                                refreshedQuote: freshQuote || null,
                            });

                            if (refreshDecision.refreshApplied) {
                                logger.info(LogCode.EXE_TX_BROADCAST, 'Using pinned fresh quote after approval', {
                                    dex: refreshDecision.quoteToExecute.dexName,
                                    oldAmountOut: originalQuote.amountOut,
                                    newAmountOut: refreshDecision.quoteToExecute.amountOut,
                                    attempt: refreshAttempt
                                });
                                Object.assign(best, refreshDecision.quoteToExecute);
                                break;
                            }

                            if (refreshDecision.mustAbortExecution) {
                                logger.error(LogCode.EXE_TX_REVERTED, 'Approved quote invalidated by post-approval refresh; aborting execution', {
                                    dex: originalQuote.dexName,
                                    reasonCode: refreshDecision.refreshFailureCode,
                                    approvedAllowanceTarget: originalQuote.allowanceTarget,
                                    attemptedAllowanceTarget: freshQuote?.allowanceTarget || null,
                                    attemptedDex: freshQuote?.dexName || null,
                                    attempt: refreshAttempt
                                });
                                break;
                            }

                            logger.warn(LogCode.SYS_INFO, 'Approved quote refresh fell back to original quote', {
                                dex: originalQuote.dexName,
                                reasonCode: refreshDecision.refreshFailureCode,
                                approvedAllowanceTarget: originalQuote.allowanceTarget,
                                attemptedAllowanceTarget: freshQuote?.allowanceTarget || null,
                                attemptedDex: freshQuote?.dexName || null,
                                attempt: refreshAttempt
                            });

                            if (!shouldRetryApprovalQuoteRefresh({
                                attempt: refreshAttempt,
                                quoteFound: Boolean(freshQuote && freshQuote.to && freshQuote.data),
                                allowanceChanged: refreshDecision.refreshFailureCode === 'fresh_quote_allowance_changed_after_approval'
                            })) {
                                break;
                            }
                        }

                        if (!refreshDecision.refreshApplied) {
                            if (refreshDecision.mustAbortExecution) {
                                throw new Error('Quote changed after approval. The approved spender no longer matches the executable route, so no swap transaction was sent. Please retry the swap.');
                            }
                            logger.warn(LogCode.SYS_INFO, 'Proceeding with approved original quote after refresh fallback', {
                                dex: originalQuote.dexName,
                                reasonCode: refreshDecision.refreshFailureCode,
                                allowanceTarget: originalQuote.allowanceTarget
                            });
                            Object.assign(best, originalQuote);
                        }
                    };

                    const trackedPreheatApproval = isSellTx
                        ? await getApprovalPreheatState({
                            chainId,
                            walletAddress,
                            tokenAddress: actualTokenIn,
                            spenderAddress: best.allowanceTarget,
                        }).catch(() => null)
                        : null;

                    if (trackedPreheatApproval?.txHash && trackedPreheatApproval.status !== 'failed') {
                        logger.info(LogCode.EXE_TX_BROADCAST, 'Reusing in-flight preheat approval for sell', {
                            txHash: trackedPreheatApproval.txHash,
                            spender: best.allowanceTarget,
                            status: trackedPreheatApproval.status
                        });
                        try {
                        const reusedApprovalReady = await waitForApprovalReady({
                            chainId,
                            txHash: trackedPreheatApproval.txHash,
                            tokenAddress: actualTokenIn,
                            ownerAddress: walletAddress,
                            spenderAddress: best.allowanceTarget,
                            requiredAmount: exactApproval,
                            timeoutMs: 20_000,
                            allowanceCheckEnabled: !isSellTx
                        });
                            await finalizeApprovalReady(trackedPreheatApproval.txHash, reusedApprovalReady);
                            await clearApprovalPreheatState({
                                chainId,
                                walletAddress,
                                tokenAddress: actualTokenIn,
                                spenderAddress: best.allowanceTarget,
                            }).catch(() => undefined);
                        } catch (reusedApprovalError: any) {
                            logger.warn(LogCode.EXE_TX_BROADCAST, 'Preheat approval reuse failed, sending direct approval', {
                                txHash: trackedPreheatApproval.txHash,
                                spender: best.allowanceTarget,
                                error: reusedApprovalError?.message || String(reusedApprovalError)
                            });
                        }
                    }

                    if (!approvalExecutedOnChain) {
                        const approveTxHash = await sendTransaction(userId, params.accessToken || '', {
                            to: actualTokenIn,
                            data: approvalData,
                            value: '0',
                            chainId,
                            txPurpose: 'approval',
                        });

                        logger.info(LogCode.EXE_TX_BROADCAST, 'Approval transaction sent', { txHash: approveTxHash });
                        await upsertApprovalPreheatState({
                            userId,
                            chainId,
                            walletAddress,
                            tokenAddress: actualTokenIn,
                            spenderAddress: best.allowanceTarget,
                            txHash: approveTxHash,
                            status: 'submitted'
                        }).catch(() => undefined);

                        // CRITICAL: Must wait for approval to be CONFIRMED on-chain
                        // Allowance-holder checks on-chain state, mempool is not enough
                        logger.info(LogCode.EXE_TX_BROADCAST, 'Waiting for approval confirmation...', { txHash: approveTxHash });

                        const approvalReady = await waitForApprovalReady({
                            chainId,
                            txHash: approveTxHash,
                            tokenAddress: actualTokenIn,
                            ownerAddress: walletAddress,
                            spenderAddress: best.allowanceTarget,
                            requiredAmount: exactApproval,
                            timeoutMs: 60000,
                            allowanceCheckEnabled: !isSellTx
                        });
                        await finalizeApprovalReady(approveTxHash, approvalReady);
                    }
                } catch (approvalError: any) {
                    await upsertApprovalPreheatState({
                        userId,
                        chainId,
                        walletAddress,
                        tokenAddress: actualTokenIn,
                        spenderAddress: best.allowanceTarget,
                        txHash: '',
                        status: 'failed'
                    }).catch(() => undefined);
                    logger.error(LogCode.EXE_TX_REVERTED, 'Approval failed', { error: approvalError.message });
                    throw new Error(`Token approval failed: ${approvalError.message}`);
                }
                }
            } else {
                logger.info(LogCode.EXE_TX_BROADCAST, 'Approval not needed or already set', { token: actualTokenIn, spender: best.allowanceTarget });
                if (isPermit2Quote(best) && !permitApprovalCovered) {
                    throw new Error('Permit2 quote is missing the required typed signature. No swap transaction was sent.');
                }
            }
        } else {
            logger.info(LogCode.EXE_TX_BROADCAST, 'No allowance target, skipping approval check (likely native token swap)', { token: actualTokenIn });
        }

        if (initialQuoteWasPrewarmed && !approvalExecutedOnChain) {
            const refreshedQuoteBundle = await getBestQuote({
                ...quoteParams,
                skipCache: true,
            });
            if (!refreshedQuoteBundle?.best) {
                throw new Error('No valid quotes found');
            }
            logger.info(LogCode.EXE_TX_BROADCAST, 'Refreshed prewarmed quote before direct swap execution', {
                oldDex: best.dexName,
                newDex: refreshedQuoteBundle.best.dexName,
            });
            best = refreshedQuoteBundle.best;
        }

        // 4. Execute Transaction
        // CRITICAL SAFETY CHECK: Verify wallet address before executing
        if (!walletAddress || walletAddress.length !== 42 || !walletAddress.startsWith('0x')) {
            throw new Error(`CRITICAL: Invalid wallet address before swap execution: ${walletAddress}`);
        }

        console.log(`[SwapExecutor] Executing ${best.dexName} swap on chain ${chainId}`);

        // DEBUG: Log the actual transaction parameters
        console.log('[SwapExecutor] ========== TRANSACTION EXECUTION ==========');
        console.log('[SwapExecutor] DEX:', best.dexName);
        console.log('[SwapExecutor] Transaction params:', {
            to: best.to,
            dataLength: best.data?.length,
            dataPrefix: best.data?.slice(0, 66),
            value: best.value,
            router: best.router,
            allowanceTarget: best.allowanceTarget
        });
        console.log('[SwapExecutor] Swap details:', {
            tokenIn: actualTokenInFixed,
            tokenOut: actualTokenOutFixed,
            amountInBase,
            amountInHuman: amountIn,
            amountOut: best.amountOut,
            slippageBps,
            priceImpact: best.priceImpact,
            gasEstimate: best.gasEstimate
        });
        console.log('[SwapExecutor] =============================================');

        // Add Gas Buffer (50% for safety on Base/complex routes to prevent Out Of Gas)
        // Explicitly fetch current network fee data to prevent underpriced transaction submissions
        const feeSnapshot = await getExecutionFeeSnapshot(chainId).catch((feeErr) => {
            console.warn('[SwapExecutor] Failed to fetch fee data, using defaults', feeErr);
            return {
                baseFeePerGas: null,
                maxPriorityFeePerGas: null,
                maxFeePerGas: null
            };
        });
        const feeData = {
            maxPriorityFeePerGas: feeSnapshot.maxPriorityFeePerGas ?? undefined,
            maxFeePerGas: feeSnapshot.maxFeePerGas ?? undefined
        };

        const gasLimit = best.gasEstimate
            ? Math.floor(Number(best.gasEstimate) * 1.5).toString()
            : undefined;

        console.log('[SwapExecutor] Execution params prepared:', {
            dex: best.dexName,
            gasEstimate: best.gasEstimate,
            gasLimit,
            maxFeePerGas: feeData?.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: feeData?.maxPriorityFeePerGas?.toString()
        });

        // ⚡ SMART GAS BIDDING STRATEGY FOR COPYTRADE
        // Base/L2: Low base fee but priority fee critical for transaction ordering
        // Mainnet: Higher base fee, priority fee for miner tips
        const isCopyTrade = params.feeContext === 'copyTrade';
        let maxFeePerGasCap = feeData?.maxFeePerGas;
        let maxPriorityFeeCap = feeData?.maxPriorityFeePerGas;
        const ethFeePolicy = resolveEthCopytradeFeePolicy({
            chainId,
            mode: params.feeContext === 'copyTrade' ? 'copytrade' : 'fast-swap',
            executionMode: params.executionMode,
        });
        const ethRelayPolicy = resolveEthCopytradeRelayPolicy({
            chainId,
            mode: params.feeContext === 'copyTrade' ? 'copytrade' : 'fast-swap',
            executionMode: params.executionMode,
            mevProtection: params.mevProtection === true,
        });

        if (isCopyTrade) {
            // Smart aggressive gas: use eth_maxPriorityFeePerGas + baseFee, clamp to avoid excessive fees
            const baseFeePerGas = feeSnapshot.baseFeePerGas;
            const suggestedPriority = feeSnapshot.maxPriorityFeePerGas;

            const isBase = chainId === 8453;
            const isL2 = isBase || chainId === 10 || chainId === 42161;
            const useEthAggressivePolicy = chainId === 1 && feeContext === 'copyTrade';

            const minPriority = isBase
                ? 10_000_000n   // 0.01 gwei
                : isL2
                    ? 50_000_000n  // 0.05 gwei
                    : 1_000_000_000n; // 1 gwei for L1
            const maxPriorityCap = isBase
                ? 500_000_000n  // 0.5 gwei cap
                : isL2
                    ? 1_000_000_000n // 1 gwei cap
                    : 5_000_000_000n; // 5 gwei cap

            let priority = suggestedPriority ?? maxPriorityFeeCap ?? 0n;
            if (priority > 0n) {
                const multiplierBps = useEthAggressivePolicy
                    ? BigInt(Number(ethFeePolicy.priorityMultiplierBps || 25000))
                    : 20000n;
                priority = priority * multiplierBps / 10000n;
            }
            const effectiveMinPriority = useEthAggressivePolicy
                ? (ethFeePolicy.minPriorityFeeWei || minPriority)
                : minPriority;
            const effectiveMaxPriorityCap = useEthAggressivePolicy
                ? (ethFeePolicy.maxPriorityFeeWei || maxPriorityCap)
                : maxPriorityCap;
            if (priority < effectiveMinPriority) priority = effectiveMinPriority;
            if (priority > effectiveMaxPriorityCap) priority = effectiveMaxPriorityCap;

            maxPriorityFeeCap = priority;

            if (baseFeePerGas) {
                const maxFeeMultiplierBps = useEthAggressivePolicy
                    ? BigInt(Number(ethFeePolicy.maxFeeMultiplierBps || 20000))
                    : 20000n;
                maxFeePerGasCap = baseFeePerGas * maxFeeMultiplierBps / 10000n + maxPriorityFeeCap;
            } else if (maxFeePerGasCap) {
                maxFeePerGasCap = maxFeePerGasCap + maxPriorityFeeCap;
            } else {
                maxFeePerGasCap = maxPriorityFeeCap * 2n;
            }

            if (params.runtimeContext) {
                setOrderMetadata(params.runtimeContext, {
                    gasPolicyTier: ethFeePolicy.gasPolicyTier,
                    replacementPolicyTier: ethFeePolicy.replacementPolicyTier,
                    privateRelayEligible: ethRelayPolicy.privateRelayEligible,
                });
            }

            logger.info(LogCode.EXE_TX_BROADCAST, '🚀 CopyTrade Aggressive Gas', {
                chainId,
                baseFeeGwei: baseFeePerGas ? (Number(baseFeePerGas) / 1e9).toFixed(6) : 'unknown',
                maxFeeGwei: (Number(maxFeePerGasCap) / 1e9).toFixed(6),
                priorityGwei: (Number(maxPriorityFeeCap) / 1e9).toFixed(6),
                mode: isBase ? 'Base(eth_maxPriorityFeePerGas)' : isL2 ? 'L2(eth_maxPriorityFeePerGas)' : 'L1(eth_maxPriorityFeePerGas)',
                policyTier: ethFeePolicy.gasPolicyTier,
                replacementPolicyTier: ethFeePolicy.replacementPolicyTier,
            });
        }

        try {
            const preWarmedNonce = resolveTradeSendNonce({
                preWarmedNonce: params.preWarmedNonce ? await params.preWarmedNonce : undefined,
                approvalExecutedOnChain,
            });
            // ⚡ Derive executionProfile so that turbo copy-trades hitting the 0x fallback
            // path still benefit from the fast sign+broadcast routing in privyWallet.
            const executionProfile = params.executionMode === 'turbo'
                ? (chainId === 8453 ? 'base-sniper' : chainId === 56 ? 'bsc-sniper' : undefined)
                : undefined;
            const executionBranch = params.runtimeContext?.fallbackUsed ? 'fallback' : 'primary';
            const txHash = await sendTransaction(userId, params.accessToken || '', {
                to: best.to,
                data: best.data,
                value: best.value,
                chainId,
                gas: gasLimit,
                maxFeePerGas: maxFeePerGasCap?.toString(),
                maxPriorityFeePerGas: maxPriorityFeeCap?.toString(),
                txPurpose: 'trade',
                mevProtection: ethRelayPolicy.mevProtection,
                gasPolicyTier: ethFeePolicy.gasPolicyTier,
                replacementPolicyTier: ethFeePolicy.replacementPolicyTier,
                privateRelayEligible: ethRelayPolicy.privateRelayEligible,
                executionBranch,
                runtimeContext: params.runtimeContext,
                ...(executionProfile ? { executionProfile } : {}),
                ...(preWarmedNonce !== undefined ? { nonce: preWarmedNonce } : {})
            });

            logger.info(LogCode.EXE_TX_BROADCAST, 'Swap Broadcast', { txHash, method: best.dexName });

            const speedUpAfterMs = ethFeePolicy.speedUpAfterMs ?? params.speedUpAfterMs;
            const speedUpBumpBps = ethFeePolicy.speedUpBumpBps ?? params.speedUpBumpBps;
            const replacementScheduleMs = ethFeePolicy.replacementScheduleMs;
            const replacementBumpBps = ethFeePolicy.replacementBumpBps;
            if (speedUpAfterMs && speedUpAfterMs > 0) {
                scheduleSpeedUp({
                    txHash,
                    chainId,
                    userId,
                    accessToken: params.accessToken || '',
                    speedUpAfterMs,
                    speedUpBumpBps,
                    replacementScheduleMs,
                    replacementBumpBps,
                    mevProtection: ethRelayPolicy.mevProtection,
                    runtimeContext: params.runtimeContext,
                    tx: {
                        to: best.to,
                        data: best.data,
                        value: best.value,
                        chainId,
                        gas: gasLimit,
                        maxFeePerGas: maxFeePerGasCap?.toString(),
                        maxPriorityFeePerGas: maxPriorityFeeCap?.toString()
                    }
                });
            }

            // 5. Handle confirmation based on mode
            // For copy trade and critical operations, wait for confirmation
            // For normal swaps, return immediately and monitor in background
            if (params.waitForConfirmation) {
                // SYNCHRONOUS CONFIRMATION: Wait for tx confirmation before returning
                const timeoutMs = params.confirmationTimeoutMs ?? 60000;
                const confirmed = await waitForTransactionConfirmation({
                    txHash,
                    chainId,
                    dexName: best.dexName,
                    timeoutMs,
                    pollMs: 2000
                });
                if (!confirmed.success) {
                    if (confirmed.kind !== 'confirmed_failed') {
                        logger.warn(LogCode.SYS_INFO, 'Transaction confirmation unresolved; preserving single-flight tx', {
                            txHash,
                            reason: confirmed.reason,
                            kind: confirmed.kind
                        });
                        monitorEvmTransaction({
                            txHash,
                            chainId,
                            dexName: best.dexName,
                            expectedAmountOut: best.amountOut,
                            userId,
                            messageId: params.messageId
                        }).catch(() => { });
                        emitCopytradeDomainAudit('exit_confirmation_unresolved_retry', {
                            extra: {
                                chainId,
                                txHash,
                                dexName: best.dexName,
                                reasonCode: confirmed.kind,
                                reason: confirmed.reason || null,
                            }
                        });
                        return {
                            success: false,
                            status: 'FAILED',
                            finalityState: 'retryable_unresolved',
                            txHash,
                            amountOut: best.amountOut,
                            error: `confirmation_unresolved:${confirmed.kind}:${confirmed.reason || 'unknown'}`,
                            method: best.dexName,
                            metadata: {
                                allowanceTarget: best.allowanceTarget
                            }
                        };
                    }

                    logger.error(LogCode.EXE_TX_REVERTED, 'Transaction REVERTED on-chain', { txHash, reason: confirmed.reason });

                    const revertReason = String(confirmed.reason || '');
                    const isTransferFailedOnConfirm =
                        revertReason.includes('TRANSFER_FROM_FAILED') ||
                        revertReason.includes('TransferHelper') ||
                        revertReason.toLowerCase().includes('transfer_from_failed');

                    if (isTransferFailedOnConfirm && isSellTx && !params.transferRetry) {
                        try {
                            const baseAmount = BigInt(amountInBase);
                            if (baseAmount > 1n) {
                                const reducedBase = baseAmount - 1n;
                                const reducedHuman = ethers.formatUnits(reducedBase, decimalsIn);
                                logger.warn(LogCode.EXE_TX_REVERTED, 'On-chain transfer failed. Retrying with last-digit reduction', {
                                    originalAmount: amountInHuman,
                                    reducedAmount: reducedHuman
                                });
                                return this.executeEvm({
                                    ...params,
                                    amountIn: reducedHuman,
                                    transferRetry: true
                                });
                            }
                        } catch (retryErr: any) {
                            logger.warn(LogCode.EXE_TX_REVERTED, 'Last-digit retry after on-chain transfer fail could not start', {
                                error: retryErr.message
                            });
                        }
                    }

                    // ⚡ RETRY LOGIC FOR REVERTED TRANSACTIONS
                    // When waitForConfirmation is enabled and tx reverts, we should retry with higher slippage
                    // NOTE: autoTradeService has its own multi-step retry, so we only do 1 internal retry here
                    const allowPostBroadcastRetry = params.allowPostBroadcastRetry !== false;
                    const MAX_INTERNAL_RETRY_SLIPPAGE = 1000; // 10% internal max (autoTradeService handles higher)
                    const INCREMENT_STEP = 300;  // 3% step for internal retry
                    const nextSlippage = slippageBps + INCREMENT_STEP;

                    // Only do internal retry if we're below internal max AND this is first internal retry
                    const isFirstInternalRetry = !params.excludeDex; // excludeDex is set on retry
                    if (allowPostBroadcastRetry && isFirstInternalRetry && best?.dex) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Fast failover: switching DEX after confirmed on-chain revert', {
                            failedDex: best.dexName,
                            failedDexId: best.dex,
                            slippageBps
                        });
                        return this.executeEvm({
                            ...params,
                            excludeDex: best.dex,
                            failoverSendContext: extendFailoverSendContext(params.failoverSendContext, {
                                previousDex: best.dex,
                                previousDexName: best.dexName,
                                previousReasonCode: 'confirmed_revert',
                                acceptedTxHash: txHash
                            })
                        });
                    }
                    if (allowPostBroadcastRetry && isFirstInternalRetry && nextSlippage <= MAX_INTERNAL_RETRY_SLIPPAGE) {
                        logger.warn(LogCode.EXE_TX_REVERTED, `On-chain revert. Quick retry with slippage: ${nextSlippage / 100}%`, {
                            original: slippageBps,
                            next: nextSlippage,
                            reason: confirmed.reason,
                            dex: best.dexName
                        });

                        // Add delay before retry to allow mempool/price to stabilize
                        await new Promise(resolve => setTimeout(resolve, 1500));

                        // Single internal retry with slightly higher slippage
                        return this.executeEvm({
                            ...params,
                            slippageBps: nextSlippage,
                            excludeDex: best?.dex // Mark as retry
                        });
                    }

                    // Return failure - let autoTradeService handle higher-level retry
                    return {
                        success: false,
                        finalityState: 'confirmed_failed',
                        error: `Transaction reverted: ${confirmed.reason || 'Slippage or price impact'}`,
                        method: best.dexName,
                        txHash
                    };
                }
                logger.info(LogCode.EXE_TX_CONFIRMED, 'Transaction confirmed on-chain', { txHash });
                reportAnchorAcceptance();

            } else {
                // ASYNC MONITORING: Fire-and-forget for normal swaps
                monitorEvmTransaction({
                    txHash,
                    chainId,
                    dexName: best.dexName,
                    expectedAmountOut: best.amountOut,
                    userId,
                    messageId: params.messageId
                }).catch(err => {
                    logger.error(LogCode.EXE_TX_REVERTED, 'Background monitoring failed', { txHash, error: err.message });
                });
                reportAnchorAcceptance();
            }

            return {
                success: true,
                status: 'SUCCESS', // Changed from PENDING to align with type definition
                finalityState: params.waitForConfirmation ? 'confirmed_success' : undefined,
                txHash,
                amountOut: best.amountOut,
                method: best.dexName,
                metadata: {
                    allowanceTarget: best.allowanceTarget
                }
            };
        } catch (execError: any) {
            console.log('[SwapExecutor] ========== EXECUTION FAILED ==========');
            console.log('[SwapExecutor] DEX:', best?.dexName);
            console.log('[SwapExecutor] Error message:', execError.message);
            console.log('[SwapExecutor] Error stack:', execError.stack);
            console.log('[SwapExecutor] Error details:', {
                name: execError.name,
                code: execError.code,
                reason: execError.reason,
                data: execError.data,
                transaction: execError.transaction,
                receipt: execError.receipt,
                transactionHash: execError.transactionHash
            });
            console.log('[SwapExecutor] Transaction params:', {
                to: best?.to,
                value: best?.value,
                dataLength: best?.data?.length,
                data: best?.data,
                router: best?.router,
                allowanceTarget: best?.allowanceTarget
            });
            console.log('[SwapExecutor] Swap input:', {
                tokenIn: actualTokenInFixed,
                tokenOut: actualTokenOutFixed,
                amountInBase,
                slippageBps,
                expectedAmountOut: best?.amountOut
            });
            console.log('[SwapExecutor] ======================================');

            logger.error(LogCode.EXE_TX_REVERTED, 'Swap execution error', {
                error: execError.message,
                fullError: execError.toString(),
                dex: best?.dexName
            });

            // ⚡ SMART ERROR DETECTION
            const errorMsg = execError.message.toLowerCase();
            const isTransferFailed = errorMsg.includes('transfer_from_failed') ||
                errorMsg.includes('transfer failed') ||
                errorMsg.includes('transferhelper');
            const isRevert = errorMsg.includes('reverted') || errorMsg.includes('execution failed');
            const isPermit2Path = best?.dex === '0x' && best?.approvalKind === 'permit2_24h';

            if (shouldRetryPermit2AsAllowanceHolder({
                isPermit2Path,
                permit2ExecutionFallbackTried: params.permit2ExecutionFallbackTried,
                isSellTx,
            })) {
                logger.warn(LogCode.EXE_TX_REVERTED, '0x permit2 execution failed, retrying with allowance-holder path', {
                    chainId,
                    error: execError.message?.slice(0, 160),
                    slippageBps
                });
                return this.executeEvm({
                    ...params,
                    excludeDex: undefined,
                    preferPermit2: false,
                    permit2ExecutionFallbackTried: true,
                    failoverSendContext: extendFailoverSendContext(params.failoverSendContext, {
                        previousDex: best?.dex,
                        previousDexName: best?.dexName,
                        previousReasonCode: 'permit2_execution_failed'
                    })
                });
            }

            // If transfer failed on a SELL order, token likely has restrictions.
            // Retry once by reducing amount by 1 base unit (last digit) to avoid balance/fee edge cases.
            if (isTransferFailed && isSellTx) {
                const canRetry = !params.transferRetry && typeof amountInBase === 'string';
                if (canRetry) {
                    try {
                        const baseAmount = BigInt(amountInBase);
                        if (baseAmount > 1n) {
                            const reducedBase = baseAmount - 1n;
                            const reducedHuman = ethers.formatUnits(reducedBase, decimalsIn);
                            logger.warn(LogCode.EXE_TX_REVERTED, 'Transfer failed on sell. Retrying with last-digit reduction', {
                                token: params.tokenIn,
                                originalAmount: params.amountIn,
                                reducedAmount: reducedHuman
                            });
                            return this.executeEvm({
                                ...params,
                                amountIn: reducedHuman,
                                transferRetry: true
                            });
                        }
                    } catch (retryErr: any) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Transfer retry with last-digit reduction failed to prepare', {
                            error: retryErr.message
                        });
                    }
                }

                logger.error(LogCode.EXE_TX_REVERTED, 'Token transfer restriction detected on SELL', {
                    token: params.tokenIn,
                    amount: params.amountIn,
                    suggestion: 'Token may have sell limits, taxes, or anti-bot protection'
                });

                throw new Error(
                    `This token has transfer restrictions that prevent selling. ` +
                    `Possible reasons: 1) Maximum sell amount limit 2) High sell tax 3) Anti-bot protection.`
                );
            }

            // Fast failover: if first attempt fails, immediately switch DEX with same slippage
            if (!params.excludeDex && best?.dex) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'Fast failover: switching DEX after execution error', {
                    failedDex: best.dexName,
                    failedDexId: best.dex,
                    slippageBps
                });
                return this.executeEvm({
                    ...params,
                    excludeDex: best.dex,
                    failoverSendContext: extendFailoverSendContext(params.failoverSendContext, {
                        previousDex: best.dex,
                        previousDexName: best.dexName,
                        previousReasonCode: 'execution_error'
                    })
                });
            }

            // Check if we should retry with higher slippage
            const currentSlippage = slippageBps;

            // If it was a revert and we haven't hit the max cap yet
            if (isRevert) {
                // INCREMENTAL RETRY LOGIC (Respect user's base + steps)
                // We add 5% (500 bps) to the current status, up to a hard MAX of 15% (1500 bps)
                const MAX_SAFETY_CAP = 1500; // 15% absolute max
                const INCREMENT_STEP = 500;  // 5% step

                const nextSlippage = currentSlippage + INCREMENT_STEP;

                if (nextSlippage <= MAX_SAFETY_CAP) {
                    logger.warn(LogCode.EXE_TX_REVERTED, `Swap reverted. Retrying with incremental slippage: ${nextSlippage / 100}%`, {
                        original: currentSlippage,
                        increment: INCREMENT_STEP,
                        dex: best?.dexName || 'unknown'
                    });

                    // ⚡ Push retry status update via WebSocket (if messageId provided)
                    try {
                        const messageId = (params as any).messageId;
                        if (messageId) {
                            const { chatWS } = await import('../../services/chatWebSocket.js');
                            const { updateMessage } = await import('../../repositories/chatRepository.js');

                            // Update database message
                            const currentMessage = await import('../../repositories/chatRepository.js').then(m => m.getMessage(messageId));
                            if (currentMessage) {
                                const currentData = typeof currentMessage.data === 'object' && currentMessage.data
                                    ? currentMessage.data
                                    : {};
                                await updateMessage(messageId, {
                                    data: {
                                        ...currentData,
                                        status: 'retrying',
                                        retryCount: (currentData.retryCount || 0) + 1,
                                        retryReason: 'Increasing slippage tolerance',
                                        currentSlippage: nextSlippage / 100,
                                        message: `⏳ First attempt failed, retrying with ${nextSlippage / 100}% slippage...`
                                    }
                                });

                                // Push WebSocket update
                                chatWS.broadcastToUser(userId, {
                                    type: 'transaction_update',
                                    sessionId: currentMessage.sessionId || 'unknown',
                                    data: {
                                        messageId,
                                        status: 'retrying',
                                        retryCount: (currentData.retryCount || 0) + 1,
                                        message: `⏳ Retrying with ${nextSlippage / 100}% slippage...`,
                                        isLoading: true
                                    }
                                });
                            }
                        }
                    } catch (wsError) {
                        console.warn('[SwapExecutor] Failed to push retry status:', wsError);
                    }

                    // Force approval reset on retry ONLY if error suggests allowance issue
                    // This handles cases where checkNeedsApproval false-negatives or spender changed
                    const isAllowanceError = execError.message.toLowerCase().includes('allowance') ||
                        execError.message.toLowerCase().includes('insufficient') ||
                        execError.message.toLowerCase().includes('approved');

                    if (isAllowanceError && !isNativeIn && best?.allowanceTarget && best.allowanceTarget !== ethers.ZeroAddress) {
                        logger.warn(LogCode.EXE_TX_BROADCAST, 'Forcing approval transaction on retry due to allowance error', {
                            token: actualTokenInFixed,
                            spender: best.allowanceTarget,
                            error: execError.message.slice(0, 100)
                        });
                        try {
                            await executeApproval({
                                userId,
                                token: actualTokenInFixed,
                                spender: best.allowanceTarget,
                                requiredAmountBase: amountInBase,
                                chainId,
                                accessToken: params.accessToken,
                                runtimeContext: params.runtimeContext
                            });
                        } catch (approveErr: any) {
                            logger.warn(LogCode.SYS_ERROR, 'Forced approval failed, continuing with retry...', { error: approveErr.message });
                        }
                    } else {
                        logger.info(LogCode.SYS_INFO, 'Skipping approval retry - error not related to allowance', {
                            errorType: execError.message.slice(0, 50)
                        });
                    }

                    // IMPORTANT: Add a small delay before retry to avoid rate limiting and allow mempool to clear
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // Recursive retry with new parameters
                    // CRITICAL: Exclude the failed DEX to force trying the alternative
                    return this.executeEvm({
                        ...params,
                        slippageBps: nextSlippage,
                        excludeDex: best?.dex // Exclude the DEX that just failed
                    });
                } else {
                    logger.error(LogCode.EXE_TX_REVERTED, `Swap failed after max retries. Token may have restrictions.`, {
                        maxSlippage: MAX_SAFETY_CAP,
                        dex: best?.dexName || 'unknown'
                    });
                }
            }

            throw execError;
        }
    }

    /**
     * Handle Solana Swaps via Jupiter
     */
    private static async executeSolana(params: SwapParams): Promise<SwapResult> {
        const { userId, tokenIn, tokenOut, amountIn, slippageBps = 100, accessToken } = params;

        // Use provided mints
        const tokenInMint = tokenIn;
        const tokenOutMint = tokenOut;

        // Fetch actual decimals
        const tokenInInfo = await getTokenInfo(tokenInMint, SOLANA_CONFIG.CHAIN_ID);
        const decimals = tokenInInfo?.decimals ?? (params.isSell ? 6 : 9);

        let amountAtomic = Math.floor(parseFloat(amountIn) * Math.pow(10, decimals)).toString();

        // Gas Reservation for Solana (Native SOL only)
        if (tokenInMint === SOLANA_NATIVE_MINT) {
            try {
                const balance = await walletService.getWalletBalance(params.walletAddress, 'solana');
                const balanceBigInt = BigInt(balance.ethBalance); // alchemy service maps SOL balance to ethBalance field
                const amountInBigInt = BigInt(amountAtomic);
                const config = getChainConfig(SOLANA_CONFIG.CHAIN_ID);
                const reserveStr = config.gasReserve || '0.05';
                const reserve = BigInt(Math.floor(parseFloat(reserveStr) * 1e9));

                if (amountInBigInt >= balanceBigInt - (reserve / BigInt(2))) {
                    const newAmountIn = balanceBigInt - reserve;
                    if (newAmountIn <= BigInt(0)) throw new Error('Insufficient SOL for gas reserve (0.05 SOL)');
                    amountAtomic = newAmountIn.toString();
                    logger.info(LogCode.SYS_INFO, 'Solana Gas Reserve Applied', { reserve: '0.05 SOL', newAmount: Number(newAmountIn) / 1e9 });
                }
            } catch (err: any) {
                logger.warn(LogCode.SYS_ERROR, 'Solana gas reserve check failed', { error: err.message });
            }
        }

        const tokenOutInfo = await getTokenInfo(tokenOutMint, SOLANA_CONFIG.CHAIN_ID).catch(() => null);
        const outDecimals = Number.isInteger(tokenOutInfo?.decimals)
            ? Number(tokenOutInfo?.decimals)
            : 6;

        const solanaResult = await executeSolanaSwapWithResult({
            userId,
            tokenInMint,
            tokenOutMint,
            amountIn: amountAtomic,
            slippageBps,
            feeContext: params.feeContext || 'swap',
            accessToken,
            waitForConfirmation: params.waitForConfirmation ?? false,
            executionMode: params.executionMode,
            launchpadProvider: params.launchpadProvider,
            preferredAggregator: params.preferredSolanaAggregator
        });
        const txHash = solanaResult.signature;
        const amountOutBase = String(solanaResult.quoteOutAmountBase || '').trim() || undefined;
        let amountOutHuman: string | undefined;
        if (amountOutBase) {
            try {
                amountOutHuman = ethers.formatUnits(BigInt(amountOutBase), outDecimals);
            } catch {
                amountOutHuman = undefined;
            }
        }

        return {
            success: true,
            status: 'SUCCESS',
            txHash,
            amountOut: amountOutHuman,
            method: String(solanaResult.quoteAggregator || 'jupiter'),
            metadata: {
                amountOutBase,
                amountOutDecimals: outDecimals,
            }
        };
    }

    /**
     * Check if token balance is sufficient
     */
    private static async preCheckBalance(params: SwapParams): Promise<void> {
        const { walletAddress, tokenIn, amountIn, chainId, isSell } = params;

        // Skip for Native (handled by gas check later)
        const isNative = isNativeToken(tokenIn, chainId);
        if (isNative) return;

        // REDUNDANT CHECK: Balance is already verified and capped in MainSwapService/routes
        // Re-checking here causes issues with cached metadata precision (18 vs 6 decimals)
        // and unstable RPCs on Base. Trust upstream validation.
        return;


    }

    /**
     * Check if token needs approval
     */
    private static async checkNeedsApproval(
        owner: string,
        token: string,
        spender: string,
        amount: string,
        chainId: number
    ): Promise<boolean> {
        if (isNativeToken(token, chainId)) return false;

        try {
            const currentBigInt = await getErc20Allowance(token, owner, spender, chainId, 'latest', { lane: 'critical' });
            const amountBigInt = BigInt(amount);
            const needsApproval = currentBigInt < amountBigInt;

            // Enhanced logging with actual allowance values
            logger.info(LogCode.EXE_TX_BROADCAST, needsApproval ? 'Approval required' : 'Approval not needed or already set', {
                token: token.slice(0, 10),
                spender: spender.slice(0, 10),
                currentAllowance: currentBigInt.toString(),
                requiredAmount: amount,
                needsApproval
            });

            return needsApproval;
        } catch (error) {
            logger.warn(LogCode.SYS_ERROR, 'Allowance check failed, assuming approval needed', {
                token: token.slice(0, 10),
                error: (error as Error).message
            });
            return true; // Assume needs approval if check fails
        }
    }

}

export const __swapExecutorTest = {
    finalizeApprovedSellQuote,
    isPermit2Quote,
    requiresExplicitApprovalQuote,
    shouldSkipCopytradeTokenInfoHotPath,
    isInteractiveWalletSwap,
};
