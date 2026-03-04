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
import { analyzeTradeOpportunity } from './copyTradeAnalysisService.js';
import { updateJudgeOutcome } from '../repositories/judgeRepository.js';
import { createMessage, createSession } from '../repositories/chatRepository.js';
import { ChatWebSocketService } from './chatWebSocket.js';
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
import { getTokenMetadata } from './rpcService.js';
import { getDexPrice } from './dexPriceService.js';
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
import { preheatSellApprovalForToken } from './sellApprovalPreheater.js';
import { persistTargetSwapEvent } from './targetWalletTrackingService.js';
import {
    buildOrderAuditFields,
} from './order-runtime/sinks/persistence.js';
import type { OrderRuntimeContext } from './order-runtime/types.js';
import { buildEvmExitPlan } from './copytrade/exit/planner.js';
import { executeEvmExitPlan } from './copytrade/exit/executor.js';
import {
    persistFailedExitState,
    persistSuccessfulExit,
    reconcileNoopExitPosition
} from './copytrade/exit/persistence.js';
import {
    computeBuyTargetValueSnapshot,
    getMinTargetEffectiveFloorUsd,
    isBelowMinTargetValue,
    resolveEffectiveMinTargetValueUsd
} from './copytrade/guards/targetValueGuard.js';
import { emitCopyTradeBuyGuardAudit, roundGuardNumber } from './copytrade/guards/guardAudit.js';
import { resolveBuyLiquidityGuardSnapshot } from './copytrade/guards/liquidityGuard.js';
import { buildDuplicateTradeWhere, describeCooldownMode } from './copytrade/guards/cooldownPolicy.js';
import { evaluateStaticBuyGuards } from './copytrade/guards/evaluator.js';
import { emitBatchFilterAudit } from './copytrade/guards/batchFilterAudit.js';
import { resolveBuyGuardPolicy, shouldEnforceBuyGuard } from './copytrade/guards/policy.js';
import { resolveMaxEntryDeviationBps } from './copytrade/config/entryDeviationPolicy.js';
import {
    resolveCopytradeBuyPositionStatus,
    waitForCopytradeBuyConfirmation,
    type CopytradeBuyPositionStatus
} from './copytrade/buy/buyConfirmationPolicy.js';
import { cleanupPendingCopytradePosition } from './copytrade/buy/pendingLifecycle.js';
import { buildCopytradeBuyPlannedArtifact } from './copytrade/buy/plannedExecutionArtifact.js';
import { shouldAbortCopytradeBuyRetry } from './copytrade/buy/copytradeBuyRetryGuard.js';
import { evaluateBuyPriceDeviationGuard } from './copytrade/buy/buyGuardPriceDeviation.js';
import { reconcileOpenPositionsForExit } from './copytrade/exit/openPositionReconciliation.js';
import { resolveAttributedPositionExitAmount } from './copytrade/positions/positionAttribution.js';
import { finalizeCopytradeBuyPosition } from './copytrade/positions/positionPersistence.js';
import {
    armPendingAttributedPositionsForMirrorSell,
    cancelPendingAttributedPosition,
    listPendingAttributedPositions,
    upsertPendingAttributedPosition
} from './copytrade/positions/pendingAttributedPositionLedger.js';
import {
    resolveBuyConfirmationPromotionAction,
    resolvePendingMirrorSellIntent
} from './copytrade/positions/buySellRaceCoordinator.js';
import { verifyTargetFullExit } from './copytrade/reconcile/targetSellFullExitVerifier.js';
import { runTargetSellReconciliationCycle } from './copytrade/reconcile/targetSellReconciliationJob.js';
import { collectDirectSwapFeeFromSettlement } from './swap/fee/directSwapFeeCollector.js';
import { getCopytradeBuySharedWarmup } from './copytrade/buy/buySharedWarmup.js';
import {
    evaluateCopyTradeDelay,
    getCopyTradeDispatchDetectedAt,
    type CopyTradeTimingSnapshot
} from './copytrade/timing/copyTradeTimingModel.js';
import { emitCopyTradeTimingAudit } from './copytrade/timing/copyTradeTimingAudit.js';
import { executeSwapViaPort } from './swap/swapExecutionPort.js';

export { getTokenInfo } from './tokenService.js';

// Track positions currently being processed for exit to prevent duplicate attempts
const positionsBeingExited = new Set<string>();
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
const TARGET_SELL_RECONCILIATION_INTERVAL_MS = Math.max(15_000, Number(process.env.COPYTRADE_TARGET_SELL_RECONCILIATION_INTERVAL_MS || '30000'));
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
    const liquidityGuardSnapshot = await resolveBuyLiquidityGuardSnapshot(tokenToBuy, chainId, tokenInfo);
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
            const universalSlippageBps = getSlippageBps(userSettings);
            const entryDeviationPolicy = resolveMaxEntryDeviationBps(config);
            const effectiveConfig = {
                ...config,
                minMarketCapUsd: resolveEffectivePositiveThreshold(config.minMarketCapUsd, userSettings?.minMarketCapUsd),
                minLiquidityUsd: resolveEffectivePositiveThreshold(config.minLiquidityUsd, userSettings?.minLiquidityUsd),
                minTargetValueUsd: resolveEffectiveMinTargetValueUsd(config, userSettings),
                maxSlippageBps: universalSlippageBps,
                maxEntryDeviationBps: entryDeviationPolicy.maxEntryDeviationBps,
                maxEntryDeviationSource: entryDeviationPolicy.source,
                maxEntryDeviationReasonCode: entryDeviationPolicy.reasonCode
            };

            const filterResult = await evaluateStaticBuyGuards(
                tokenInfo,
                effectiveConfig,
                targetSwapValueUsd,
                resolveBuyGuardPolicy(resolveExecutionModeForConfig(config)),
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
                    targetBuyValue: targetSwapValueUsd > 0 ? targetSwapValueUsd.toFixed(2) : undefined,
                    marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                    liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
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
        const universalSlippageBps = getSlippageBps(userSettings);
        const entryDeviationPolicy = resolveMaxEntryDeviationBps(config);

        const effectiveConfig = {
            ...config,
            minMarketCapUsd: resolveEffectivePositiveThreshold(config.minMarketCapUsd, userSettings?.minMarketCapUsd),
            minLiquidityUsd: resolveEffectivePositiveThreshold(config.minLiquidityUsd, userSettings?.minLiquidityUsd),
            minTargetValueUsd: resolveEffectiveMinTargetValueUsd(config, userSettings),
            maxSlippageBps: universalSlippageBps,
            maxEntryDeviationBps: entryDeviationPolicy.maxEntryDeviationBps,
            maxEntryDeviationSource: entryDeviationPolicy.source,
            maxEntryDeviationReasonCode: entryDeviationPolicy.reasonCode
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
                    targetBuyValue: normalizedTargetSwapValueUsd > 0 ? normalizedTargetSwapValueUsd.toFixed(2) : undefined,
                    marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                    liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
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
                    targetBuyValue: effectiveTargetSwapValueUsd > 0 ? effectiveTargetSwapValueUsd.toFixed(2) : undefined,
                    marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                    liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
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
                    targetBuyValue: targetSwapValueUsd > 0 ? targetSwapValueUsd.toFixed(2) : undefined,
                    marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                    liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
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
                        targetBuyValue: targetSwapValueUsd > 0 ? targetSwapValueUsd.toFixed(2) : undefined,
                        marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                        liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
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
            // Compare Oracle price vs the IMPLIED execution price from the TARGET wallet's trade.
            // This protects against buying at the absolute top of a "scam wick" or high slippage event.
            let targetExecutionPrice = 0;
            if (chainId !== 900 && targetSwapValueUsd > 0) { // Skip for Solana (diff mechanic)
                try {
                    const estimatedOut = Number(ethers.formatUnits(swap.amountOut, tokenInfo.decimals || 18));
                    if (estimatedOut > 0) {
                        const priceDeviationGuard = evaluateBuyPriceDeviationGuard({
                            chainId,
                            oraclePrice: Number(tokenInfo.price || 0),
                            oracleProvider: tokenInfo.provider,
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
                            logger.info(LogCode.DEC_PRICE_IMPACT_HIGH, `🚨 Price Deviation too high! Oracle: $${Number(tokenInfo.price || 0).toFixed(6)}, Target Paid: $${targetExecutionPrice.toFixed(6)} (${Number(priceDeviationGuard.ratio || 0).toFixed(1)}x)`, {
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
                                    targetBuyValue: targetSwapValueUsd.toFixed(2),
                                    marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                                    liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
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
                        maxSlippageBps: effectiveConfig.maxSlippageBps,
                        pass: deviationBps <= effectiveConfig.maxEntryDeviationBps
                    };
                    if (shouldEnforceBuyGuard(guardPolicy, 'priceDeviationBps') && deviationBps > effectiveConfig.maxEntryDeviationBps) {
                        logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: entry deviation exceeds configured threshold', {
                            userId: config.userId,
                            token: tokenToBuy,
                            deviationBps: deviationBps.toFixed(0),
                            limitBps: effectiveConfig.maxEntryDeviationBps,
                            thresholdSource: effectiveConfig.maxEntryDeviationSource,
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
                                targetBuyValue: targetSwapValueUsd.toFixed(2),
                            }
                        }, 'copytrade_skip_price_deviation_bps');
                        emitGuardAudit('skip', 'price_deviation_bps_exceeded');
                        return;
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
                            targetBuyValue: targetSwapValueUsd > 0 ? targetSwapValueUsd.toFixed(2) : undefined,
                            marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                            liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
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

                // === BUY WITH RETRY LOGIC (Hardened) ===
                const baseAmount = usdAmount / nativePrice;
                const timingDetectedAt = Date.now();
                // Use universal global slippage
                const baseSlippage = effectiveConfig.maxSlippageBps;
	                const copyTradeFeeBpsOverride =
	                    isJudgeEnabledByCopyTradeConfig(config)
	                        ? env.platformFees.copyTradeAiBps
	                        : undefined;
                    const plannedArtifact = await buildCopytradeBuyPlannedArtifact({
                        chainId,
                        walletAddress: effectiveConfig.user.walletAddress,
                        tokenIn: 'ETH',
                        tokenOut: tokenToBuy,
                        swap
                    });
                    let step1Request: MainSwapRequest | undefined;

	                try {
                    // Step 1: Try with 100% amount, user's base slippage (default 15%)
                    logger.info(LogCode.EXE_TX_BROADCAST, `Buy Step 1: 100% amount, ${baseSlippage / 100}% slippage`, {
                        userId: effectiveConfig.userId,
                        eth: baseAmount.toFixed(6),
                        timingMs: Date.now() - timingDetectedAt
                    });
                    const fastSwapOverride = userSettings?.fastSwapMode === true; // allow direct on buy when enabled
                    const amountStep1 = baseAmount.toFixed(18);
                    const plannedStep1 = await plannedArtifact.getExecutionPlan(amountStep1);
                    step1Request = {
                        userId: effectiveConfig.user.privyDid,
                        walletAddress: effectiveConfig.user.walletAddress,
                        tokenIn: 'ETH',
                        tokenOut: tokenToBuy,
                        // [Logic]: Limit to 18 decimals to prevent ethers "too many decimals" error.
                        amountIn: amountStep1,
                        chainId,
                        slippageBps: baseSlippage,
                        mode: 'copytrade',
                        feeBpsOverride: copyTradeFeeBpsOverride,
                        directSwapHint: buildDirectSwapHintFromSwap(swap),
                        executionContext: {
                            ...plannedArtifact.executionContextBase,
                            executionStep: 'buy_step_1'
                        },
                        executionPlan: plannedStep1,
                        userSettings: {
                            fastSwapMode: fastSwapOverride || userSettings?.fastSwapMode,
                            copyTradeExecutionMode: executionMode
                        },
                        preWarmedNonce: getPendingNonce(chainId, effectiveConfig.user.walletAddress)
                    };
                    const result1 = await executeSwapViaPort(step1Request);
                    if (!result1.success) throw new Error(result1.error);
                    txHash = result1.txHash!;
                    attributedEntryAmountHuman = result1.amountOut || attributedEntryAmountHuman;
                    txLifecycleStatus = result1.txLifecycle?.status || result1.metadata?.txLifecycleStatus;
                    orderRuntimeContext = result1.runtimeContext;
                    swapMetadata = result1.metadata;
                    logger.info(LogCode.EXE_TX_BROADCAST, '[CopyTradeTiming] buy step 1 success', {
                        userId: effectiveConfig.userId,
                        token: tokenToBuy,
                        txHash,
                        txLifecycleStatus: txLifecycleStatus || 'unknown',
                        ...buildOrderAuditFields(orderRuntimeContext),
                        timingMs: Date.now() - timingDetectedAt
                    });
                } catch (buyErr1: any) {
                    logger.warn(LogCode.EXE_TX_REVERTED, 'Buy Step 1 failed', {
                        userId: config.userId,
                        error: compactCopyTradeError(buyErr1),
                        bugHint: inferCopyTradeBugHint(buyErr1),
                        chainId,
                        token: tokenToBuy
                    });
                    const step1RetryDecision = shouldAbortCopytradeBuyRetry({
                        chainId,
                        runtimeContext: step1Request?.runtimeContext
                    });
                    if (step1RetryDecision.shouldAbortRetry && step1RetryDecision.txHash) {
                        orderRuntimeContext = step1Request?.runtimeContext;
                        txHash = step1RetryDecision.txHash;
                        txLifecycleStatus = orderRuntimeContext?.lastLifecycle?.status || 'broadcasted_unseen';
                        logger.warn(LogCode.SYS_INFO, 'Accepted buy tx already exists after Step 1 failure; aborting further buy retries', {
                            userId: config.userId,
                            token: tokenToBuy,
                            txHash,
                            reasonCode: step1RetryDecision.reasonCode
                        });
                    } else if (turboMode) {
                        // MainSwapService already did 2 direct attempts (1st + 光速 2nd, cache hot); no 120ms + second executeSwap here
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Turbo mode: skip slow multi-step retries after step1 failure', {
                            userId: config.userId,
                            token: tokenToBuy,
                            error: compactCopyTradeError(buyErr1),
                            bugHint: inferCopyTradeBugHint(buyErr1)
                        });
                        if (pendingPositionId) {
                            await prisma.position.deleteMany({ where: { id: pendingPositionId } }).catch((e) =>
                                logger.error(LogCode.SYS_ERROR, 'Failed to cleanup pending pos on turbo step1 failure', { error: e })
                            );
                        }
                        return;
                    } else {
                        // CHECK: Conservative vs Aggressive Retry Mode
                        // If checkTokenBeforeSwap is TRUE (Conservative), we re-check price stability.
                        // If price hasn't "flown" (spiked > 20%), we continue retry. Otherwise we abort.
                        if (userSettings?.checkTokenBeforeSwap) {
                            logger.info(LogCode.EXE_QUOTE_FETCHED, 'Conservative Mode: Checking price stability before retry...', { userId: config.userId });
                            try {
                                const freshInfo = tokenInfoCache
                                    ? await getTokenInfoOnce(tokenInfoCache, tokenToBuy, chainId, { verbose: false, forceRefresh: true, rpcStrategy: 'fast' })
                                    : await getTokenInfo(tokenToBuy, chainId, { verbose: false, forceRefresh: true, rpcStrategy: 'fast' });
                                if (freshInfo && freshInfo.price > 0) {
                                    const priceChange = freshInfo.price / tokenInfo.price;
                                    if (priceChange > 2.00) { // > 100% spike (2x)
                                        logger.warn(LogCode.WTC_TX_SKIPPED, `Conservative Mode: Price spiked ${((priceChange - 1) * 100).toFixed(1)}%, aborting retry`, {
                                            userId: config.userId,
                                            oldPrice: tokenInfo.price,
                                            newPrice: freshInfo.price
                                        });
                                        return; // ABORT RETRY
                                    }
                                    // Update token info for record accuracy
                                    tokenInfo.price = freshInfo.price;
                                }
                            } catch (err) {
                                logger.warn(LogCode.API_FETCH_FAILED, 'Conservative Mode: Failed to re-check price, aborting for safety', { userId: config.userId });
                                return;
                            }
                        }

                        // AGGRESSIVE MODE (or Conservative Passed): Proceed with high slippage retries
                        logger.info(LogCode.EXE_TX_BROADCAST, 'Aggressive Mode: Initiating retry sequence...', { userId: config.userId });
                        await new Promise(resolve => setTimeout(resolve, 500)); // 🚀 Optimized: 1000ms → 500ms

                        let step2Request: MainSwapRequest | undefined;
                        try {
                            // Step 2: Try with 99% amount + 1.25x slippage
                            // NOTE: We intentionally do NOT re-run Price Deviation Check here.
                            // If Step 1 failed, we assume high volatility and prioritize execution over strict price protection.
                            const amount99 = baseAmount * 0.99;
                            const slippage2 = Math.min(Math.floor(baseSlippage * 1.25), 2000); // Max 20% or 1.25x user setting
                            logger.info(LogCode.EXE_TX_BROADCAST, `Buy Step 2: 99% amount, ${slippage2 / 100}% slippage`, { userId: effectiveConfig.userId, eth: amount99.toFixed(6) });
                            const fastSwapOverride = userSettings?.fastSwapMode === true; // allow direct on buy when enabled
                            const amountStep2 = amount99.toFixed(18);
                            const plannedStep2 = await plannedArtifact.getExecutionPlan(amountStep2);
                            step2Request = {
                                userId: effectiveConfig.user.privyDid,
                                walletAddress: effectiveConfig.user.walletAddress,
                                tokenIn: 'ETH',
                                tokenOut: tokenToBuy,
                                // [Logic]: Limit to 18 decimals to prevent ethers "too many decimals" error.
                                amountIn: amountStep2,
                                chainId,
                                slippageBps: slippage2,
                                mode: 'copytrade',
                                feeBpsOverride: copyTradeFeeBpsOverride,
                                directSwapHint: buildDirectSwapHintFromSwap(swap),
                                executionContext: {
                                    ...plannedArtifact.executionContextBase,
                                    executionStep: 'buy_step_2'
                                },
                                executionPlan: plannedStep2,
                                userSettings: {
                                    fastSwapMode: fastSwapOverride || userSettings?.fastSwapMode,
                                    copyTradeExecutionMode: executionMode
                                }
                            };
                            const result2 = await executeSwapViaPort(step2Request);
                            if (!result2.success) throw new Error(result2.error);
                            txHash = result2.txHash!;
                            attributedEntryAmountHuman = result2.amountOut || attributedEntryAmountHuman;
                            txLifecycleStatus = result2.txLifecycle?.status || result2.metadata?.txLifecycleStatus;
                            orderRuntimeContext = result2.runtimeContext;
                            swapMetadata = result2.metadata;
                        } catch (buyErr2: any) {
                            logger.warn(LogCode.EXE_TX_REVERTED, 'Buy Step 2 failed, retrying final step...', {
                                userId: config.userId,
                                error: compactCopyTradeError(buyErr2),
                                bugHint: inferCopyTradeBugHint(buyErr2),
                                chainId,
                                token: tokenToBuy
                            });
                            const step2RetryDecision = shouldAbortCopytradeBuyRetry({
                                chainId,
                                runtimeContext: step2Request?.runtimeContext
                            });
                            if (step2RetryDecision.shouldAbortRetry && step2RetryDecision.txHash) {
                                orderRuntimeContext = step2Request?.runtimeContext;
                                txHash = step2RetryDecision.txHash;
                                txLifecycleStatus = orderRuntimeContext?.lastLifecycle?.status || 'broadcasted_unseen';
                                logger.warn(LogCode.SYS_INFO, 'Accepted buy tx already exists after Step 2 failure; aborting final buy retry', {
                                    userId: config.userId,
                                    token: tokenToBuy,
                                    txHash,
                                    reasonCode: step2RetryDecision.reasonCode
                                });
                            } else {
                                await new Promise(resolve => setTimeout(resolve, 500)); // 🚀 Optimized: 1000ms → 500ms

                                try {
                                // Step 3: Final attempt with 98% amount + 1.5x slippage
                                const amount98 = baseAmount * 0.98;
                                const slippage3 = Math.min(Math.floor(baseSlippage * 1.5), 2500); // Max 25% or 1.5x user setting
                                logger.info(LogCode.EXE_TX_BROADCAST, `Buy Step 3: 98% amount, ${slippage3 / 100}% slippage`, { userId: effectiveConfig.userId, eth: amount98.toFixed(6) });
                                const fastSwapOverride = userSettings?.fastSwapMode === true; // allow direct on buy when enabled
                                const amountStep3 = amount98.toFixed(18);
                                const plannedStep3 = await plannedArtifact.getExecutionPlan(amountStep3);
                                const step3Request: MainSwapRequest = {
                                    userId: effectiveConfig.user.privyDid,
                                    walletAddress: effectiveConfig.user.walletAddress,
                                    tokenIn: 'ETH',
                                    tokenOut: tokenToBuy,
                                    // [Logic]: Limit to 18 decimals to prevent ethers "too many decimals" error.
                                    amountIn: amountStep3,
                                    chainId,
                                    slippageBps: slippage3,
                                    mode: 'copytrade',
                                    feeBpsOverride: copyTradeFeeBpsOverride,
                                    directSwapHint: buildDirectSwapHintFromSwap(swap),
                                    executionContext: {
                                        ...plannedArtifact.executionContextBase,
                                        executionStep: 'buy_step_3'
                                    },
                                    executionPlan: plannedStep3,
                                    userSettings: {
                                        fastSwapMode: fastSwapOverride || userSettings?.fastSwapMode,
                                        copyTradeExecutionMode: executionMode
                                    }
                                };
                                const result3 = await executeSwapViaPort(step3Request);
                                if (!result3.success) throw new Error(result3.error);
                                txHash = result3.txHash!;
                                attributedEntryAmountHuman = result3.amountOut || attributedEntryAmountHuman;
                                txLifecycleStatus = result3.txLifecycle?.status || result3.metadata?.txLifecycleStatus;
                                orderRuntimeContext = result3.runtimeContext;
                                swapMetadata = result3.metadata;
                                } catch (buyErr3: any) {
                                    logger.error(LogCode.EXE_TX_REVERTED, 'All buy steps failed for token', {
                                        userId: config.userId,
                                        token: tokenToBuy,
                                        error: compactCopyTradeError(buyErr3),
                                        bugHint: inferCopyTradeBugHint(buyErr3),
                                        chainId
                                    });
                                    return; // Skip to next config
                                }
                            }
                        }
                        }
                    }
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
        const nextPositionStatus: CopytradeBuyPositionStatus = (txHash && chainId === 900)
            ? 'open'
            : resolveCopytradeBuyPositionStatus(orderRuntimeContext, txLifecycleStatus
                ? { status: txLifecycleStatus as any, attempts: 1, chainId }
                : null);
        const persistedPosition = await finalizeCopytradeBuyPosition({
            pendingPositionId,
            userId: effectiveConfig.userId,
            configId: effectiveConfig.id,
            tokenAddress: tokenToBuy,
            tokenSymbol: resolveDisplayTokenSymbol(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy),
            chainId,
            entryPrice: tokenInfo.price,
            entryAmount: (usdAmount / nativePrice).toString(),
            attributedEntryAmountExact: swapMetadata?.directFeeSettlement?.amountOutBase || attributedEntryAmountHuman || undefined,
            entryTxHash: txHash,
            leaderTxHash: leaderTxHash || undefined,
            entryUsdValue: usdAmount,
            status: nextPositionStatus,
        });
        let persistedPositionId = persistedPosition.positionId;
        if (!pendingPositionId && persistedPosition.createdAt) {
            pendingPositionCreatedAt = persistedPosition.createdAt;
        }
        pendingPositionSettled = true;

        if (chainId !== 900 && persistedPositionId) {
            const expectedAmountRaw = swapMetadata?.directFeeSettlement?.amountOutBase || undefined;
            const expectedAmountDec = expectedAmountRaw ? null : attributedEntryAmountHuman;
            await upsertPendingAttributedPosition({
                positionId: persistedPositionId,
                userId: effectiveConfig.userId,
                chainId,
                tokenAddress: tokenToBuy,
                entryTxHash: txHash,
                leaderBuyTxHash: leaderTxHash || undefined,
                expectedAmountRaw,
                expectedAmountDec,
                reasonCode: expectedAmountRaw ? 'swap_amount_out_base' : 'swap_amount_out_human_fallback',
            }).catch((lotErr: any) => {
                logger.warn(LogCode.SYS_ERROR, 'Failed to upsert pending attributed position lot', {
                    userId: effectiveConfig.userId,
                    token: tokenToBuy,
                    chainId,
                    txHash,
                    positionId: persistedPositionId,
                    error: lotErr?.message || String(lotErr)
                });
            });
        }

        logger.info(LogCode.EXE_TX_CONFIRMED, 'Copy trade buy submitted and position state updated', {
            userId: config.userId,
            token: tokenToBuy,
            txHash,
            txLifecycleStatus: txLifecycleStatus || 'unknown',
            positionStatus: nextPositionStatus,
            positionId: persistedPositionId,
            positionAmountStorageReasonCode: persistedPosition.reasonCode,
            ...buildOrderAuditFields(orderRuntimeContext)
        });

        // Drive all post-buy actions from a single confirmation outcome so fee recovery,
        // position promotion, notification and preheat stay on the same state boundary.
        setTimeout(() => {
            void (async () => {
                if (!txHash) return;
                const confirmation = await waitForCopytradeBuyConfirmation({
                    chainId,
                    txHash,
                    timeoutMs: SELL_PREHEAT_CONFIRM_TIMEOUT_MS,
                    pollMs: SELL_PREHEAT_CONFIRM_POLL_MS
                }).catch(() => null);
                if (!confirmation) {
                    logger.warn(LogCode.SYS_ERROR, '[CopyTradeBuyConfirm] Confirmation wait failed', {
                        chainId,
                        token: tokenToBuy,
                        txHash
                    });
                    return;
                }
                if (confirmation.kind === 'confirmed_failed') {
                    if (persistedPositionId) {
                        await prisma.position.updateMany({
                            where: { id: persistedPositionId, status: positionStatusCompat.pendingCreateStatus as any },
                            data: { status: positionStatusCompat.failedFinalStatus as any }
                        }).catch((e) => logger.error(LogCode.SYS_ERROR, 'Failed to mark pending buy position as failed', { error: e }));
                    }
                    await cancelPendingAttributedPosition({
                        positionId: persistedPositionId,
                        reasonCode: 'buy_confirmation_failed'
                    }).catch(() => 0);
                    logger.warn(LogCode.EXE_TX_REVERTED, '[CopyTradeBuyConfirm] Buy transaction failed after submission', {
                        chainId,
                        token: tokenToBuy,
                        txHash,
                        reason: confirmation.reason || 'confirmed_failed'
                    });
                    return;
                }
                if (confirmation.kind !== 'confirmed_success') {
                    logger.info(LogCode.SYS_INFO, '[SellApprovalPreheat] Skipped: buy tx not confirmed yet', {
                        chainId,
                        token: tokenToBuy,
                        txHash
                    });
                    return;
                }

                const pendingMirrorIntent = chainId === 900 ? null : await resolvePendingMirrorSellIntent({
                    positionId: persistedPositionId,
                    targetWallet,
                    tokenAddress: tokenToBuy,
                    chainId,
                    leaderBuyTxHash: leaderTxHash || undefined,
                    positionCreatedAt: pendingPositionCreatedAt
                }).catch(() => null);

                const promotionAction = await resolveBuyConfirmationPromotionAction({
                    positionId: persistedPositionId
                }).catch(() => ({ action: 'missing' as const }));

                if (persistedPositionId) {
                    let promotionOutcome = 'POSITION_PROMOTION_SKIPPED';
                    let rowsUpdated: number | null = null;
                    if (promotionAction.action === 'promote_open') {
                        const promoteResult = await prisma.position.updateMany({
                            where: { id: persistedPositionId, status: positionStatusCompat.pendingCreateStatus as any },
                            data: { status: 'open' as any, entryTxHash: txHash }
                        }).catch((e) => {
                            logger.error(LogCode.SYS_ERROR, 'Failed to promote pending buy position to open', { error: e });
                            return null;
                        });
                        rowsUpdated = promoteResult?.count ?? null;
                        promotionOutcome = promoteResult === null
                            ? 'error'
                            : promoteResult.count > 0 ? 'PROMOTED_NOW' : 'POSITION_PROMOTION_SKIPPED';
                    } else if (promotionAction.action === 'already_open') {
                        promotionOutcome = 'ALREADY_OPEN';
                    } else if (promotionAction.action === 'closed_before_open') {
                        promotionOutcome = 'CLOSED_BEFORE_OPEN';
                    } else {
                        promotionOutcome = 'POSITION_PROMOTION_SKIPPED';
                    }
                    logger.info(LogCode.SYS_INFO, `[CopyTradePosition] Buy confirmation promotion result: ${promotionOutcome} rowsUpdated=${rowsUpdated ?? 'n/a'} positionId=${persistedPositionId}`, {
                        positionId: persistedPositionId,
                        promotionOutcome,
                        rowsUpdated,
                        txHash,
                        chainId,
                        token: tokenToBuy,
                        targetSellTxHash: pendingMirrorIntent?.targetSellTxHash || undefined,
                        targetSellReasonCode: pendingMirrorIntent?.reasonCode || undefined
                    });
                }

                if (pendingMirrorIntent?.shouldMirrorSell && persistedPositionId) {
                    const mirrorSellPosition = await prisma.position.findUnique({
                        where: { id: persistedPositionId }
                    });
                    if (mirrorSellPosition && mirrorSellPosition.status !== 'closed') {
                        logger.warn(LogCode.SYS_INFO, '[CopyTradeRace] Target already sold while buy was pending; executing mirror sell on confirmation', {
                            userId: config.userId,
                            token: tokenToBuy,
                            chainId,
                            txHash,
                            positionId: persistedPositionId,
                            targetSellTxHash: pendingMirrorIntent.targetSellTxHash,
                            reasonCode: pendingMirrorIntent.reasonCode
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
                    return;
                }

                if (swapMetadata?.directFeeSettlement?.deferred) {
                    try {
                        await collectDirectSwapFeeFromSettlement({
                            userId: effectiveConfig.user.privyDid,
                            settlement: {
                                ...swapMetadata.directFeeSettlement,
                                deferred: false,
                                reasonCode: 'confirmed_success_recovery'
                            },
                            trace: (msg: string) => `[CopyTradeBuyFeeRecovery] ${msg}`
                        });
                    } catch (feeErr: any) {
                        logger.warn(LogCode.SYS_ERROR, 'Deferred direct swap fee recovery failed', {
                            userId: config.userId,
                            token: tokenToBuy,
                            txHash,
                            error: feeErr?.message || String(feeErr)
                        });
                    }
                }

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
                await preheatSellApprovalForToken({
                    userId: effectiveConfig.user.privyDid,
                    walletAddress: effectiveConfig.user.walletAddress,
                    chainId,
                    tokenAddress: tokenToBuy,
                    tokenPriceUsd: tokenInfo.price,
                    tokenDecimals: tokenInfo.decimals
                });
            })();
        }, SELL_PREHEAT_DELAY_MS);

        // Track User Activity (Copy Trade + Swap Volume)
        trackCopyTrade(config.userId);
        trackSwap(config.userId, usdAmount);

        // =================================================================
        // 🆕 AI Analysis Logic (Post-Trade)
        // =================================================================
        const aiMode = getEnabledCopyTradeAiMode(config);
        if (aiMode) {
            logger.info(LogCode.DEC_AI_RISK_CHECK, 'AI Analysis triggered for copy trade (post-trade)', {
                userId: config.userId,
                mode: aiMode
            });

            const analysis = await analyzeTradeOpportunity(
                tokenToBuy,
                chainId,
                targetWallet,
                config.buyAmountUsd,  // Pass real user amount for proper L1-L4 risk assessment
                undefined,
                {
                    source: 'copytrade',
                    copyTradeConfigId: config.id,
                    copyTradeTxHash: txHash,
                    aiAnalysisMode: aiMode,
                }
            );
            judgeDecisionId = analysis.judgeDecisionId ?? null;

            await prisma.copyTradeAnalysis.create({
                data: {
                    configId: config.id,
                    tokenAddress: tokenToBuy,
                    tokenSymbol: resolveDisplayTokenSymbol(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy),
                    aiDecision: analysis.decision,
                    confidenceScore: analysis.confidence,
                    analysisJson: JSON.stringify(analysis),
                }
            });

            try {
                const session = await createSession(
                    config.user.privyDid,
                    `🤖 AI Trade Analysis: ${resolveDisplayTokenSymbol(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy)}`,
                    env.aiModel
                );
                const sessionId = session.id;

                const messageContent = `
✅ **Copy Trade Executed**
Target Wallet: \`${targetWallet.slice(0, 6)}...${targetWallet.slice(-4)}\`
Token: **${resolveDisplayTokenSymbol(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy)}** (\`${tokenToBuy}\`)

🧠 **AI Decision**: ${analysis.decision === 'BUY' ? '✅ BUY' : '❌ SKIP'}
**Confidence**: ${analysis.confidence}%
**Reason**: ${analysis.reason}

**Metrics**:
- 🚀 Launchpad: ${analysis.metrics.launchpad}
- 📉 5m Change: ${analysis.metrics.priceChange5m.toFixed(2)}%
- 💧 Liquidity: $${analysis.metrics.liquidity.toLocaleString()}
- 📊 Market Cap: $${analysis.metrics.marketCap.toLocaleString()}
- 🐦 Social Score: ${analysis.metrics.socialScore}/100

${analysis.rawAnalysis}
                    `.trim();

                await createMessage(sessionId, 'assistant', messageContent);

                ChatWebSocketService.getInstance().broadcastToUser(config.user.privyDid, {
                    type: 'content_block',
                    sessionId,
                    data: {
                        text: messageContent,
                        final: true
                    }
                });
            } catch (chatError: any) {
                logger.error(LogCode.API_NOTIFY_FAILED, 'Failed to send chat notification', { userId: config.userId, error: chatError.message });
            }

            if (judgeDecisionId) {
                try {
                    await updateJudgeOutcome(judgeDecisionId, {
                        actualExecuted: true,
                        actualOutcome: 'success',
                    });
                } catch (updateError: any) {
                    logger.warn(LogCode.SYS_ERROR, 'Failed to update judge outcome', { decisionId: judgeDecisionId, error: updateError.message });
                }
            }
        } else {
            logger.debug(LogCode.DEC_AI_RISK_CHECK, 'AI Analysis skipped by copytrade config', {
                userId: config.userId,
                mode: resolveCopyTradeAiMode(config),
                configId: config.id,
                txHash
            });
        }
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
async function executePositionExit(params: {
    userId: string;
    tokenAddress: string;
    chainId: number;
    exitReason: 'mirror_sell' | 'take_profit' | 'stop_loss' | 'manual' | 'dynamic_take_profit';
    tokenInfo?: any;
    config: any;
    userSettings?: any;
    positions?: Array<any>;
    pendingAttributedLots?: Array<any>;
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
    const universalSlippageBps = getSlippageBps(settings);

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
                const isMirrorSell = exitReason === 'mirror_sell';
                const treatAsEmptyOrDust = balance <= 0n || (!isMirrorSell && hasValidPrice && balanceUsd < 0.1);
                // CHECK: If we have an open position record but no balance, close it.
                // This handles the case where an external sell happened or previous sell leftover dust.
                if (treatAsEmptyOrDust) {
                    logger.throttled(LogCode.WTC_TX_SKIPPED, 'Closing database record for empty or negligible balance', {
                        userId,
                        token: tokenAddress,
                        balanceUsd,
                        reason: exitReason,
                        isMirrorSell
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

            const exitResult = await executeEvmExitPlan(exitPlan);
            exitRuntimeContext = exitResult.runtimeContext;

            if (!exitResult.success || !exitResult.txHash) {
                throw new Error(exitResult.error || 'Unified EVM exit failed');
            }

            txHash = exitResult.txHash;
            const isPartialSell = exitResult.isPartialSell;

            if (txHash) {
                const skipDustSweepForMirrorSell = exitReason === 'mirror_sell' && (COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP || exitPlan.hasExternalBalance);
                if (skipDustSweepForMirrorSell) {
                    logger.debug(LogCode.SYS_INFO, 'Mirror sell dust sweep skipped to prevent duplicate sell race', {
                        userId,
                        tokenAddress,
                        chainId,
                        hasExternalBalance: exitPlan.hasExternalBalance
                    });
                } else {
                    try {
                        const remainingBalance = await getErc20Balance(tokenAddress, user.walletAddress, chainId);
                        const dustUsd = formatTokenAmount(remainingBalance, decimals) * (tokenInfo?.price || 0);
                        if (remainingBalance > 1000n && (dustUsd >= 0.05 || isPartialSell)) {
                            const dustAmountHuman = ethers.formatUnits(remainingBalance, decimals);
                            await executeSwapViaPort({
                                userId: user.privyDid,
                                walletAddress: user.walletAddress,
                                tokenIn: tokenAddress,
                                tokenOut: 'ETH',
                                amountIn: dustAmountHuman,
                                chainId,
                                slippageBps: 2000,
                                mode: 'copytrade',
                                executionContext: {
                                    executionStep: 'sell_dust_sweep',
                                    strictReplica: false,
                                    sellRoutePolicy: 'external_primary'
                                },
                                userSettings: {
                                    fastSwapMode: false,
                                    copyTradeExecutionMode: executionMode
                                }
                            });
                        }
                    } catch (sweepErr: any) {
                        logger.debug(LogCode.EXE_TX_REVERTED, 'EVM dust sweep failed', { error: sweepErr.message });
                    }
                }
            }
        }

        // Update DB with PNL calculation
        if (txHash) {
            const fallbackExitPrice = persistedExitPositions.find((p: any) => (p.currentPrice || 0) > 0)?.currentPrice
                ?? persistedExitPositions.find((p: any) => (p.entryPrice || 0) > 0)?.entryPrice
                ?? 0;
            const exitPrice = hasValidPrice ? tokenInfo.price : fallbackExitPrice;
            if (!hasValidPrice && exitPrice > 0) {
                logger.warn(LogCode.API_FETCH_FAILED, 'Exit price missing from live data; using fallback price', {
                    userId,
                    token: tokenAddress,
                    exitPrice
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

            await notificationService.sendNotification({
                userId: user.privyDid,
                farcasterFid: user.farcasterFid,
                type: 'TRADE_SUCCESS_SELL',
                data: {
                    tokenSymbol: await resolveDisplayTokenSymbolAsync(tokenInfo.symbol, tokenAddress, chainId),
                    usdValue: sellVolUsd.toFixed(2),
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

    const strictFullExit = await verifyTargetFullExit({
        targetWallet,
        chainId,
        tokenAddress: tokenToSell,
    });
    if (!strictFullExit.isFullExit) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Mirror sell skipped: target sell is not a strict full-balance exit', {
            targetWallet: normalizedWallet,
            chainId,
            token: tokenToSell,
            targetSellTxHash: swap.txHash,
            reasonCode: strictFullExit.reasonCode,
            remainingBalanceRaw: strictFullExit.remainingBalanceRaw,
            dustThresholdRaw: strictFullExit.dustThresholdRaw,
        });
        return;
    }

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

    // PERFECT EVM-LIKE SHARING: Fetch token info once instead of N times concurrently, preventing RPC explosion
    const sharedTokenInfoPromise = getTokenInfo(tokenToSell, chainId, { priority: 'high', rpcStrategy: 'fast', fastMode: true }).catch(() => null);

    await Promise.all(uniqueExecutableConfigs.map(async (config) => {
        // Never infer copytrade ownership from wallet balance alone.
        // Manual holdings and external transfers must not be converted into copytrade positions.
        const [positions, tokenInfo] = await Promise.all([
            prisma.position.findMany({
                // Include 'pending' positions: sell signal can arrive while buy tx is still confirming on-chain.
                // Attribution logic will further check if entryTxHash is a real hash (not PENDING_ prefix).
                // tokenAddress filter added as safety net — reconcileOpenPositionsForExit also normalizes,
                // but an explicit DB filter prevents empty-array false negatives.
                where: { userId: config.userId, chainId, tokenAddress: tokenToSell, status: { in: ['open', 'pending'] } },
            }),
            sharedTokenInfoPromise
        ]);

        if (!tokenInfo) {
            // tokenInfo is used for price display only — NOT a prerequisite for executing the sell.
            // Log a warning and continue; the sell will proceed with price = 0 (position closed, no USD shown).
            logger.warn(LogCode.API_FETCH_FAILED, 'Mirror sell: Token info unavailable (RPC/API down), proceeding with price=0', { token: tokenToSell, userId: config.userId });
        }

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
            })
            .catch((err: any) => {
                logger.warn(LogCode.SYS_ERROR, '[TargetSellReconcile] Cycle failed', {
                    error: err?.message || String(err)
                });
            });
    }, TARGET_SELL_RECONCILIATION_INTERVAL_MS);
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
            ]
        },
        include: {
            user: { include: { settings: true } }
        }
    });

    if (positionsNeedingRetry.length > 0) {
        logger.info(LogCode.SYS_STARTUP, `Found ${positionsNeedingRetry.length} positions needing exit retry`);

        for (const position of positionsNeedingRetry) {
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
                const dexPrice = await getDexPrice(address, dexChainId);

                if (dexPrice > 0) {
                    const info = await getTokenInfo(address, chainId).catch(() => null);
                    tokenPriceMap.set(`${address.toLowerCase()}_${chainId}`, {
                        ...(info || {}),
                        price: dexPrice,
                        provider: chainId === 900 ? 'jupiter-dex' : '0x-dex'
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
                            const dynamicSlippage = dtpResult.urgency === 'emergency' ? 5000 : getSlippageBps(position.user.settings);

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
        return 1500; // Default 15% for Copy Trade (high volatility scenarios)
    }
    return Math.floor(userSettings.customSlippage * 100);
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
