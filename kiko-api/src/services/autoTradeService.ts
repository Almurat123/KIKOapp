/**
 * Auto Trade Service
 * Executes copy trades when target wallet swaps are detected
 */

import { ethers } from 'ethers';
import prisma, { withRetry } from '../db/prisma.js';
import { DecodedSwap } from './txDecoder.js';
import { onSwapDetected } from './watcherService.js';
import type { DirectSwapHint, MainSwapRequest, MainSwapResult } from './MainSwapService.js';
import { detectLaunchpadToken } from './ai/launchpadDetector.js';
import { zoraSniperService } from './zoraSniperService.js';
import { fourMemeService } from './fourMemeService.js';

import { getChainConfig, CHAINS } from '../config/chainConfig.js';

import { executeSolanaSwap } from './solanaExecutor.js';
import { SOLANA_CONFIG, getSolanaConnection } from '../config/solanaConfig.js';
import { onSolanaSwapDetected, startSolanaWatcher } from './solanaWatcher.js';
import { DynamicTakeProfitService } from './dynamicTakeProfitService.js';
import { PublicKey } from '@solana/web3.js';
import { getSolanaEmbeddedWalletAddress, getPendingNonce } from './privyWallet.js';
import { env } from '../config/env.js';
import { PrivyClient } from '@privy-io/server-auth';
import { recordNewTrade } from './leaderWalletStatsService.js';
import { trackCopyTrade, trackSwap } from './userActivityService.js';
import { getTokenDetails } from './geckoTerminal.js';
import { getNativeTokenPriceUsd } from './onChainPriceService.js';
import { normalizeAddress } from '../utils/address.js';
import { moralisService } from './moralisService.js';
import { warpcastService } from './warpcastService.js';
import { notificationService, type TradeNotificationParams } from './notificationService.js';
import { getTokenInfo } from './tokenService.js';
import { getTokenDecimals, getTokenMetadata, getTokenSupply } from './rpcService.js';
import { getDexPrice, getDexPriceDetailed } from './dexPriceService.js';
import { cacheHub } from '../cache/DataCacheHub.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { callRpc, getNativeBalance as rpcGetNativeBalance, getErc20Balance, getErc20Decimals, getTransactionReceipt } from './rpcManager.js';
import { startCopyTradePendingWatcher, stopCopyTradePendingWatcher } from './copyTradePendingService.js';
import { assertConfigExecutable } from './copyTradeConfigSignatureService.js';
import { determineCopyTradeDirection } from './copyTradeDirection.js';
import { evaluateCopytradeSignalAssetPolicy } from './copytradeAssetEligibility.js';
import {
    resolveExecutionModeFromConfig,
    type CopyTradeExecutionMode
} from './copyTradeExecutionMode.js';
import { persistTargetSwapEvent } from './targetWalletTrackingService.js';
import {
    buildOrderAuditFields,
} from './order-runtime/sinks/persistence.js';
import type { OrderRuntimeContext } from './order-runtime/types.js';
import { buildEvmExitPlan } from './copytrade-v2/exit/planner.js';
import { executePlannedEvmExitFlow } from './copytrade-v2/exit/evmExitExecutionFlow.js';
import {
    persistFailedExitState,
    persistDeferredExitRetryState,
    persistPendingExitFinalityState,
    persistSuccessfulExit,
    reconcileNoopExitPosition
} from './copytrade-v2/exit/persistence.js';
import { getExitInflightRetryGraceMs, hasRecentInflightExitRetryGuard } from './copytrade-v2/exit/retryGuard.js';
import {
    computeBuyTargetValueSnapshot,
    getMinTargetEffectiveFloorUsd,
    isBelowMinTargetValue,
    resolveEffectiveMinTargetValueUsd
} from './copytrade-v2/guards/targetValueGuard.js';
import { emitCopyTradeBuyGuardAudit, roundGuardNumber } from './copytrade-v2/guards/guardAudit.js';
import { emitCopytradeDomainAudit } from './copytrade-v2/audit/copytradeDomainAudit.js';
import { resolveBuyLiquidityGuardSnapshot } from './copytrade-v2/guards/liquidityGuard.js';
import { buildDuplicateTradeWhere, describeCooldownMode } from './copytrade-v2/guards/cooldownPolicy.js';
import { evaluateStaticBuyGuards } from './copytrade-v2/guards/evaluator.js';
import { emitBatchFilterAudit } from './copytrade-v2/guards/batchFilterAudit.js';
import { resolveBuyGuardPolicy, shouldEnforceBuyGuard } from './copytrade-v2/guards/policy.js';
import { resolveEntryDeviationModePolicy } from './copytrade-v2/config/entryDeviationModePolicy.js';
import { emitEntryDeviationSummary } from './copytrade-v2/audit/entryDeviationAudit.js';
import { executeEvmCopytradeBuySubmissionFlow } from './copytrade-v2/buy/evmBuySubmissionFlow.js';
import { persistCopytradeBuySubmission } from './copytrade-v2/buy/buyPersistenceFlow.js';
import { dispatchCopyTradeIfReady } from './copytrade-v2/ingress/copyTradeFastDispatcher.js';
import { runPostBuyAiFlow } from './copytrade-v2/buy/postBuyAiFlow.js';
import { applyBuyConfirmationTransition } from './copytrade-v2/buy/buyConfirmationTransition.js';
import { scheduleCopytradeBuyConfirmationFlow } from './copytrade-v2/buy/buyConfirmationCoordinator.js';
import { cleanupPendingCopytradePosition } from './copytrade-v2/buy/pendingLifecycle.js';
import { buildCopytradeBuyPlannedArtifact } from './copytrade-v2/buy/plannedExecutionArtifact.js';
import { shouldAbortCopytradeBuyRetry } from './copytrade-v2/buy/copytradeBuyRetryGuard.js';
import { evaluateBuyPriceDeviationGuard } from './copytrade-v2/buy/buyGuardPriceDeviation.js';
import {
    type SingleUserBuyResult,
    resolveTurboMetadataFallbackInfo,
    scheduleAsyncMarketCapHydration,
    summarizeSingleUserBuyResults,
} from './copytrade-v2/buy/tradeHotPathSupport.js';
import { resolveAttributedPositionExitAmount } from './copytrade-v2/positions/positionAttribution.js';
import { finalizeCopytradeBuyPosition } from './copytrade-v2/positions/positionPersistence.js';
import {
    armPendingAttributedPositionsForMirrorSell,
    listPendingAttributedPositions,
    upsertPendingAttributedPosition
} from './copytrade-v2/positions/pendingAttributedPositionLedger.js';
import { runCopytradeAttributionRepairCycle } from './copytrade-v2/jobs/copytradeAttributionRepairJob.js';
import { repairCopytradePositionAttribution } from './copytrade-v2/jobs/copytradeAttributionRepairJob.js';
import { upsertTargetSellEvent } from './copytrade-v2/exit/targetSellEventStore.js';
import { syncCopytradeLedgerFromLegacy } from './copytrade-v2/ledger/copytradeLedgerRepository.js';
import {
    buildTargetSellEventPayload,
    persistTargetSellEventAndSchedulePositions
} from './copytrade-v2/exit/positionExitIntentScheduler.js';
import { getCopytradeBuySharedWarmup } from './copytrade-v2/buy/buySharedWarmup.js';
import {
    applyPreparedTokenInfoPatch,
    preparePerConfigBuyLiquidity
} from './copytrade-v2/buy/perConfigBuyLiquidity.js';
import { shouldDeferStrongRpcMonitoring } from './copytrade-v2/buy/preConfirmationRpcPolicy.js';
import {
    evaluateCopyTradeDelay,
    getCopyTradeDispatchDetectedAt,
    getCopyTradeDispatchTimingAnchor,
    type CopyTradeTimingSnapshot
} from './copytrade-v2/timing/copyTradeTimingModel.js';
import { emitCopyTradeTimingAudit } from './copytrade-v2/timing/copyTradeTimingAudit.js';
import { executeSwapViaPort } from './swap/swapExecutionPort.js';
import { getReferenceExpectedOutput } from './dex/directSwap/application/quoteEngines.js';
import type { ConfirmationOutcome } from './swap/confirmationCoordinator.js';
import type { MirrorSellAfterConfirmContext } from './copytrade-v2/buy/buyConfirmationTransition.js';
import { evaluateStaleBuySignal } from './copytrade-v2/buy/staleBuyPolicy.js';
import { TRADE_METADATA_PROFILE } from './rpc/profile.js';
import {
    executePositionExit as executePositionExitRuntime,
    checkPositionsForExits as checkPositionsForExitsRuntime,
    type LegacyPositionExitRuntimeDeps
} from './copytrade-v2/runtime/legacyPositionExitRuntime.js';
import {
    processSingleUserBuy as processSingleUserBuyRuntime,
    handleTargetSell as handleTargetSellRuntime
} from './copytrade-v2/runtime/legacyCopytradeBuyRuntime.js';
import {
    getChainSlug,
    getSlippageBps,
    resolveCopytradeSlippageBps,
    getNativeBalance,
    formatTokenAmount,
    resolveExecutionModeForConfig,
    resolveEffectivePositiveThreshold,
    resolveDisplayTokenSymbol,
    resolveDisplayTokenSymbolAsync,
    sendNotificationAsync,
    buildDirectSwapHintFromSwap,
} from './copytrade-v2/runtime/legacyAutoTradeHelpers.js';

export { getTokenInfo } from './tokenService.js';

// Track positions currently being processed for exit to prevent duplicate attempts
const positionsBeingExited = new Set<string>();
const EXIT_INFLIGHT_RETRY_GRACE_MS = getExitInflightRetryGraceMs();
const MIN_POSITION_AGE_FOR_TPSL_MS = Math.max(0, Number(process.env.MIN_POSITION_AGE_FOR_TPSL_MS || '90000'));
const TPSL_CONSECUTIVE_HITS_REQUIRED = Math.max(1, Number(process.env.TPSL_CONSECUTIVE_HITS_REQUIRED || '2'));
const TPSL_HIT_WINDOW_MS = Math.max(1000, Number(process.env.TPSL_HIT_WINDOW_MS || '90000'));
const TPSL_TRACKER_PRUNE_MS = 10 * 60 * 1000;
const tpslHitTracker = new Map<string, { side: 'tp' | 'sl'; hits: number; firstHitAt: number; lastHitAt: number; lastPnlPct: number }>();

type PositionStatusCompat = {
    lockStatuses: string[];
    activeOrLockedStatuses: string[];
    pendingCreateStatus: string;
    failedFinalStatus: string;
};

let positionStatusCompatCache: { value: PositionStatusCompat; ts: number } | null = null;
const POSITION_STATUS_COMPAT_TTL_MS = 30_000;
let zombieCleanupInterval: NodeJS.Timeout | null = null;
let attributionRepairInterval: NodeJS.Timeout | null = null;

async function getPositionStatusCompat(): Promise<PositionStatusCompat> {
    const cached = positionStatusCompatCache;
    if (cached && Date.now() - cached.ts < POSITION_STATUS_COMPAT_TTL_MS) {
        return cached.value;
    }

    try {
        const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
            SELECT e.enumlabel
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = 'PositionStatus'
        `;
        const labels = new Set(rows.map((r) => String(r.enumlabel)));
        const hasFailedFinal = labels.has('failed_final');

        const lockStatuses = ['pending'];

        const compat: PositionStatusCompat = {
            lockStatuses,
            activeOrLockedStatuses: ['open', ...lockStatuses],
            pendingCreateStatus: 'pending',
            failedFinalStatus: hasFailedFinal ? 'failed_final' : 'failed'
        };
        positionStatusCompatCache = { value: compat, ts: Date.now() };
        return compat;
    } catch {
        const fallback: PositionStatusCompat = {
            lockStatuses: ['pending'],
            activeOrLockedStatuses: ['open', 'pending'],
            pendingCreateStatus: 'pending',
            failedFinalStatus: 'failed'
        };
        positionStatusCompatCache = { value: fallback, ts: Date.now() };
        return fallback;
    }
}

function recordTpslHit(positionId: string, side: 'tp' | 'sl', pnlPct: number): number {
    const now = Date.now();
    const current = tpslHitTracker.get(positionId);
    if (!current || current.side !== side || (now - current.lastHitAt) > TPSL_HIT_WINDOW_MS) {
        tpslHitTracker.set(positionId, {
            side,
            hits: 1,
            firstHitAt: now,
            lastHitAt: now,
            lastPnlPct: pnlPct
        });
        return 1;
    }
    const nextHits = current.hits + 1;
    tpslHitTracker.set(positionId, {
        ...current,
        hits: nextHits,
        lastHitAt: now,
        lastPnlPct: pnlPct
    });
    return nextHits;
}

function clearTpslHit(positionId: string): void {
    tpslHitTracker.delete(positionId);
}

function pruneTpslTracker(): void {
    if (tpslHitTracker.size === 0) return;
    const now = Date.now();
    for (const [positionId, state] of tpslHitTracker.entries()) {
        if (now - state.lastHitAt > TPSL_TRACKER_PRUNE_MS) {
            tpslHitTracker.delete(positionId);
        }
    }
}

// Per-user trade locks to prevent concurrent trade execution for same user
const userTradeLocks = new Map<string, Promise<any>>();
const TRADE_LOCK_TIMEOUT_MS = 90000; // 90 seconds max wait for lock

/**
 * Execute a function with per-user locking to prevent concurrent trades
 * This ensures a user can only have ONE trade executing at a time
 * Includes timeout to prevent deadlocks
 */
async function withTradeLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing trade to complete (with timeout)
    const existingLock = userTradeLocks.get(userId);
    if (existingLock) {
        logger.debug(LogCode.WTC_TX_SKIPPED, `Waiting for existing trade lock for user ${userId.slice(0, 10)}...`, { userId });
        try {
            // Race between existing lock and timeout
            await Promise.race([
                existingLock,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Lock timeout')), TRADE_LOCK_TIMEOUT_MS)
                )
            ]);
        } catch (err: any) {
            // If timeout, force clear the stale lock and proceed
            if (err.message === 'Lock timeout') {
                logger.warn(LogCode.SYS_ERROR, 'Trade lock timeout, forcing lock release', { userId: userId.slice(0, 10) });
                userTradeLocks.delete(userId);
            }
            // Ignore other errors from previous trade
        }
    }

    // Create new lock
    const lockPromise = fn();
    userTradeLocks.set(userId, lockPromise);

    try {
        return await lockPromise;
    } finally {
        // Clean up lock after completion
        if (userTradeLocks.get(userId) === lockPromise) {
            userTradeLocks.delete(userId);
        }
    }
}

// Duplicate swap detection cache (prevents processing same swap twice)
const recentSwaps = new Map<string, number>(); // swapKey -> timestamp
const SWAP_DEDUP_WINDOW_MS = 60000; // 1 minute
const LAUNCHPAD_DET_TIMEOUT_MS = Number(process.env.LAUNCHPAD_DET_TIMEOUT_MS || '500');
const COPYTRADE_MAX_DELAY_MS = Number(process.env.COPYTRADE_MAX_DELAY_MS || '45000');
const COPYTRADE_TURBO_MAX_DELAY_MS = Number(process.env.COPYTRADE_TURBO_MAX_DELAY_MS || '12000');
const COPYTRADE_HARD_MAX_DELAY_MS = Number(process.env.COPYTRADE_HARD_MAX_DELAY_MS || '180000');

/**
 * Pure delay check for copy trade (used in processBuyWithInfo; exported for tests).
 * @param detectedAtOrTiming - Legacy detectedAt or structured timing snapshot
 * @param turboMode - If true use COPYTRADE_TURBO_MAX_DELAY_MS, else COPYTRADE_MAX_DELAY_MS
 * @param nowMs - Current time (default Date.now(); inject for tests)
 */
export function isCopyTradeDelayExceeded(
    detectedAtOrTiming: number | CopyTradeTimingSnapshot | undefined,
    turboMode: boolean,
    nowMs: number = Date.now()
): {
    skip: boolean;
    delayMs: number;
    maxDelayMs: number;
    hardDelayMs: number;
    delayAnchor: string;
    reasonCode?: string;
} {
    return evaluateCopyTradeDelay(detectedAtOrTiming, turboMode, {
        maxDelayMs: turboMode ? COPYTRADE_TURBO_MAX_DELAY_MS : COPYTRADE_MAX_DELAY_MS,
        hardMaxDelayMs: COPYTRADE_HARD_MAX_DELAY_MS
    }, nowMs);
}
const COPYTRADE_PRICE_CHECK_TIMEOUT_MS = Number(process.env.COPYTRADE_PRICE_CHECK_TIMEOUT_MS || '1200');
const COPYTRADE_LOG_ERROR_SLICE = Math.max(80, Number(process.env.COPYTRADE_LOG_ERROR_SLICE || '240'));
const NO_OPEN_POSITIONS_LOG_WINDOW_MS = Number(process.env.NO_OPEN_POSITIONS_LOG_WINDOW_MS || '180000');
const COPYTRADE_ENABLE_DETECTION_PREWARM = (process.env.COPYTRADE_ENABLE_DETECTION_PREWARM || 'false') === 'true';
const COPYTRADE_SKIP_ON_DIRECTION_CONFLICT = (process.env.COPYTRADE_SKIP_ON_DIRECTION_CONFLICT || 'true') === 'true';
const COPYTRADE_ENABLE_TOKEN_TO_TOKEN_PARALLEL = (process.env.COPYTRADE_ENABLE_TOKEN_TO_TOKEN_PARALLEL || 'false') === 'true';
const ALLOWED_LAUNCHPAD_PROVIDERS = new Set(['zora', 'fourmeme', 'pumpfun', 'pumpswap', 'bonkfun']);
const COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP = (process.env.COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP || 'true') === 'true';
const DEFAULT_COPYTRADE_SLIPPAGE_BPS = 1500;
const MIN_COPYTRADE_SLIPPAGE_BPS = 50;
const MAX_COPYTRADE_SLIPPAGE_BPS = 5000;
const ATTRIBUTION_REPAIR_INTERVAL_MS = 600_000;
const CHAIN_LAUNCHPAD_PROVIDERS: Record<number, Set<string>> = {
    8453: new Set(['zora']),
    56: new Set(['fourmeme']),
    900: new Set(['pumpfun', 'pumpswap', 'bonkfun'])
};

// State for graceful shutdown and cleanup
let isServiceShuttingDown = false;

// Per-user-per-token-per-sourceTx lock to suppress duplicate webhook fan-out for the same target swap.
// Different target tx hashes for the same token should still be allowed to execute.
const userTokenLocks = new Map<string, number>(); // key -> timestamp
const USER_TOKEN_LOCK_DURATION_MS = 30000; // 30 seconds
const MAX_COPY_TRADE_USD = 1_000_000; // Hard safety cap to prevent absurd buy amounts
type CopyTradeAiAnalysisMode = 'disabled' | 'analyze_only' | 'auto_decide';

function resolveCopyTradeAiMode(config: any): CopyTradeAiAnalysisMode {
    const raw = String(config?.aiAnalysisMode || 'disabled').trim().toLowerCase();
    if (raw === 'analyze_only' || raw === 'auto_decide') return raw;
    return 'disabled';
}

function isJudgeEnabledByCopyTradeConfig(config: any): boolean {
    const mode = resolveCopyTradeAiMode(config);
    return mode === 'analyze_only' || mode === 'auto_decide';
}

function getEnabledCopyTradeAiMode(config: any): 'analyze_only' | 'auto_decide' | null {
    const mode = resolveCopyTradeAiMode(config);
    return mode === 'analyze_only' || mode === 'auto_decide' ? mode : null;
}

function parsePositiveBigInt(value: unknown): bigint {

    try {
        const parsed = BigInt(String(value ?? '0'));
        return parsed > 0n ? parsed : 0n;
    } catch {
        return 0n;
    }
}

async function getSolanaMintBalanceRaw(userId: string, mintAddress: string): Promise<bigint> {
    try {
        const solAddress = await getSolanaEmbeddedWalletAddress(userId);
        if (!solAddress) return 0n;
        // Use fast+critical: this is called on sell reconciliation path (money at stake)
        const connection = getSolanaConnection('fast', 'critical');
        const { value } = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(solAddress),
            { mint: new PublicKey(mintAddress) }
        );
        let balance = 0n;
        for (const acc of value) {
            balance += BigInt(acc.account.data.parsed.info.tokenAmount.amount || '0');
        }
        return balance;
    } catch {
        return 0n;
    }
}

function filterExecutableCopyTradeConfigs(configs: any[], context: { chainId: number; targetWallet: string; token: string }) {
    const executable: any[] = [];
    for (const config of configs) {
        const check = assertConfigExecutable(config, config?.user?.walletAddress || '');
        if (!check.ok) {
            if (check.reason === 'requires_resign') {
                logger.warn(LogCode.WTC_TX_SKIPPED, 'COPYTRADE_LEGACY_CONFIG_REQUIRES_RESIGN', {
                    configId: config?.id,
                    userId: config?.userId,
                    chainId: context.chainId,
                    targetWallet: context.targetWallet,
                });
            }
            logger.warn(LogCode.WTC_TX_SKIPPED, 'CopyTrade config rejected by signature enforcement', {
                event: 'COPYTRADE_SIGNATURE_VERIFY_FAILED',
                configId: config?.id,
                userId: config?.userId,
                chainId: context.chainId,
                targetWallet: context.targetWallet,
                token: context.token,
                signatureCheck: 'fail',
                rejectReason: check.reason || 'unknown'
            });
            continue;
        }
        executable.push(config);
    }
    return executable;
}

function dedupeConfigsByUser(configs: any[]): any[] {
    const picked = new Map<string, any>();
    for (const config of configs) {
        const userId = String(config?.userId || '');
        if (!userId) continue;
        const existing = picked.get(userId);
        if (!existing) {
            picked.set(userId, config);
            continue;
        }
        const existingTs = new Date(existing?.updatedAt || existing?.createdAt || 0).getTime();
        const nextTs = new Date(config?.updatedAt || config?.createdAt || 0).getTime();
        const shouldReplace = Number.isFinite(nextTs) && nextTs >= existingTs;
        if (shouldReplace) picked.set(userId, config);
    }
    return Array.from(picked.values());
}

/**
 * Check if a token is currently locked for a user (trade in progress)
 * If not locked, acquires the lock
 */
function isTokenLockedForUser(userId: string, tokenAddress: string, sourceTxHash?: string): boolean {
    const normalizedTxHash = String(sourceTxHash || '').toLowerCase();
    const key = normalizedTxHash
        ? `${userId}:${tokenAddress.toLowerCase()}:${normalizedTxHash}`
        : `${userId}:${tokenAddress.toLowerCase()}`;
    const lockTime = userTokenLocks.get(key);
    const now = Date.now();

    if (lockTime && now - lockTime < USER_TOKEN_LOCK_DURATION_MS) {
        return true; // Still locked from previous trade attempt
    }

    // Acquire lock
    userTokenLocks.set(key, now);

    // Cleanup old entries periodically
    if (userTokenLocks.size > 500) {
        for (const [k, timestamp] of userTokenLocks.entries()) {
            if (now - timestamp > USER_TOKEN_LOCK_DURATION_MS) {
                userTokenLocks.delete(k);
            }
        }
    }

    return false;
}

/**
 * Generate unique key for a swap to detect duplicates
 */
function getSwapKey(targetWallet: string, swap: DecodedSwap, chainId: number): string {
    if ((swap as any).txHash) {
        return `${targetWallet}-${(swap as any).txHash}-${chainId}`;
    }
    return `${targetWallet}-${swap.tokenIn}-${swap.tokenOut}-${swap.amountIn}-${swap.amountOut}-${chainId}`;
}

/**
 * Check if this swap was recently processed
 */
function isDuplicateSwap(targetWallet: string, swap: DecodedSwap, chainId: number): boolean {
    const key = getSwapKey(targetWallet, swap, chainId);
    const lastSeen = recentSwaps.get(key);

    if (lastSeen && Date.now() - lastSeen < SWAP_DEDUP_WINDOW_MS) {
        // logger.throttled(LogCode.WTC_TX_SKIPPED, `Skipping duplicate swap (last seen ${Date.now() - lastSeen}ms ago)`, { targetWallet, chainId });
        return true;
    }

    // Mark as seen
    recentSwaps.set(key, Date.now());

    // Cleanup old entries (prevent memory leak)
    if (recentSwaps.size > 1000) {
        const now = Date.now();
        for (const [k, timestamp] of recentSwaps.entries()) {
            if (now - timestamp > SWAP_DEDUP_WINDOW_MS) {
                recentSwaps.delete(k);
            }
        }
    }

    return false;
}

async function resolveLaunchpad(
    launchpadPromise: Promise<any> | null | undefined,
    chainId: number
): Promise<any | null> {
    if (!launchpadPromise) return null;
    try {
        const result = await Promise.race([
            launchpadPromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), LAUNCHPAD_DET_TIMEOUT_MS))
        ]);
        if (!result) return null;
        const provider = result?.provider?.toLowerCase?.();
        const chainAllow = CHAIN_LAUNCHPAD_PROVIDERS[chainId];
        if (!provider || !ALLOWED_LAUNCHPAD_PROVIDERS.has(provider) || (chainAllow && !chainAllow.has(provider))) {
            return null;
        }
        return result;
    } catch {
        return null;
    }
}

function getTokenInfoOnce(
    cache: Map<string, Promise<any>>,
    tokenAddress: string,
    chainId: number,
    options: Parameters<typeof getTokenInfo>[2]
): Promise<any> {
    const forceRefresh = options?.forceRefresh ? 'refresh' : 'cached';
    const key = `${chainId}:${tokenAddress.toLowerCase()}:${forceRefresh}`;
    const existing = cache.get(key);
    if (existing) return existing;
    const promise = getTokenInfo(tokenAddress, chainId, options).catch(() => null);
    cache.set(key, promise);
    return promise;
}

async function getDexPriceWithTimeout(tokenAddress: string, chainId: number | 'solana'): Promise<number> {
    try {
        const price = await Promise.race([
            getDexPrice(tokenAddress, chainId),
            new Promise<number>((resolve) => setTimeout(() => resolve(0), COPYTRADE_PRICE_CHECK_TIMEOUT_MS))
        ]);
        return Number.isFinite(price) ? price : 0;
    } catch {
        return 0;
    }
}

function isEntryDeviationPriceUnreliable(chainId: number, tokenInfo: any): boolean {
    if (chainId === 900) return true;
    if (!tokenInfo || typeof tokenInfo !== 'object') return true;
    if (tokenInfo.guardLiquidityReliable === false) return true;

    const poolCount = Number(tokenInfo.guardLiquidityPoolCount ?? 0);
    if (!Number.isFinite(poolCount) || poolCount <= 0) {
        // G6: pool 未被索引时，只有 oracle 价格本身也是 fallback 来源才跳过 BPS 检查。
        // 如果 oracle 有直接价格且没有用 fallback，仍然执行 BPS 检查。
        return Boolean(tokenInfo.priceFallbackUsed) || Number(tokenInfo.price || 0) <= 0;
    }

    const liquiditySource = String(tokenInfo.guardLiquiditySource || '').toLowerCase();
    if (liquiditySource === 'direct_pool_unpriced') return true;

    return false;
}

function compactCopyTradeError(error: any): string {
    return String(error?.message || error || 'unknown_error').slice(0, COPYTRADE_LOG_ERROR_SLICE);
}

function inferCopyTradeBugHint(error: any): string {
    const msg = compactCopyTradeError(error).toLowerCase();
    if (msg.includes('allowance') || msg.includes('approve')) return 'allowance_path';
    if (msg.includes('slippage') || msg.includes('price impact')) return 'slippage_price';
    if (msg.includes('nonce') || msg.includes('replacement')) return 'nonce_conflict';
    if (msg.includes('timeout') || msg.includes('rpc') || msg.includes('network')) return 'rpc_timeout';
    if (msg.includes('quote') || msg.includes('liquidity')) return 'quote_liquidity';
    if (msg.includes('revert')) return 'onchain_revert';
    return 'unknown';
}

function buildCopyTradeNotificationEvidence(
    tokenInfo: any,
    options?: { targetBuyValueUsd?: number }
): Record<string, string | undefined> {
    const meta = tokenInfo?.guardLiquidityMeta && typeof tokenInfo.guardLiquidityMeta === 'object'
        ? tokenInfo.guardLiquidityMeta as Record<string, unknown>
        : null;
    const targetPoolCount = Number(meta?.targetPoolCount ?? 0);
    const targetPoolAddresses = Array.isArray(meta?.targetPoolAddresses) ? meta.targetPoolAddresses : [];
    const preferredProviders = Array.isArray(meta?.preferredProviders) ? meta.preferredProviders : [];

    return {
        targetBuyValue: Number.isFinite(options?.targetBuyValueUsd) && Number(options?.targetBuyValueUsd) > 0
            ? Number(options?.targetBuyValueUsd).toFixed(2)
            : undefined,
        marketCap: tokenInfo?.marketCap ? Number(tokenInfo.marketCap).toFixed(0) : undefined,
        liquidity: tokenInfo?.liquidity ? Number(tokenInfo.liquidity).toFixed(0) : undefined,
        liquidityMode: typeof meta?.mode === 'string' ? String(meta.mode) : undefined,
        liquiditySource: tokenInfo?.guardLiquiditySource ? String(tokenInfo.guardLiquiditySource) : undefined,
        liquidityScanSource: typeof meta?.source === 'string' ? String(meta.source) : undefined,
        liquidityProgram: meta?.dominantProgramLabel ? String(meta.dominantProgramLabel) : (meta?.dominantProgram ? String(meta.dominantProgram) : undefined),
        liquidityPreferredProviders: preferredProviders.length > 0 ? preferredProviders.map(String).join(', ') : undefined,
        liquidityTargetPools: targetPoolCount > 0
            ? `${targetPoolCount}${targetPoolAddresses.length > 0 ? ` (${targetPoolAddresses.length} addressed)` : ''}`
            : undefined,
    };
}

// ... (previous functions remain)

/**
 * Handle detected swap from target wallet
 */
export async function handleSwapDetected(
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number,
    context?: { detectedAt?: number; timing?: CopyTradeTimingSnapshot; sourceBlockTimestampMs?: number }
): Promise<void> {
    const detectedAt = getCopyTradeDispatchDetectedAt(context?.timing, context?.detectedAt) || Date.now();
    // 🛑 SHUTDOWN CHECK (Risk #2 Mitigation)
    if (isServiceShuttingDown) {
        logger.warn(LogCode.SYS_SHUTDOWN, 'Service shutting down, rejecting new swap webhook', { wallet: targetWallet });
        return;
    }

    logger.info(LogCode.WTC_SWAP_DETECTED, 'Swap detected on target wallet', {
        event: 'copytrade_detected',
        wallet: targetWallet,
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        amountIn: swap.amountIn,
        amountOut: swap.amountOut,
        chainId,
        txHash: swap.txHash,
        detectedAt
    });

    // Check for duplicate swap
    if (isDuplicateSwap(targetWallet, swap, chainId)) {
        return; // Skip duplicate
    }

    // Optional pre-warm to avoid adding API pressure/noise on hot webhook paths.
    if (COPYTRADE_ENABLE_DETECTION_PREWARM) {
        Promise.allSettled([
            getTokenInfo(swap.tokenIn, chainId, { priority: 'high', rpcStrategy: TRADE_METADATA_PROFILE, fastMode: true }),
            getTokenInfo(swap.tokenOut, chainId, { priority: 'high', rpcStrategy: TRADE_METADATA_PROFILE, fastMode: true }),
            getNativeTokenPriceUsd(chainId),
            detectLaunchpadToken(swap.tokenOut, chainId),
        ]).catch(() => undefined);
    }

    const direction = determineCopyTradeDirection({
        chainId,
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        cashLegHint: swap.cashLegHint
    });
    const { isBuy, isSell, isTokenToToken } = direction;
    const directionGuardOk = (
        (isBuy && !direction.tokenOutIsCash)
        || (isSell && !direction.tokenInIsCash)
        || (isTokenToToken && !direction.tokenInIsCash && !direction.tokenOutIsCash)
    );

    logger.info(LogCode.SYS_INFO, '[CopyTradeDirectionGuard] evaluated', {
        targetWallet,
        chainId,
        txHash: swap.txHash,
        isBuy,
        isSell,
        isTokenToToken,
        tokenInIsCash: direction.tokenInIsCash,
        tokenOutIsCash: direction.tokenOutIsCash,
        inferredTxType: direction.inferredTxType,
        source: direction.source,
        hintConflict: direction.hintConflict,
        guardOk: directionGuardOk
    });
    if (!directionGuardOk) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping copytrade: direction_guard_violation', {
            targetWallet,
            chainId,
            txHash: swap.txHash,
            tokenIn: swap.tokenIn,
            tokenOut: swap.tokenOut
        });
        return;
    }

    const assetPolicy = evaluateCopytradeSignalAssetPolicy({
        chainId,
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        direction: isSell ? 'sell' : isBuy ? 'buy' : isTokenToToken ? 'token_swap' : 'unknown',
    });
    if (!assetPolicy.allowed) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping copytrade: forbidden_asset', {
            targetWallet,
            chainId,
            txHash: swap.txHash,
            tokenIn: swap.tokenIn,
            tokenOut: swap.tokenOut,
            blockedToken: assetPolicy.blockedToken,
            reasonCode: assetPolicy.reasonCode,
        });
        return;
    }

    logger.debug(LogCode.WTC_SWAP_DETECTED, 'Detection analysis complete', {
        isBuy,
        isSell,
        isTokenToToken,
        tokenInIsCash: direction.tokenInIsCash,
        tokenOutIsCash: direction.tokenOutIsCash,
        source: direction.source,
        inferredTxType: direction.inferredTxType,
        hintConflict: direction.hintConflict
    });

    if (direction.hintConflict && COPYTRADE_SKIP_ON_DIRECTION_CONFLICT) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping copytrade due to direction conflict', {
            targetWallet,
            chainId,
            txHash: swap.txHash,
            tokenIn: swap.tokenIn,
            tokenOut: swap.tokenOut,
            inferredTxType: direction.inferredTxType,
            tokenPairDirection: isBuy ? 'buy' : isSell ? 'sell' : 'neutral'
        });
        return;
    }

    // Persist target wallet activity to WalletTransaction so PnL card always reflects live trades.
    // This is fire-and-forget — it must never block the copy trade execution path.
    if (swap.txHash) {
        const txTypeForPersist: 'TARGET_BUY' | 'TARGET_SELL' | 'TARGET_TOKEN_SWAP' =
            isSell ? 'TARGET_SELL' :
            isTokenToToken ? 'TARGET_TOKEN_SWAP' :
            'TARGET_BUY';
        void persistTargetSwapEvent({
            walletAddress: targetWallet,
            chainId,
            txHash: swap.txHash,
            txType: txTypeForPersist,
            tokenIn: swap.tokenIn,
            tokenOut: swap.tokenOut,
            tokenInAddress: swap.tokenIn,
            tokenOutAddress: swap.tokenOut,
            amountIn: swap.amountIn,
            amountOut: swap.amountOut,
            valueInUsd: swap.cashLegHint?.cashSpentUsd,
            valueOutUsd: swap.cashLegHint?.cashReceivedUsd,
            valueUsd: (swap.cashLegHint?.cashSpentUsd ?? 0) > 0
                ? swap.cashLegHint?.cashSpentUsd
                : swap.cashLegHint?.cashReceivedUsd,
            source: 'webhook',
        }).catch(() => undefined);
    }

    const staleBuyDecision = evaluateStaleBuySignal({
        isBuy,
        sourceBlockTimestampMs: context?.sourceBlockTimestampMs
    });
    if (isBuy && staleBuyDecision.skip) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping copytrade: stale target buy signal', {
            targetWallet,
            chainId,
            txHash: swap.txHash,
            tokenIn: swap.tokenIn,
            tokenOut: swap.tokenOut,
            sourceBlockTimestampMs: staleBuyDecision.sourceBlockTimestampMs || null,
            signalAgeMs: staleBuyDecision.signalAgeMs,
            maxAgeMs: staleBuyDecision.maxAgeMs,
            reasonCode: staleBuyDecision.reasonCode
        });
        return;
    }

    if (isSell) {
        logger.info(LogCode.EXE_TX_BROADCAST, 'Target is selling - triggering mirror sell', { targetWallet, token: swap.tokenIn });
        await handleTargetSell(targetWallet, swap, chainId);
    } else if (isBuy) {
        logger.info(LogCode.EXE_TX_BROADCAST, 'Target is buying - triggering copy trade', { targetWallet, token: swap.tokenOut });
        await handleTargetBuy(targetWallet, swap, chainId, {
            detectedAt,
            timing: context?.timing
        });
    } else if (isTokenToToken) {
        if (!COPYTRADE_ENABLE_TOKEN_TO_TOKEN_PARALLEL) {
            logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping token-to-token activity by policy', {
                targetWallet,
                chainId,
                txHash: swap.txHash,
                tokenIn: swap.tokenIn,
                tokenOut: swap.tokenOut
            });
            return;
        }
        logger.info(LogCode.EXE_TX_BROADCAST, 'Parallel lightning trigger: SELL and BUY starting simultaneously', { targetWallet });
        await Promise.all([
            handleTargetSell(targetWallet, swap, chainId).catch(e => logger.error(LogCode.EXE_TX_REVERTED, 'Parallel sell error', {
                error: compactCopyTradeError(e),
                bugHint: inferCopyTradeBugHint(e),
                txHash: swap.txHash,
                chainId
            })),
            handleTargetBuy(targetWallet, swap, chainId, {
                detectedAt,
                timing: context?.timing
            }).catch(e => logger.error(LogCode.EXE_TX_REVERTED, 'Parallel buy error', {
                error: compactCopyTradeError(e),
                bugHint: inferCopyTradeBugHint(e),
                txHash: swap.txHash,
                chainId
            }))
        ]);
    } else {
        // logger.throttled(LogCode.WTC_TX_SKIPPED, 'Cash-to-Cash or ignored swap type detected', { tokenIn: swap.tokenIn, tokenOut: swap.tokenOut });
    }
}

/**
 * Handle Target BUYING a token -> We BUY that token
 */
async function handleTargetBuy(
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number,
    context?: { detectedAt?: number; timing?: CopyTradeTimingSnapshot }
): Promise<void> {
    // Find all configs watching this wallet
    // NOTE: Solana addresses are case-sensitive (Base58), only lowercase EVM addresses
    const normalizedWallet = normalizeAddress(targetWallet);

    const tokenToBuy = swap.tokenOut;
    const detectedAt = getCopyTradeDispatchDetectedAt(context?.timing, context?.detectedAt) ?? Date.now();
    logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTradeTiming] target buy start', {
        targetWallet,
        token: tokenToBuy,
        chainId,
        txHash: swap.txHash,
        detectedAt,
        firstSeenAt: context?.timing?.firstSeenAt || null,
        swapReadyAt: context?.timing?.swapReadyAt || null,
        dispatchEligibleAt: context?.timing?.dispatchEligibleAt || null,
        elapsedMs: Date.now() - detectedAt
    });
    emitCopyTradeTimingAudit('target_buy_start', context?.timing, {
        targetWallet,
        token: tokenToBuy,
        chainId,
        txHash: swap.txHash,
        dispatchDetectedAt: detectedAt
    });

    logger.debug(LogCode.EXE_QUOTE_FETCHED, `Fast path execution started for ${tokenToBuy}`, { targetWallet, token: tokenToBuy });

    const rawConfigsFound = await cacheHub.getCopyTradeConfigs(
        normalizedWallet,
        chainId,
        () => withRetry(() => prisma.copyTradeConfig.findMany({
            where: {
                targetWallet: { mode: 'insensitive', equals: normalizedWallet },
                chainId,
                status: 'active',
            },
        }))
    ) as any[];

    const rawConfigs = rawConfigsFound.filter((config) =>
        normalizeAddress(config?.targetWallet || '') === normalizedWallet
    );

    if (rawConfigs.length === 0) {
        logger.throttled(LogCode.WTC_TX_SKIPPED, 'No active configurations found for this wallet', { targetWallet, chainId });
        return;
    }
    if (rawConfigsFound.length !== rawConfigs.length) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Filtered mismatched target wallet configs on buy path', {
            targetWallet: normalizedWallet,
            chainId,
            found: rawConfigsFound.length,
            matched: rawConfigs.length
        });
    }

    const userIds = [...new Set(rawConfigs.map(c => c.userId))];
    // ⚡ Fire token metadata in parallel with the shared warmup so both arrive together.
    const turboMetaPromise = getTokenMetadata(chainId, tokenToBuy, {
        rpcStrategy: TRADE_METADATA_PROFILE.strategy,
        profile: TRADE_METADATA_PROFILE,
    }).catch(() => null);
    const sharedWarmup = await getCopytradeBuySharedWarmup(chainId, userIds);
    const userMap = sharedWarmup.userMap;
    const allowSelfTarget = (process.env.COPYTRADE_ALLOW_SELF_TARGET || 'false') === 'true';
    const configs = rawConfigs
        .map((c: any) => ({
            ...c,
            user: userMap.get(c.userId),
            executionMode: resolveExecutionModeForConfig(c),
            // safe: full path, normal/turbo: fast path enabled (all EVM chains)
            fastExecutionEnabled: resolveExecutionModeForConfig(c) !== 'safe'
        }))
        .filter((c) => Boolean(c.user))
        .filter((c) => {
            if (allowSelfTarget) return true;
            const userWallet = normalizeAddress(c.user?.walletAddress || '');
            const isSelfTarget = userWallet !== '' && userWallet === normalizedWallet;
            if (isSelfTarget) {
                logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping self-target copytrade config (safety)', {
                    configId: c.id,
                    userId: c.userId,
                    targetWallet: normalizedWallet
                });
                return false;
            }
            return true;
        });

    if (configs.length === 0) {
        logger.throttled(LogCode.WTC_TX_SKIPPED, 'No valid user records for configs', { targetWallet, chainId });
        return;
    }

    const executableConfigs = filterExecutableCopyTradeConfigs(configs, {
        chainId,
        targetWallet: normalizedWallet,
        token: tokenToBuy,
    });
    if (executableConfigs.length === 0) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'No executable copy trade configs after signature validation', {
            chainId,
            targetWallet: normalizedWallet,
            token: tokenToBuy,
        });
        return;
    }

    const uniqueExecutableConfigs = dedupeConfigsByUser(executableConfigs);
    if (uniqueExecutableConfigs.length !== executableConfigs.length) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Buy path deduped duplicate configs for same user', {
            targetWallet: normalizedWallet,
            chainId,
            txHash: swap.txHash,
            originalConfigs: executableConfigs.length,
            dedupedConfigs: uniqueExecutableConfigs.length
        });
    }

    logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTrade] Executable buy configs ready', {
        chainId,
        targetWallet: normalizedWallet,
        token: tokenToBuy,
        configCount: uniqueExecutableConfigs.length,
        configIds: uniqueExecutableConfigs.slice(0, 8).map((c: any) => c.id)
    });

    const tokenInfoCache = new Map<string, Promise<any>>();

    const launchpadPromise = (chainId === 8453 || chainId === 56 || chainId === 900)
        ? detectLaunchpadToken(tokenToBuy, chainId).catch(() => null)
        : Promise.resolve(null);

    const skipTokenInfo = uniqueExecutableConfigs.every(c => c.executionMode === 'turbo');
    if (skipTokenInfo) {
        try {
            const { tokenInfo: fallbackInfo, metadataTimedOut } = await resolveTurboMetadataFallbackInfo({
                tokenAddress: tokenToBuy,
                metadataPromise: turboMetaPromise,
                timeoutMs: TRADE_METADATA_PROFILE.latencyBudgetMs || 900,
                metadataProfile: TRADE_METADATA_PROFILE,
                getTokenDecimals,
                chainId,
            });

            logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTrade] Token info disabled - using RPC metadata fallback', {
                token: tokenToBuy,
                chainId,
                provider: fallbackInfo.provider,
                metadataTimedOut,
            });

            await processBuyWithInfo(targetWallet, tokenToBuy, swap, chainId, uniqueExecutableConfigs, fallbackInfo, true, launchpadPromise, tokenInfoCache, sharedWarmup, context?.timing, detectedAt);
            return;
        } catch (err: any) {
            logger.warn(LogCode.API_FETCH_FAILED, '[CopyTrade] Token info disabled but metadata fallback failed', {
                token: tokenToBuy,
                error: err?.message?.slice(0, 120)
            });
            // Fall through to standard flow
        }
    }

    const tokenInfoPromise = getTokenInfoOnce(tokenInfoCache, tokenToBuy, chainId, { priority: 'high', rpcStrategy: TRADE_METADATA_PROFILE, fastMode: true });
    const tokenInfo = await tokenInfoPromise;
    const launchpadResult = await resolveLaunchpad(launchpadPromise, chainId);

    if (!tokenInfo || tokenInfo.price <= 0) {
        if (launchpadResult && launchpadResult.data) {
            logger.warn(LogCode.DEC_FAILED_UNKNOWN_DEX, `${tokenToBuy} missing DexScreener info - using Launchpad fallback`, {
                provider: launchpadResult.provider,
                token: tokenToBuy
            });

            const lpData = launchpadResult.data;
            const lpPrice = lpData.tokenPrice?.priceInUsdc || lpData.tokenPrice?.usd;
            const lpMarketCap = parseFloat(lpData.marketCap || '0');
            const lpVolume = parseFloat(lpData.volume24h || lpData.totalVolume || '0');

            const fallbackInfo = {
                price: typeof lpPrice === 'string' ? parseFloat(lpPrice) : (lpPrice || 0),
                symbol: lpData.symbol || 'UNKNOWN',
                name: lpData.name || 'Unknown Token',
                decimals: lpData.decimals || 18,
                liquidity: lpMarketCap, // Use marketCap as proxy for liquidity
                volume24h: lpVolume,
                fdv: lpMarketCap,
                marketCap: lpMarketCap,
                pairCreatedAt: lpData.createdAt ? new Date(lpData.createdAt).getTime() : Date.now(),
                socials: [],
                websites: [],
                provider: launchpadResult.provider
            };
            await processBuyWithInfo(targetWallet, tokenToBuy, swap, chainId, uniqueExecutableConfigs, fallbackInfo, true, launchpadPromise, tokenInfoCache, sharedWarmup, context?.timing, detectedAt);
            return;
        }

        const allowFastFallback = configs.some((c: any) => c.fastExecutionEnabled !== false);
        if (allowFastFallback) {
            try {
                const meta = await getTokenMetadata(chainId, tokenToBuy, {
                    rpcStrategy: TRADE_METADATA_PROFILE.strategy,
                    profile: TRADE_METADATA_PROFILE,
                });
                const fallbackInfo = {
                    price: 0,
                    symbol: meta?.symbol || 'UNKNOWN',
                    name: meta?.name || 'Unknown Token',
                    decimals: meta?.decimals || 18,
                    liquidity: 0,
                    volume24h: 0,
                    fdv: 0,
                    marketCap: 0,
                    pairCreatedAt: Date.now(),
                    socials: [],
                    websites: [],
                    provider: 'rpc-metadata'
                };

                logger.warn(LogCode.API_FETCH_FAILED, 'RPC price missing - proceeding with metadata-only fallback (fast mode)', {
                    token: tokenToBuy,
                    chainId
                });

                await processBuyWithInfo(targetWallet, tokenToBuy, swap, chainId, uniqueExecutableConfigs, fallbackInfo, true, launchpadPromise, tokenInfoCache, sharedWarmup, context?.timing, detectedAt);
                return;
            } catch (metaErr: any) {
                logger.warn(LogCode.API_FETCH_FAILED, 'Metadata fallback failed', { token: tokenToBuy, error: metaErr.message });
            }
        }

        logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: No valid token information or price found', { targetWallet, token: tokenToBuy });
        return;
    }

    await processBuyWithInfo(targetWallet, tokenToBuy, swap, chainId, uniqueExecutableConfigs, tokenInfo, false, launchpadPromise, tokenInfoCache, sharedWarmup, context?.timing, detectedAt);
}

/**
 */
async function processBuyWithInfo(
    targetWallet: string,
    tokenToBuy: string,
    swap: DecodedSwap,
    chainId: number,
    configs: any[],
    tokenInfo: any,
    isFallbackMode: boolean,
    launchpadPromise?: Promise<any>,
    tokenInfoCache?: Map<string, Promise<any>>,
    sharedWarmup?: Awaited<ReturnType<typeof getCopytradeBuySharedWarmup>>,
    timing?: CopyTradeTimingSnapshot,
    detectedAt?: number
) {
    const PROFILE = process.env.COPYTRADE_PROFILE ? process.env.COPYTRADE_PROFILE === 'true' : true;
    const tStart = Date.now();
    tokenInfo.tokenAddress = tokenToBuy;
    const targetValueSnapshot = await computeBuyTargetValueSnapshot(swap, chainId, tokenInfo);
    let targetSwapValueUsd = targetValueSnapshot.targetSwapValueUsd;
    let strictTargetSwapValueUsd = targetValueSnapshot.strictTargetSwapValueUsd;
    let strictTargetSwapValueReliable = targetValueSnapshot.strictTargetSwapValueReliable;
    let strictTargetSwapValueSource = targetValueSnapshot.strictTargetSwapValueSource;
    const strictMinGuardRequired = targetValueSnapshot.strictMinGuardRequired;

    let judgeDecisionId: string | null = null;

    if (!Number.isFinite(targetSwapValueUsd) || targetSwapValueUsd < 0) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Target swap value is invalid; forcing value to 0 for safety', {
            txHash: swap.txHash,
            targetWallet,
            chainId,
            rawValue: targetSwapValueUsd
        });
        targetSwapValueUsd = 0;
    }
    if (!Number.isFinite(strictTargetSwapValueUsd) || strictTargetSwapValueUsd < 0) {
        strictTargetSwapValueUsd = 0;
        strictTargetSwapValueReliable = false;
        strictTargetSwapValueSource = 'invalid';
    }
    if (strictTargetSwapValueReliable && strictTargetSwapValueUsd > 0 && targetSwapValueUsd > 0) {
        const ratio = targetSwapValueUsd / strictTargetSwapValueUsd;
        if (ratio > 1.5 || ratio < (1 / 1.5)) {
            logger.warn(LogCode.DATA_CORRUPTION, '[CopyTrade] Target value mismatch between broad estimate and strict cash guard', {
                txHash: swap.txHash,
                chainId,
                tokenIn: swap.tokenIn,
                broadValueUsd: Number(targetSwapValueUsd.toFixed(4)),
                strictValueUsd: Number(strictTargetSwapValueUsd.toFixed(4)),
                strictSource: strictTargetSwapValueSource,
                ratio: Number(ratio.toFixed(4))
            });
        }
    }
    const valueMs = Date.now() - tStart;

    if ((!tokenInfo.price || tokenInfo.price <= 0) && targetSwapValueUsd > 0) {
        try {
            const amountOutBN = BigInt(swap.amountOut);
            const decimals = tokenInfo.decimals || 18;
            const amountOutFloat = Number(ethers.formatUnits(amountOutBN, decimals));

            if (amountOutFloat > 0) {
                const impliedPrice = targetSwapValueUsd / amountOutFloat;
                tokenInfo.price = impliedPrice;
                logger.info(LogCode.DATA_RECOVERY, 'Derived missing token price from swap data', {
                    symbol: tokenInfo.symbol,
                    impliedPrice: impliedPrice.toFixed(9),
                    valueUsd: targetSwapValueUsd
                });

                if (chainId !== 900 && (!tokenInfo.marketCap || tokenInfo.marketCap <= 0)) {
                    try {
                        scheduleAsyncMarketCapHydration({
                            chainId,
                            tokenAddress: tokenToBuy,
                            impliedPrice,
                            decimals,
                            getTokenSupply,
                            profile: TRADE_METADATA_PROFILE,
                            onResolved: (marketCap, totalSupply) => {
                                tokenInfo.marketCap = marketCap;
                                tokenInfo.fdv = marketCap;
                                logger.info(LogCode.DATA_RECOVERY, 'Derived EVM market cap from RPC supply and implied price', {
                                    token: tokenToBuy,
                                    marketCap,
                                    totalSupply,
                                    impliedPrice
                                });
                            },
                            onError: (supplyErr) => {
                                logger.warn(LogCode.API_FETCH_FAILED, 'Failed to derive EVM market cap from RPC supply', {
                                    token: tokenToBuy,
                                    error: supplyErr instanceof Error ? supplyErr.message : String(supplyErr)
                                });
                            }
                        });
                    } catch (supplyErr: any) {
                        logger.warn(LogCode.API_FETCH_FAILED, 'Failed to derive EVM market cap from RPC supply', {
                            token: tokenToBuy,
                            error: supplyErr?.message || String(supplyErr)
                        });
                    }
                }

                if (chainId === 900 && (!tokenInfo.marketCap || tokenInfo.marketCap <= 0)) {
                    try {
                        const supplyResp = await callRpc<any>('solana', 'getTokenSupply', [tokenToBuy], {
                            rpcClass: 'best_effort_read',
                            path: 'token_supply_market_cap'
                        });
                        const rawAmount = String(supplyResp?.value?.amount || '0');
                        const supplyDecimals = Number(supplyResp?.value?.decimals ?? decimals);
                        const totalSupply = Number(rawAmount) / Math.pow(10, Number.isFinite(supplyDecimals) ? supplyDecimals : decimals);
                        if (Number.isFinite(totalSupply) && totalSupply > 0) {
                            tokenInfo.marketCap = totalSupply * impliedPrice;
                            tokenInfo.fdv = tokenInfo.marketCap;
                            logger.info(LogCode.DATA_RECOVERY, 'Derived Solana market cap from RPC supply and implied price', {
                                token: tokenToBuy,
                                marketCap: tokenInfo.marketCap,
                                totalSupply,
                                impliedPrice
                            });
                        }
                    } catch (supplyErr: any) {
                        logger.warn(LogCode.API_FETCH_FAILED, 'Failed to derive Solana market cap from RPC supply', {
                            token: tokenToBuy,
                            error: supplyErr?.message || String(supplyErr)
                        });
                    }
                }
            }
        } catch (err) {
            logger.warn(LogCode.DATA_CORRUPTION, 'Failed to derive implied price', { error: err });
        }
    }

    const preparedBuyLiquidity = await preparePerConfigBuyLiquidity({ tokenToBuy, chainId, swap, tokenInfo, configs });
    applyPreparedTokenInfoPatch(preparedBuyLiquidity, {
        price: tokenInfo.price,
        marketCap: tokenInfo.marketCap,
        fdv: tokenInfo.fdv,
        provider: tokenInfo.provider
    });
    tokenInfo = preparedBuyLiquidity.sharedTokenInfo;
    const liquidityGuardSnapshot = preparedBuyLiquidity.sharedLiquidityGuardSnapshot;
    const tokenInfoByConfigId = preparedBuyLiquidity.tokenInfoByConfigId;
    const liquidityGuardSnapshotByConfigId = preparedBuyLiquidity.liquidityGuardSnapshotByConfigId;

    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Processing configurations for buy', {
        count: configs.length,
        price: tokenInfo.price,
        fallback: isFallbackMode,
        guardLiquidityUsd: liquidityGuardSnapshot.liquidityUsd,
        guardLiquiditySource: liquidityGuardSnapshot.source,
        guardLiquidityReliable: liquidityGuardSnapshot.reliable,
        guardLiquidityPoolCount: liquidityGuardSnapshot.poolCount,
        guardLiquidityMeta: liquidityGuardSnapshot.metadata || undefined,
    });

    if (chainId === 900 && tokenInfo.price > 0 && (!tokenInfo.marketCap || tokenInfo.marketCap <= 0)) {
        try {
            const supplyResp = await callRpc<any>('solana', 'getTokenSupply', [tokenToBuy], {
                rpcClass: 'best_effort_read',
                path: 'token_supply_market_cap'
            });
            const supplyRaw = String(supplyResp?.value?.amount || '0');
            const supplyDecimals = Number(supplyResp?.value?.decimals ?? tokenInfo.decimals ?? 6);
            const totalSupply = Number(supplyRaw) / Math.pow(10, Number.isFinite(supplyDecimals) ? supplyDecimals : 6);
            if (Number.isFinite(totalSupply) && totalSupply > 0) {
                tokenInfo.marketCap = totalSupply * Number(tokenInfo.price);
                tokenInfo.fdv = tokenInfo.marketCap;
                logger.info(LogCode.DATA_RECOVERY, 'Hydrated Solana market cap from RPC supply', {
                    token: tokenToBuy,
                    marketCap: tokenInfo.marketCap,
                    totalSupply,
                    price: tokenInfo.price
                });
            }
        } catch (supplyErr: any) {
            logger.warn(LogCode.API_FETCH_FAILED, 'Unable to hydrate Solana market cap from RPC supply', {
                token: tokenToBuy,
                error: supplyErr?.message || String(supplyErr)
            });
        }
    }

    recordNewTrade(targetWallet, chainId, 'buy', targetSwapValueUsd);

    const turboConfigs = configs.filter((c) => resolveExecutionModeForConfig(c) === 'turbo');
    const normalConfigs = configs.filter((c) => resolveExecutionModeForConfig(c) !== 'turbo');

    if (turboConfigs.length > 0) {
        const turboUserIds = [...new Set(turboConfigs.map(c => c.userId).filter(Boolean))];
        const quickNativePrice = sharedWarmup!.nativePriceUsd;
        const turboUserSettingsMap = sharedWarmup!.userSettingsMap;
        logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTrade] Turbo fast lane enabled', {
            userCount: turboConfigs.length,
            token: tokenToBuy,
            chainId
        });

        const turboResults = await Promise.allSettled(
            turboConfigs.map((config) =>
                processSingleUserBuy(
                    config,
                    turboUserSettingsMap.get(config.userId),
                    targetWallet,
                    tokenToBuy,
                    swap,
                    chainId,
                    tokenInfoByConfigId.get(config.id) || tokenInfo,
                    targetSwapValueUsd,
                    strictTargetSwapValueUsd,
                    strictTargetSwapValueReliable,
                    strictTargetSwapValueSource,
                    strictMinGuardRequired,
                    isFallbackMode,
                    1.0,
                    quickNativePrice,
                    launchpadPromise,
                    tokenInfoCache,
                    timing,
                    detectedAt
                )
            )
        );

        const turboSummary = summarizeSingleUserBuyResults(turboResults);
        logger.info(LogCode.EXE_TX_CONFIRMED, '[CopyTrade] Turbo fast lane complete', {
            userCount: turboConfigs.length,
            success: turboSummary.submitted,
            submitted: turboSummary.submitted,
            confirmed: turboSummary.confirmed,
            awaitingVisibility: turboSummary.awaitingVisibility,
            executed: turboSummary.executed,
            pending: turboSummary.pending,
            skipped: turboSummary.skipped,
            failed: turboSummary.failed,
            totalMs: Date.now() - tStart
        });
    }

    if (normalConfigs.length === 0) {
        return;
    }
    const workingConfigs = normalConfigs;

    // =================================================================
    // 🚀 SMART BATCH EXECUTION ENGINE
    // Handles 200+ users with liquidity awareness and adaptive batching
    // =================================================================

    // ⚡ PERFORMANCE OPTIMIZATION: Fetch shared data ONCE for all users via Cache Hub
    const cacheStart = Date.now();
    const userSettingsMap = sharedWarmup!.userSettingsMap;
    const sharedNativePrice = sharedWarmup!.nativePriceUsd;
    const cacheMs = Date.now() - cacheStart;

    logger.debug(LogCode.EXE_QUOTE_FETCHED, '⚡ Shared data fetched via Cache Hub', {
        userCount: configs.length,
        userCountTurboBypassed: turboConfigs.length,
        nativePrice: sharedNativePrice,
        settingsFetched: userSettingsMap.size
    });

    // ⚡ BATCH FILTER: Pre-filter users IN PARALLEL (优化: 串行 → 并行)
    // 🚀 100 users: 500ms (serial) → ~5ms (parallel)
    const filterStart = Date.now();
    const filterResults = await Promise.all(
        workingConfigs.map(async (config) => {
            const userSettings = userSettingsMap.get(config.userId);
            const guardedTokenInfo = tokenInfoByConfigId.get(config.id) || tokenInfo;
            const guardedLiquiditySnapshot = liquidityGuardSnapshotByConfigId.get(config.id) || liquidityGuardSnapshot;
            const universalSlippageBps = resolveCopytradeSlippageBps(config, userSettings);
            const executionMode = resolveExecutionModeForConfig(config);
            const entryDeviationPolicy = resolveEntryDeviationModePolicy(config, executionMode);
            const effectiveConfig = {
                ...config,
                minMarketCapUsd: resolveEffectivePositiveThreshold(config.minMarketCapUsd, null),
                minLiquidityUsd: resolveEffectivePositiveThreshold(config.minLiquidityUsd, null),
                minTargetValueUsd: resolveEffectiveMinTargetValueUsd(config, null),
                maxSlippageBps: universalSlippageBps,
                maxEntryDeviationBps: entryDeviationPolicy.maxEntryDeviationBps,
                maxEntryDeviationSource: entryDeviationPolicy.source,
                maxEntryDeviationReasonCode: entryDeviationPolicy.reasonCode,
                maxEntryDeviationThresholdPolicy: entryDeviationPolicy.thresholdPolicy,
                maxEntryDeviationModeFloorBps: entryDeviationPolicy.modeFloorBps,
            };

            const filterResult = await evaluateStaticBuyGuards(
                guardedTokenInfo,
                effectiveConfig,
                targetSwapValueUsd,
                resolveBuyGuardPolicy(executionMode),
                {
                    targetValueSnapshot,
                    liquidityGuardSnapshot: guardedLiquiditySnapshot
                }
            );
            return { config, filterResult, effectiveConfig, userSettings, guardedTokenInfo };
        })
    );
    const filterMs = Date.now() - filterStart;

    const eligibleConfigs: any[] = [];
    const skippedUsers: any[] = [];

    for (const { config, filterResult, effectiveConfig } of filterResults) {
        if (filterResult.passed) {
            eligibleConfigs.push(config);
        } else {
            skippedUsers.push({
                config,
                reason: filterResult.reason,
                policy: resolveBuyGuardPolicy(resolveExecutionModeForConfig(config)),
                effectiveConfig
            });
        }
    }

    logger.info(LogCode.EXE_QUOTE_FETCHED, '🔍 Batch filter complete (PARALLEL)', {
        total: configs.length,
        totalTurboBypassed: turboConfigs.length,
        eligible: eligibleConfigs.length,
        skipped: skippedUsers.length
    });
    emitBatchFilterAudit({
        targetWallet,
        token: tokenToBuy,
        chainId,
        total: configs.length,
        eligible: eligibleConfigs.length,
        skippedUsers
    });

    // Send notifications to skipped users (async, non-blocking)
    setImmediate(() => {
        skippedUsers.forEach(({ config, reason }) => {
            notificationService.sendNotification({
                userId: config.userId,
                farcasterFid: config.user?.farcasterFid,
                type: 'COPY_TRADE_SKIPPED',
                data: {
                    tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                    tokenAddress: tokenToBuy,
                    targetWallet: targetWallet,
                    chainId: chainId,
                    skipReason: reason,
                    ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: targetSwapValueUsd }),
                }
            }).catch(() => { }); // Ignore notification errors
        });
    });

    // If no eligible users, exit early
    if (eligibleConfigs.length === 0) {
        logger.info(LogCode.WTC_TX_SKIPPED, 'No eligible users after batch filter', {
            targetWallet,
            token: tokenToBuy,
            chainId,
            topReasons: skippedUsers
                .slice(0, 5)
                .map((entry: any) => entry.reason || 'unknown')
        });
        return;
    }

    // Calculate total volume for ELIGIBLE users only
    const totalVolumeUsd = eligibleConfigs.reduce((sum, c) => sum + (c.buyAmountUsd || 0), 0);
    const liquidity = eligibleConfigs.reduce((max, config) => {
        const guardedLiquidity = Number((tokenInfoByConfigId.get(config.id) || tokenInfo).liquidity || 0);
        return Number.isFinite(guardedLiquidity) && guardedLiquidity > max ? guardedLiquidity : max;
    }, 0);

    // 🛡️ LIQUIDITY PROTECTION: Limit total buy to 30% of liquidity
    const MAX_LIQUIDITY_IMPACT_PERCENT = 30;
    const maxAllowedVolumeUsd = liquidity * (MAX_LIQUIDITY_IMPACT_PERCENT / 100);

    logger.info(LogCode.EXE_QUOTE_FETCHED, '📊 Mass Copy Trade Analysis', {
        userCount: configs.length,
        totalVolumeUsd: totalVolumeUsd.toFixed(2),
        liquidity: liquidity.toFixed(2),
        maxAllowedVolumeUsd: maxAllowedVolumeUsd.toFixed(2),
        willScale: totalVolumeUsd > maxAllowedVolumeUsd
    });

    // Calculate scaling factor if we need to reduce individual amounts
    let scalingFactor = 1.0;
    if (liquidity > 0 && totalVolumeUsd > maxAllowedVolumeUsd) {
        scalingFactor = maxAllowedVolumeUsd / totalVolumeUsd;
        logger.warn(LogCode.WTC_TX_SKIPPED, `⚠️ Scaling down trades to protect liquidity`, {
            originalTotal: totalVolumeUsd.toFixed(2),
            scaledTotal: maxAllowedVolumeUsd.toFixed(2),
            scalingFactor: scalingFactor.toFixed(3)
        });
    }

    // 🎯 SMART BATCHING: Adjust batch size based on liquidity
    // More liquidity = larger batches (faster), Less liquidity = smaller batches (safer)
    const BASE_BATCH_SIZE = 10;
    const liquidityRatio = liquidity > 0 ? totalVolumeUsd / liquidity : 1;
    let dynamicBatchSize: number;

    if (liquidityRatio < 0.05) {
        // Very high liquidity relative to volume - go fast
        dynamicBatchSize = 30;
    } else if (liquidityRatio < 0.15) {
        // Good liquidity - moderate speed
        dynamicBatchSize = 20;
    } else if (liquidityRatio < 0.30) {
        // Tight liquidity - be careful
        dynamicBatchSize = 10;
    } else {
        // Very tight liquidity - go slow to minimize price impact
        dynamicBatchSize = 5;
    }

    const sortedConfigs = [...eligibleConfigs].sort((a, b) => (b.buyAmountUsd || 0) - (a.buyAmountUsd || 0));

    let successCount = 0;
    let pendingCount = 0;
    let executionSkippedCount = 0;
    let failCount = 0;
    let currentPriceMultiplier = 1.0; // Track price drift during execution

    const execStart = Date.now();
    for (let i = 0; i < sortedConfigs.length; i += dynamicBatchSize) {
        const batch = sortedConfigs.slice(i, i + dynamicBatchSize);
        const batchNum = Math.floor(i / dynamicBatchSize) + 1;
        const totalBatches = Math.ceil(sortedConfigs.length / dynamicBatchSize);

        logger.info(LogCode.EXE_TX_BROADCAST, `📦 Processing batch ${batchNum}/${totalBatches}`, {
            batchSize: batch.length,
            priceMultiplier: currentPriceMultiplier.toFixed(3)
        });

        const results = await Promise.allSettled(
            batch.map(config =>
                processSingleUserBuy(
                    config,
                    userSettingsMap.get(config.userId),
                    targetWallet,
                    tokenToBuy,
                    swap,
                    chainId,
                    tokenInfoByConfigId.get(config.id) || tokenInfo,
                    targetSwapValueUsd,
                    strictTargetSwapValueUsd,
                    strictTargetSwapValueReliable,
                    strictTargetSwapValueSource,
                    strictMinGuardRequired,
                    isFallbackMode,
                    scalingFactor, // Pass scaling factor to reduce individual amounts
                    sharedNativePrice, // ⚡ Pass shared native price to avoid repeated queries
                    launchpadPromise,
                    tokenInfoCache,
                    timing,
                    detectedAt
                ).catch(error => {
                    logger.error(LogCode.SYS_ERROR, `Error in batch execution`, {
                        configId: config.id,
                        userId: config.userId,
                        error: error.message
                    });
                    throw error;
                })
            )
        );

        const batchSummary = summarizeSingleUserBuyResults(results);
        successCount += batchSummary.executed;
        pendingCount += batchSummary.pending;
        executionSkippedCount += batchSummary.skipped;
        failCount += batchSummary.failed;

        if (i + dynamicBatchSize < sortedConfigs.length) {
            const batchVolumeUsd = batch.reduce((sum, c) => sum + ((c.buyAmountUsd || 0) * scalingFactor), 0);
            const impactRatio = liquidity > 0 ? batchVolumeUsd / liquidity : 0;

            const adaptiveDelay = 100 + Math.min(400, Math.floor(impactRatio * 2000));

            await new Promise(resolve => setTimeout(resolve, adaptiveDelay));

            if (impactRatio > 0.05 && i + dynamicBatchSize * 2 < sortedConfigs.length) {
                let step1Request: MainSwapRequest | undefined;
                try {
                    const freshInfo = tokenInfoCache
                        ? await getTokenInfoOnce(tokenInfoCache, tokenToBuy, chainId, { forceRefresh: true, priority: 'high', rpcStrategy: TRADE_METADATA_PROFILE })
                        : await getTokenInfo(tokenToBuy, chainId, { forceRefresh: true, priority: 'high', rpcStrategy: TRADE_METADATA_PROFILE });
                    if (freshInfo && freshInfo.price > 0 && tokenInfo.price > 0) {
                        currentPriceMultiplier = freshInfo.price / tokenInfo.price;

                        if (currentPriceMultiplier > 1.5) {
                            logger.warn(LogCode.WTC_TX_SKIPPED, `🛑 Circuit breaker triggered: Price pumped ${((currentPriceMultiplier - 1) * 100).toFixed(1)}%`, {
                                originalPrice: tokenInfo.price,
                                currentPrice: freshInfo.price,
                                remainingUsers: sortedConfigs.length - i - dynamicBatchSize
                            });

                            const remainingConfigs = sortedConfigs.slice(i + dynamicBatchSize);
                            for (const config of remainingConfigs) {
                                await notificationService.sendNotification({
                                    userId: config.userId,
                                    farcasterFid: config.user?.farcasterFid,
                                    type: 'COPY_TRADE_SKIPPED',
                                    data: {
                                        tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                                        tokenAddress: tokenToBuy,
                                        targetWallet: targetWallet,
                                        chainId: chainId,
                                        skipReason: `Price pumped ${((currentPriceMultiplier - 1) * 100).toFixed(0)}% - trade skipped for safety`,
                                    }
                                }).catch(() => { }); // Ignore notification errors
                            }
                            break;
                        }
                    }
                } catch (err) {
                }
            }
        }
    }
    const execMs = Date.now() - execStart;

    logger.info(LogCode.EXE_TX_CONFIRMED, `✅ Smart batch execution complete`, {
        targetWallet,
        token: tokenToBuy,
        totalUsers: workingConfigs.length + turboConfigs.length,
        success: successCount,
        executed: successCount,
        pending: pendingCount,
        skipped: skippedUsers.length + executionSkippedCount,
        prefilterSkipped: skippedUsers.length,
        executionSkipped: executionSkippedCount,
        failed: failCount,
        scalingFactor: scalingFactor.toFixed(3),
        batchSize: dynamicBatchSize,
        finalPriceMultiplier: currentPriceMultiplier.toFixed(3),
        ...(PROFILE ? {
            profile: {
                valueMs,
                cacheMs,
                filterMs,
                execMs,
                totalMs: Date.now() - tStart
            }
        } : {})
    });
}

/**
 * Process a single user's buy trade (extracted for parallel execution)
 * @param scalingFactor - Optional factor to reduce buy amount (for liquidity protection)
 * @param sharedNativePrice - Pre-fetched native token price (performance optimization)
 */
async function processSingleUserBuy(
    config: any,
    userSettings: any,
    targetWallet: string,
    tokenToBuy: string,
    swap: DecodedSwap,
    chainId: number,
    tokenInfo: any,
    targetSwapValueUsd: number,
    strictTargetSwapValueUsd: number,
    strictTargetSwapValueReliable: boolean,
    strictTargetSwapValueSource: string,
    strictMinGuardRequired: boolean,
    isFallbackMode: boolean,
    scalingFactor: number = 1.0,
    sharedNativePrice: number = 0,
    launchpadPromise?: Promise<any>,
    tokenInfoCache?: Map<string, Promise<any>>,
    timing?: CopyTradeTimingSnapshot,
    detectedAt?: number
): Promise<SingleUserBuyResult> {
    return processSingleUserBuyRuntime({
        config,
        userSettings,
        targetWallet,
        tokenToBuy,
        swap,
        chainId,
        tokenInfo,
        targetSwapValueUsd,
        strictTargetSwapValueUsd,
        strictTargetSwapValueReliable,
        strictTargetSwapValueSource,
        strictMinGuardRequired,
        isFallbackMode,
        scalingFactor,
        sharedNativePrice,
        launchpadPromise,
        tokenInfoCache,
        timing,
        detectedAt
    }, getLegacyCopytradeBuyRuntimeDeps());
}

/**
 * Handle Target SELLING a token -> We SELL if we have a position and mirrorSell is ON
 * Logic upgraded to handle multiple open positions safely (Sell total balance once)
 */
/**
 * Centralized logic to exit a position (used for Mirror Sell, Take Profit, and Stop Loss)
 * Handles balance checking, execution (EVM/Solana), dust sweep, DB updates, and notifications
 */
export async function executePositionExit(params: {
    userId: string;
    tokenAddress: string;
    chainId: number;
    exitReason: 'mirror_sell' | 'take_profit' | 'stop_loss' | 'manual' | 'dynamic_take_profit';
    tokenInfo?: any;
    config: any;
    userSettings?: any;
    positions?: Array<any>;
    pendingAttributedLots?: Array<any>;
    desiredSellRawOverride?: bigint;
    intentContext?: {
        intentId?: string;
        sourceEventId?: string;
        targetSellTxHash?: string;
        targetFullExitVerified?: boolean;
        targetSellRatioBps?: number | null;
    };
}): Promise<string | null> {
    return executePositionExitRuntime(params, legacyPositionExitRuntimeDeps);
}

async function handleTargetSell(
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number
): Promise<void> {
    return handleTargetSellRuntime({ targetWallet, swap, chainId }, getLegacyCopytradeBuyRuntimeDeps());
}


/**
 * Initialize the auto trade service
 */
export function initAutoTradeService(): void {
    logger.info(LogCode.SYS_STARTUP, 'Initializing auto trade service...');

    // Register swap callbacks
    onSwapDetected(async (targetWallet, swap, chainId) => {
        const txHash = String(swap?.txHash || '').trim();
        if (!txHash) return;
        await dispatchCopyTradeIfReady({
            chainId,
            txHash,
            targetWallet,
            swap,
            source: 'watcher_live'
        });
    });
    onSolanaSwapDetected(handleSwapDetected);

    // NOTE: EVM watcher disabled - using Alchemy webhooks for real-time push notifications
    // startWatcher(); // Disabled - webhook is faster and more efficient
    startSolanaWatcher(); // Keep Solana watcher (no webhook alternative)
    startCopyTradePendingWatcher().catch((err: any) => {
        logger.warn(LogCode.SYS_INFO, '[CopyTradePending] Failed to start pending watcher', {
            error: err?.message || String(err)
        });
    });

    logger.info(LogCode.SYS_STARTUP, 'Auto trade service initialized (Solana watcher + EVM webhook + pending prefetch enabled)', { mode: 'hybrid+pending' });

    // Start Zombie Cleanup Job (Risk #1 Mitigation)
    // Runs every 5 minutes to remove stale PENDING locks
    zombieCleanupInterval = setInterval(cleanupPendingPositions, 5 * 60 * 1000);
    attributionRepairInterval = setInterval(() => {
        void runCopytradeAttributionRepairCycle()
            .then((result) => {
                if (result.repairedCount > 0 || result.repairRequiredCount > 0) {
                    logger.info(LogCode.SYS_INFO, '[CopyTradeRepair] Cycle completed', result);
                }
            })
            .catch((err: any) => {
                logger.warn(LogCode.SYS_ERROR, '[CopyTradeRepair] Cycle failed', {
                    error: err?.message || String(err)
                });
            });
    }, ATTRIBUTION_REPAIR_INTERVAL_MS);

    void runCopytradeAttributionRepairCycle().catch(() => { });
}

/**
 * Stop the auto trade service (Graceful Shutdown - Risk #2 Mitigation)
 */
export async function stopAutoTradeService(): Promise<void> {
    logger.info(LogCode.SYS_SHUTDOWN, 'Stopping Auto Trade Service...');
    isServiceShuttingDown = true;
    if (zombieCleanupInterval) {
        clearInterval(zombieCleanupInterval);
        zombieCleanupInterval = null;
    }
    if (attributionRepairInterval) {
        clearInterval(attributionRepairInterval);
        attributionRepairInterval = null;
    }
    stopCopyTradePendingWatcher();
    // Note: watchers are event-driven, setting flag stops processing
}

/**
 * Cleanup stale PENDING positions (Zombies)
 */
async function cleanupPendingPositions() {
    try {
        const positionStatusCompat = await getPositionStatusCompat();
        const result = await prisma.position.updateMany({
            where: {
                status: { in: positionStatusCompat.lockStatuses as any },
                createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } // Older than 5 mins
            },
            data: {
                status: positionStatusCompat.failedFinalStatus as any,
                exitReason: 'pending_timeout',
                closedAt: new Date()
            }
        });
        if (result.count > 0) {
            logger.info(LogCode.SYS_INFO, `Marked ${result.count} stale pending positions as terminal failed`);
        }
    } catch (err: any) {
        logger.error(LogCode.SYS_ERROR, 'Failed to clean up zombie positions', { error: err.message });
    }
}


/**
 * Check and execute take profit / stop loss for open positions
 */
export async function checkPositionsForExits(): Promise<void> {
    return checkPositionsForExitsRuntime(legacyPositionExitRuntimeDeps);
}

// ================= HELPERS (Restored) =================

const legacyPositionExitRuntimeDeps: LegacyPositionExitRuntimeDeps = {
    positionsBeingExited,
    getPositionStatusCompat,
    recordTpslHit,
    clearTpslHit,
    pruneTpslTracker,
    resolveCopytradeSlippageBps,
    resolveExecutionModeForConfig,
    resolveDisplayTokenSymbolAsync,
    formatTokenAmount
};

function getLegacyCopytradeBuyRuntimeDeps() {
    return {
        withTradeLock,
        resolveExecutionModeForConfig,
        resolveBuyGuardPolicy,
        getPositionStatusCompat,
        emitCopyTradeBuyGuardAudit,
        logger,
        LogCode,
        getCopyTradeDispatchDetectedAt,
        getCopyTradeDispatchTimingAnchor,
        isCopyTradeDelayExceeded,
        emitCopyTradeTimingAudit,
        isTokenLockedForUser,
        resolveCopytradeSlippageBps,
        resolveEntryDeviationModePolicy,
        resolveEffectivePositiveThreshold,
        resolveEffectiveMinTargetValueUsd,
        roundGuardNumber,
        shouldEnforceBuyGuard,
        sendNotificationAsync,
        buildCopyTradeNotificationEvidence,
        isBelowMinTargetValue,
        MAX_COPY_TRADE_USD,
        notificationService,
        getNativeTokenPriceUsd,
        describeCooldownMode,
        ethers,
        getReferenceExpectedOutput,
        evaluateBuyPriceDeviationGuard,
        emitEntryDeviationSummary,
        isEntryDeviationPriceUnreliable,
        getDexPriceWithTimeout,
        getNativeBalance,
        getChainConfig,
        prisma,
        buildDuplicateTradeWhere,
        resolveLaunchpad,
        getSolanaEmbeddedWalletAddress,
        executeSwapViaPort,
        SOLANA_CONFIG,
        zoraSniperService,
        env,
        isJudgeEnabledByCopyTradeConfig,
        fourMemeService,
        executeEvmCopytradeBuySubmissionFlow,
        getPendingNonce,
        getTokenInfoOnce,
        getTokenInfo,
        persistCopytradeBuySubmission,
        resolveDisplayTokenSymbol,
        buildOrderAuditFields,
        resolveDisplayTokenSymbolAsync,
        executePositionExit,
        applyBuyConfirmationTransition,
        scheduleCopytradeBuyConfirmationFlow,
        SELL_PREHEAT_DELAY_MS,
        SELL_PREHEAT_CONFIRM_TIMEOUT_MS,
        SELL_PREHEAT_CONFIRM_POLL_MS,
        trackCopyTrade,
        trackSwap,
        getEnabledCopyTradeAiMode,
        runPostBuyAiFlow,
        resolveCopyTradeAiMode,
        compactCopyTradeError,
        inferCopyTradeBugHint,
        cleanupPendingCopytradePosition,
        buildDirectSwapHintFromSwap,
        normalizeAddress,
        withRetry,
        filterExecutableCopyTradeConfigs,
        dedupeConfigsByUser,
        upsertTargetSellEvent,
        buildTargetSellEventPayload,
        persistTargetSellEventAndSchedulePositions,
        syncCopytradeLedgerFromLegacy,
        armPendingAttributedPositionsForMirrorSell,
        recordNewTrade,
    };
}



export async function passesFilters(
    tokenInfo: any,
    config: any,
    targetSwapValueUsd: number,
    policy = resolveBuyGuardPolicy('normal'),
    options?: Parameters<typeof evaluateStaticBuyGuards>[4]
) {
    if (!tokenInfo) return { passed: false, reason: 'No token info' };
    return evaluateStaticBuyGuards(tokenInfo, config, targetSwapValueUsd, policy, options);
}

// Test-only hooks used by deterministic stress scripts.
export const __copyTradeGuardTestHelpers = {
    getMinTargetEffectiveFloorUsd,
    isBelowMinTargetValue,
    resolveEffectivePositiveThreshold,
    resolveEffectiveMinTargetValueUsd,
    dedupeConfigsByUser
};

const SELL_PREHEAT_DELAY_MS = Math.max(0, Number(process.env.COPYTRADE_SELL_APPROVAL_PREHEAT_DELAY_MS || '15000'));
const SELL_PREHEAT_CONFIRM_TIMEOUT_MS = Math.max(5000, Number(process.env.COPYTRADE_SELL_APPROVAL_PREHEAT_CONFIRM_TIMEOUT_MS || '45000'));
const SELL_PREHEAT_CONFIRM_POLL_MS = Math.max(500, Number(process.env.COPYTRADE_SELL_APPROVAL_PREHEAT_CONFIRM_POLL_MS || '1200'));
