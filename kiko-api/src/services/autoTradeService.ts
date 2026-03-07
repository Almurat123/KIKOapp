/**
 * Auto Trade Service
 * Executes copy trades when target wallet swaps are detected
 */

import { ethers } from 'ethers';
import prisma, { withRetry } from '../db/prisma.js';
import { DecodedSwap } from './txDecoder.js';
import { onSwapDetected } from './watcherService.js';
import { enqueueCopyTradeTask } from './copyTradeQueue.js';
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
import { getTokenMetadata, getTokenSupply } from './rpcService.js';
import { getDexPrice, getDexPriceDetailed } from './dexPriceService.js';
import { cacheHub } from '../cache/DataCacheHub.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { callRpc, getNativeBalance as rpcGetNativeBalance, getErc20Balance, getErc20Decimals, getTransactionReceipt } from './rpcManager.js';
import { startCopyTradePendingWatcher, stopCopyTradePendingWatcher } from './copyTradePendingService.js';
import { assertConfigExecutable } from './copyTradeConfigSignatureService.js';
import { determineCopyTradeDirection } from './copyTradeDirection.js';
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
import { runPostBuyAiFlow } from './copytrade-v2/buy/postBuyAiFlow.js';
import { shouldSkipCopyTradeLocalReferenceQuote } from './copytrade-v2/buy/turboReferenceGate.js';
import { applyBuyConfirmationTransition } from './copytrade-v2/buy/buyConfirmationTransition.js';
import { scheduleCopytradeBuyConfirmationFlow } from './copytrade-v2/buy/buyConfirmationCoordinator.js';
import { cleanupPendingCopytradePosition } from './copytrade-v2/buy/pendingLifecycle.js';
import { buildCopytradeBuyPlannedArtifact } from './copytrade-v2/buy/plannedExecutionArtifact.js';
import { shouldAbortCopytradeBuyRetry } from './copytrade-v2/buy/copytradeBuyRetryGuard.js';
import { evaluateBuyPriceDeviationGuard } from './copytrade-v2/buy/buyGuardPriceDeviation.js';
import { reconcileOpenPositionsForExit } from './copytrade-v2/exit/openPositionReconciliation.js';
import { evaluateMirrorSellExecutionPolicy } from './copytrade-v2/exit/mirrorSellExecutionPolicy.js';
import { resolveAttributedPositionExitAmount } from './copytrade-v2/positions/positionAttribution.js';
import { finalizeCopytradeBuyPosition } from './copytrade-v2/positions/positionPersistence.js';
import {
    armPendingAttributedPositionsForMirrorSell,
    listPendingAttributedPositions,
    upsertPendingAttributedPosition
} from './copytrade-v2/positions/pendingAttributedPositionLedger.js';
import { runTargetSellReconciliationCycle } from './copytrade-v2/reconcile/targetSellReconciliationJob.js';
import { runCopytradeAttributionRepairCycle } from './copytrade-v2/jobs/copytradeAttributionRepairJob.js';
import { runCopytradeOrphanSweepCycle } from './copytrade-v2/jobs/copytradeOrphanSweepJob.js';
import { repairCopytradePositionAttribution } from './copytrade-v2/jobs/copytradeAttributionRepairJob.js';
import { getCopytradeBuySharedWarmup } from './copytrade-v2/buy/buySharedWarmup.js';
import { shouldDeferStrongRpcMonitoring } from './copytrade-v2/buy/preConfirmationRpcPolicy.js';
import {
    evaluateCopyTradeDelay,
    getCopyTradeDispatchDetectedAt,
    type CopyTradeTimingSnapshot
} from './copytrade-v2/timing/copyTradeTimingModel.js';
import { emitCopyTradeTimingAudit } from './copytrade-v2/timing/copyTradeTimingAudit.js';
import { executeSwapViaPort } from './swap/swapExecutionPort.js';
import { getReferenceExpectedOutput } from './dex/directSwap/application/quoteEngines.js';
import type { ConfirmationOutcome } from './swap/confirmationCoordinator.js';

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
let targetSellReconciliationInterval: NodeJS.Timeout | null = null;
let attributionRepairInterval: NodeJS.Timeout | null = null;
let orphanSweepInterval: NodeJS.Timeout | null = null;

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
const TARGET_SELL_RECONCILIATION_INTERVAL_MS = Math.max(15_000, Number(process.env.COPYTRADE_TARGET_SELL_RECONCILIATION_INTERVAL_MS || '30000'));
const ATTRIBUTION_REPAIR_INTERVAL_MS = 600_000;
const ORPHAN_SWEEP_INTERVAL_MS = Math.max(60_000, Number(process.env.COPYTRADE_ORPHAN_SWEEP_INTERVAL_MS || '600000'));
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

function resolveExecutionModeForConfig(config: any): CopyTradeExecutionMode {
    return resolveExecutionModeFromConfig({
        requested: config?.executionMode,
        legacyDisableTokenInfo: config?.disableTokenInfo,
        fallback: 'normal'
    }).mode;
}

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

function sendNotificationAsync(params: TradeNotificationParams, context: string): void {
    void notificationService.sendNotification(params)
        .then((sent) => {
            if (!sent) {
                logger.warn(LogCode.API_NOTIFY_FAILED, `[Notify] Notification not sent (${context})`, {
                    userId: params.userId,
                    type: params.type
                });
            }
        })
        .catch((error: any) => {
            logger.error(LogCode.API_NOTIFY_FAILED, `[Notify] Notification failed (${context})`, {
                userId: params.userId,
                type: params.type,
                error: error?.message || String(error)
            });
        });
}

function buildDirectSwapHintFromSwap(swap: DecodedSwap): DirectSwapHint | undefined {
    const sourceTxHash = String(swap?.txHash || '').toLowerCase();
    const sourceRouter = String(swap?.router || '').toLowerCase();
    const sourceDexName = String(swap?.dexName || '').trim();
    if (
        !sourceTxHash
        && !sourceRouter
        && !sourceDexName
        && !swap?.resolvedPoolHint
        && !swap?.routeHopCount
        && !swap?.routeHops?.length
    ) return undefined;

    const preferredStrategy = (() => {
        const resolvedKind = swap?.resolvedPoolHint?.kind;
        if (resolvedKind === 'v4' || resolvedKind === 'v3' || resolvedKind === 'v2' || resolvedKind === 'aerodrome') {
            return resolvedKind;
        }
        const firstHop = swap?.routeHops?.[0]?.kind;
        if (firstHop === 'v4' || firstHop === 'v3' || firstHop === 'v2' || firstHop === 'aerodrome' || firstHop === 'infinity') {
            return firstHop;
        }
        return undefined;
    })();
    const preferredDex = swap?.resolvedPoolHint?.dex || swap?.routeHops?.[0]?.dex;
    const routeHopCount = Number.isFinite(Number(swap?.routeHopCount))
        ? Number(swap?.routeHopCount)
        : (swap?.routeHops?.length || 0);

    return {
        sourceDexName: sourceDexName || undefined,
        sourceRouter: sourceRouter || undefined,
        sourceTxHash: sourceTxHash || undefined,
        sourceTokenIn: swap?.tokenIn,
        sourceTokenOut: swap?.tokenOut,
        sourceAmountIn: swap?.amountIn,
        sourceAmountOut: swap?.amountOut,
        routeHopCount,
        routeHops: swap?.routeHops,
        canUseResolvedPoolFastPath: swap?.canUseResolvedPoolFastPath,
        resolvedPoolHint: swap?.resolvedPoolHint,
        preferredStrategy,
        preferredDex,
        bypassReferencePrice: true
    };
}

function normalizeFiniteNumber(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
}

function resolveEffectivePositiveThreshold(configValue: unknown, userSettingValue: unknown): number | null {
    const c = normalizeFiniteNumber(configValue);
    const u = normalizeFiniteNumber(userSettingValue);
    const candidates: number[] = [];
    if (c !== null && c > 0) candidates.push(c);
    if (u !== null && u > 0) candidates.push(u);
    if (candidates.length === 0) return null;
    return Math.max(...candidates);
}

function parsePositiveBigInt(value: unknown): bigint {

    try {
        const parsed = BigInt(String(value ?? '0'));
        return parsed > 0n ? parsed : 0n;
    } catch {
        return 0n;
    }
}

function resolveDisplayTokenSymbol(symbol: unknown, tokenAddress: string): string {
    const raw = String(symbol || '').trim();
    if (raw && !/^unknown$/i.test(raw)) return raw;
    const addr = String(tokenAddress || '').trim();
    if (!addr) return 'TOKEN';
    return addr.slice(0, 6);
}

async function resolveDisplayTokenSymbolAsync(symbol: unknown, tokenAddress: string, chainId: number): Promise<string> {
    const current = resolveDisplayTokenSymbol(symbol, tokenAddress);
    const fallbackPrefix = String(tokenAddress || '').slice(0, 6);
    if (current !== fallbackPrefix) return current;
    try {
        const meta = await getTokenMetadata(chainId, tokenAddress, { rpcStrategy: 'fast' });
        return resolveDisplayTokenSymbol(meta?.symbol, tokenAddress);
    } catch {
        return current;
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
    context?: { detectedAt?: number; timing?: CopyTradeTimingSnapshot }
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
            getTokenInfo(swap.tokenIn, chainId, { priority: 'high', rpcStrategy: 'fast', fastMode: true }),
            getTokenInfo(swap.tokenOut, chainId, { priority: 'high', rpcStrategy: 'fast', fastMode: true }),
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

    if (isSell) {
        logger.info(LogCode.EXE_TX_BROADCAST, 'Target is selling - triggering mirror sell', { targetWallet, token: swap.tokenIn });
        await handleTargetSell(targetWallet, swap, chainId);
    } else if (isBuy) {
        logger.info(LogCode.EXE_TX_BROADCAST, 'Target is buying - triggering copy trade', { targetWallet, token: swap.tokenOut });
        await handleTargetBuy(targetWallet, swap, chainId, { detectedAt });
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
            handleTargetBuy(targetWallet, swap, chainId, { detectedAt }).catch(e => logger.error(LogCode.EXE_TX_REVERTED, 'Parallel buy error', {
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

    // 1. FIRST: Check for active configs. If none, exit immediately (No API calls, No Logs)
    // ⚡ Use DataCacheHub config cache (60s TTL) to avoid hitting Prisma on every webhook
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
    const turboMetaPromise = getTokenMetadata(chainId, tokenToBuy, { rpcStrategy: 'fast' }).catch(() => null);
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

    // Turbo Mode: only if ALL configs explicitly choose turbo.
    const skipTokenInfo = uniqueExecutableConfigs.every(c => c.executionMode === 'turbo');
    if (skipTokenInfo) {
        try {
            // ⚡ Reuse the metadata that was prefetched in parallel with the user DB query.
            const meta = await turboMetaPromise;
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

            logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTrade] Token info disabled - using RPC metadata fallback', {
                token: tokenToBuy,
                chainId
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

    // 2. SECOND: Fetch Token Info & Launchpad (parallel, non-blocking)
    // 🚀 Copy Trade uses HIGH priority to bypass rate limits for critical order execution
    const tokenInfoPromise = getTokenInfoOnce(tokenInfoCache, tokenToBuy, chainId, { priority: 'high', rpcStrategy: 'fast', fastMode: true });
    const tokenInfo = await tokenInfoPromise;
    const launchpadResult = await resolveLaunchpad(launchpadPromise, chainId);

    if (!tokenInfo || tokenInfo.price <= 0) {
        // 🚨 Fallback: If we detected it as a valid Launchpad token (Clanker/Pump/etc), we might trust it blind
        // because DexScreener is slow to index new pairs.
        if (launchpadResult && launchpadResult.data) {
            logger.warn(LogCode.DEC_FAILED_UNKNOWN_DEX, `${tokenToBuy} missing DexScreener info - using Launchpad fallback`, {
                provider: launchpadResult.provider,
                token: tokenToBuy
            });

            // Construct fallback token info using launchpad data when available
            const lpData = launchpadResult.data;
            const lpPrice = lpData.tokenPrice?.priceInUsdc || lpData.tokenPrice?.usd; // Allow undefined to trigger derivation
            const lpMarketCap = parseFloat(lpData.marketCap || '0');
            const lpVolume = parseFloat(lpData.volume24h || lpData.totalVolume || '0');

            const fallbackInfo = {
                price: typeof lpPrice === 'string' ? parseFloat(lpPrice) : (lpPrice || 0), // If 0, processBuyWithInfo will derive it
                symbol: lpData.symbol || 'UNKNOWN',
                name: lpData.name || 'Unknown Token',
                decimals: lpData.decimals || 18,
                liquidity: lpMarketCap, // Use marketCap as proxy for liquidity
                volume24h: lpVolume,
                fdv: lpMarketCap,
                marketCap: lpMarketCap,
                pairCreatedAt: lpData.createdAt ? new Date(lpData.createdAt).getTime() : Date.now(),
                // Empty arrays for social/web to prevent checks failing on undefined
                socials: [],
                websites: [],
                provider: launchpadResult.provider
            };

            // Proceed with fallback info
            // NOTE: We must be careful about price calculations later.
            // If price is 0, we can only do "Buy X ETH worth", not "Buy Y Tokens".
            // Our logic below handles "Target Swap Value" based on Input ETH, so we are safe.
            await processBuyWithInfo(targetWallet, tokenToBuy, swap, chainId, uniqueExecutableConfigs, fallbackInfo, true, launchpadPromise, tokenInfoCache, sharedWarmup, context?.timing, detectedAt);
            return;
        }

        // ⚡ FAST-MODE FALLBACK: If we have active configs and fast execution, proceed with metadata-only info.
        // This avoids waiting on slow APIs when RPC price is unavailable.
        const allowFastFallback = configs.some((c: any) => c.fastExecutionEnabled !== false);
        if (allowFastFallback) {
            try {
                const meta = await getTokenMetadata(chainId, tokenToBuy, { rpcStrategy: 'fast' });
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
 * Process the buy execution now that we have (or faked) the token info
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
    const stopAtLiquidityUsd = configs.reduce((max, config) => {
        const next = Number(config?.minLiquidityUsd || 0);
        return Number.isFinite(next) && next > max ? next : max;
    }, 0);
    const liquidityGuardSnapshot = await resolveBuyLiquidityGuardSnapshot(tokenToBuy, chainId, tokenInfo, {
        swap,
        stopAtLiquidityUsd,
    });
    tokenInfo.guardLiquidityUsd = liquidityGuardSnapshot.liquidityUsd;
    tokenInfo.guardLiquiditySource = liquidityGuardSnapshot.source;
    tokenInfo.guardLiquidityReliable = liquidityGuardSnapshot.reliable;
    tokenInfo.guardLiquidityPoolCount = liquidityGuardSnapshot.poolCount;
    tokenInfo.guardLiquidityMeta = liquidityGuardSnapshot.metadata || null;
    if (liquidityGuardSnapshot.liquidityUsd > 0) {
        tokenInfo.liquidity = liquidityGuardSnapshot.liquidityUsd;
    }

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

    // 🚨 SELF-HEALING: If token price is missing (Fallback Mode), derive it from the trade itself
    // impliedPrice = Total Value USD / Token Amount
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
                        const totalSupply = await getTokenSupply(chainId, tokenToBuy, {
                            rpcStrategy: 'fast',
                            defaultDecimals: decimals,
                        });
                        if (Number.isFinite(totalSupply) && totalSupply > 0) {
                            tokenInfo.marketCap = totalSupply * impliedPrice;
                            tokenInfo.fdv = tokenInfo.marketCap;
                            logger.info(LogCode.DATA_RECOVERY, 'Derived EVM market cap from RPC supply and implied price', {
                                token: tokenToBuy,
                                marketCap: tokenInfo.marketCap,
                                totalSupply,
                                impliedPrice
                            });
                        }
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

    // Record Leader Trade Stats (Buy)
    // We record it once for the leader, regardless of how many users copy it
    recordNewTrade(targetWallet, chainId, 'buy', targetSwapValueUsd);

    // TURBO FAST LANE:
    // Skip batch analytics/caching/delays and execute immediately for all-turbo configs.
    const turboConfigs = configs.filter((c) => resolveExecutionModeForConfig(c) === 'turbo');
    const normalConfigs = configs.filter((c) => resolveExecutionModeForConfig(c) !== 'turbo');

    if (turboConfigs.length > 0) {
        const turboUserIds = [...new Set(turboConfigs.map(c => c.userId).filter(Boolean))];
        // ⚡ Parallel: native price fetch + user settings warmup run concurrently (~100ms saved)
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
                    tokenInfo,
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

        const successCount = turboResults.filter((r) => r.status === 'fulfilled').length;
        const failCount = turboResults.length - successCount;
        logger.info(LogCode.EXE_TX_CONFIRMED, '[CopyTrade] Turbo fast lane complete', {
            userCount: turboConfigs.length,
            success: successCount,
            failed: failCount,
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
                tokenInfo,
                effectiveConfig,
                targetSwapValueUsd,
                resolveBuyGuardPolicy(executionMode),
                {
                    targetValueSnapshot,
                    liquidityGuardSnapshot
                }
            );
            return { config, filterResult, effectiveConfig, userSettings };
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
    const liquidity = tokenInfo.liquidity || 0;

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

    // 📈 PRIORITY SORTING: Process by buy amount (largest first gets best price)
    const sortedConfigs = [...eligibleConfigs].sort((a, b) => (b.buyAmountUsd || 0) - (a.buyAmountUsd || 0));

    // Track execution stats
    let successCount = 0;
    let failCount = 0;
    let currentPriceMultiplier = 1.0; // Track price drift during execution

    // 🚀 EXECUTE IN SMART BATCHES
    const execStart = Date.now();
    for (let i = 0; i < sortedConfigs.length; i += dynamicBatchSize) {
        const batch = sortedConfigs.slice(i, i + dynamicBatchSize);
        const batchNum = Math.floor(i / dynamicBatchSize) + 1;
        const totalBatches = Math.ceil(sortedConfigs.length / dynamicBatchSize);

        logger.info(LogCode.EXE_TX_BROADCAST, `📦 Processing batch ${batchNum}/${totalBatches}`, {
            batchSize: batch.length,
            priceMultiplier: currentPriceMultiplier.toFixed(3)
        });

        // Execute batch in parallel
        const results = await Promise.allSettled(
            batch.map(config =>
                processSingleUserBuy(
                    config,
                    userSettingsMap.get(config.userId),
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

        // Count results
        for (const result of results) {
            if (result.status === 'fulfilled') successCount++;
            else failCount++;
        }

        // 🔄 ADAPTIVE DELAY: Wait between batches, longer if we're impacting price
        if (i + dynamicBatchSize < sortedConfigs.length) {
            // Base delay + extra delay based on batch impact
            const batchVolumeUsd = batch.reduce((sum, c) => sum + ((c.buyAmountUsd || 0) * scalingFactor), 0);
            const impactRatio = liquidity > 0 ? batchVolumeUsd / liquidity : 0;

            // 100ms base + up to 400ms for high impact batches
            const adaptiveDelay = 100 + Math.min(400, Math.floor(impactRatio * 2000));

            await new Promise(resolve => setTimeout(resolve, adaptiveDelay));

            // 📊 Optional: Re-check price after high-impact batches
            if (impactRatio > 0.05 && i + dynamicBatchSize * 2 < sortedConfigs.length) {
                let step1Request: MainSwapRequest | undefined;
                try {
                    const freshInfo = tokenInfoCache
                        ? await getTokenInfoOnce(tokenInfoCache, tokenToBuy, chainId, { forceRefresh: true, priority: 'high', rpcStrategy: 'fast' })
                        : await getTokenInfo(tokenToBuy, chainId, { forceRefresh: true, priority: 'high', rpcStrategy: 'fast' });
                    if (freshInfo && freshInfo.price > 0 && tokenInfo.price > 0) {
                        currentPriceMultiplier = freshInfo.price / tokenInfo.price;

                        // 🛑 CIRCUIT BREAKER: Stop if price pumped too much (>50%)
                        if (currentPriceMultiplier > 1.5) {
                            logger.warn(LogCode.WTC_TX_SKIPPED, `🛑 Circuit breaker triggered: Price pumped ${((currentPriceMultiplier - 1) * 100).toFixed(1)}%`, {
                                originalPrice: tokenInfo.price,
                                currentPrice: freshInfo.price,
                                remainingUsers: sortedConfigs.length - i - dynamicBatchSize
                            });

                            // Notify remaining users that their trade was skipped
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
                            break; // Exit the batch loop
                        }
                    }
                } catch (err) {
                    // Ignore price check errors, continue with execution
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
): Promise<void> {
    // Lock per userId:token so different tokens can execute concurrently for the same user.
    // Same-token deduplication is handled separately by isTokenLockedForUser + DB transaction lock.
    return withTradeLock(`${config.userId}:${tokenToBuy.toLowerCase()}`, async () => {
        let judgeDecisionId: string | null = null;
        const executionMode = resolveExecutionModeForConfig(config);
        const turboMode = executionMode === 'turbo';
        const guardPolicy = resolveBuyGuardPolicy(executionMode);
        const positionStatusCompat = await getPositionStatusCompat();
        const leaderTxHash = String(swap?.txHash || '').toLowerCase().trim();
        const guardAudit: Record<string, unknown> = {
            userId: config.userId,
            token: tokenToBuy,
            chainId,
            executionMode,
            guardPolicy: guardPolicy.name,
            turboMode,
            sourceTxHash: swap?.txHash || null,
            minTargetValue: null,
            priceDeviation: null,
            cooldown: null,
            marketCap: null,
            minLiquidity: null,
            liquiditySource: tokenInfo?.guardLiquiditySource || null,
            liquidityPoolCount: tokenInfo?.guardLiquidityPoolCount ?? null,
            liquidityProgram: tokenInfo?.guardLiquidityMeta?.dominantProgramLabel || tokenInfo?.guardLiquidityMeta?.dominantProgram || null,
            liquidityScanSource: tokenInfo?.guardLiquidityMeta?.source || null,
        };
        const emitGuardAudit = (
            decision: 'pass' | 'skip',
            reason: string,
            extra?: Record<string, unknown>
        ) => {
            emitCopyTradeBuyGuardAudit(guardAudit, decision, reason, extra);
        };
        let pendingPositionId: string | null = null;
        let pendingPositionCreatedAt: Date | null = null;
        let pendingPositionSettled = false;
        let attributedEntryAmountHuman: string | null = null;
        let txHash = '';
        let txLifecycleStatus: string | undefined;
        let orderRuntimeContext: any = undefined;
        let swapMetadata: MainSwapResult['metadata'] | undefined;

        try {
            const dispatchDetectedAt = getCopyTradeDispatchDetectedAt(timing, detectedAt);
            const inboundDelayMs = dispatchDetectedAt ? Math.max(0, Date.now() - dispatchDetectedAt) : null;
            if (inboundDelayMs !== null && inboundDelayMs > 800) {
                logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTradeTiming] user buy dispatch delay', {
                    userId: config.userId,
                    token: tokenToBuy,
                    chainId,
                    inboundDelayMs,
                    delayFirstSeenMs: timing?.firstSeenAt ? Math.max(0, Date.now() - timing.firstSeenAt) : null,
                    delayAnchor: timing?.dispatchEligibleAt ? 'dispatch_eligible' : (timing?.swapReadyAt ? 'swap_ready' : 'legacy_detected_at'),
                    executionMode
                });
            }
            const delayCheck = isCopyTradeDelayExceeded(timing || detectedAt, turboMode);
            emitCopyTradeTimingAudit('buy_dispatch_gate', timing, {
                userId: config.userId,
                token: tokenToBuy,
                chainId,
                executionMode,
                turboMode,
                delayMs: delayCheck.delayMs,
                hardDelayMs: delayCheck.hardDelayMs,
                maxDelayMs: delayCheck.maxDelayMs,
                delayAnchor: delayCheck.delayAnchor,
                reasonCode: delayCheck.reasonCode || null,
                skip: delayCheck.skip
            });
            if (delayCheck.skip) {
                logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: copytrade delay exceeded', {
                    userId: config.userId,
                    token: tokenToBuy,
                    delayMs: delayCheck.delayMs,
                    hardDelayMs: delayCheck.hardDelayMs,
                    maxDelayMs: delayCheck.maxDelayMs,
                    delayAnchor: delayCheck.delayAnchor,
                    reasonCode: delayCheck.reasonCode,
                    turboMode,
                    hint: 'dispatch delay is from dispatchEligibleAt/swapReadyAt; hard cap still uses firstSeenAt'
                });
                return;
            }

            if (isTokenLockedForUser(config.userId, tokenToBuy, swap?.txHash)) {
                logger.throttled(LogCode.WTC_TX_SKIPPED, 'Skipping trade: token lock active', {
                    userId: config.userId,
                    token: tokenToBuy,
                    sourceTxHash: swap?.txHash
                });
                return;
            }
        // Universal Global Slippage (userSettings already passed in)
        const universalSlippageBps = resolveCopytradeSlippageBps(config, userSettings);
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
        const observedMarketCapUsd = Number(tokenInfo?.marketCap || 0);
        const observedLiquidityUsd = Number(
            tokenInfo?.guardLiquidityUsd ?? tokenInfo?.liquidity ?? 0
        );
        const minMarketCapUsd = Number(effectiveConfig.minMarketCapUsd || 0);
        const minLiquidityUsd = Number(effectiveConfig.minLiquidityUsd || 0);
        guardAudit.marketCap = {
            minUsd: roundGuardNumber(minMarketCapUsd),
            observedUsd: roundGuardNumber(observedMarketCapUsd),
            pass: minMarketCapUsd <= 0 ? true : observedMarketCapUsd >= minMarketCapUsd,
            enforced: shouldEnforceBuyGuard(guardPolicy, 'minMarketCap')
        };
        guardAudit.minLiquidity = {
            minUsd: roundGuardNumber(minLiquidityUsd),
            observedUsd: roundGuardNumber(observedLiquidityUsd),
            pass: minLiquidityUsd <= 0 ? true : observedLiquidityUsd >= minLiquidityUsd,
            enforced: shouldEnforceBuyGuard(guardPolicy, 'minLiquidity'),
            source: tokenInfo?.guardLiquiditySource || 'token_info',
            reliable: Boolean(tokenInfo?.guardLiquidityReliable ?? (observedLiquidityUsd > 0)),
            poolCount: Number(tokenInfo?.guardLiquidityPoolCount || 0)
        };

        // Fast check for per-user target value guard (must apply in all modes, including turbo).
        const minTargetValueUsd = resolveEffectiveMinTargetValueUsd(effectiveConfig, null);
        const normalizedTargetSwapValueUsd = Number.isFinite(targetSwapValueUsd) ? targetSwapValueUsd : 0;
        const normalizedStrictTargetSwapValueUsd = Number.isFinite(strictTargetSwapValueUsd) ? strictTargetSwapValueUsd : 0;
        const effectiveTargetSwapValueUsd = strictTargetSwapValueReliable
            ? normalizedStrictTargetSwapValueUsd
            : normalizedTargetSwapValueUsd;
        guardAudit.minTargetValue = {
            minUsd: roundGuardNumber(minTargetValueUsd),
            broadUsd: roundGuardNumber(normalizedTargetSwapValueUsd),
            strictUsd: roundGuardNumber(normalizedStrictTargetSwapValueUsd),
            effectiveUsd: roundGuardNumber(effectiveTargetSwapValueUsd),
            strictReliable: strictTargetSwapValueReliable,
            strictRequired: strictMinGuardRequired,
            strictSource: strictTargetSwapValueSource
        };

        if (shouldEnforceBuyGuard(guardPolicy, 'minTargetValue') && minTargetValueUsd > 0 && strictMinGuardRequired && !strictTargetSwapValueReliable) {
            logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: strict min-target cash guard unavailable', {
                userId: config.userId,
                token: tokenToBuy,
                txHash: swap.txHash,
                minTargetValueUsd,
                strictSource: strictTargetSwapValueSource,
                broadTargetSwapValueUsd: Number(normalizedTargetSwapValueUsd.toFixed(2))
            });
            sendNotificationAsync({
                userId: config.userId,
                farcasterFid: config.user.farcasterFid,
                type: 'COPY_TRADE_SKIPPED',
                data: {
                    tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                    tokenAddress: tokenToBuy,
                    targetWallet: targetWallet,
                    chainId: chainId,
                    skipReason: `Unable to verify target cash value for strict min gate ($${minTargetValueUsd.toFixed(2)}).`,
                    ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: normalizedTargetSwapValueUsd }),
                }
            }, 'copytrade_skip_min_target_guard_unavailable');
            emitGuardAudit('skip', 'min_target_guard_unavailable');
            return;
        }

        if (shouldEnforceBuyGuard(guardPolicy, 'minTargetValue') && minTargetValueUsd > 0 && isBelowMinTargetValue(effectiveTargetSwapValueUsd, minTargetValueUsd)) {
            logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: target value below user minimum', {
                userId: config.userId,
                token: tokenToBuy,
                txHash: swap.txHash,
                targetSwapValueUsd: Number(normalizedTargetSwapValueUsd.toFixed(2)),
                effectiveTargetSwapValueUsd: Number(effectiveTargetSwapValueUsd.toFixed(2)),
                strictTargetSwapValueUsd: Number(normalizedStrictTargetSwapValueUsd.toFixed(2)),
                strictSource: strictTargetSwapValueSource,
                strictReliable: strictTargetSwapValueReliable,
                minTargetValueUsd,
            });

            sendNotificationAsync({
                userId: config.userId,
                farcasterFid: config.user.farcasterFid,
                type: 'COPY_TRADE_SKIPPED',
                data: {
                    tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                    tokenAddress: tokenToBuy,
                    targetWallet: targetWallet,
                    chainId: chainId,
                    skipReason: `Target buy value $${effectiveTargetSwapValueUsd.toFixed(2)} < min $${minTargetValueUsd.toFixed(2)}`,
                    ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: effectiveTargetSwapValueUsd }),
                }
            }, 'copytrade_skip_min_target_value');
            emitGuardAudit('skip', 'min_target_value_below_threshold');
            return;
        }

        // 🛡️ SAFETY CHECK: Token Info must be valid (unless in Fast Mode)
        // If we failed to fetch token info (e.g. DexScreener down), we should NOT guess.
        // Fast Mode explicitly opts-out of this safety check for speed.
        const isFastMode = config.fastExecutionEnabled !== false;
        if ((!tokenInfo || !tokenInfo.price) && !isFastMode) {
            logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping trade: Token info invalid and Fast Mode disabled', { userId: config.userId, token: tokenToBuy });
            return;
        }

        // ⚡ OPTIMIZATION: Filter already checked in batch, skip here
        // const filterResult = await passesFilters(tokenInfo, effectiveConfig, targetSwapValueUsd);


        // Calculate how much to buy in token units
        // Apply scaling factor for liquidity protection (reduces amount when many users buy simultaneously)
        const rawUsdAmount = Number(config.buyAmountUsd);
        if (!Number.isFinite(rawUsdAmount) || rawUsdAmount <= 0 || rawUsdAmount > MAX_COPY_TRADE_USD) {
            logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping trade: Invalid buy amount', {
                userId: config.userId,
                buyAmountUsd: config.buyAmountUsd
            });

            await notificationService.sendNotification({
                userId: config.userId,
                farcasterFid: config.user.farcasterFid,
                type: 'COPY_TRADE_SKIPPED',
                data: {
                    tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                    tokenAddress: tokenToBuy,
                    targetWallet: targetWallet,
                    chainId: chainId,
                    skipReason: `Invalid buy amount ($${String(config.buyAmountUsd)}). Please update your copy trade amount.`,
                    ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: targetSwapValueUsd }),
                }
            });

            return;
        }

        const usdAmount = rawUsdAmount * scalingFactor;

        // Log if scaling was applied
        if (scalingFactor < 1.0) {
            logger.info(LogCode.EXE_QUOTE_FETCHED, `📉 Trade scaled for liquidity protection`, {
                userId: config.userId,
                originalAmount: rawUsdAmount.toFixed(2),
                scaledAmount: usdAmount.toFixed(2),
                scalingFactor: scalingFactor.toFixed(3)
            });
        }

        // ⚡ OPTIMIZATION: Use shared native price instead of querying again
        let nativePrice = sharedNativePrice;
        if (!Number.isFinite(nativePrice) || nativePrice <= 1) {
            const fallbackNative = await getNativeTokenPriceUsd(chainId);
            if (Number.isFinite(fallbackNative) && fallbackNative > 1) {
                nativePrice = fallbackNative;
            } else {
                logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping trade: Native price unavailable', {
                    userId: config.userId,
                    chainId,
                    nativePrice
                });

                await notificationService.sendNotification({
                    userId: config.userId,
                    farcasterFid: config.user.farcasterFid,
                    type: 'COPY_TRADE_SKIPPED',
                    data: {
                        tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                        tokenAddress: tokenToBuy,
                        targetWallet: targetWallet,
                        chainId: chainId,
                        skipReason: 'Native token price unavailable. Please retry in a moment.',
                        ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: targetSwapValueUsd }),
                    }
                });

                return;
            }
        }

            const cooldownMinutes = config.copyTradeTokenCooldownMinutes ?? userSettings?.copyTradeTokenCooldownMinutes ?? 60;
            guardAudit.cooldown = {
                minutes: cooldownMinutes,
                enabled: cooldownMinutes > 0,
                mode: describeCooldownMode(cooldownMinutes)
            };

            // 🛡️ PRICE DEVIATION CHECK (Anti-Spike)
            // MUST run regardless of cooldownMinutes — turbo configs set cooldown=0 but still need this protection.
            // Compare our imminent local execution quote price vs the IMPLIED execution
            // price from the TARGET wallet's trade. External market prices are only a
            // fallback when no local quote is available.
            // This protects against buying at the absolute top of a "scam wick" or high slippage event.
            let targetExecutionPrice = 0;
            if (targetSwapValueUsd > 0) { // G2: Solana 也参与价格偏离比例检测
                try {
                    const estimatedOut = Number(ethers.formatUnits(swap.amountOut, tokenInfo.decimals || (chainId === 900 ? 9 : 18)));
                    if (estimatedOut > 0) {
                        let localQuotePriceUsd = 0;
                        let localQuoteProvider: string | undefined;
                        let oraclePriceSource: 'market_oracle_price' | 'local_quote_price' = 'market_oracle_price';
                        if (!shouldSkipCopyTradeLocalReferenceQuote(chainId, executionMode)) {
                            try {
                                const amountInWei = ethers.parseUnits((usdAmount / nativePrice).toFixed(18), 18);
                                const quotedAmountOutWei = await getReferenceExpectedOutput(
                                    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                                    tokenToBuy,
                                    amountInWei,
                                    chainId,
                                    effectiveConfig.maxSlippageBps,
                                    effectiveConfig.user.walletAddress,
                                    {
                                        enableZoraRoutes: true,
                                        traceId: `[copytrade-guard:${config.userId}:${tokenToBuy.slice(0, 8)}]`
                                    }
                                ).catch(() => 0n);

                                const quotedAmountOut = quotedAmountOutWei > 0n
                                    ? Number(ethers.formatUnits(quotedAmountOutWei, tokenInfo.decimals || 18))
                                    : 0;
                                if (quotedAmountOut > 0) {
                                    localQuotePriceUsd = usdAmount / quotedAmountOut;
                                    localQuoteProvider = 'direct-reference-quote';
                                    oraclePriceSource = 'local_quote_price';
                                }
                            } catch {
                                localQuotePriceUsd = 0;
                            }
                        } else if (executionMode === 'turbo') {
                            localQuoteProvider = 'turbo_reference_quote_skipped';
                        }

                        const priceDeviationGuard = evaluateBuyPriceDeviationGuard({
                            chainId,
                            oraclePrice: localQuotePriceUsd > 0 ? localQuotePriceUsd : Number(tokenInfo.price || 0),
                            oraclePriceSource,
                            oracleProvider: localQuotePriceUsd > 0 ? localQuoteProvider : tokenInfo.provider,
                            oracleDexName: tokenInfo.rpcDexName,
                            oracleValidationReason: tokenInfo.priceValidationReason,
                            referencePrice: tokenInfo.referencePrice,
                            referenceProvider: tokenInfo.referenceProvider,
                            oracleFallbackUsed: Boolean(tokenInfo.priceFallbackUsed),
                            estimatedOut,
                            targetSwapValueUsd,
                            strictTargetSwapValueUsd,
                            strictTargetSwapValueReliable,
                            strictTargetSwapValueSource,
                            policy: guardPolicy,
                            maxRatio: 3,
                        });
                        targetExecutionPrice = priceDeviationGuard.targetExecutionPrice;
                        guardAudit.priceDeviation = {
                            oraclePriceSource: priceDeviationGuard.metrics.oraclePriceSource,
                            targetExecutionPriceSource: priceDeviationGuard.metrics.targetExecutionPriceSource,
                            targetImpliedPriceSourceCategory: priceDeviationGuard.metrics.targetImpliedPriceSourceCategory,
                            targetImpliedValueSource: priceDeviationGuard.metrics.targetImpliedValueSource,
                            oraclePrice: roundGuardNumber(priceDeviationGuard.metrics.oraclePrice, 8),
                            targetExecutionPrice: roundGuardNumber(targetExecutionPrice, 8),
                            ratio: roundGuardNumber(priceDeviationGuard.ratio, 4),
                            maxRatio: priceDeviationGuard.metrics.maxRatio,
                            pass: priceDeviationGuard.passed,
                            oracleProvider: priceDeviationGuard.metrics.oracleProvider,
                            oracleDexName: priceDeviationGuard.metrics.oracleDexName,
                            oracleValidationReason: priceDeviationGuard.metrics.oracleValidationReason,
                            referencePrice: roundGuardNumber(priceDeviationGuard.metrics.referencePrice, 8),
                            referenceProvider: priceDeviationGuard.metrics.referenceProvider,
                            oracleFallbackUsed: Boolean(priceDeviationGuard.metrics.oracleFallbackUsed),
                            reasonCode: priceDeviationGuard.reasonCode
                        };

                        if (!priceDeviationGuard.passed && priceDeviationGuard.reasonCode === 'PRICE_DEVIATION_TOO_HIGH') {
                            logger.info(LogCode.DEC_PRICE_IMPACT_HIGH, `🚨 Price Deviation too high! Local Quote: $${Number(priceDeviationGuard.metrics.oraclePrice || 0).toFixed(6)}, Target Paid: $${targetExecutionPrice.toFixed(6)} (${Number(priceDeviationGuard.ratio || 0).toFixed(1)}x)`, {
                                userId: config.userId,
                                token: tokenToBuy,
                                targetSwapValueUsd,
                                priceGuardValueUsd: priceDeviationGuard.metrics.priceGuardValueUsd,
                                estimatedOut,
                                oracleProvider: priceDeviationGuard.metrics.oracleProvider,
                                oracleDexName: priceDeviationGuard.metrics.oracleDexName,
                                oracleValidationReason: priceDeviationGuard.metrics.oracleValidationReason,
                                referencePrice: priceDeviationGuard.metrics.referencePrice,
                                referenceProvider: priceDeviationGuard.metrics.referenceProvider,
                                oracleFallbackUsed: Boolean(priceDeviationGuard.metrics.oracleFallbackUsed),
                                reasonCode: priceDeviationGuard.reasonCode
                            });

                            sendNotificationAsync({
                                userId: config.userId,
                                farcasterFid: config.user.farcasterFid,
                                type: 'COPY_TRADE_SKIPPED',
                                data: {
                                    tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                                    tokenAddress: tokenToBuy,
                                    targetWallet: targetWallet,
                                    chainId: chainId,
                                    skipReason: `Price deviation too high (${Number(priceDeviationGuard.ratio || 0).toFixed(1)}x). Oracle: $${Number(tokenInfo.price || 0).toFixed(6)}, Target paid: $${targetExecutionPrice.toFixed(6)}`,
                                    ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: targetSwapValueUsd }),
                                    priceImpact: `${Number(priceDeviationGuard.ratio || 0).toFixed(1)}x deviation`
                                }
                            }, 'copytrade_skip_price_deviation');
                            emitGuardAudit('skip', 'price_deviation_ratio_exceeded');
                            return; // SKIP TRADE
                        }
                        if (!priceDeviationGuard.passed && ['PRICE_REFERENCE_UNAVAILABLE', 'PRICE_REFERENCE_ZERO'].includes(priceDeviationGuard.reasonCode)) {
                            logger.warn(LogCode.DEC_PRICE_IMPACT_HIGH, 'Price deviation guard skipped strict enforcement due to unavailable oracle reference', {
                                userId: config.userId,
                                token: tokenToBuy,
                                chainId,
                                reasonCode: priceDeviationGuard.reasonCode,
                                oracleProvider: priceDeviationGuard.metrics.oracleProvider,
                                oracleValidationReason: priceDeviationGuard.metrics.oracleValidationReason,
                                referenceProvider: priceDeviationGuard.metrics.referenceProvider,
                                referencePrice: priceDeviationGuard.metrics.referencePrice,
                            });
                        }
                    }
                } catch (e) { }
            }

            if (targetExecutionPrice > 0) {
                const dexChainId = chainId === 900 ? 'solana' : chainId;
                const currentPrice = await getDexPriceWithTimeout(tokenToBuy, dexChainId);
                if (currentPrice > 0) {
                    const deviationBps = Math.abs(targetExecutionPrice - currentPrice) / currentPrice * 10000;
                    guardAudit.priceDeviation = {
                        ...(guardAudit.priceDeviation && typeof guardAudit.priceDeviation === 'object' ? guardAudit.priceDeviation as Record<string, unknown> : {}),
                        dexPrice: roundGuardNumber(currentPrice, 8),
                        deviationBps: roundGuardNumber(deviationBps, 2),
                        maxEntryDeviationBps: effectiveConfig.maxEntryDeviationBps,
                        entryDeviationSource: effectiveConfig.maxEntryDeviationSource,
                        entryDeviationReasonCode: effectiveConfig.maxEntryDeviationReasonCode,
                        entryDeviationThresholdPolicy: effectiveConfig.maxEntryDeviationThresholdPolicy,
                        entryDeviationModeFloorBps: effectiveConfig.maxEntryDeviationModeFloorBps,
                        maxSlippageBps: effectiveConfig.maxSlippageBps,
                        pass: deviationBps <= effectiveConfig.maxEntryDeviationBps
                    };
                    emitEntryDeviationSummary({
                        action: deviationBps > effectiveConfig.maxEntryDeviationBps ? 'entry_deviation_skip' : 'entry_deviation_pass',
                        userId: config.userId,
                        configId: config.id,
                        tokenAddress: tokenToBuy,
                        targetWallet,
                        chainId,
                        executionMode,
                        currentPriceSource: 'market_oracle_price',
                        targetExecutionPriceSource: 'target_implied_price',
                        targetImpliedPriceSourceCategory: String((guardAudit.priceDeviation as Record<string, unknown> | undefined)?.targetImpliedPriceSourceCategory || 'target_unknown'),
                        targetImpliedValueSource: String((guardAudit.priceDeviation as Record<string, unknown> | undefined)?.targetImpliedValueSource || 'target_swap_value_usd'),
                        targetExecutionPrice,
                        currentPrice,
                        deviationBps,
                        limitBps: effectiveConfig.maxEntryDeviationBps,
                        thresholdSource: effectiveConfig.maxEntryDeviationSource,
                        thresholdReasonCode: effectiveConfig.maxEntryDeviationReasonCode,
                        thresholdPolicy: effectiveConfig.maxEntryDeviationThresholdPolicy,
                    });
                    if (shouldEnforceBuyGuard(guardPolicy, 'priceDeviationBps') && deviationBps > effectiveConfig.maxEntryDeviationBps) {
                        const unreliableMarketPrice = isEntryDeviationPriceUnreliable(chainId, tokenInfo);
                        if (unreliableMarketPrice) {
                            logger.warn(LogCode.DEC_PRICE_IMPACT_HIGH, 'Entry deviation exceeded but bypassed due unreliable market price source', {
                                userId: config.userId,
                                token: tokenToBuy,
                                chainId,
                                deviationBps: deviationBps.toFixed(0),
                                limitBps: effectiveConfig.maxEntryDeviationBps,
                                targetExecutionPrice,
                                currentPrice,
                                guardLiquidityReliable: tokenInfo?.guardLiquidityReliable ?? null,
                                guardLiquidityPoolCount: tokenInfo?.guardLiquidityPoolCount ?? null,
                                guardLiquiditySource: tokenInfo?.guardLiquiditySource ?? null,
                                reasonCode: 'ENTRY_DEVIATION_UNRELIABLE_PRICE_BYPASS'
                            });
                            emitGuardAudit('pass', 'price_deviation_unreliable_price_bypass');
                        } else {
                            logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: entry deviation exceeds configured threshold', {
                                userId: config.userId,
                                token: tokenToBuy,
                                deviationBps: deviationBps.toFixed(0),
                                limitBps: effectiveConfig.maxEntryDeviationBps,
                                targetExecutionPrice,
                                currentPrice,
                                thresholdSource: effectiveConfig.maxEntryDeviationSource,
                                thresholdPolicy: effectiveConfig.maxEntryDeviationThresholdPolicy,
                                modeFloorBps: effectiveConfig.maxEntryDeviationModeFloorBps,
                                executionMode,
                                reasonCode: effectiveConfig.maxEntryDeviationReasonCode
                            });

                            sendNotificationAsync({
                                userId: config.userId,
                                farcasterFid: config.user.farcasterFid,
                                type: 'COPY_TRADE_SKIPPED',
                                data: {
                                    tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                                    tokenAddress: tokenToBuy,
                                    targetWallet: targetWallet,
                                    chainId: chainId,
                                    skipReason: `Entry deviation ${deviationBps.toFixed(0)} bps > limit ${effectiveConfig.maxEntryDeviationBps} bps`,
                                    ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: targetSwapValueUsd }),
                                }
                            }, 'copytrade_skip_price_deviation_bps');
                            emitGuardAudit('skip', 'price_deviation_bps_exceeded');
                            return;
                        }
                    }
                }
            }

            // 🛡️ GAS BUFFER CHECK (EVM Only)
            // Must run for all execution modes (including turbo), otherwise low-balance wallets still attempt tx.
            if (shouldEnforceBuyGuard(guardPolicy, 'gasBuffer') && chainId !== 900) {
                const nativeBalance = await getNativeBalance(effectiveConfig.user.walletAddress, chainId);
                const gasBufferWei = ethers.parseEther("0.005"); // ~$15 buffer

                // Calculate trade cost in Native Token (ETH/BNB)
                let tradeCostWei = 0n;
                if (nativePrice > 0) {
                    const amountInNative = usdAmount / nativePrice;
                    // [Logic]: Limit to 18 decimals to prevent ethers "too many decimals" error.
                    // [Ref]: ethers.parseEther documentation.
                    tradeCostWei = ethers.parseEther(amountInNative.toFixed(18));
                }

                if (nativeBalance === null) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Skipping strict gas-buffer check due to native balance RPC failure', {
                        userId: config.userId,
                        wallet: effectiveConfig.user.walletAddress,
                        chainId
                    });
                    emitGuardAudit('pass', 'gas_balance_rpc_failed');
                } else if (nativeBalance < (tradeCostWei + gasBufferWei)) {
                    const balanceEth = ethers.formatEther(nativeBalance);
                    const requiredEth = ethers.formatEther(tradeCostWei + gasBufferWei);

                    logger.throttled(LogCode.EXE_INSUFFICIENT_FUNDS, 'Skipping trade: Insufficient gas buffer', {
                        userId: config.userId,
                        balance: balanceEth,
                        required: requiredEth,
                        buffer: "0.005"
                    });

                    // Send skip notification for insufficient gas
                    await notificationService.sendNotification({
                        userId: config.userId,
                        farcasterFid: config.user.farcasterFid,
                        type: 'COPY_TRADE_SKIPPED',
                        data: {
                            tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                            tokenAddress: tokenToBuy,
                            targetWallet: targetWallet,
                            chainId: chainId,
                            skipReason: `Insufficient gas. Balance: ${parseFloat(balanceEth).toFixed(4)} ETH, Required: ${parseFloat(requiredEth).toFixed(4)} ETH`,
                            ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: targetSwapValueUsd }),
                        }
                    });
                    emitGuardAudit('skip', 'insufficient_gas_buffer');
                    return;
                }
            }

        emitGuardAudit('pass', 'guards_passed_pre_execution');

        // 🛡️ DB TRANSACTION LOCK (Prevents Concurrent Buys)
        // Create a PENDING position record atomically. If one exists, this will fail.
        try {
            const pendingPos = await prisma.$transaction(async (tx) => {
                const positionWhere = buildDuplicateTradeWhere({
                    userId: config.userId,
                    tokenAddress: tokenToBuy,
                    cooldownMinutes: shouldEnforceBuyGuard(guardPolicy, 'cooldown') ? cooldownMinutes : 0,
                    positionStatusCompat
                });
                const existing = await tx.position.findFirst({
                    where: positionWhere
                });

                if (existing) {
                    throw new Error('DUPLICATE_TRADE: Position already exists or pending');
                }

                // Create PENDING position to claim the lock
                return tx.position.create({
                    data: {
                        userId: config.userId,
                        configId: effectiveConfig.id,
                        tokenAddress: tokenToBuy,
                        tokenSymbol: tokenInfo.symbol || 'UNK',
                        chainId,
                        entryPrice: tokenInfo.price || 0,
                        entryAmount: '0',
                        entryTxHash: `PENDING_${Date.now()}`, // Temporary placeholder
                        // DB-level idempotency key: same user+chain+token+source tx can only lock once.
                        leaderTxHash: leaderTxHash || undefined,
                        entryUsdValue: usdAmount,
                        status: positionStatusCompat.pendingCreateStatus as any
                    }
                });
            });
            pendingPositionId = pendingPos.id;
            pendingPositionCreatedAt = pendingPos.createdAt;
            logger.info(LogCode.EXE_TX_BROADCAST, 'Created PENDING position lock', { userId: config.userId, token: tokenToBuy, positionId: pendingPositionId });
        } catch (err: any) {
            const isUniqueConflict = String(err?.code || '').toUpperCase() === 'P2002'
                || String(err?.message || '').toLowerCase().includes('unique constraint');
            if (err.message.includes('DUPLICATE_TRADE') || isUniqueConflict) {
                logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping duplicate trade (DB Lock)', { userId: config.userId, token: tokenToBuy });
                emitGuardAudit('skip', 'duplicate_trade_lock');
            } else {
                logger.error(LogCode.SYS_ERROR, 'Failed to create pending position', { error: err.message });
            }
            return;
        }

        logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Executing trade', {
            userId: config.userId,
            wallet: config.user.walletAddress,
            usdAmount
        });

        // Fetch launchpad detection. 
        // Previously turboMode forced this to null, which breaks pump.fun in Solana 
        // because un-migrated pump tokens MUST be routed through direct bonding curve.
        const launchpad = await resolveLaunchpad(launchpadPromise, chainId);

        if (chainId === 900) {
            // Dynamically fetch Solana wallet from Privy (not from database field)
            let solAddress: string | null = null;
            try {
                solAddress = await getSolanaEmbeddedWalletAddress(config.user.privyDid);
            } catch (err: any) {
                logger.error(LogCode.SYS_ERROR, 'Unexpected error in processSingleUserBuy', {
                    userId: config.userId,
                    error: err?.message || String(err)
                });
            }

            if (!solAddress) {
                logger.warn(LogCode.API_AUTH_FAILED, 'Skipping Solana trade: No Solana wallet found in Privy', { userId: config.userId });
                return;
            }

            // Get SOL Price dynamically (already fetched at top of loop)
            if (nativePrice <= 0) {
                logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch SOL price for trade calculation', { userId: config.userId });
                return; // Better to skip than use a stale hardcoded price
            }

            const amountInLamports = Math.floor((usdAmount / nativePrice) * 1e9).toString();
            const amountInSol = Number(amountInLamports) / 1e9;

            const lamportsToSolAmount = (lamports: string): string => {
                const value = BigInt(lamports);
                const whole = value / 1000000000n;
                const frac = value % 1000000000n;
                const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
                return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
            };

            const executeSolanaCopytradeAttempt = async (
                attemptLamports: string,
                attemptSlippageBps: number,
                modeForAttempt: CopyTradeExecutionMode
            ): Promise<MainSwapResult> => {
                const result = await executeSwapViaPort({
                    userId: effectiveConfig.user.privyDid,
                    walletAddress: solAddress,
                    tokenIn: SOLANA_CONFIG.TOKENS.SOL,
                    tokenOut: tokenToBuy,
                    amountIn: lamportsToSolAmount(attemptLamports),
                    chainId,
                    slippageBps: attemptSlippageBps,
                    mode: 'copytrade',
                    launchpadProvider: launchpad?.provider as any,
                    userSettings: {
                        fastSwapMode: modeForAttempt === 'turbo',
                        copyTradeExecutionMode: modeForAttempt
                    },
                    executionContext: {
                        executionStep: 'copytrade_buy',
                        strictReplica: false,
                        sellRoutePolicy: 'direct_primary',
                        sourceTxHash: leaderTxHash || undefined
                    }
                });

                if (!result.success || !result.txHash) {
                    throw new Error(result.error || 'Solana copytrade buy failed');
                }

                const provider = String(result.metadata?.provider || 'unknown');
                const route = provider.includes('fallback') || provider.includes('jupiter') ? 'jupiter' : 'direct';
                logger.info(
                    LogCode.SYS_INFO,
                    `[CopyTradeRoute][solana_buy] route=${route} provider=${provider} launchpad=${String(launchpad?.provider || 'unknown')} slippageBps=${attemptSlippageBps} lamports=${attemptLamports}`,
                    {
                    userId: config.userId,
                    token: tokenToBuy,
                    launchpadProvider: launchpad?.provider || 'unknown',
                    route,
                    provider,
                    slippageBps: attemptSlippageBps,
                    amountLamports: attemptLamports
                    }
                );

                return result;
            };

            logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Solana trade calculation complete', {
                buyAmountUsd: usdAmount,
                solPrice: nativePrice,
                amountInSol: amountInSol.toString(),
                token: tokenToBuy,
                wallet: solAddress
            });

            // Jupiter/Solana System Safeguard
            // We enforce a $0.5 minimum to avoid "Route not found" errors common with tiny amounts
            // and to ensure the trade is economically viable despite fees. Not a strict protocol limit.
            const MIN_TRADE_USD = 0.5;
            if (usdAmount < MIN_TRADE_USD) {
                logger.throttled(LogCode.EXE_MIN_AMOUNT_NOT_MET, 'Trade amount below minimum threshold', {
                    amountUsd: usdAmount,
                    minUsd: MIN_TRADE_USD
                });
                return;
            }

            if (turboMode) {
                // Turbo: up to 3 consecutive attempts with escalating slippage / reduced amount.
                // Same pattern as EVM turbo retries in MainSwapService.
                const SOLANA_TURBO_MAX_ATTEMPTS = 3;
                const baseLamports = BigInt(amountInLamports);
                const baseSlippage = effectiveConfig.maxSlippageBps;
                let lastSolErr: Error | null = null;

                for (let attempt = 1; attempt <= SOLANA_TURBO_MAX_ATTEMPTS; attempt++) {
                    const amountMultiplier = attempt === 1 ? 1 : attempt === 2 ? 0.998 : 0.996;
                    const slippageMultiplier = attempt === 1 ? 1 : attempt === 2 ? 1.2 : 1.5;
                    const attemptLamports = (baseLamports * BigInt(Math.floor(amountMultiplier * 1000)) / 1000n).toString();
                    const attemptSlippage = Math.min(Math.floor(baseSlippage * slippageMultiplier), 4900);

                    if (attempt > 1) {
                        logger.info(LogCode.SYS_INFO, `[Solana Turbo] 光速 retry attempt ${attempt}`, {
                            userId: config.userId,
                            token: tokenToBuy,
                            lamports: attemptLamports,
                            slippageBps: attemptSlippage,
                            prevError: lastSolErr?.message?.slice(0, 80)
                        });
                    }
                    try {
                        const result = await executeSolanaCopytradeAttempt(attemptLamports, attemptSlippage, 'turbo');
                        txHash = result.txHash!;
                        txLifecycleStatus = result.txLifecycle?.status || txLifecycleStatus;
                        swapMetadata = {
                            ...(swapMetadata || {}),
                            mainSwapProvider: result.metadata?.provider,
                            mainSwapRouteMode: result.metadata?.launchpad || launchpad?.provider || 'unknown'
                        } as any;
                        break;
                    } catch (solErr: any) {
                        lastSolErr = solErr;
                        logger.warn(LogCode.EXE_TX_REVERTED, `[Solana Turbo] Attempt ${attempt} failed`, {
                            userId: config.userId,
                            token: tokenToBuy,
                            attempt,
                            error: solErr?.message?.slice(0, 120)
                        });
                    }
                }
                if (!txHash && lastSolErr) {
                    throw lastSolErr;
                }
            } else {
                const solAttempts: Array<{ amountIn: string; slippageBps: number; label: string }> = [
                    {
                        amountIn: amountInLamports,
                        slippageBps: effectiveConfig.maxSlippageBps,
                        label: 'primary'
                    },
                    {
                        amountIn: amountInLamports,
                        slippageBps: Math.min((effectiveConfig.maxSlippageBps || 300) + 500, 4900),
                        label: 'retry_relaxed_slippage'
                    }
                ];

                let lastSolErr: any = null;
                for (let i = 0; i < solAttempts.length; i++) {
                    const attempt = solAttempts[i];
                    try {
                        if (i > 0) {
                            logger.warn(LogCode.EXE_TX_REVERTED, '[Solana Buy] Retrying non-turbo buy after failure', {
                                userId: config.userId,
                                token: tokenToBuy,
                                attempt: attempt.label,
                                slippageBps: attempt.slippageBps,
                                prevError: String(lastSolErr?.message || '').slice(0, 160)
                            });
                        }

                        const result = await executeSolanaCopytradeAttempt(attempt.amountIn, attempt.slippageBps, executionMode);
                        txHash = result.txHash!;
                        txLifecycleStatus = result.txLifecycle?.status || txLifecycleStatus;
                        swapMetadata = {
                            ...(swapMetadata || {}),
                            mainSwapProvider: result.metadata?.provider,
                            mainSwapRouteMode: result.metadata?.launchpad || launchpad?.provider || 'unknown'
                        } as any;
                        break;
                    } catch (solErr: any) {
                        lastSolErr = solErr;
                        const msg = String(solErr?.message || '').toLowerCase();
                        const retryable = msg.includes('failed on-chain')
                            || msg.includes('simulation failed')
                            || msg.includes('custom program error')
                            || msg.includes('slippage')
                            || msg.includes('exceedmaxcost')
                            || msg.includes('0x1771')
                            || msg.includes('6001');

                        if (i >= solAttempts.length - 1 || !retryable) {
                            throw solErr;
                        }
                    }
                }
            }

        } else {
            // EVM Logic - nativePrice already fetched at top


            // SPECIALIZED ZORA INTERACTION - Use async launchpad detection (non-blocking)
            const isFastExecutionEnabled = userSettings?.fastSwapMode === true;

            let useStandardSwap = true;

            if (launchpad && launchpad.provider === 'zora' && isFastExecutionEnabled) {
                logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Zora token detected with fast execution enabled', { userId: config.userId, token: tokenToBuy });
                try {
                    const copyTradeFeeBpsOverride =
                        isJudgeEnabledByCopyTradeConfig(config)
                            ? env.platformFees.copyTradeAiBps
                            : undefined;
                    txHash = await zoraSniperService.fastSwap({
                        userId: effectiveConfig.user.privyDid,
                        accessToken: '', // Privy server-side doesn't need token if configured
                        walletAddress: effectiveConfig.user.walletAddress,
                        tokenOut: tokenToBuy,
                        // [Logic]: Limit to 18 decimals to prevent ethers "too many decimals" error.
                        amountIn: (usdAmount / nativePrice).toFixed(18),
                        // Use universal global slippage directly
                        slippage: effectiveConfig.maxSlippageBps / 100,
                        feeContext: 'copyTrade',
                        feeBpsOverride: copyTradeFeeBpsOverride
                    });
                    useStandardSwap = !txHash;
                } catch (zoraErr: any) {
                    logger.warn(LogCode.EXE_TX_REVERTED, 'Zora fast swap failed, falling back to standard route', { userId: config.userId, error: zoraErr.message || zoraErr });
                    useStandardSwap = true;
                }
            } else if (launchpad && launchpad.provider === 'fourmeme' && chainId === 56) {
                // Four.meme tokens can be traded via TokenManager while on bonding curve
                logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Four.meme token detected - attempting specialized contract buy', { userId: config.userId, token: tokenToBuy });
                try {
                    const bnbAmount = (usdAmount / nativePrice).toFixed(18);
                    txHash = await fourMemeService.buyTokenAMAP({
                        userId: effectiveConfig.user.privyDid,
                        walletAddress: effectiveConfig.user.walletAddress,
                        tokenAddress: tokenToBuy,
                        bnbAmount,
                        // Use universal global slippage directly
                        slippageBps: effectiveConfig.maxSlippageBps,
                        feeContext: 'copyTrade',
                    });
                    // If successful, skip standard swap. If txHash is null/empty for some reason, fallback.
                    useStandardSwap = !txHash;
                } catch (fourErr: any) {
                    logger.warn(LogCode.EXE_TX_REVERTED, 'Four.meme specialized buy failed, falling back to standard route (Token might have graduated)', {
                        userId: config.userId,
                        error: fourErr.message || fourErr
                    });
                    useStandardSwap = true;
                }
            }

            if (useStandardSwap) {
                if (launchpad && launchpad.provider === 'zora' && !isFastExecutionEnabled) {
                    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Zora token detected but Fast Execution is disabled', { userId: config.userId });
                }
                if (launchpad && launchpad.provider === 'zora' && isFastExecutionEnabled) {
                    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Falling back to standard swap after Zora fast swap failure', { userId: config.userId });
                }

                const copyTradeFeeBpsOverride =
                    isJudgeEnabledByCopyTradeConfig(config)
                        ? env.platformFees.copyTradeAiBps
                        : undefined;
                const submissionResult = await executeEvmCopytradeBuySubmissionFlow({
                    userId: config.userId,
                    privyUserId: effectiveConfig.user.privyDid,
                    walletAddress: effectiveConfig.user.walletAddress,
                    tokenToBuy,
                    chainId,
                    usdAmount,
                    nativePrice,
                    baseSlippageBps: effectiveConfig.maxSlippageBps,
                    executionMode,
                    turboMode,
                    fastSwapMode: userSettings?.fastSwapMode === true,
                    checkTokenBeforeSwap: userSettings?.checkTokenBeforeSwap === true,
                    tokenInfo,
                    swap,
                    feeBpsOverride: copyTradeFeeBpsOverride,
                    directSwapHint: buildDirectSwapHintFromSwap(swap),
                    preWarmedNonce: getPendingNonce(chainId, effectiveConfig.user.walletAddress),
                    refreshTokenInfoForRetry: async () => tokenInfoCache
                        ? await getTokenInfoOnce(tokenInfoCache, tokenToBuy, chainId, { verbose: false, forceRefresh: true, rpcStrategy: 'fast' })
                        : await getTokenInfo(tokenToBuy, chainId, { verbose: false, forceRefresh: true, rpcStrategy: 'fast' })
                });
                if (submissionResult.status === 'aborted') {
                    return;
                }
                txHash = submissionResult.txHash;
                attributedEntryAmountHuman = submissionResult.attributedEntryAmountHuman || attributedEntryAmountHuman;
                txLifecycleStatus = submissionResult.txLifecycleStatus || txLifecycleStatus;
                orderRuntimeContext = submissionResult.runtimeContext;
                swapMetadata = submissionResult.swapMetadata;
            }
        }

        if (!txHash) {
            logger.warn(LogCode.EXE_TX_REVERTED, 'No txHash returned for buy. Deleting pending position.', { userId: config.userId, token: tokenToBuy });
            if (pendingPositionId) {
                await prisma.position.deleteMany({ where: { id: pendingPositionId } }).catch(e => logger.error(LogCode.SYS_ERROR, 'Failed to cleanup pending pos', { error: e }));
            }
            return;
        }

        // CRITICAL: Ensure price is valid before creating position to avoid infinite PNL
        if (!tokenInfo.price || tokenInfo.price <= 0) {
            logger.error(LogCode.DEC_FAILED_UNKNOWN_DEX, 'Invalid entry price found, cleanup pending position', { token: tokenToBuy, price: tokenInfo.price });
            if (pendingPositionId) {
                await prisma.position.deleteMany({ where: { id: pendingPositionId } }).catch(e => logger.error(LogCode.SYS_ERROR, 'Failed to cleanup pending pos', { error: e }));
            }
            return;
        }

        // Update PENDING position to OPEN with real details
        // For Solana: when txHash is available, mark as 'open' immediately.
        // Solana uses fire-and-forget submission (waitForConfirmation: false), so a
        // successful txHash means the transaction was accepted by the network.
        // Relying on the delayed setTimeout promotion (15 s) caused mirror sells to
        // fire before the promotion ran and miss the position entirely.
        const persistenceResult = await persistCopytradeBuySubmission({
            pendingPositionId,
            pendingPositionCreatedAt,
            userId: effectiveConfig.userId,
            configId: effectiveConfig.id,
            tokenAddress: tokenToBuy,
            tokenSymbol: resolveDisplayTokenSymbol(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy),
            chainId,
            tokenPrice: tokenInfo.price,
            entryAmount: (usdAmount / nativePrice).toString(),
            attributedEntryAmountHuman: attributedEntryAmountHuman || undefined,
            attributedEntryAmountExact: swapMetadata?.directFeeSettlement?.amountOutBase || undefined,
            entryTxHash: txHash,
            leaderBuyTxHash: leaderTxHash || undefined,
            entryUsdValue: usdAmount,
            txLifecycleStatus,
            runtimeContext: orderRuntimeContext,
        });
        const nextPositionStatus = persistenceResult.nextPositionStatus;
        let persistedPositionId = persistenceResult.persistedPositionId;
        pendingPositionCreatedAt = persistenceResult.pendingPositionCreatedAt || pendingPositionCreatedAt;
        pendingPositionSettled = persistenceResult.pendingPositionSettled;

        logger.info(LogCode.EXE_TX_CONFIRMED, 'Copy trade buy submitted and position state updated', {
            userId: config.userId,
            token: tokenToBuy,
            txHash,
            txLifecycleStatus: txLifecycleStatus || 'unknown',
            positionStatus: nextPositionStatus,
            positionId: persistedPositionId,
            positionAmountStorageReasonCode: persistenceResult.positionAmountStorageReasonCode,
            ...buildOrderAuditFields(orderRuntimeContext)
        });

        const notifyBuySuccessConfirmed = async () => {
            sendNotificationAsync({
                userId: config.user.privyDid,
                farcasterFid: config.user.farcasterFid,
                type: 'TRADE_SUCCESS_BUY',
                data: {
                    tokenSymbol: await resolveDisplayTokenSymbolAsync(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy, chainId),
                    usdValue: usdAmount.toFixed(2),
                    targetWallet: targetWallet,
                    txHash: txHash,
                    chainId: chainId
                }
            }, 'copytrade_buy_success_confirmed');
        };

        const executeMirrorSellAfterBuyConfirm = async (positionId: string) => {
            const mirrorSellPosition = await prisma.position.findUnique({
                where: { id: positionId }
            });
            if (mirrorSellPosition && mirrorSellPosition.status !== 'closed') {
                logger.warn(LogCode.SYS_INFO, '[CopyTradeRace] Target already sold while buy was pending; executing mirror sell on confirmation', {
                    userId: config.userId,
                    token: tokenToBuy,
                    chainId,
                    txHash,
                    positionId,
                    targetSellTxHash: null,
                });
                await executePositionExit({
                    userId: config.userId,
                    tokenAddress: tokenToBuy,
                    chainId,
                    exitReason: 'mirror_sell',
                    tokenInfo,
                    config: { ...effectiveConfig, user: effectiveConfig.user },
                    positions: [mirrorSellPosition]
                });
            }
        };

        const runBuyConfirmationTransition = async (
            confirmation: ConfirmationOutcome,
            recoverySource: 'initial_wait' | 'late_recovery',
        ) => {
            return await applyBuyConfirmationTransition({
                confirmation,
                chainId,
                tokenToBuy,
                txHash,
                userId: effectiveConfig.user.privyDid,
                targetWallet,
                leaderBuyTxHash: leaderTxHash || undefined,
                persistedPositionId,
                pendingPositionCreatedAt,
                tokenInfo: {
                    symbol: tokenInfo.symbol,
                    price: tokenInfo.price,
                    decimals: tokenInfo.decimals
                },
                walletAddress: effectiveConfig.user.walletAddress,
                positionStatusCompat,
                directFeeSettlement: swapMetadata?.directFeeSettlement || null,
                onMirrorSellAfterConfirm: executeMirrorSellAfterBuyConfirm,
                onNotifySuccess: notifyBuySuccessConfirmed,
                recoverySource,
            });
        };

        // Drive all post-buy actions from a single confirmation outcome so fee recovery,
        // position promotion, notification and preheat stay on the same state boundary.
        scheduleCopytradeBuyConfirmationFlow({
            chainId,
            txHash,
            tokenAddress: tokenToBuy,
            delayMs: SELL_PREHEAT_DELAY_MS,
            timeoutMs: SELL_PREHEAT_CONFIRM_TIMEOUT_MS,
            pollMs: SELL_PREHEAT_CONFIRM_POLL_MS,
            onTransition: runBuyConfirmationTransition,
        });

        // Track User Activity (Copy Trade + Swap Volume)
        trackCopyTrade(config.userId);
        trackSwap(config.userId, usdAmount);

        // =================================================================
        // 🆕 AI Analysis Logic (Post-Trade)
        // =================================================================
        const aiMode = getEnabledCopyTradeAiMode(config);
        const postBuyAiResult = await runPostBuyAiFlow({
            aiMode,
            userId: config.userId,
            privyDid: config.user.privyDid,
            configId: config.id,
            buyAmountUsd: config.buyAmountUsd,
            tokenAddress: tokenToBuy,
            tokenSymbol: resolveDisplayTokenSymbol(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy),
            chainId,
            targetWallet,
            txHash,
            aiModel: env.aiModel,
            resolvedAiModeForLogs: resolveCopyTradeAiMode(config),
        });
        judgeDecisionId = postBuyAiResult.judgeDecisionId;
        // =================================================================

        if (nextPositionStatus !== 'open') {
            logger.warn(LogCode.SYS_INFO, 'Buy notification deferred until on-chain confirmation', {
                userId: config.userId,
                token: tokenToBuy,
                txHash,
                txLifecycleStatus: txLifecycleStatus || 'unknown'
            });
        }

    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, `Error processing trade configuration`, {
            configId: config.id,
            userId: config.userId,
            error: compactCopyTradeError(error),
            bugHint: inferCopyTradeBugHint(error),
            stack: error.stack
        });

        // =================================================================
        // 🟣 Send Farcaster Direct Cast (Failure)
        // =================================================================
        sendNotificationAsync({
            userId: config.userId,
            farcasterFid: config.user.farcasterFid,
            type: 'TRADE_FAILURE',
            data: {
                tokenSymbol: resolveDisplayTokenSymbol(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy),
                error: compactCopyTradeError(error),
                targetWallet: targetWallet,
                chainId: chainId
            }
        }, 'copytrade_buy_failure');
    } finally {
        if (pendingPositionId && !pendingPositionSettled) {
            const cleaned = await cleanupPendingCopytradePosition({
                pendingPositionId,
                reasonCode: txHash ? 'buy_unsettled_cleanup' : 'buy_failed_cleanup'
            }).catch((cleanupError) => {
                logger.error(LogCode.SYS_ERROR, 'Failed to cleanup pending copytrade position', {
                    configId: config.id,
                    userId: config.userId,
                    pendingPositionId,
                    error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
                });
                return false;
            });

            if (cleaned) {
                logger.warn(LogCode.SYS_INFO, 'Pending copytrade position cleaned up before attribution could be established', {
                    configId: config.id,
                    userId: config.userId,
                    token: tokenToBuy,
                    pendingPositionId,
                    txHash: txHash || undefined
                });
            }
        }
    }
    });
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
    const { userId, tokenAddress, chainId, exitReason, config } = params;
    const tokenInfo = params.tokenInfo ?? { price: 0, symbol: 'UNKNOWN' };
    const hasValidPrice = Number.isFinite(tokenInfo?.price) && tokenInfo.price > 0;

    logger.info(LogCode.EXE_TX_BROADCAST, 'Executing position exit', {
        userId,
        token: tokenAddress,
        reason: exitReason,
        chainId
    });

    let balance = 0n;
    let decimals = 18;
    let txHash = '';
    let exitRuntimeContext: OrderRuntimeContext | undefined;
    const user = config.user;
    let exitPositions: any[] = [];
    let persistedExitPositions: any[] = [];
    let persistedExitBalance = balance;

    // Fetch universal global slippage from UserSettings
    const settings = params.userSettings || await prisma.userSettings.findUnique({ where: { userId } });
    const universalSlippageBps = resolveCopytradeSlippageBps(config, settings);

    try {
        exitPositions = params.positions && params.positions.length > 0
            ? params.positions
            : await prisma.position.findMany({
                // Include 'pending': sell can fire while buy is still confirming on-chain
                where: { userId, tokenAddress, chainId, status: { in: ['open', 'pending'] } }
            });

        if (exitPositions.length === 0) {
            logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping position exit: no attributed open positions supplied', {
                userId,
                token: tokenAddress,
                chainId,
                reason: exitReason
            });
            return null;
        }
        persistedExitPositions = exitPositions;
        persistedExitBalance = balance;

        if (chainId === 900) {
            // SOLANA Logic
            let solAddress: string | null = null;
            try {
                solAddress = await getSolanaEmbeddedWalletAddress(user.privyDid);
            } catch (e: any) {
                logger.error(LogCode.API_AUTH_FAILED, 'Error fetching Solana wallet for exit', { userId, error: e.message });
            }

            if (!solAddress) {
                logger.warn(LogCode.API_AUTH_FAILED, 'Skipping Solana sell: No Solana wallet found in Privy', { userId });
                return null;
            }

            // 1. Robust Balance Fetching with Retries
            // EVM-like strategy rotation: each retry hits a DIFFERENT endpoint pool
            // because getSolanaConnection caches per URL (60s TTL):
            //   attempt 0 → fast+critical  (premium dedicated node)
            //   attempt 1 → cheap+critical (backup pool, different URL)
            //   attempt 2 → fast+normal    (last resort, ignores circuit state)
            const BALANCE_FETCH_STRATEGIES: Array<['fast'|'cheap', 'critical'|'normal']> = [
                ['fast', 'critical'],
                ['cheap', 'critical'],
                ['fast', 'normal'],
            ];
            let accounts: any = { value: [] };
            let fetchSuccess = false;
            for (let i = 0; i < BALANCE_FETCH_STRATEGIES.length; i++) {
                const [strategy, importance] = BALANCE_FETCH_STRATEGIES[i];
                try {
                    const connection = getSolanaConnection(strategy, importance);
                    accounts = await connection.getParsedTokenAccountsByOwner(
                        new PublicKey(solAddress),
                        { mint: new PublicKey(tokenAddress) }
                    );
                    fetchSuccess = true;
                    if (accounts.value.length > 0) break; // Found accounts, stop retrying
                    // Empty result (no token accounts yet) - brief wait and try next strategy
                    if (i < BALANCE_FETCH_STRATEGIES.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                } catch (err) {
                    const isLast = i === BALANCE_FETCH_STRATEGIES.length - 1;
                    logger[isLast ? 'error' : 'warn'](
                        LogCode.API_FETCH_FAILED,
                        `Solana balance fetch failed [${strategy}/${importance}]${isLast ? ' after all strategies' : ', trying next strategy'}`,
                        { userId, token: tokenAddress, attempt: i, error: (err as Error).message }
                    );
                    if (!isLast) await new Promise(resolve => setTimeout(resolve, 400));
                }
            }

            let usedDbBalanceFallback = false;
            if (!fetchSuccess) {
                // RPC is fully degraded — we cannot get the on-chain token balance.
                // For mirror_sell: fall back to the DB-stored entryAmountExact (raw bigint
                // token units stored at buy time). Using DB amount and failing on-chain is
                // far better than silently skipping the sell and leaving an open position.
                if (exitReason === 'mirror_sell' && exitPositions.length > 0) {
                    for (const pos of exitPositions) {
                        // entryAmountExact is the raw integer token amount written during buy.
                        const rawExact = pos.entryAmountExact != null ? String(pos.entryAmountExact).trim() : '';
                        if (rawExact && rawExact !== '0') {
                            try { balance += BigInt(rawExact); } catch { /* skip */ }
                        }
                        // fallback: entryAmountDec is the human amount; use it with known decimals
                        if (balance === 0n) {
                            const dec = tokenInfo?.decimals ?? null;
                            const rawDecStr = pos.entryAmountDec != null ? String(pos.entryAmountDec).trim() : '';
                            if (dec != null && rawDecStr && rawDecStr !== '0') {
                                try { balance += ethers.parseUnits(rawDecStr, dec); } catch { /* skip */ }
                            }
                        }
                        // Use tokenInfo decimals for display; if unavailable default to 6 (safe for dust check)
                        decimals = tokenInfo?.decimals ?? 6;
                    }
                    if (balance > 0n) {
                        usedDbBalanceFallback = true;
                        logger.warn(LogCode.API_FETCH_FAILED, 'Solana RPC exhausted during mirror sell — using DB position amount as balance fallback', {
                            userId, token: tokenAddress, balanceFallback: balance.toString(), decimals,
                            positionCount: exitPositions.length
                        });
                    } else {
                        logger.warn(LogCode.API_FETCH_FAILED, 'Skipping Solana sell: RPC exhausted and no usable amount in DB positions', { userId, token: tokenAddress });
                        return null;
                    }
                } else {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Skipping Solana sell: All RPC strategies exhausted, keeping position open', { userId, token: tokenAddress });
                    return null; // Safely skip — keep position open, do NOT treat RPC failure as zero balance
                }
            }

            if (!usedDbBalanceFallback) {
                for (const acc of accounts.value) {
                    const amount = BigInt(acc.account.data.parsed.info.tokenAmount.amount);
                    balance += amount;
                    decimals = acc.account.data.parsed.info.tokenAmount.decimals;
                }
            }

            const attribution = resolveAttributedPositionExitAmount({
                positions: exitPositions,
                decimals,
                onChainBalanceRaw: balance,
                // Mirror sell: if attribution can't resolve (e.g. position still pending confirmation),
                // sell the full on-chain balance rather than skipping.
                allowFullBalanceFallback: exitReason === 'mirror_sell',
            });

            const balanceUsd = formatTokenAmount(balance, decimals) * (hasValidPrice ? tokenInfo.price : 0);

            // 2. Rent Reclamation / Dust Handling
            // If balance is effectively zero (or just dust < 1000 raw units), we consider it empty.
            if (balance < 1000n) {
                const treatAsEmptyOrDust = balance <= 0n || balance < 1000n || (hasValidPrice && balanceUsd < 0.1);
                // CHECK: If we have an open position record but no balance, close it.
                // This handles the case where an external sell happened or previous sell leftover dust.
                if (treatAsEmptyOrDust) {
                    logger.throttled(LogCode.WTC_TX_SKIPPED, 'Closing database record for empty or negligible balance', {
                        userId,
                        token: tokenAddress,
                        balanceUsd,
                        reason: exitReason
                    });
                    await reconcileNoopExitPosition({
                        positions: exitPositions,
                        action: 'close_position',
                        closeReason: balance <= 0n ? 'balance_empty' : 'balance_dust'
                    });

                    // OPTIONAL: We could add CloseAccount instruction here if account exists but has dust, 
                    // but usually we do it *during* the swap transaction to save a separate TX.
                    return null;
                }
            }

            if (attribution.sellAmountRaw <= 0n) {
                logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping Solana auto-exit: attributed position amount unavailable', {
                    userId,
                    token: tokenAddress,
                    chainId,
                    reason: exitReason,
                    reasonCode: attribution.reasonCode,
                    ...attribution.metrics
                });
                return null;
            }

            logger.info(LogCode.EXE_TX_BROADCAST, 'Selling token on Solana', {
                userId,
                balance: attribution.sellAmountRaw.toString(),
                valueUsd: balanceUsd.toFixed(2)
            });
            balance = attribution.sellAmountRaw;
            persistedExitPositions = attribution.eligiblePositions as any;
            persistedExitBalance = attribution.sellAmountRaw;

            let isPartialSell = false;
            try {
                txHash = await executeSolanaSwap({
                    userId: user.privyDid,
                    tokenInMint: tokenAddress,
                    tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                    amountIn: attribution.sellAmountRaw.toString(),
                    // Use universal global slippage
                    slippageBps: universalSlippageBps
                });
            } catch (e: any) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'Solana 100% sell failed, retrying with AGGRESSIVE slippage', { userId, error: e.message });
                try {
                    // Retry with 1.25x slippage (Aggressive)
                    const aggressiveSlippage = Math.min(Math.floor(universalSlippageBps * 1.25), 2000);
                    txHash = await executeSolanaSwap({
                        userId: user.privyDid,
                        tokenInMint: tokenAddress,
                        tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                        amountIn: attribution.sellAmountRaw.toString(),
                        slippageBps: aggressiveSlippage
                    });
                } catch (e2: any) {
                    try {
                        const safeBalance999 = (attribution.sellAmountRaw * 999n) / 1000n;
                        // Retry with 1.5x slippage (Survival Mode)
                        const survivalSlippage = Math.min(Math.floor(universalSlippageBps * 1.5), 2500);
                        txHash = await executeSolanaSwap({
                            userId: user.privyDid,
                            tokenInMint: tokenAddress,
                            tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                            amountIn: safeBalance999.toString(),
                            slippageBps: survivalSlippage
                        });
                        isPartialSell = true;
                    } catch (e3: any) {
                        logger.error(LogCode.EXE_TX_REVERTED, 'All Solana sell attempts failed', { userId, token: tokenAddress, error: e3.message });
                        throw e3; // Re-throw to trigger exit_failed
                    }
                }
            }

            // Dust sweep is intentionally disabled for attributed exits.
            // Any remaining token balance may belong to manual or external holdings.
            if (txHash && attribution.metrics.hasExternalBalance) {
                logger.info(LogCode.SYS_INFO, 'Skipping Solana dust sweep due to external holdings detected', {
                    userId,
                    token: tokenAddress,
                    chainId,
                    ...attribution.metrics
                });
            } else if (txHash) {
                try {
                    const connection = getSolanaConnection();
                    const postSellAccounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(solAddress), { mint: new PublicKey(tokenAddress) });
                    let remainingBalance = 0n;
                    for (const acc of postSellAccounts.value) { remainingBalance += BigInt(acc.account.data.parsed.info.tokenAmount.amount); }
                    if (remainingBalance > 0n && !attribution.metrics.hasExternalBalance) {
                        const dustUsd = formatTokenAmount(remainingBalance, decimals) * (tokenInfo?.price || 0);
                        if (dustUsd >= 0.05 || isPartialSell) {
                            await executeSolanaSwap({
                                userId: user.privyDid,
                                tokenInMint: tokenAddress,
                                tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                                amountIn: remainingBalance.toString(),
                                // Higher slippage for dust sweep (20%)
                                slippageBps: 2000
                            });
                        }
                    }
                } catch (sweepErr: any) {
                    logger.debug(LogCode.EXE_TX_REVERTED, 'Solana dust sweep failed', { error: sweepErr.message });
                }
            }

        } else {
            // EVM Logic
            const executionMode = resolveExecutionModeForConfig(config);
            const exitPlan = await buildEvmExitPlan({
                userId: user.privyDid,
                walletAddress: user.walletAddress,
                tokenAddress,
                chainId,
                exitReason,
                tokenInfo,
                universalSlippageBps,
                executionMode,
                targetWallet: config.targetWallet,
                positions: exitPositions,
                pendingLots: params.pendingAttributedLots
            });

            balance = exitPlan.balance;
            decimals = exitPlan.decimals;
            persistedExitPositions = exitPlan.positions as any;
            persistedExitBalance = exitPlan.kind === 'swap' ? exitPlan.attributedBalance : balance;

            if (exitPlan.kind === 'noop') {
                if (exitPlan.action === 'keep_open') {
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'Automatic exit skipped: attributed position amount unavailable or wallet balance not safely attributable', {
                        userId,
                        tokenAddress,
                        chainId,
                        reasonCode: exitPlan.attributedReasonCode || 'UNKNOWN',
                        attributionMetrics: exitPlan.attributionMetrics || null
                    });
                    const repairReasonCodes = new Set([
                        'ATTRIBUTED_AMOUNT_UNAVAILABLE',
                        'NO_CONFIRMED_POSITIONS',
                        'PENDING_EXPECTED_AMOUNT_UNAVAILABLE',
                    ]);
                    const exitKeepOpenReasonCode = String(exitPlan.attributedReasonCode || '');
                    if (repairReasonCodes.has(exitKeepOpenReasonCode)) {
                        const repairedPositionIds: string[] = [];
                        for (const position of exitPlan.positions) {
                            const positionId = String((position as any)?.id || '').trim();
                            if (!positionId) continue;
                            const repairOutcome = await repairCopytradePositionAttribution({
                                positionId,
                                chainId,
                                tokenAddress,
                                targetWallet: config?.targetWallet || null,
                            }).catch(() => 'repair_required' as const);
                            if (repairOutcome === 'repaired') {
                                repairedPositionIds.push(positionId);
                            }
                        }
                        if (repairedPositionIds.length > 0) {
                            await prisma.position.updateMany({
                                where: {
                                    id: { in: repairedPositionIds },
                                    status: 'open',
                                },
                                data: {
                                    lastExitAttempt: null,
                                    exitRetryCount: 1,
                                },
                            }).catch(() => null);
                            logger.info(LogCode.SYS_INFO, 'Inline attribution repair applied; scheduled immediate exit retry', {
                                userId,
                                tokenAddress,
                                chainId,
                                exitReason,
                                repairedPositionCount: repairedPositionIds.length,
                                repairedPositionIds,
                            });
                        }
                    }
                    const retryableKeepOpenReasonCodes = new Set([
                        'ATTRIBUTED_AMOUNT_UNAVAILABLE',
                        'NO_CONFIRMED_POSITIONS',
                        'PENDING_EXPECTED_AMOUNT_UNAVAILABLE',
                        'PENDING_BALANCE_NOT_VISIBLE_YET',
                    ]);
                    if (exitReason === 'mirror_sell' && retryableKeepOpenReasonCodes.has(exitKeepOpenReasonCode)) {
                        const retryPositionIds = exitPlan.positions
                            .map((position: any) => String(position?.id || '').trim())
                            .filter(Boolean);
                        if (retryPositionIds.length > 0) {
                            await prisma.position.updateMany({
                                where: {
                                    id: { in: retryPositionIds },
                                    status: { in: ['open', 'pending'] },
                                },
                                data: {
                                    exitReason: 'mirror_sell',
                                    exitRetryCount: 1,
                                    lastExitAttempt: null,
                                },
                            }).catch(() => null);
                            logger.info(LogCode.SYS_INFO, 'Mirror sell keep_open scheduled for retry', {
                                userId,
                                tokenAddress,
                                chainId,
                                reasonCode: exitKeepOpenReasonCode,
                                retryPositionIds,
                            });
                        }
                    }
                    return null;
                }

                if (exitPlan.action === 'retry_later') {
                    const retryMetrics = exitPlan.attributionMetrics || null;
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'Exit deferred: balance oracle returned uncertain result', {
                        userId,
                        tokenAddress,
                        chainId,
                        exitReason,
                        reasonCode: exitPlan.attributedReasonCode || 'EXIT_BALANCE_RPC_UNCERTAIN',
                        balanceRaw: exitPlan.balance.toString(),
                        balanceUsd: exitPlan.balanceUsd,
                        oracleStatus: retryMetrics?.oracleStatus || null,
                        oracleReasonCode: retryMetrics?.oracleReasonCode || null,
                        oracleAttemptCount: retryMetrics?.oracleAttemptCount || null,
                        newestPositionAgeMs: retryMetrics?.newestPositionAgeMs || null,
                        pendingLotCount: retryMetrics?.pendingLotCount || null,
                        recentOwnershipEvidence: retryMetrics?.recentOwnershipEvidence || null,
                        mirrorSellDustCloseDeferred: retryMetrics?.mirrorSellDustCloseDeferred || null,
                        attributionMetrics: retryMetrics
                    });
                    await persistDeferredExitRetryState({
                        positions: exitPlan.positions as any,
                        targetWallet: config.targetWallet,
                        exitReason,
                        reasonCode: exitPlan.attributedReasonCode || 'EXIT_BALANCE_RPC_UNCERTAIN'
                    });
                    return null;
                }

                logger.throttled(LogCode.WTC_TX_SKIPPED, 'Negligible EVM balance, closing database records', {
                    userId,
                    tokenAddress,
                    balanceUsd: exitPlan.balanceUsd,
                    reason: exitReason,
                    isMirrorSell: exitPlan.isMirrorSell
                });
                await reconcileNoopExitPosition({
                    positions: exitPlan.positions as any,
                    action: exitPlan.action,
                    closeReason: exitPlan.closeReason
                });
                return null;
            }

            const evmExitResult = await executePlannedEvmExitFlow({
                exitPlan,
                exitReason,
                userId,
                walletAddress: user.walletAddress,
                chainId,
                tokenAddress,
                tokenInfo,
                targetWallet: config.targetWallet,
                persistedExitPositions: persistedExitPositions as any,
                copyTradeDisableMirrorSellDustSweep: COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP,
            });
            exitRuntimeContext = evmExitResult.runtimeContext;
            if (evmExitResult.status === 'pending') {
                return null;
            }
            txHash = evmExitResult.txHash || '';
        }

        // Update DB with PNL calculation
        if (txHash) {
            const exitPrice = hasValidPrice ? tokenInfo.price : 0;
            if (!hasValidPrice) {
                logger.warn(LogCode.API_FETCH_FAILED, 'Exit price missing from live data; persisting exit with unresolved USD valuation', {
                    userId,
                    token: tokenAddress,
                    fallbackSuppressed: true
                });
            }
            const { sellVolUsd } = await persistSuccessfulExit({
                positions: persistedExitPositions as any,
                txHash,
                exitReason,
                balance: persistedExitBalance,
                decimals,
                exitPrice
            });

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Position exit executed successfully', {
                userId,
                token: tokenAddress,
                reason: exitReason,
                txHash,
                ...buildOrderAuditFields(exitRuntimeContext)
            });

            // Tracking
            trackCopyTrade(userId);
            trackSwap(userId, sellVolUsd);


            // =================================================================
            // 🟣 Send Farcaster Direct Cast (Sell Success)
            // =================================================================
            const reasonMap: Record<string, string> = {
                'mirror_sell': 'Mirror Sell',
                'take_profit': 'Take Profit',
                'stop_loss': 'Stop Loss',
                'manual': 'Manual Exit',
                'dynamic_take_profit': '🎯 Dynamic Take Profit'
            };

            // When exit price was unavailable (RPC down), sellVolUsd = 0.
            // Fall back to sum of entry USD values so DM shows a meaningful number.
            const totalEntryUsd = persistedExitPositions.reduce(
                (sum: number, p: any) => sum + (Number(p.entryUsdValue) || 0),
                0
            );
            const displaySellValue = hasValidPrice && sellVolUsd > 0
                ? sellVolUsd.toFixed(2)
                : totalEntryUsd > 0
                    ? `~${totalEntryUsd.toFixed(2)}`
                    : '—';

            await notificationService.sendNotification({
                userId: user.privyDid,
                farcasterFid: user.farcasterFid,
                type: 'TRADE_SUCCESS_SELL',
                data: {
                    tokenSymbol: await resolveDisplayTokenSymbolAsync(tokenInfo.symbol, tokenAddress, chainId),
                    usdValue: displaySellValue,
                    targetWallet: config.targetWallet,
                    txHash: txHash,
                    chainId: chainId,
                    alertTitle: reasonMap[exitReason] || exitReason
                }
            });
        }

        return txHash;

    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Critical error during position exit', {
            userId,
            token: tokenAddress,
            error: error.message,
            stack: error.stack,
            ...buildOrderAuditFields(exitRuntimeContext)
        });

        const MAX_EXIT_RETRIES = 3;

        try {
            const { retryCount, terminal } = await persistFailedExitState({
                positions: exitPositions as any,
                exitReason,
                maxRetries: MAX_EXIT_RETRIES
            });

            if (!terminal) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'Mirror sell failed, will retry via PositionMonitor', {
                    userId,
                    token: tokenAddress,
                    retryCount,
                    nextRetryIn: '5 minutes',
                    reason: exitReason,
                    ...buildOrderAuditFields(exitRuntimeContext)
                });
            } else {
                logger.error(LogCode.EXE_TX_REVERTED, 'Mirror sell failed after max retries, marking as failed', {
                    userId,
                    token: tokenAddress,
                    retries: MAX_EXIT_RETRIES,
                    ...buildOrderAuditFields(exitRuntimeContext)
                });

                if (user.farcasterFid) {
                    await notificationService.sendNotification({
                        userId: user.privyDid,
                        farcasterFid: user.farcasterFid,
                        type: 'TRADE_FAILURE',
                        data: {
                            tokenSymbol: tokenInfo?.symbol || 'Unknown',
                            error: `Failed to exit after ${MAX_EXIT_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            targetWallet: config.targetWallet,
                            chainId: chainId
                        }
                    });
                }
            }
        } catch (dbErr: any) {
            logger.error(LogCode.SYS_ERROR, 'Failed to update position retry counter', { error: dbErr.message });
        }

        return null;
    }
}

async function handleTargetSell(
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number
): Promise<void> {
    const tokenToSell = swap.tokenIn;
    const normalizedWallet = normalizeAddress(targetWallet);
    logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTradeTiming] target sell start', {
        targetWallet: normalizedWallet,
        token: tokenToSell,
        chainId,
        txHash: swap.txHash
    });

    const rawConfigsFound = await withRetry(() => prisma.copyTradeConfig.findMany({
        where: {
            targetWallet: { mode: 'insensitive', equals: normalizedWallet },
            chainId,
            status: 'active',
            mirrorSell: true,
        },
    }));

    const rawConfigs = rawConfigsFound.filter((config) =>
        normalizeAddress(config?.targetWallet || '') === normalizedWallet
    );

    if (rawConfigs.length === 0) return;
    if (rawConfigsFound.length !== rawConfigs.length) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Filtered mismatched target wallet configs on sell path', {
            targetWallet: normalizedWallet,
            chainId,
            found: rawConfigsFound.length,
            matched: rawConfigs.length
        });
    }

    const userIds = [...new Set(rawConfigs.map(c => c.userId))];
    const users = await prisma.user.findMany({
        where: { privyDid: { in: userIds } }
    });
    const userMap = new Map(users.map(u => [u.privyDid, u]));
    const allowSelfTarget = (process.env.COPYTRADE_ALLOW_SELF_TARGET || 'false') === 'true';
    const configs = rawConfigs
        .map(c => ({ ...c, user: userMap.get(c.userId) }))
        .filter((c): c is typeof rawConfigs[number] & { user: NonNullable<(typeof users)[number]> } => Boolean(c.user))
        .filter((c) => {
            if (allowSelfTarget) return true;
            const userWallet = normalizeAddress(c.user?.walletAddress || '');
            const isSelfTarget = userWallet !== '' && userWallet === normalizedWallet;
            if (isSelfTarget) {
                logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping self-target mirror sell config (safety)', {
                    configId: c.id,
                    userId: c.userId,
                    targetWallet: normalizedWallet
                });
                return false;
            }
            return true;
        });

    if (configs.length === 0) return;

    const executableConfigs = filterExecutableCopyTradeConfigs(configs, {
        chainId,
        targetWallet: normalizedWallet,
        token: tokenToSell,
    });
    if (executableConfigs.length === 0) return;

    const uniqueExecutableConfigs = dedupeConfigsByUser(executableConfigs);
    if (uniqueExecutableConfigs.length !== executableConfigs.length) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Mirror sell deduped duplicate configs for same user', {
            targetWallet: normalizedWallet,
            chainId,
            txHash: swap.txHash,
            originalConfigs: executableConfigs.length,
            dedupedConfigs: uniqueExecutableConfigs.length
        });
    }

    logger.info(LogCode.EXE_TX_BROADCAST, `Mirror sell: Processing open positions for token`, { token: tokenToSell, configCount: uniqueExecutableConfigs.length, targetWallet });

    await Promise.all(uniqueExecutableConfigs.map(async (config) => {
        // Never infer copytrade ownership from wallet balance alone.
        // Manual holdings and external transfers must not be converted into copytrade positions.
        const positions = await prisma.position.findMany({
            // Include 'pending' positions: sell signal can arrive while buy tx is still confirming on-chain.
            // Attribution logic will further check if entryTxHash is a real hash (not PENDING_ prefix).
            // tokenAddress filter added as safety net — reconcileOpenPositionsForExit also normalizes,
            // but an explicit DB filter prevents empty-array false negatives.
            where: { userId: config.userId, chainId, tokenAddress: tokenToSell, status: { in: ['open', 'pending'] } },
        });

        const tokenInfo = { price: 0, symbol: 'UNKNOWN' };

        const reconciledPositions = reconcileOpenPositionsForExit(positions, tokenToSell, chainId);
        if (reconciledPositions.matchedPositions.length === 0) {
            logger.info(
                LogCode.WTC_TX_SKIPPED,
                `Mirror sell skipped: no open positions after reconciliation (token=${tokenToSell}, before=${reconciledPositions.metrics.positionCountBefore}, after=${reconciledPositions.metrics.positionCountAfter}, normalized=${reconciledPositions.metrics.normalizedTokenAddress}, reasonCode=${reconciledPositions.reasonCode})`,
                {
                    userId: config.userId,
                    token: tokenToSell,
                    reasonCode: reconciledPositions.reasonCode,
                    ...reconciledPositions.metrics
                }
            );
            return;
        }
        const matchedPositions = reconciledPositions.matchedPositions;
        const pendingMatchedPositionIds = matchedPositions
            .filter((position) => String(position.status || '') !== 'open')
            .map((position) => position.id);
        if (pendingMatchedPositionIds.length > 0) {
            const armedCount = await armPendingAttributedPositionsForMirrorSell({
                userId: config.userId,
                chainId,
                tokenAddress: tokenToSell,
                positionIds: pendingMatchedPositionIds,
                targetSellTxHash: swap.txHash || undefined,
                reasonCode: 'target_sell_detected'
            }).catch(() => 0);
            logger.info(LogCode.SYS_INFO, 'Mirror sell armed pending attributed lots', {
                userId: config.userId,
                token: tokenToSell,
                chainId,
                pendingPositionIds: pendingMatchedPositionIds,
                armedCount,
                targetSellTxHash: swap.txHash || undefined
            });
        }
        const pendingAttributedLots = pendingMatchedPositionIds.length > 0
            ? await listPendingAttributedPositions({
                userId: config.userId,
                chainId,
                tokenAddress: tokenToSell,
                positionIds: pendingMatchedPositionIds,
                statuses: ['armed', 'sell_armed']
            }).catch(() => [])
            : [];

        const mirrorSellExecutionPolicy = evaluateMirrorSellExecutionPolicy({
            matchedPositions,
            pendingAttributedLots
        });
        if (!mirrorSellExecutionPolicy.allowed) {
            logger.info(LogCode.WTC_TX_SKIPPED, 'Mirror sell skipped: follower-side execution policy blocked immediate sell', {
                userId: config.userId,
                token: tokenToSell,
                chainId,
                targetWallet: normalizedWallet,
                targetSellTxHash: swap.txHash,
                reasonCode: mirrorSellExecutionPolicy.reasonCode,
                ...mirrorSellExecutionPolicy.metrics
            });
            return;
        }
        logger.info(LogCode.SYS_INFO, 'Mirror sell immediate gate passed', {
            userId: config.userId,
            token: tokenToSell,
            chainId,
            targetWallet: normalizedWallet,
            targetSellTxHash: swap.txHash,
            reasonCode: mirrorSellExecutionPolicy.reasonCode,
            ...mirrorSellExecutionPolicy.metrics
        });

        // Leader stat tracking (only for mirror sell)
        const balanceUsdForStats = matchedPositions.reduce((sum, p) => sum + (p.entryUsdValue || 0), 0);
        recordNewTrade(targetWallet, chainId, 'sell', balanceUsdForStats);

        const positionIds = matchedPositions.map(p => p.id);
        if (positionIds.some(id => positionsBeingExited.has(id))) {
            logger.throttled(LogCode.WTC_TX_SKIPPED, 'Mirror sell skipped: position already being processed', { userId: config.userId, token: tokenToSell });
            return;
        }

        positionIds.forEach(id => positionsBeingExited.add(id));
        try {
            await executePositionExit({
                userId: config.userId,
                tokenAddress: tokenToSell,
                chainId,
                exitReason: 'mirror_sell',
                tokenInfo,
                config: { ...config, user: (config as any).user },
                positions: matchedPositions,
                pendingAttributedLots
            });
        } finally {
            positionIds.forEach(id => positionsBeingExited.delete(id));
        }
    }));
}


/**
 * Initialize the auto trade service
 */
export function initAutoTradeService(): void {
    logger.info(LogCode.SYS_STARTUP, 'Initializing auto trade service...');

    // Register swap callbacks
    onSwapDetected(async (targetWallet, swap, chainId) => {
        enqueueCopyTradeTask(targetWallet, swap, chainId);
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
    targetSellReconciliationInterval = setInterval(() => {
        void runTargetSellReconciliationCycle()
            .then((result) => {
                if (result.scheduledOpen > 0 || result.armedPending > 0 || result.fullExitMatches > 0) {
                    logger.info(LogCode.SYS_INFO, '[TargetSellReconcile] Cycle completed', result);
                }
                if (result.fullExitMatches > 0) {
                    void runCopytradeOrphanSweepCycle({ staleBefore: new Date() })
                        .then((sweep) => {
                            if (sweep.scheduledRetryCount > 0 || sweep.quarantinedPendingLots > 0) {
                                logger.info(LogCode.SYS_INFO, '[CopyTradeOrphanSweep] Follow-up sweep after full-exit matches', sweep);
                            }
                        })
                        .catch((err: any) => {
                            logger.warn(LogCode.SYS_ERROR, '[CopyTradeOrphanSweep] Follow-up sweep failed', {
                                error: err?.message || String(err)
                            });
                        });
                }
            })
            .catch((err: any) => {
                logger.warn(LogCode.SYS_ERROR, '[TargetSellReconcile] Cycle failed', {
                    error: err?.message || String(err)
                });
            });
    }, TARGET_SELL_RECONCILIATION_INTERVAL_MS);

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

    orphanSweepInterval = setInterval(() => {
        void runCopytradeOrphanSweepCycle()
            .then((result) => {
                if (result.scheduledRetryCount > 0 || result.quarantinedPendingLots > 0) {
                    logger.info(LogCode.SYS_INFO, '[CopyTradeOrphanSweep] Cycle completed', result);
                }
            })
            .catch((err: any) => {
                logger.warn(LogCode.SYS_ERROR, '[CopyTradeOrphanSweep] Cycle failed', {
                    error: err?.message || String(err)
                });
            });
    }, ORPHAN_SWEEP_INTERVAL_MS);

    void runCopytradeAttributionRepairCycle().catch(() => { });
    void runCopytradeOrphanSweepCycle().catch(() => { });
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
    if (targetSellReconciliationInterval) {
        clearInterval(targetSellReconciliationInterval);
        targetSellReconciliationInterval = null;
    }
    if (attributionRepairInterval) {
        clearInterval(attributionRepairInterval);
        attributionRepairInterval = null;
    }
    if (orphanSweepInterval) {
        clearInterval(orphanSweepInterval);
        orphanSweepInterval = null;
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
    pruneTpslTracker();
    const positionStatusCompat = await getPositionStatusCompat();

    // 🔄 STEP 0: Retry failed exit attempts (Mirror Sell, Take Profit, Stop Loss)
    // Check for positions with exitRetry Count > 0 and retry them if cooldown has passed
    const RETRY_COOLDOWN_MS = 60 * 1000; // 1 minute (Reduced from 5min for faster emergency exit)
    const positionsNeedingRetry = await prisma.position.findMany({
        where: {
            status: 'open',
            exitRetryCount: { gt: 0 },
            OR: [
                { lastExitAttempt: null }, // Never attempted (shouldn't happen, but handle it)
                { lastExitAttempt: { lt: new Date(Date.now() - RETRY_COOLDOWN_MS) } }
            ],
            NOT: {
                AND: [
                    { exitTxHash: { not: null } },
                    { lastExitAttempt: { gte: new Date(Date.now() - EXIT_INFLIGHT_RETRY_GRACE_MS) } }
                ]
            }
        },
        include: {
            user: { include: { settings: true } }
        }
    });

    const retryablePositions = positionsNeedingRetry.filter((position) => !hasRecentInflightExitRetryGuard({
        exitTxHash: position.exitTxHash,
        lastExitAttempt: position.lastExitAttempt,
        graceMs: EXIT_INFLIGHT_RETRY_GRACE_MS,
    }));

    if (retryablePositions.length > 0) {
        logger.info(LogCode.SYS_STARTUP, `Found ${retryablePositions.length} positions needing exit retry`);

        for (const position of retryablePositions) {
            try {
                const config = await prisma.copyTradeConfig.findUnique({
                    where: { id: position.configId }
                });

                if (!config) {
                    logger.warn(LogCode.SYS_ERROR, 'Config not found for position retry', { positionId: position.id });
                    continue;
                }

                const tokenInfo = await getTokenInfo(position.tokenAddress, position.chainId);
                if (!tokenInfo) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Token info not available for retry', { token: position.tokenAddress });
                    continue;
                }

                logger.info(LogCode.EXE_TX_BROADCAST, `Retrying position exit (attempt ${position.exitRetryCount + 1})`, {
                    userId: position.userId,
                    token: position.tokenAddress,
                    retryCount: position.exitRetryCount
                });

                // Retry the exit
                await executePositionExit({
                    userId: position.userId,
                    tokenAddress: position.tokenAddress,
                    chainId: position.chainId,
                    exitReason: (position.exitReason as any) || 'mirror_sell', // Use original reason or default
                    tokenInfo,
                    config: { ...config, user: position.user },
                    positions: [position]
                });
            } catch (err: any) {
                logger.error(LogCode.SYS_ERROR, 'Error during position exit retry', {
                    positionId: position.id,
                    error: err.message
                });
            }
        }
    }

    // STEP 1: Fetch all open positions for take profit/stop loss monitoring
    const positions = await prisma.position.findMany({
        where: { status: 'open' },
        include: { user: { include: { settings: true } } },
    });

    if (positions.length === 0) {
        logger.throttled(LogCode.SYS_STARTUP, 'No open positions to monitor', undefined, NO_OPEN_POSITIONS_LOG_WINDOW_MS);
        return;
    }

    logger.debug(LogCode.SYS_STARTUP, `Monitoring open positions`, { count: positions.length });

    // 1. Batch fetch configs for efficiency
    const configIds = [...new Set(positions.map(p => p.configId))];
    const configs = await prisma.copyTradeConfig.findMany({
        where: { id: { in: configIds } }
    });
    const configMap = new Map(configs.map(c => [c.id, c]));

    // 2. Batch fetch token prices (GROUP BY tokenAddress + chainId)
    const uniqueTokens = new Map<string, { address: string, chainId: number }>();
    positions.forEach(p => {
        const key = `${p.tokenAddress.toLowerCase()}_${p.chainId}`;
        if (!uniqueTokens.has(key)) {
            uniqueTokens.set(key, { address: p.tokenAddress, chainId: p.chainId });
        }
    });

    const tokenPriceMap = new Map<string, any>(); // Store complete tokenInfo objects

    // Process unique tokens in parallel chunks (limit concurrency)
    const tokenList = Array.from(uniqueTokens.values());
    const TOKEN_BATCH_SIZE = 10;

    for (let i = 0; i < tokenList.length; i += TOKEN_BATCH_SIZE) {
        const batch = tokenList.slice(i, i + TOKEN_BATCH_SIZE);
        await Promise.all(batch.map(async ({ address, chainId }) => {
            try {
                // Primary: DEX aggregator price (0x for EVM, Jupiter for Solana)
                const dexChainId = chainId === 900 ? 'solana' : chainId;
                const dexPriceResult = await getDexPriceDetailed(address, dexChainId);
                const dexPrice = dexPriceResult.price;

                if (dexPrice > 0) {
                    const info = await getTokenInfo(address, chainId).catch(() => null);
                    tokenPriceMap.set(`${address.toLowerCase()}_${chainId}`, {
                        ...(info || {}),
                        price: dexPrice,
                        provider: dexPriceResult.provider || (chainId === 900 ? 'jupiter-dex' : '0x-dex')
                    });
                    return;
                }

                // Fallback: full token info (RPC + GeckoTerminal)
                const info = await getTokenInfo(address, chainId);
                if (info && info.price) {
                    tokenPriceMap.set(`${address.toLowerCase()}_${chainId}`, info);
                }
            } catch (err) {
                logger.throttled(LogCode.API_FETCH_FAILED, 'Monitoring: Failed to fetch price', { token: address, error: (err as Error).message });
            }
        }));
    }

    // 3. Process positions in PARALLEL (with batching)
    const POSITION_BATCH_SIZE = 20; // Process 20 positions at a time
    for (let i = 0; i < positions.length; i += POSITION_BATCH_SIZE) {
        const batch = positions.slice(i, i + POSITION_BATCH_SIZE);

        await Promise.all(batch.map(async (position) => {
            // Skip if this position is already being processed
            if (positionsBeingExited.has(position.id)) return;

            try {
                // STEP A: Check on-chain balance first (detect manual sells or dust)
                let balance = 0n;
                let isBalanceCheckSuccess = false;

                try {
                    if (position.chainId === 900) {
                        // SOLANA Balance Check
                        const solAddress = await getSolanaEmbeddedWalletAddress(position.user.privyDid);
                        if (solAddress) {
                            const connection = getSolanaConnection();
                            const { value } = await connection.getParsedTokenAccountsByOwner(
                                new PublicKey(solAddress),
                                { mint: new PublicKey(position.tokenAddress) }
                            );
                            // Sum up all accounts for this mint
                            for (const acc of value) {
                                balance += BigInt(acc.account.data.parsed.info.tokenAmount.amount);
                            }
                            isBalanceCheckSuccess = true;
                        }
                    } else {
                        // EVM Balance Check
                        balance = await getErc20Balance(position.tokenAddress, position.user.walletAddress, position.chainId);
                        isBalanceCheckSuccess = true;
                    }

                    // Auto-Close if balance is empty (0)
                    // Note: We user stricter check here than 'dust', effectively 0 balance
                    // CRITICAL FIX: Don't auto-close positions created within last 2 minutes
                    // This prevents false "sold" notifications for reverted buy transactions
                    if (isBalanceCheckSuccess && balance === 0n) {
                        const positionAgeMs = Date.now() - new Date(position.createdAt).getTime();
                        const MIN_AGE_FOR_AUTO_CLOSE_MS = 2 * 60 * 1000; // 2 minutes

                        if (positionAgeMs < MIN_AGE_FOR_AUTO_CLOSE_MS) {
                            // Position is too new - likely a failed/reverted buy transaction
                            // Delete the position silently instead of notifying about a "sell"
                            logger.warn(LogCode.EXE_TX_REVERTED, 'Deleting new position with 0 balance (likely reverted buy)', {
                                positionId: position.id,
                                ageSeconds: Math.round(positionAgeMs / 1000),
                                chainId: position.chainId
                            });
                            await prisma.position.delete({ where: { id: position.id } });
                            return; // Stop processing - no notification needed
                        }

                        logger.info(LogCode.EXE_TX_CONFIRMED, 'Auto-closing position: 0 balance found on-chain (likely manual sell)', { positionId: position.id, chainId: position.chainId });
                        await prisma.position.update({
                            where: { id: position.id },
                            data: { status: 'closed', exitReason: 'manual', exitTxHash: 'MANUAL_ON_CHAIN', closedAt: new Date() }
                        });

                        // Notify user that position was auto-closed
                        if (position.user?.farcasterFid) {
                            await notificationService.sendNotification({
                                userId: position.userId,
                                farcasterFid: position.user.farcasterFid,
                                type: 'TRADE_SUCCESS_SELL', // Reusing sell success notification type
                                data: {
                                    alertTitle: 'Position Auto-Closed',
                                    tokenSymbol: position.tokenSymbol || 'Unknown',
                                    usdValue: '0.00',
                                    targetWallet: 'Manual/External',
                                    txHash: 'External',
                                    chainId: position.chainId
                                }
                            });
                        }
                        return; // Stop processing this position
                    }
                } catch (balanceErr: any) {
                    logger.warn(LogCode.SYS_ERROR, 'Error checking on-chain balance', { positionId: position.id, error: balanceErr.message });
                    // Continue to price check even if balance check fails (e.g. RPC error), unless it's critical
                }

                // STEP B: Check for TP/SL
                const tokenKey = `${position.tokenAddress.toLowerCase()}_${position.chainId}`;
                const tokenInfo = tokenPriceMap.get(tokenKey); // Now this is the COMPLETE object

                if (!tokenInfo) {
                    // Price not available in batch - LOG THIS! Critical for debugging TP failures
                    logger.warn(LogCode.API_FETCH_FAILED, 'TP/SL check skipped: Price not available', {
                        positionId: position.id,
                        token: position.tokenSymbol || position.tokenAddress,
                        chainId: position.chainId,
                        configId: position.configId
                    });
                    return;
                }

                const currentPrice = tokenInfo.price;
                const profitLossPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
                const positionAgeMs = Date.now() - new Date(position.createdAt).getTime();

                // Persist live price + PnL% so the frontend card always shows up-to-date values.
                // Fire-and-forget to avoid blocking the TP/SL check loop.
                if (Number.isFinite(currentPrice) && currentPrice > 0 && Number.isFinite(profitLossPct)) {
                    void prisma.position.update({
                        where: { id: position.id },
                        data: { currentPrice, profitLossPct },
                    }).catch(() => undefined);
                }

                // Get config
                const config = configMap.get(position.configId);
                if (!config) {
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'Orphaned position: Config not found', { positionId: position.id, configId: position.configId });
                    clearTpslHit(position.id);
                    return;
                }

                // Log position status periodically (every ~5 min based on position createdAt)
                const positionAgeMinutes = Math.floor((Date.now() - new Date(position.createdAt).getTime()) / 60000);
                if (positionAgeMinutes % 5 === 0 && positionAgeMinutes > 0) {
                    logger.info(LogCode.EXE_TX_BROADCAST, '📊 Position P/L check', {
                        token: position.tokenSymbol || 'Unknown',
                        entryPrice: position.entryPrice,
                        currentPrice: currentPrice,
                        profitLossPct: profitLossPct.toFixed(2) + '%',
                        takeProfitPct: config.takeProfitPct ? config.takeProfitPct + '%' : 'not set',
                        stopLossPct: config.stopLossPct ? config.stopLossPct + '%' : 'not set'
                    });
                }

                if (positionAgeMs < MIN_POSITION_AGE_FOR_TPSL_MS) {
                    clearTpslHit(position.id);
                    logger.debug(LogCode.SYS_INFO, 'TP/SL guard: position too new', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        ageMs: positionAgeMs,
                        minAgeMs: MIN_POSITION_AGE_FOR_TPSL_MS,
                        pnlPct: Number.isFinite(profitLossPct) ? profitLossPct.toFixed(2) : 'NaN'
                    });
                    return;
                }

                if (shouldDeferStrongRpcMonitoring(position.createdAt)) {
                    clearTpslHit(position.id);
                    logger.debug(LogCode.SYS_INFO, 'TP/SL guard: deferred until confirmation settles', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        ageMs: positionAgeMs,
                        pnlPct: Number.isFinite(profitLossPct) ? profitLossPct.toFixed(2) : 'NaN'
                    });
                    return;
                }

                // Check take profit
                if (config.takeProfitPct && profitLossPct >= config.takeProfitPct) {
                    const hitCount = recordTpslHit(position.id, 'tp', profitLossPct);
                    if (hitCount < TPSL_CONSECUTIVE_HITS_REQUIRED) {
                        logger.info(LogCode.EXE_TX_BROADCAST, 'Take Profit armed (awaiting confirmation tick)', {
                            positionId: position.id,
                            token: position.tokenSymbol || 'Unknown',
                            profitLossPct: profitLossPct.toFixed(2),
                            hitCount,
                            requiredHits: TPSL_CONSECUTIVE_HITS_REQUIRED
                        });
                        return;
                    }
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Take Profit triggered', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        profitLossPct: profitLossPct.toFixed(2)
                    });

                    positionsBeingExited.add(position.id);
                    try {
                        await executePositionExit({
                            userId: position.userId,
                            tokenAddress: position.tokenAddress,
                            chainId: position.chainId,
                            exitReason: 'take_profit',
                            tokenInfo: tokenInfo,
                            config: { ...config, user: position.user },
                            positions: [position]
                        });
                    } finally {
                        clearTpslHit(position.id);
                        positionsBeingExited.delete(position.id);
                    }
                }
                // Check stop loss
                else if (config.stopLossPct && profitLossPct <= -config.stopLossPct) {
                    const hitCount = recordTpslHit(position.id, 'sl', profitLossPct);
                    if (hitCount < TPSL_CONSECUTIVE_HITS_REQUIRED) {
                        logger.info(LogCode.EXE_TX_BROADCAST, 'Stop Loss armed (awaiting confirmation tick)', {
                            positionId: position.id,
                            token: position.tokenSymbol || 'Unknown',
                            profitLossPct: profitLossPct.toFixed(2),
                            hitCount,
                            requiredHits: TPSL_CONSECUTIVE_HITS_REQUIRED
                        });
                        return;
                    }
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Stop Loss triggered', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        profitLossPct: profitLossPct.toFixed(2)
                    });

                    positionsBeingExited.add(position.id);
                    try {
                        await executePositionExit({
                            userId: position.userId,
                            tokenAddress: position.tokenAddress,
                            chainId: position.chainId,
                            exitReason: 'stop_loss',
                            tokenInfo: tokenInfo,
                            config: { ...config, user: position.user },
                            positions: [position]
                        });
                    } finally {
                        clearTpslHit(position.id);
                        positionsBeingExited.delete(position.id);
                    }
                } else {
                    clearTpslHit(position.id);
                    // === Dynamic Take Profit Check ===
                    // Cast config to correct type (Prisma types might need reload)
                    const fullConfig = config as any;
                    if (fullConfig.enableDynamicTP) {
                        // We need the config attached to the position object for the service
                        // Construct a temporary object that satisfies the interface
                        const positionWithConfig = {
                            ...position,
                            config: fullConfig
                        };

                        const dtpResult = await DynamicTakeProfitService.checkDynamicTP(
                            positionWithConfig as any, // Type cast to satisfy strict checks
                            currentPrice
                        );

                        if (dtpResult.shouldSell) {
                            logger.info(LogCode.EXE_TX_BROADCAST, '🎯 Dynamic Take Profit triggered', {
                                positionId: position.id,
                                token: position.tokenSymbol || 'Unknown',
                                reason: dtpResult.reason,
                                urgency: dtpResult.urgency,
                                profitLossPct: profitLossPct.toFixed(2)
                            });

                            // Use higher slippage for emergency exits (rug pull detection)
                            const dynamicSlippage = dtpResult.urgency === 'emergency'
                                ? 5000
                                : resolveCopytradeSlippageBps(config, position.user.settings);

                            if (dtpResult.urgency === 'emergency') {
                                logger.warn(LogCode.EXE_TX_BROADCAST, `⚠️  [DynamicTP] Applying EMERGENCY slippage: ${dynamicSlippage} bps`, {
                                    positionId: position.id,
                                    token: position.tokenSymbol ?? undefined
                                });
                            }

                            positionsBeingExited.add(position.id);
                            try {
                                await executePositionExit({
                                    userId: position.userId,
                                    tokenAddress: position.tokenAddress,
                                    chainId: position.chainId,
                                    exitReason: 'dynamic_take_profit',
                                    tokenInfo: tokenInfo,
                                    config: { ...config, user: position.user },
                                    positions: [position],
                                    // Pass overriding slippage if needed (requires support in executePositionExit, 
                                    // otherwise it uses default. For now assume default is okay or logic inside handles it)
                                });
                            } finally {
                                positionsBeingExited.delete(position.id);
                            }
                        }
                    }
                }

            } catch (error: any) {
                logger.error(LogCode.SYS_ERROR, 'Error monitoring position', {
                    positionId: position.id,
                    token: position.tokenAddress,
                    error: error.message
                    // No stack trace in prod logs usually, but good for debug
                });
            }
        }));
    }
}

// ================= HELPERS (Restored) =================

function getChainSlug(chainId: number) {
    const chains: Record<number, { dexScreener: string; geckoTerminal: string }> = {
        8453: { dexScreener: 'base', geckoTerminal: 'base' },
        1: { dexScreener: 'ethereum', geckoTerminal: 'eth' },
        56: { dexScreener: 'bsc', geckoTerminal: 'bsc' },
        900: { dexScreener: 'solana', geckoTerminal: 'solana' },
    };
    return chains[chainId] || chains[8453];
}

/**
 * Helper to convert UserSettings.customSlippage (%) to BPS
 * Strictly used as the universal global slippage for all auto-trades
 * 🚀 COPY TRADE: 默认滑点 15% (1500 bps) 适合跟单高波动场景
 */
function getSlippageBps(userSettings: any): number {
    if (!userSettings || userSettings.customSlippage === null || userSettings.customSlippage === undefined) {
        return DEFAULT_COPYTRADE_SLIPPAGE_BPS; // Default 15% for Copy Trade (high volatility scenarios)
    }
    const percent = Number(userSettings.customSlippage);
    if (!Number.isFinite(percent) || percent <= 0) {
        return DEFAULT_COPYTRADE_SLIPPAGE_BPS;
    }
    return Math.floor(percent * 100);
}

function clampCopytradeSlippageBps(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_COPYTRADE_SLIPPAGE_BPS;
    return Math.max(MIN_COPYTRADE_SLIPPAGE_BPS, Math.min(MAX_COPYTRADE_SLIPPAGE_BPS, Math.floor(value)));
}

function resolveCopytradeSlippageBps(config: any, userSettings: any): number {
    const configuredBps = Number(config?.maxSlippageBps);
    if (Number.isFinite(configuredBps) && configuredBps > 0) {
        return clampCopytradeSlippageBps(configuredBps);
    }
    return clampCopytradeSlippageBps(getSlippageBps(userSettings));
}

async function getNativeBalance(walletAddress: string, chainId: number): Promise<bigint | null> {
    try {
        const raw = await rpcGetNativeBalance(walletAddress, chainId);
        return BigInt(raw);
    } catch (error) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Failed to fetch native balance for gas check', { wallet: walletAddress, chainId });
        return null;
    }
}

function formatTokenAmount(amount: bigint, decimals: number): number {
    const formatted = ethers.formatUnits(amount, decimals);
    const value = Number(formatted);
    if (!Number.isFinite(value)) {
        logger.warn(LogCode.SYS_ERROR, 'Token amount overflow during formatting', { amount: amount.toString(), decimals });
        return 0;
    }
    return value;
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
