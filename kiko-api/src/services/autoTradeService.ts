/**
 * Auto Trade Service
 * Executes copy trades when target wallet swaps are detected
 */

import { ethers } from 'ethers';
import prisma, { withRetry } from '../db/prisma.js';
import { DecodedSwap } from './txDecoder.js';
import { onSwapDetected } from './watcherService.js';
import { enqueueCopyTradeTask } from './copyTradeQueue.js';
import { MainSwapService, type DirectSwapHint } from './MainSwapService.js';
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
import { getNativeBalance as rpcGetNativeBalance, getErc20Balance, getErc20Decimals, getTransactionReceipt } from './rpcManager.js';
import { startCopyTradePendingWatcher, stopCopyTradePendingWatcher } from './copyTradePendingService.js';
import { assertConfigExecutable } from './copyTradeConfigSignatureService.js';
import { determineCopyTradeDirection } from './copyTradeDirection.js';
import {
    resolveExecutionModeFromConfig,
    type CopyTradeExecutionMode
} from './copyTradeExecutionMode.js';
import { preheatSellApprovalForToken } from './sellApprovalPreheater.js';
import { isP2PlannerEnabled, getP2AllowedChains } from './copytrade/planner/featureFlags.js';
import { buildExecutionPlan } from './copytrade/planner/pathPlanner.js';
import type { PlannerInput, ExecutionSide } from './copytrade/planner/types.js';
import { persistTargetSwapEvent } from './targetWalletTrackingService.js';
import { buildSwapExecutionContext } from './copytrade/context/contextBuilder.js';
import { getContextByTxHash, putContext } from './copytrade/context/contextStore.js';
import type { ContextStoreHit } from './copytrade/context/types.js';

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
    broadcastedUnseenStatus: string;
    failedFinalStatus: string;
};

let positionStatusCompatCache: { value: PositionStatusCompat; ts: number } | null = null;
const POSITION_STATUS_COMPAT_TTL_MS = 30_000;

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
        const hasPendingBroadcast = labels.has('pending_broadcast');
        const hasBroadcastedUnseen = labels.has('broadcasted_unseen');
        const hasFailedFinal = labels.has('failed_final');

        const lockStatuses = ['pending'];
        if (hasPendingBroadcast) lockStatuses.push('pending_broadcast');
        if (hasBroadcastedUnseen) lockStatuses.push('broadcasted_unseen');

        const compat: PositionStatusCompat = {
            lockStatuses,
            activeOrLockedStatuses: ['open', ...lockStatuses],
            pendingCreateStatus: hasPendingBroadcast ? 'pending_broadcast' : 'pending',
            broadcastedUnseenStatus: hasBroadcastedUnseen ? 'broadcasted_unseen' : 'pending',
            failedFinalStatus: hasFailedFinal ? 'failed_final' : 'failed'
        };
        positionStatusCompatCache = { value: compat, ts: Date.now() };
        return compat;
    } catch {
        const fallback: PositionStatusCompat = {
            lockStatuses: ['pending'],
            activeOrLockedStatuses: ['open', 'pending'],
            pendingCreateStatus: 'pending',
            broadcastedUnseenStatus: 'pending',
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
const COPYTRADE_MAX_DELAY_MS = Number(process.env.COPYTRADE_MAX_DELAY_MS || '5000');
const COPYTRADE_TURBO_MAX_DELAY_MS = Number(process.env.COPYTRADE_TURBO_MAX_DELAY_MS || '2500');

/**
 * Pure delay check for copy trade (used in processBuyWithInfo; exported for tests).
 * @param detectedAt - Timestamp when swap was detected (webhook enqueue or pending prefetch)
 * @param turboMode - If true use COPYTRADE_TURBO_MAX_DELAY_MS (2.5s), else COPYTRADE_MAX_DELAY_MS (5s)
 * @param nowMs - Current time (default Date.now(); inject for tests)
 */
export function isCopyTradeDelayExceeded(
    detectedAt: number | undefined,
    turboMode: boolean,
    nowMs: number = Date.now()
): { skip: boolean; delayMs: number; maxDelayMs: number } {
    const maxDelayMs = turboMode ? COPYTRADE_TURBO_MAX_DELAY_MS : COPYTRADE_MAX_DELAY_MS;
    const delayMs = detectedAt ? Math.max(0, nowMs - detectedAt) : 0;
    const skip = !!(detectedAt && delayMs > maxDelayMs);
    return { skip, delayMs, maxDelayMs };
}
const COPYTRADE_PRICE_CHECK_TIMEOUT_MS = Number(process.env.COPYTRADE_PRICE_CHECK_TIMEOUT_MS || '1200');
const COPYTRADE_LOG_ERROR_SLICE = Math.max(80, Number(process.env.COPYTRADE_LOG_ERROR_SLICE || '240'));
const NO_OPEN_POSITIONS_LOG_WINDOW_MS = Number(process.env.NO_OPEN_POSITIONS_LOG_WINDOW_MS || '180000');
const COPYTRADE_ENABLE_DETECTION_PREWARM = (process.env.COPYTRADE_ENABLE_DETECTION_PREWARM || 'false') === 'true';
const COPYTRADE_SKIP_ON_DIRECTION_CONFLICT = (process.env.COPYTRADE_SKIP_ON_DIRECTION_CONFLICT || 'true') === 'true';
const COPYTRADE_ENABLE_TOKEN_TO_TOKEN_PARALLEL = (process.env.COPYTRADE_ENABLE_TOKEN_TO_TOKEN_PARALLEL || 'false') === 'true';
const ALLOWED_LAUNCHPAD_PROVIDERS = new Set(['zora', 'fourmeme']);
const COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP = (process.env.COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP || 'true') === 'true';
const CHAIN_LAUNCHPAD_PROVIDERS: Record<number, Set<string>> = {
    8453: new Set(['zora']),
    56: new Set(['fourmeme'])
};

// State for graceful shutdown and cleanup
let isServiceShuttingDown = false;
let zombieCleanupInterval: NodeJS.Timeout | null = null;

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
        routeHopCount,
        routeHops: swap?.routeHops,
        canUseResolvedPoolFastPath: swap?.canUseResolvedPoolFastPath,
        resolvedPoolHint: swap?.resolvedPoolHint,
        preferredStrategy,
        preferredDex,
        bypassReferencePrice: true
    };
}

function inferExecutionSideFromTokens(tokenIn: string, tokenOut: string, chainId: number): ExecutionSide {
    const chain = getChainConfig(chainId);
    const stableSet = new Set((chain.stablecoins || []).map((x) => String(x || '').toLowerCase()));
    const wrappedNative = String(chain.wrappedNativeAddress || '').toLowerCase();
    const isCashLike = (value: string): boolean => {
        const v = String(value || '').toLowerCase();
        return v === 'eth'
            || v === 'bnb'
            || v === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
            || v === wrappedNative
            || stableSet.has(v);
    };
    return isCashLike(tokenIn) && !isCashLike(tokenOut) ? 'buy' : 'sell';
}

function isSourceReplayEligibleInput(sourceTxInput?: string): boolean {
    const selector = String(sourceTxInput || '').slice(0, 10).toLowerCase();
    return selector === '0x3593564c' || selector === '0x24856bc3';
}

async function buildPlannedExecutionContext(args: {
    chainId: number;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    swap?: DecodedSwap;
}) {
    const sourceTxHash = String(args.swap?.txHash || '').toLowerCase();
    let contextStoreHit: ContextStoreHit = { context: null, source: 'miss' };
    if (sourceTxHash) {
        contextStoreHit = await getContextByTxHash(args.chainId, sourceTxHash).catch(() => ({ context: null, source: 'miss' }));
    }
    const inlineContext = args.swap?.txHash
        ? buildSwapExecutionContext({
            tx: {
                hash: String(args.swap.txHash),
                to: String(args.swap.router || ''),
                input: String(args.swap.sourceTxInput || ''),
                value: String(args.swap.sourceTxValue || '0')
            },
            decodedSwap: args.swap,
            chainId: args.chainId,
            targetWallet: args.walletAddress
        })
        : null;
    const context = contextStoreHit.context || inlineContext;
    if (inlineContext && !contextStoreHit.context) {
        await putContext(inlineContext).catch(() => { });
    }

    const contextHitSource: 'redis' | 'db' | 'inline' | 'miss' = contextStoreHit.context
        ? contextStoreHit.source
        : (inlineContext ? 'inline' : 'miss');

    const executionContext = {
        sourceTxHash: context?.sourceTxHash || args.swap?.txHash,
        sourceRouter: context?.sourceRouter || args.swap?.router,
        sourceTxInput: context?.sourceTxInput || args.swap?.sourceTxInput,
        sourceTxValue: context?.sourceTxValue || args.swap?.sourceTxValue,
        contextId: contextStoreHit.contextId,
        contextSnapshot: context || undefined,
        contextHitSource,
        strictReplica: false
    };
    const sourceInput = context?.sourceTxInput || args.swap?.sourceTxInput;
    const sourceRouter = context?.sourceRouter || args.swap?.router;
    const hasSourceReplayContext = !!sourceInput
        && !!sourceRouter
        && isSourceReplayEligibleInput(sourceInput);
    if (!isP2PlannerEnabled() && !hasSourceReplayContext) {
        return { executionContext, executionPlan: undefined };
    }
    if (!getP2AllowedChains().includes(args.chainId) && !hasSourceReplayContext) {
        return { executionContext, executionPlan: undefined };
    }
    try {
        const plannerInput: PlannerInput = {
            chainId: args.chainId,
            side: inferExecutionSideFromTokens(args.tokenIn, args.tokenOut, args.chainId),
            tokenIn: args.tokenIn,
            tokenOut: args.tokenOut,
            amountIn: args.amountIn,
            walletAddress: args.walletAddress,
            sourceTxHash: context?.sourceTxHash || args.swap?.txHash,
            sourceRouter: sourceRouter,
            sourceSelector: context?.sourceSelector,
            sourceTxInput: sourceInput,
            sourceTxValue: context?.sourceTxValue || args.swap?.sourceTxValue
        };
        const executionPlan = await buildExecutionPlan(plannerInput);
        return { executionContext, executionPlan };
    } catch (error: any) {
        logger.warn(LogCode.SYS_ERROR, '[P2] Planner build failed in autoTradeService', {
            error: error?.message || String(error),
            chainId: args.chainId,
            tokenIn: args.tokenIn,
            tokenOut: args.tokenOut
        });
        return { executionContext, executionPlan: undefined };
    }
}

function getMinTargetEffectiveFloorUsd(minTargetValueUsd: number): number {
    const min = Number(minTargetValueUsd || 0);
    if (!Number.isFinite(min) || min <= 0) return 0;
    // No tolerance — floor is exactly the configured minimum.
    return min;
}

function isBelowMinTargetValue(targetSwapValueUsd: number, minTargetValueUsd: number): boolean {
    const target = Number(targetSwapValueUsd || 0);
    const effectiveFloor = getMinTargetEffectiveFloorUsd(minTargetValueUsd);
    return target < effectiveFloor;
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
    context?: { detectedAt?: number }
): Promise<void> {
    const detectedAt = context?.detectedAt || Date.now();
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
    context?: { detectedAt?: number }
): Promise<void> {
    // Find all configs watching this wallet
    // NOTE: Solana addresses are case-sensitive (Base58), only lowercase EVM addresses
    const normalizedWallet = normalizeAddress(targetWallet);

    // I will fix this logic now too: `const tokenToBuy = swap.tokenOut`.
    const tokenToBuy = swap.tokenOut;
    const detectedAt = context?.detectedAt ?? Date.now();
    logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTradeTiming] target buy start', {
        targetWallet,
        token: tokenToBuy,
        chainId,
        txHash: swap.txHash,
        detectedAt,
        elapsedMs: Date.now() - detectedAt
    });

    logger.debug(LogCode.EXE_QUOTE_FETCHED, `Fast path execution started for ${tokenToBuy}`, { targetWallet, token: tokenToBuy });

    // 1. FIRST: Check for active configs. If none, exit immediately (No API calls, No Logs)
    const rawConfigsFound = await withRetry(() => prisma.copyTradeConfig.findMany({
        where: {
            targetWallet: { mode: 'insensitive', equals: normalizedWallet },
            chainId,
            status: 'active',
        },
    })) as any[];

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
    const users = await prisma.user.findMany({
        where: { privyDid: { in: userIds } }
    });
    const userMap = new Map(users.map(u => [u.privyDid, u]));
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

    logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTrade] Executable buy configs ready', {
        chainId,
        targetWallet: normalizedWallet,
        token: tokenToBuy,
        configCount: executableConfigs.length,
        configIds: executableConfigs.slice(0, 8).map((c: any) => c.id)
    });

    const tokenInfoCache = new Map<string, Promise<any>>();

    const launchpadPromise = (chainId === 8453 || chainId === 56)
        ? detectLaunchpadToken(tokenToBuy, chainId).catch(() => null)
        : Promise.resolve(null);

    // Turbo Mode: only if ALL configs explicitly choose turbo.
    const skipTokenInfo = executableConfigs.every(c => c.executionMode === 'turbo');
    if (skipTokenInfo) {
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

            logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTrade] Token info disabled - using RPC metadata fallback', {
                token: tokenToBuy,
                chainId
            });

            await processBuyWithInfo(targetWallet, tokenToBuy, swap, chainId, executableConfigs, fallbackInfo, true, launchpadPromise, tokenInfoCache, detectedAt);
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
            await processBuyWithInfo(targetWallet, tokenToBuy, swap, chainId, executableConfigs, fallbackInfo, true, launchpadPromise, tokenInfoCache, detectedAt);
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

                await processBuyWithInfo(targetWallet, tokenToBuy, swap, chainId, executableConfigs, fallbackInfo, true, launchpadPromise, tokenInfoCache, detectedAt);
                return;
            } catch (metaErr: any) {
                logger.warn(LogCode.API_FETCH_FAILED, 'Metadata fallback failed', { token: tokenToBuy, error: metaErr.message });
            }
        }

        logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: No valid token information or price found', { targetWallet, token: tokenToBuy });
        return;
    }

    await processBuyWithInfo(targetWallet, tokenToBuy, swap, chainId, executableConfigs, tokenInfo, false, launchpadPromise, tokenInfoCache, detectedAt);
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
    detectedAt?: number
) {
    const PROFILE = process.env.COPYTRADE_PROFILE ? process.env.COPYTRADE_PROFILE === 'true' : true;
    const tStart = Date.now();
    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Processing configurations for buy', {
        count: configs.length,
        price: tokenInfo.price,
        fallback: isFallbackMode
    });

    let judgeDecisionId: string | null = null;


    // Calculate target swap value (buy volume)
    // Actually, usually we value the trade based on the STABLE/ETH amount (Input).
    // If user spent 1 ETH ($2500), that's the trade value.
    // Logic: if tokenIn is cash, use it. Otherwise use tokenOut.

    const chainConfig = getChainConfig(chainId);
    const ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69';
    const CASH_TOKENS = [
        '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        ZORA_TOKEN,
        chainConfig.wrappedNativeAddress,
        ...chainConfig.stablecoins,
        SOLANA_CONFIG.TOKENS.SOL,
        SOLANA_CONFIG.TOKENS.USDC,
        SOLANA_CONFIG.TOKENS.USDT
    ].map(s => normalizeAddress(s));

    const isTokenInCash = CASH_TOKENS.includes(normalizeAddress(swap.tokenIn));
    let targetSwapValueUsd = 0;

    if (isTokenInCash) {
        // Use tokenIn for value calculation
        const isStableIn = chainConfig.stablecoins.map(s => normalizeAddress(s)).includes(normalizeAddress(swap.tokenIn));
        const isZoraIn = normalizeAddress(swap.tokenIn) === normalizeAddress(ZORA_TOKEN);
        const amountInBN = BigInt(swap.amountIn);

        if (isStableIn) {
            // USDC/USDT - fetch dynamic info to get true decimals
            const stableInfo = tokenInfoCache
                ? await getTokenInfoOnce(tokenInfoCache, swap.tokenIn, chainId, { rpcStrategy: 'fast', fastMode: true })
                : await getTokenInfo(swap.tokenIn, chainId, { rpcStrategy: 'fast', fastMode: true });
            const decimalsIn = stableInfo?.decimals || 6; // Fallback to 6 if fetch fails (safe for USDC/USDT)
            targetSwapValueUsd = formatTokenAmount(amountInBN, decimalsIn);
        } else if (isZoraIn) {
            // ZORA Token price - fetch dynamically
            const zoraInfo = tokenInfoCache
                ? await getTokenInfoOnce(tokenInfoCache, ZORA_TOKEN, chainId, { rpcStrategy: 'fast', fastMode: true })
                : await getTokenInfo(ZORA_TOKEN, chainId, { rpcStrategy: 'fast', fastMode: true });
            if (!zoraInfo || zoraInfo.price <= 0) {
                logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch ZORA price, cannot calculate trade value', { token: ZORA_TOKEN });
                targetSwapValueUsd = 0; // Cannot proceed without price
            } else {
                targetSwapValueUsd = formatTokenAmount(amountInBN, 18) * zoraInfo.price;
            }
        } else {
            // ETH / WETH - use DataCacheHub native cache to keep this in low-latency path.
            const nativePrice = await cacheHub.getNativePrice(chainId, async () => getNativeTokenPriceUsd(chainId));
            if (!nativePrice || nativePrice <= 0) {
                logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch native token price, cannot calculate trade value', {
                    chainId
                });
                targetSwapValueUsd = 0; // Cannot proceed without price
            } else {
                targetSwapValueUsd = formatTokenAmount(amountInBN, 18) * nativePrice;
            }
        }
        logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Calculated value from token input', { valueUsd: targetSwapValueUsd, token: swap.tokenIn });
    } else {
        // Fallback to tokenOut
        const amountOutBN = BigInt(swap.amountOut);
        const splitDecimals = tokenInfo.decimals || 18;
        const formattedAmountOut = formatTokenAmount(amountOutBN, splitDecimals);
        targetSwapValueUsd = formattedAmountOut * tokenInfo.price;
        logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Calculated value from token output', { valueUsd: targetSwapValueUsd, token: swap.tokenOut });
    }
    const hintedCashSpentUsd = Number(swap?.cashLegHint?.cashSpentUsd || 0);
    if (isTokenInCash && Number.isFinite(hintedCashSpentUsd) && hintedCashSpentUsd > 0) {
        const previous = targetSwapValueUsd;
        targetSwapValueUsd = Math.max(targetSwapValueUsd, hintedCashSpentUsd);
        if (targetSwapValueUsd > previous) {
            logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Using higher activity cash hint for target swap value', {
                txHash: swap.txHash,
                previousValueUsd: Number.isFinite(previous) ? Number(previous.toFixed(4)) : previous,
                hintedCashSpentUsd: Number(hintedCashSpentUsd.toFixed(4)),
                selectedValueUsd: Number(targetSwapValueUsd.toFixed(4))
            });
        }
    }
    if (!Number.isFinite(targetSwapValueUsd) || targetSwapValueUsd < 0) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Target swap value is invalid; forcing value to 0 for safety', {
            txHash: swap.txHash,
            targetWallet,
            chainId,
            rawValue: targetSwapValueUsd
        });
        targetSwapValueUsd = 0;
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
            }
        } catch (err) {
            logger.warn(LogCode.DATA_CORRUPTION, 'Failed to derive implied price', { error: err });
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
        const quickNativePrice = await getNativeTokenPriceUsd(chainId).catch(() => 0);
        const turboUserIds = [...new Set(turboConfigs.map(c => c.userId).filter(Boolean))];
        const turboUserSettingsMap = await cacheHub.warmupUserSettings(
            turboUserIds,
            async (userId) => prisma.userSettings.findUnique({ where: { userId } })
        );
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
                    isFallbackMode,
                    1.0,
                    quickNativePrice,
                    launchpadPromise,
                    tokenInfoCache,
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
    const [userSettingsMap, sharedNativePrice] = await Promise.all([
        // 1. 批量预热用户设置缓存
        cacheHub.warmupUserSettings(
            workingConfigs.map(c => c.userId).filter(Boolean),
            async (userId) => prisma.userSettings.findUnique({ where: { userId } })
        ),
        // 2. 获取 Native 价格（通过缓存中心）
        cacheHub.getNativePrice(chainId, async () => {
            return getNativeTokenPriceUsd(chainId);
        })
    ]);
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
            const effectiveConfig = {
                ...config,
                minMarketCapUsd: config.minMarketCapUsd ?? userSettings?.minMarketCapUsd,
                minLiquidityUsd: config.minLiquidityUsd ?? userSettings?.minLiquidityUsd,
                minTargetValueUsd: config.minTargetValueUsd ?? userSettings?.minTargetValueUsd,
                maxSlippageBps: universalSlippageBps
            };

            const filterResult = await passesFilters(tokenInfo, effectiveConfig, targetSwapValueUsd);
            return { config, filterResult, effectiveConfig, userSettings };
        })
    );
    const filterMs = Date.now() - filterStart;

    const eligibleConfigs: any[] = [];
    const skippedUsers: any[] = [];

    for (const { config, filterResult } of filterResults) {
        if (filterResult.passed) {
            eligibleConfigs.push(config);
        } else {
            skippedUsers.push({ config, reason: filterResult.reason });
        }
    }

    logger.info(LogCode.EXE_QUOTE_FETCHED, '🔍 Batch filter complete (PARALLEL)', {
        total: configs.length,
        totalTurboBypassed: turboConfigs.length,
        eligible: eligibleConfigs.length,
        skipped: skippedUsers.length
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
        logger.info(LogCode.WTC_TX_SKIPPED, 'No eligible users after batch filter', { targetWallet, token: tokenToBuy });
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
                    isFallbackMode,
                    scalingFactor, // Pass scaling factor to reduce individual amounts
                    sharedNativePrice, // ⚡ Pass shared native price to avoid repeated queries
                    launchpadPromise,
                    tokenInfoCache,
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
    isFallbackMode: boolean,
    scalingFactor: number = 1.0,
    sharedNativePrice: number = 0,
    launchpadPromise?: Promise<any>,
    tokenInfoCache?: Map<string, Promise<any>>,
    detectedAt?: number
): Promise<void> {
    // Lock per userId:token so different tokens can execute concurrently for the same user.
    // Same-token deduplication is handled separately by isTokenLockedForUser + DB transaction lock.
    return withTradeLock(`${config.userId}:${tokenToBuy.toLowerCase()}`, async () => {
        let judgeDecisionId: string | null = null;
        const executionMode = resolveExecutionModeForConfig(config);
        const turboMode = executionMode === 'turbo';
        const positionStatusCompat = await getPositionStatusCompat();

        try {
            const inboundDelayMs = detectedAt ? Math.max(0, Date.now() - detectedAt) : null;
            if (inboundDelayMs !== null && inboundDelayMs > 800) {
                logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTradeTiming] user buy dispatch delay', {
                    userId: config.userId,
                    token: tokenToBuy,
                    chainId,
                    inboundDelayMs,
                    executionMode
                });
            }
            const delayCheck = isCopyTradeDelayExceeded(detectedAt, turboMode);
            if (delayCheck.skip) {
                logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: copytrade delay exceeded', {
                    userId: config.userId,
                    token: tokenToBuy,
                    delayMs: delayCheck.delayMs,
                    maxDelayMs: delayCheck.maxDelayMs,
                    turboMode,
                    hint: 'delay is from detectedAt (webhook enqueue or pending prefetch) to this check'
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

        const effectiveConfig = {
            ...config,
            minMarketCapUsd: config.minMarketCapUsd ?? userSettings?.minMarketCapUsd,
            minLiquidityUsd: config.minLiquidityUsd ?? userSettings?.minLiquidityUsd,
            minTargetValueUsd: config.minTargetValueUsd ?? userSettings?.minTargetValueUsd,
            maxSlippageBps: universalSlippageBps
        };

        // Fast check for per-user target value guard (must apply in all modes, including turbo).
        const minTargetValueUsd = Number(effectiveConfig.minTargetValueUsd || 0);
        const normalizedTargetSwapValueUsd = Number.isFinite(targetSwapValueUsd) ? targetSwapValueUsd : 0;
        if (minTargetValueUsd > 0 && isBelowMinTargetValue(normalizedTargetSwapValueUsd, minTargetValueUsd)) {
            logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: target value below user minimum', {
                userId: config.userId,
                token: tokenToBuy,
                txHash: swap.txHash,
                targetSwapValueUsd: Number(normalizedTargetSwapValueUsd.toFixed(2)),
                minTargetValueUsd
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
                    skipReason: `Target buy value $${normalizedTargetSwapValueUsd.toFixed(2)} < min $${minTargetValueUsd.toFixed(2)}`,
                    targetBuyValue: normalizedTargetSwapValueUsd > 0 ? normalizedTargetSwapValueUsd.toFixed(2) : undefined,
                    marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                    liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
                }
            }, 'copytrade_skip_min_target_value');

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

            // 🛡️ PRICE DEVIATION CHECK (Anti-Spike)
            // MUST run regardless of cooldownMinutes — turbo configs set cooldown=0 but still need this protection.
            // Compare Oracle price vs the IMPLIED execution price from the TARGET wallet's trade.
            // This protects against buying at the absolute top of a "scam wick" or high slippage event.
            let targetExecutionPrice = 0;
            if (tokenInfo.price > 0 && chainId !== 900 && targetSwapValueUsd > 0) { // Skip for Solana (diff mechanic)
                try {
                    const estimatedOut = Number(ethers.formatUnits(swap.amountOut, tokenInfo.decimals || 18));
                    if (estimatedOut > 0) {
                        // Calculate IMPLIED execution price from TARGET WALLET's trade
                        // This is how much the target ACTUALLY paid per token
                        targetExecutionPrice = targetSwapValueUsd / estimatedOut;
                        const priceDeviation = targetExecutionPrice / tokenInfo.price;

                        if (priceDeviation > 3.0) { // Allow up to 3x (200% increase) but no more
                            logger.warn(LogCode.DEC_PRICE_IMPACT_HIGH, `🚨 Price Deviation too high! Oracle: $${tokenInfo.price.toFixed(6)}, Target Paid: $${targetExecutionPrice.toFixed(6)} (${priceDeviation.toFixed(1)}x)`, {
                                userId: config.userId,
                                token: tokenToBuy,
                                targetSwapValueUsd,
                                estimatedOut
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
                                    skipReason: `Price deviation too high (${priceDeviation.toFixed(1)}x). Oracle: $${tokenInfo.price.toFixed(6)}, Target paid: $${targetExecutionPrice.toFixed(6)}`,
                                    targetBuyValue: targetSwapValueUsd.toFixed(2),
                                    marketCap: tokenInfo.marketCap ? tokenInfo.marketCap.toFixed(0) : undefined,
                                    liquidity: tokenInfo.liquidity ? tokenInfo.liquidity.toFixed(0) : undefined,
                                    priceImpact: `${priceDeviation.toFixed(1)}x deviation`
                                }
                            }, 'copytrade_skip_price_deviation');

                            return; // SKIP TRADE
                        }
                    }
                } catch (e) { }
            }

            if (targetExecutionPrice > 0) {
                const dexChainId = chainId === 900 ? 'solana' : chainId;
                const currentPrice = await getDexPriceWithTimeout(tokenToBuy, dexChainId);
                if (currentPrice > 0) {
                    const deviationBps = Math.abs(targetExecutionPrice - currentPrice) / currentPrice * 10000;
                    if (deviationBps > effectiveConfig.maxSlippageBps) {
                        logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping trade: price deviation exceeds user limit', {
                            userId: config.userId,
                            token: tokenToBuy,
                            deviationBps: deviationBps.toFixed(0),
                            limitBps: effectiveConfig.maxSlippageBps
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
                                skipReason: `Price deviation ${deviationBps.toFixed(0)} bps > limit ${effectiveConfig.maxSlippageBps} bps`,
                                targetBuyValue: targetSwapValueUsd.toFixed(2),
                            }
                        }, 'copytrade_skip_price_deviation_bps');

                        return;
                    }
                }
            }

            // 🛡️ GAS BUFFER CHECK (EVM Only)
            // Must run for all execution modes (including turbo), otherwise low-balance wallets still attempt tx.
            if (chainId !== 900) {
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

                if (nativeBalance < (tradeCostWei + gasBufferWei)) {
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

                    return;
                }
            }

        // 🛡️ DB TRANSACTION LOCK (Prevents Concurrent Buys)
        // Create a PENDING position record atomically. If one exists, this will fail.
        let pendingPositionId: string | null = null;
        try {
            const pendingPos = await prisma.$transaction(async (tx) => {
                // Check for ANY recent open or pending position for this token
                const positionWhere: any = {
                    userId: config.userId,
                    tokenAddress: tokenToBuy,
                    status: { in: positionStatusCompat.activeOrLockedStatuses as any },
                };
                if (cooldownMinutes > 0) {
                    positionWhere.createdAt = { gte: new Date(Date.now() - cooldownMinutes * 60 * 1000) };
                }
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
                        entryUsdValue: usdAmount,
                        status: positionStatusCompat.pendingCreateStatus as any
                    }
                });
            });
            pendingPositionId = pendingPos.id;
            logger.info(LogCode.EXE_TX_BROADCAST, 'Created PENDING position lock', { userId: config.userId, token: tokenToBuy, positionId: pendingPositionId });
        } catch (err: any) {
            if (err.message.includes('DUPLICATE_TRADE')) {
                logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping duplicate trade (DB Lock)', { userId: config.userId, token: tokenToBuy });
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
        let txHash = '';
        let txLifecycleStatus: string | undefined;

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
                        txHash = await executeSolanaSwap({
                            userId: effectiveConfig.user.privyDid,
                            tokenInMint: SOLANA_CONFIG.TOKENS.SOL,
                            tokenOutMint: tokenToBuy,
                            amountIn: attemptLamports,
                            slippageBps: attemptSlippage,
                            feeContext: 'copyTrade',
                            executionMode: 'turbo',
                            waitForConfirmation: false
                        });
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
                txHash = await executeSolanaSwap({
                    userId: effectiveConfig.user.privyDid,
                    tokenInMint: SOLANA_CONFIG.TOKENS.SOL,
                    tokenOutMint: tokenToBuy,
                    amountIn: amountInLamports,
                    slippageBps: effectiveConfig.maxSlippageBps,
                    feeContext: 'copyTrade',
                    executionMode
                });
            }

        } else {
            // EVM Logic - nativePrice already fetched at top


            // SPECIALIZED ZORA INTERACTION - Use async launchpad detection (non-blocking)
            // Turbo mode skips launchpad detection on critical path for lower latency.
            const launchpad = turboMode ? null : await resolveLaunchpad(launchpadPromise, chainId);
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

                try {
                    // Step 1: Try with 100% amount, user's base slippage (default 15%)
                    logger.info(LogCode.EXE_TX_BROADCAST, `Buy Step 1: 100% amount, ${baseSlippage / 100}% slippage`, {
                        userId: effectiveConfig.userId,
                        eth: baseAmount.toFixed(6),
                        timingMs: Date.now() - timingDetectedAt
                    });
                    const fastSwapOverride = userSettings?.fastSwapMode === true; // allow direct on buy when enabled
                    const amountStep1 = baseAmount.toFixed(18);
                    const plannedStep1 = await buildPlannedExecutionContext({
                        chainId,
                        walletAddress: effectiveConfig.user.walletAddress,
                        tokenIn: 'ETH',
                        tokenOut: tokenToBuy,
                        amountIn: amountStep1,
                        swap
                    });
                    const result1 = await MainSwapService.executeSwap({
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
                        executionContext: plannedStep1.executionContext,
                        executionPlan: plannedStep1.executionPlan,
                        userSettings: {
                            fastSwapMode: fastSwapOverride || userSettings?.fastSwapMode,
                            copyTradeExecutionMode: executionMode
                        },
                        preWarmedNonce: getPendingNonce(chainId, effectiveConfig.user.walletAddress)
                    });
                    if (!result1.success) throw new Error(result1.error);
                    txHash = result1.txHash!;
                    txLifecycleStatus = result1.txLifecycle?.status || result1.metadata?.txLifecycleStatus;
                    logger.info(LogCode.EXE_TX_BROADCAST, '[CopyTradeTiming] buy step 1 success', {
                        userId: effectiveConfig.userId,
                        token: tokenToBuy,
                        txHash,
                        txLifecycleStatus: txLifecycleStatus || 'unknown',
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
                    if (turboMode) {
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

                        try {
                            // Step 2: Try with 99% amount + 1.25x slippage
                            // NOTE: We intentionally do NOT re-run Price Deviation Check here.
                            // If Step 1 failed, we assume high volatility and prioritize execution over strict price protection.
                            const amount99 = baseAmount * 0.99;
                            const slippage2 = Math.min(Math.floor(baseSlippage * 1.25), 2000); // Max 20% or 1.25x user setting
                            logger.info(LogCode.EXE_TX_BROADCAST, `Buy Step 2: 99% amount, ${slippage2 / 100}% slippage`, { userId: effectiveConfig.userId, eth: amount99.toFixed(6) });
                            const fastSwapOverride = userSettings?.fastSwapMode === true; // allow direct on buy when enabled
                            const amountStep2 = amount99.toFixed(18);
                            const plannedStep2 = await buildPlannedExecutionContext({
                                chainId,
                                walletAddress: effectiveConfig.user.walletAddress,
                                tokenIn: 'ETH',
                                tokenOut: tokenToBuy,
                                amountIn: amountStep2,
                                swap
                            });
                            const result2 = await MainSwapService.executeSwap({
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
                                executionContext: plannedStep2.executionContext,
                                executionPlan: plannedStep2.executionPlan,
                                userSettings: {
                                    fastSwapMode: fastSwapOverride || userSettings?.fastSwapMode,
                                    copyTradeExecutionMode: executionMode
                                }
                            });
                            if (!result2.success) throw new Error(result2.error);
                            txHash = result2.txHash!;
                            txLifecycleStatus = result2.txLifecycle?.status || result2.metadata?.txLifecycleStatus;
                        } catch (buyErr2: any) {
                            logger.warn(LogCode.EXE_TX_REVERTED, 'Buy Step 2 failed, retrying final step...', {
                                userId: config.userId,
                                error: compactCopyTradeError(buyErr2),
                                bugHint: inferCopyTradeBugHint(buyErr2),
                                chainId,
                                token: tokenToBuy
                            });
                            await new Promise(resolve => setTimeout(resolve, 500)); // 🚀 Optimized: 1000ms → 500ms

                            try {
                                // Step 3: Final attempt with 98% amount + 1.5x slippage
                                const amount98 = baseAmount * 0.98;
                                const slippage3 = Math.min(Math.floor(baseSlippage * 1.5), 2500); // Max 25% or 1.5x user setting
                                logger.info(LogCode.EXE_TX_BROADCAST, `Buy Step 3: 98% amount, ${slippage3 / 100}% slippage`, { userId: effectiveConfig.userId, eth: amount98.toFixed(6) });
                                const fastSwapOverride = userSettings?.fastSwapMode === true; // allow direct on buy when enabled
                                const amountStep3 = amount98.toFixed(18);
                                const plannedStep3 = await buildPlannedExecutionContext({
                                    chainId,
                                    walletAddress: effectiveConfig.user.walletAddress,
                                    tokenIn: 'ETH',
                                    tokenOut: tokenToBuy,
                                    amountIn: amountStep3,
                                    swap
                                });
                                const result3 = await MainSwapService.executeSwap({
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
                                    executionContext: plannedStep3.executionContext,
                                    executionPlan: plannedStep3.executionPlan,
                                    userSettings: {
                                        fastSwapMode: fastSwapOverride || userSettings?.fastSwapMode,
                                        copyTradeExecutionMode: executionMode
                                    }
                                });
                                if (!result3.success) throw new Error(result3.error);
                                txHash = result3.txHash!;
                                txLifecycleStatus = result3.txLifecycle?.status || result3.metadata?.txLifecycleStatus;
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
        const shouldPromoteToOpen =
            !txLifecycleStatus
            || txLifecycleStatus === 'visible_pending'
            || txLifecycleStatus === 'confirmed_success';
        const nextPositionStatus = shouldPromoteToOpen ? 'open' : positionStatusCompat.broadcastedUnseenStatus;
        if (pendingPositionId) {
            await prisma.position.update({
                where: { id: pendingPositionId },
                data: {
                    entryPrice: tokenInfo.price,
                    entryAmount: (usdAmount / nativePrice).toString(), // Native amount spent
                    entryTxHash: txHash,
                    status: nextPositionStatus as any,
                },
            });
        } else {
            // Fallback (should not happen if logic is correct): Create new if pending failed for some reason
            await prisma.position.create({
                data: {
                    userId: effectiveConfig.userId,
                    configId: effectiveConfig.id,
                    tokenAddress: tokenToBuy,
                    tokenSymbol: tokenInfo.symbol,
                    chainId,
                    entryPrice: tokenInfo.price,
                    entryAmount: (usdAmount / nativePrice).toString(),
                    entryTxHash: txHash,
                    entryUsdValue: usdAmount,
                    status: nextPositionStatus as any,
                },
            });
        }

        logger.info(LogCode.EXE_TX_CONFIRMED, 'Copy trade buy submitted and position state updated', {
            userId: config.userId,
            token: tokenToBuy,
            txHash,
            txLifecycleStatus: txLifecycleStatus || 'unknown',
            positionStatus: nextPositionStatus
        });

        // Warm sell approval only after buy tx is confirmed to avoid nonce/queue contention.
        // Turbo: send "Bought" DM only after on-chain confirmation (never on broadcast-only).
        setTimeout(() => {
            void (async () => {
                if (!txHash) return;
                const confirmed = await waitTxConfirmedForPreheat(chainId, txHash);
                if (!confirmed) {
                    logger.info(LogCode.SYS_INFO, '[SellApprovalPreheat] Skipped: buy tx not confirmed yet', {
                        chainId,
                        token: tokenToBuy,
                        txHash
                    });
                    return;
                }
                // Turbo mode: send success DM only after tx confirmed (avoids "Bought" when tx never landed or reverted).
                if (turboMode) {
                    sendNotificationAsync({
                        userId: config.user.privyDid,
                        farcasterFid: config.user.farcasterFid,
                        type: 'TRADE_SUCCESS_BUY',
                        data: {
                            tokenSymbol: tokenInfo.symbol,
                            usdValue: usdAmount.toFixed(2),
                            targetWallet: targetWallet,
                            txHash: txHash,
                            chainId: chainId
                        }
                    }, 'copytrade_buy_success_confirmed');
                }
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
                    tokenSymbol: tokenInfo.symbol || 'UNKNOWN',
                    aiDecision: analysis.decision,
                    confidenceScore: analysis.confidence,
                    analysisJson: JSON.stringify(analysis),
                }
            });

            try {
                const session = await createSession(
                    config.user.privyDid,
                    `🤖 AI Trade Analysis: ${tokenInfo.symbol}`,
                    env.aiModel
                );
                const sessionId = session.id;

                const messageContent = `
✅ **Copy Trade Executed**
Target Wallet: \`${targetWallet.slice(0, 6)}...${targetWallet.slice(-4)}\`
Token: **${tokenInfo.symbol}** (\`${tokenToBuy}\`)

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

        // =================================================================
        // 🟣 Send Farcaster Direct Cast (Success)
        // Turbo: DM is sent only after on-chain confirmation (in setTimeout above), not on broadcast.
        // =================================================================
        if (!turboMode && shouldPromoteToOpen) {
            sendNotificationAsync({
                userId: config.user.privyDid,
                farcasterFid: config.user.farcasterFid,
                type: 'TRADE_SUCCESS_BUY',
                data: {
                    tokenSymbol: tokenInfo.symbol,
                    usdValue: usdAmount.toFixed(2),
                    targetWallet: targetWallet,
                    txHash: txHash,
                    chainId: chainId
                }
            }, 'copytrade_buy_success');
        } else if (!shouldPromoteToOpen) {
            logger.warn(LogCode.SYS_INFO, 'Buy notification deferred: tx not yet visible on-chain', {
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
                tokenSymbol: tokenInfo.symbol || 'Unknown',
                error: compactCopyTradeError(error),
                targetWallet: targetWallet,
                chainId: chainId
            }
        }, 'copytrade_buy_failure');
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
    const user = config.user;

    // Fetch universal global slippage from UserSettings
    const settings = params.userSettings || await prisma.userSettings.findUnique({ where: { userId } });
    const universalSlippageBps = getSlippageBps(settings);

    try {
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
            // Handle RPC latency where balance might not appear immediately
            let accounts: any = { value: [] };
            for (let i = 0; i < 3; i++) {
                try {
                    const connection = getSolanaConnection();
                    accounts = await connection.getParsedTokenAccountsByOwner(
                        new PublicKey(solAddress),
                        { mint: new PublicKey(tokenAddress) }
                    );
                    if (accounts.value.length > 0) break; // Found accounts, stop retrying
                    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
                } catch (err) {
                    if (i === 2) logger.error(LogCode.API_FETCH_FAILED, 'Solana balance fetch failed after retries', { userId, error: (err as Error).message });
                }
            }

            for (const acc of accounts.value) {
                const amount = BigInt(acc.account.data.parsed.info.tokenAmount.amount);
                balance += amount;
                decimals = acc.account.data.parsed.info.tokenAmount.decimals;
            }

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
                    await prisma.position.updateMany({
                        where: { userId: userId, tokenAddress: tokenAddress, status: 'open' },
                        data: { status: 'closed', exitReason: balance <= 0n ? 'balance_empty' : 'balance_dust', closedAt: new Date() }
                    });

                    // OPTIONAL: We could add CloseAccount instruction here if account exists but has dust, 
                    // but usually we do it *during* the swap transaction to save a separate TX.
                    return null;
                }
            }

            logger.info(LogCode.EXE_TX_BROADCAST, 'Selling token on Solana', {
                userId,
                balance: balance.toString(),
                valueUsd: balanceUsd.toFixed(2)
            });

            let isPartialSell = false;
            try {
                txHash = await executeSolanaSwap({
                    userId: user.privyDid,
                    tokenInMint: tokenAddress,
                    tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                    amountIn: balance.toString(),
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
                        amountIn: balance.toString(),
                        slippageBps: aggressiveSlippage
                    });
                } catch (e2: any) {
                    try {
                        const safeBalance999 = (balance * 999n) / 1000n;
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

            // Sweep dust
            if (txHash) {
                try {
                    const connection = getSolanaConnection();
                    const postSellAccounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(solAddress), { mint: new PublicKey(tokenAddress) });
                    let remainingBalance = 0n;
                    for (const acc of postSellAccounts.value) { remainingBalance += BigInt(acc.account.data.parsed.info.tokenAmount.amount); }
                    if (remainingBalance > 0n) {
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
            const dec = await getErc20Decimals(tokenAddress, chainId).catch(() => 18);
            let bal = await getErc20Balance(tokenAddress, user.walletAddress, chainId);
            const isMirrorSell = exitReason === 'mirror_sell';

            // Mirror-sell safety: do not trust a single zero read from RPC.
            // Re-check a few times before deciding there is no balance.
            if (isMirrorSell && bal <= 0n) {
                for (let i = 0; i < 3; i++) {
                    await new Promise((resolve) => setTimeout(resolve, 220));
                    const retryBal = await getErc20Balance(tokenAddress, user.walletAddress, chainId).catch(() => 0n);
                    if (retryBal > bal) bal = retryBal;
                    if (bal > 0n) break;
                }
            }

            balance = bal;
            decimals = Number(dec);
            const balanceUsd = formatTokenAmount(balance, decimals) * (hasValidPrice ? tokenInfo.price : 0);

            const treatAsEmptyOrDust = balance <= 0n || (!isMirrorSell && hasValidPrice && balanceUsd < 0.1);
            if (treatAsEmptyOrDust) {
                if (isMirrorSell && balance <= 0n) {
                    // Keep position open for retry path; do not close on mirror-sell zero-balance uncertainty.
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'Mirror sell skipped: zero token balance after retries; position left open', {
                        userId,
                        tokenAddress,
                        chainId
                    });
                    return null;
                }
                logger.throttled(LogCode.WTC_TX_SKIPPED, 'Negligible EVM balance, closing database records', {
                    userId,
                    tokenAddress,
                    balanceUsd,
                    reason: exitReason,
                    isMirrorSell
                });
                await prisma.position.updateMany({
                    where: { userId: userId, tokenAddress: tokenAddress, status: 'open' },
                    data: { status: 'closed', exitReason: balance <= 0n ? 'balance_empty' : 'balance_dust', closedAt: new Date() }
                });
                return null;
            }

            let isPartialSell = false;
            const executionMode = resolveExecutionModeForConfig(config);
            const allowDirectSellPath = false; // copytrade aggregator-only
            const fastSwapModeForSell = false;
            const runSellRoute = async (amountInHuman: string, slippageBps: number, fastSwapMode: boolean, route: string) => {
                logger.info(LogCode.EXE_TX_BROADCAST, 'Mirror sell route attempt', {
                    userId,
                    tokenAddress,
                    chainId,
                    executionMode,
                    route,
                    slippageBps,
                    fastSwapMode
                });
                const planned = await buildPlannedExecutionContext({
                    chainId,
                    walletAddress: user.walletAddress,
                    tokenIn: tokenAddress,
                    tokenOut: 'ETH',
                    amountIn: amountInHuman
                });
                return await MainSwapService.executeSwap({
                    userId: user.privyDid,
                    walletAddress: user.walletAddress,
                    tokenIn: tokenAddress,
                    tokenOut: 'ETH', // Selling to native token
                    amountIn: amountInHuman,
                    chainId: chainId,
                    slippageBps,
                    mode: 'copytrade',
                    executionContext: planned.executionContext,
                    executionPlan: planned.executionPlan,
                    userSettings: {
                        fastSwapMode,
                        copyTradeExecutionMode: executionMode
                    }
                });
            };
            try {
                // Use full balance for sell - the 1-wei subtraction caused amountIn=0 when balance=1n.
                // The router tolerates minor dust on EVM; if it reverts we fall through to the partial-sell retry.
                const safeBalance = balance;
                // Use universal global slippage
                const initialSlippage = universalSlippageBps;
                logger.debug(LogCode.EXE_TX_BROADCAST, 'Attempting EVM sell with slippage', { userId, slippageBps: initialSlippage });

                // [Logic]: Use ethers.formatUnits to prevent precision loss when converting BigInt to string.
                // [Ref]: ethers.js v6 documentation "formatUnits".
                const amountToSellHuman = ethers.formatUnits(safeBalance, decimals);

                // Guard: if formatting produced a zero or negative string (e.g. sub-wei dust), skip gracefully.
                if (!amountToSellHuman || parseFloat(amountToSellHuman) <= 0) {
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'EVM sell skipped: effective amountIn is zero after formatting; closing dust position', {
                        userId, tokenAddress, chainId, balance: balance.toString(), decimals
                    });
                    await prisma.position.updateMany({
                        where: { userId, tokenAddress, status: 'open' },
                        data: { status: 'closed', exitReason: 'balance_dust', closedAt: new Date() }
                    });
                    return null;
                }

                if (!txHash) {
                    let sellResult = await runSellRoute(
                        amountToSellHuman,
                        initialSlippage,
                        false,
                        'external_primary'
                    );
                    if (!sellResult.success && allowDirectSellPath) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Mirror sell external route failed, trying direct pool fallback', {
                            userId,
                            tokenAddress,
                            chainId,
                            error: sellResult.error
                        });
                        sellResult = await runSellRoute(
                            amountToSellHuman,
                            initialSlippage,
                            true,
                            'direct_fallback'
                        );
                    } else if (!sellResult.success) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Mirror sell direct fallback skipped by execution mode/policy', {
                            userId,
                            tokenAddress,
                            chainId,
                            executionMode,
                            allowDirectSellPath,
                            error: sellResult.error
                        });
                    }
                    if (!sellResult.success) throw new Error(sellResult.error);
                    txHash = sellResult.txHash!;
                }
            } catch (e: any) {
                if (allowDirectSellPath) {
                    try {
                        const amountToSellHuman = ethers.formatUnits(balance, decimals);
                        const directResult = await runSellRoute(
                            amountToSellHuman,
                            universalSlippageBps,
                            true,
                            'direct_fallback_after_exception'
                        );
                        if (directResult.success) {
                            txHash = directResult.txHash!;
                        } else {
                            throw new Error(directResult.error);
                        }
                    } catch {
                        // continue to partial retry path below
                    }
                }
                if (txHash) {
                    logger.info(LogCode.EXE_TX_CONFIRMED, 'Mirror sell recovered via direct fallback after external exception', {
                        userId,
                        tokenAddress,
                        chainId,
                        txHash
                    });
                } else {
                logger.warn(LogCode.EXE_TX_REVERTED, 'EVM sell failed, retrying partial sell', {
                    userId,
                    error: compactCopyTradeError(e),
                    bugHint: inferCopyTradeBugHint(e),
                    token: tokenAddress,
                    chainId
                });
                }
                if (!txHash) {
                try {
                    // Use 99.9% of balance for retry; clamp to full balance if it would round to 0.
                    const safeBalance999Raw = (balance * 999n) / 1000n;
                    const safeBalance999 = safeBalance999Raw > 0n ? safeBalance999Raw : balance;
                    // Retry with 1.5x of global slippage, capped at 25%
                    const retrySlippage = Math.min(Math.floor(universalSlippageBps * 1.5), 2500);
                    logger.debug(LogCode.EXE_TX_BROADCAST, 'Retrying EVM sell with higher slippage', { userId, slippageBps: retrySlippage });

                    const amountToSellHuman999 = ethers.formatUnits(safeBalance999, decimals);

                    let retryResult;
                    try {
                        retryResult = await runSellRoute(
                            amountToSellHuman999,
                            retrySlippage,
                            false,
                            'external_retry'
                        );
                    } catch (retryErr: any) {
                        if (allowDirectSellPath) {
                            retryResult = await runSellRoute(
                                amountToSellHuman999,
                                retrySlippage,
                                true,
                                'direct_retry_fallback_after_exception'
                            );
                        } else {
                            throw retryErr;
                        }
                    }
                    if (!retryResult.success && allowDirectSellPath) {
                        retryResult = await runSellRoute(
                            amountToSellHuman999,
                            retrySlippage,
                            true,
                            'direct_retry_fallback'
                        );
                    }
                    if (!retryResult.success) throw new Error(retryResult.error);
                    txHash = retryResult.txHash!;
                    isPartialSell = true;
                } catch (e2: any) {
                    // Four.meme fallback
                    const isFourMeme = chainId === 56 && (tokenAddress.toLowerCase().endsWith('4444') || fourMemeService.isFourMemeToken(tokenAddress));
                    if (isFourMeme) {
                        try {
                            txHash = await fourMemeService.sellToken({
                                userId: user.privyDid,
                                walletAddress: user.walletAddress,
                                tokenAddress: tokenAddress,
                                amount: balance.toString(),
                                feeContext: 'copyTrade',
                            });
                        } catch (fmErr: any) {
                            logger.error(LogCode.EXE_TX_REVERTED, 'Four.meme fallback sell failed', {
                                userId,
                                token: tokenAddress,
                                error: compactCopyTradeError(fmErr),
                                bugHint: inferCopyTradeBugHint(fmErr),
                                chainId
                            });
                            throw fmErr;
                        } // Re-throw to trigger exit_failed
                    } else { throw e2; } // Re-throw to trigger exit_failed
                }
                }
            }

            // Sweep dust
            if (txHash) {
                const skipDustSweepForMirrorSell = exitReason === 'mirror_sell' && COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP;
                if (skipDustSweepForMirrorSell) {
                    logger.debug(LogCode.SYS_INFO, 'Mirror sell dust sweep skipped to prevent duplicate sell race', {
                        userId,
                        tokenAddress,
                        chainId
                    });
                } else {
                try {
                    const remainingBalance = await getErc20Balance(tokenAddress, user.walletAddress, chainId);
                    const dustUsd = formatTokenAmount(remainingBalance, decimals) * (tokenInfo?.price || 0);
                    if (remainingBalance > 1000n && (dustUsd >= 0.05 || isPartialSell)) {
                        const dustAmountHuman = ethers.formatUnits(remainingBalance, decimals);
                        const plannedDust = await buildPlannedExecutionContext({
                            chainId,
                            walletAddress: user.walletAddress,
                            tokenIn: tokenAddress,
                            tokenOut: 'ETH',
                            amountIn: dustAmountHuman
                        });

                        const dustResult = await MainSwapService.executeSwap({
                            userId: user.privyDid,
                            walletAddress: user.walletAddress,
                            tokenIn: tokenAddress,
                            tokenOut: 'ETH',
                            amountIn: dustAmountHuman,
                            chainId: chainId,
                            slippageBps: 2000, // Higher slippage for dust sweep (20%)
                            mode: 'copytrade',
                            executionContext: plannedDust.executionContext,
                            executionPlan: plannedDust.executionPlan,
                            userSettings: {
                                fastSwapMode: fastSwapModeForSell,
                                copyTradeExecutionMode: executionMode
                            }
                        });
                        // Dust sweep failure is non-critical, just log
                    }
                } catch (sweepErr: any) {
                    logger.debug(LogCode.EXE_TX_REVERTED, 'EVM dust sweep failed', { error: sweepErr.message });
                }
                }
            }
        }

        // Update DB with PNL calculation
        if (txHash) {
            // [Logic]: Calculate sell value FIRST (needed for PNL)
            // [Ref]: formatTokenAmount helper + tokenInfo.price from API
            // [Risk]: tokenInfo.price may be stale or 0 if API fails
            const openPositions = await prisma.position.findMany({
                where: { userId: userId, tokenAddress: tokenAddress, status: 'open' }
            });
            const fallbackExitPrice = openPositions.find(p => (p.currentPrice || 0) > 0)?.currentPrice
                ?? openPositions.find(p => (p.entryPrice || 0) > 0)?.entryPrice
                ?? 0;
            const exitPrice = hasValidPrice ? tokenInfo.price : fallbackExitPrice;
            const sellVolUsd = exitPrice > 0 ? formatTokenAmount(balance, decimals) * exitPrice : 0;

            // [Logic]: Fetch open positions to get entry data for PNL calculation
            // [Ref]: Prisma Position model has entryPrice, entryUsdValue fields
            // [Risk]: Position may have been closed by another process (race condition)
            if (!hasValidPrice && exitPrice > 0) {
                logger.warn(LogCode.API_FETCH_FAILED, 'Exit price missing from live data; using fallback price', {
                    userId,
                    token: tokenAddress,
                    exitPrice
                });
            }

            // [Logic]: Update each position with calculated PNL
            // [Ref]: Prisma schema fields: realizedPnlUsd, realizedPnlPct, exitPrice, exitUsdValue
            // [Risk]: Division by zero if entryPrice is 0 (shouldn't happen, but guard against it)
            for (const pos of openPositions) {
                let realizedPnlUsd = sellVolUsd - (pos.entryUsdValue || 0);
                const realizedPnlPct = pos.entryPrice && pos.entryPrice > 0
                    ? ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100
                    : 0;

                // Sanity guard: if PnL is absurdly large relative to entry value,
                // it means the sell balance or price was corrupted. Clamp to ±10x entry.
                const maxPlausiblePnl = Math.max((pos.entryUsdValue || 0) * 10, 100000);
                if (Math.abs(realizedPnlUsd) > maxPlausiblePnl) {
                    logger.warn(LogCode.SYS_ERROR, 'Clamping implausible realizedPnlUsd', {
                        positionId: pos.id,
                        rawPnl: realizedPnlUsd,
                        entryUsdValue: pos.entryUsdValue,
                        sellVolUsd,
                        exitPrice,
                        clampedTo: 0
                    });
                    realizedPnlUsd = 0;
                }

                await prisma.position.update({
                    where: { id: pos.id },
                    data: {
                        status: 'closed',
                        exitTxHash: txHash,
                        exitReason: exitReason,
                        closedAt: new Date(),
                        exitPrice: exitPrice,
                        exitUsdValue: sellVolUsd,
                        realizedPnlUsd: realizedPnlUsd,
                        realizedPnlPct: realizedPnlPct,
                    },
                });
            }

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Position exit executed successfully', { userId, token: tokenAddress, reason: exitReason, txHash });

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
                    tokenSymbol: tokenInfo.symbol,
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
            stack: error.stack
        });

        // 🔄 RETRY MECHANISM: Instead of immediately closing, track retry attempts
        // This prevents permanent position lock-up from temporary failures
        const MAX_EXIT_RETRIES = 3;

        try {
            const position = await prisma.position.findFirst({
                where: { userId: userId, tokenAddress: tokenAddress, status: 'open' }
            });

            const retryCount = (position?.exitRetryCount || 0) + 1;

            if (retryCount <= MAX_EXIT_RETRIES) {
                // Update retry counter, keep position open for PositionMonitor retry
                // FIX 6: Persist exitReason so we know WHY we are exiting during retry
                await prisma.position.updateMany({
                    where: { userId: userId, tokenAddress: tokenAddress, status: 'open' },
                    data: {
                        exitRetryCount: retryCount,
                        lastExitAttempt: new Date(),
                        exitReason: exitReason // Persist intent
                    }
                });

                logger.warn(LogCode.EXE_TX_REVERTED, 'Mirror sell failed, will retry via PositionMonitor', {
                    userId,
                    token: tokenAddress,
                    retryCount,
                    nextRetryIn: '5 minutes',
                    reason: exitReason
                });

                // FIX 4: Notification Throttling
                // We do NOT send notifications for intermediate retries to avoid spam.
                // Notifications are only sent on success or final failure (max retries reached).
            } else {
                // After max retries, mark as failed permanently
                await prisma.position.updateMany({
                    where: { userId: userId, tokenAddress: tokenAddress, status: 'open' },
                    data: {
                        status: 'closed',
                        exitReason: 'exit_failed_max_retries',
                        closedAt: new Date(),
                    },
                });

                logger.error(LogCode.EXE_TX_REVERTED, 'Mirror sell failed after max retries, marking as failed', {
                    userId,
                    token: tokenAddress,
                    retries: MAX_EXIT_RETRIES
                });

                // Send final failure notification
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
    const positionStatusCompat = await getPositionStatusCompat();
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
        // Reconcile rare turbo race: tx settled on-chain but position stayed pending.
        try {
            const pendingPositions = await prisma.position.findMany({
                where: {
                    userId: config.userId,
                    tokenAddress: tokenToSell,
                    chainId,
                    status: { in: positionStatusCompat.lockStatuses as any }
                },
                orderBy: { createdAt: 'desc' },
                take: 3
            });
            if (pendingPositions.length > 0 && config.user?.walletAddress) {
                const onChainBal = chainId === 900
                    ? 0n
                    : await getErc20Balance(tokenToSell, config.user.walletAddress, chainId);
                if (onChainBal > 0n) {
                    const pendingIds = pendingPositions.map((p) => p.id);
                    await prisma.position.updateMany({
                        where: { id: { in: pendingIds }, status: { in: positionStatusCompat.lockStatuses as any } },
                        data: {
                            status: 'open',
                            entryTxHash: `RECOVERED_ONCHAIN_${Date.now()}`
                        }
                    });
                    logger.warn(LogCode.SYS_INFO, 'Recovered pending positions to open by on-chain balance (mirror sell path)', {
                        userId: config.userId,
                        chainId,
                        token: tokenToSell,
                        pendingCount: pendingPositions.length,
                        recoveredIds: pendingIds
                    });
                }
            }
        } catch (reconcileErr: any) {
            logger.warn(LogCode.SYS_ERROR, 'Failed pending->open reconciliation in mirror sell', {
                userId: config.userId,
                token: tokenToSell,
                chainId,
                error: reconcileErr?.message || String(reconcileErr)
            });
        }

        const [positions, tokenInfo] = await Promise.all([
            prisma.position.findMany({
                where: { userId: config.userId, tokenAddress: tokenToSell, status: 'open' },
            }),
            getTokenInfo(tokenToSell, chainId, { priority: 'high', rpcStrategy: 'fast', fastMode: true })
        ]);

        if (positions.length === 0) {
            logger.info(LogCode.WTC_TX_SKIPPED, 'Mirror sell skipped: no open positions after reconciliation', {
                userId: config.userId,
                token: tokenToSell,
                chainId
            });
            return;
        }

        // Leader stat tracking (only for mirror sell)
        const balanceUsdForStats = positions.reduce((sum, p) => sum + (p.entryUsdValue || 0), 0);
        recordNewTrade(targetWallet, chainId, 'sell', balanceUsdForStats);

        const positionIds = positions.map(p => p.id);
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
                config: { ...config, user: (config as any).user }
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
    const lifecycleLockStatuses = positionStatusCompat.lockStatuses.filter((s) => s !== 'pending');
    // STEP -2: Reconcile lifecycle-driven pending states by tx receipt.
    const lifecyclePending = lifecycleLockStatuses.length > 0
        ? await prisma.position.findMany({
            where: {
                status: { in: lifecycleLockStatuses as any },
                createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
                entryTxHash: { startsWith: '0x' }
            },
            orderBy: { createdAt: 'desc' },
            take: 40
        })
        : [];
    if (lifecyclePending.length > 0) {
        await Promise.allSettled(lifecyclePending.map(async (p) => {
            try {
                const receipt = await getTransactionReceipt(p.chainId, p.entryTxHash);
                if (!receipt) return;
                const statusHex = String(receipt?.status || '');
                const success = statusHex === '0x1' || statusHex === '1';
                await prisma.position.updateMany({
                    where: { id: p.id, status: { in: lifecycleLockStatuses as any } },
                    data: success
                        ? { status: 'open' as any }
                        : {
                            status: positionStatusCompat.failedFinalStatus as any,
                            exitReason: 'buy_tx_reverted',
                            closedAt: new Date()
                        }
                });
                logger.info(LogCode.SYS_INFO, '[CopyTradeLifecycle] position state transition', {
                    positionId: p.id,
                    chainId: p.chainId,
                    txHash: p.entryTxHash,
                    from: p.status,
                    to: success ? 'open' : positionStatusCompat.failedFinalStatus,
                    reason: success ? 'receipt_success' : 'receipt_failed'
                });
            } catch (err: any) {
                logger.debug(LogCode.SYS_INFO, '[CopyTradeLifecycle] tx receipt probe skipped', {
                    positionId: p.id,
                    chainId: p.chainId,
                    txHash: p.entryTxHash,
                    error: err?.message || String(err)
                });
            }
        }));
    }

    // STEP -1: Reconcile pending positions that already hold token on-chain.
    // This protects TP/SL and mirror-sell flows from rare turbo timeout races.
    const pendingForReconcile = await prisma.position.findMany({
        where: {
            status: { in: positionStatusCompat.lockStatuses as any },
            createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } // recent 30m only
        },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: 30
    });
    if (pendingForReconcile.length > 0) {
        await Promise.allSettled(
            pendingForReconcile.map(async (p) => {
                if (!p.user?.walletAddress || p.chainId === 900) return;
                const bal = await getErc20Balance(p.tokenAddress, p.user.walletAddress, p.chainId);
                if (bal <= 0n) return;
                await prisma.position.updateMany({
                    where: { id: p.id, status: { in: positionStatusCompat.lockStatuses as any } },
                    data: {
                        status: 'open',
                        entryTxHash: p.entryTxHash?.startsWith('PENDING_')
                            ? `RECOVERED_ONCHAIN_${Date.now()}`
                            : p.entryTxHash
                    }
                });
                logger.warn(LogCode.SYS_INFO, 'Recovered pending position to open in monitor path', {
                    positionId: p.id,
                    userId: p.userId,
                    token: p.tokenAddress,
                    chainId: p.chainId
                });
            })
        );
    }

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
                    config: { ...config, user: position.user }
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
                            config: { ...config, user: position.user }
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
                            config: { ...config, user: position.user }
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

async function getNativeBalance(walletAddress: string, chainId: number): Promise<bigint> {
    try {
        const raw = await rpcGetNativeBalance(walletAddress, chainId);
        return BigInt(raw);
    } catch (error) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Failed to fetch native balance for gas check', { wallet: walletAddress, chainId });
        return 0n; // Fail open (don't block trade on RPC error, assume enough gas)
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



export async function passesFilters(tokenInfo: any, config: any, targetSwapValueUsd: number) {
    if (!tokenInfo) return { passed: false, reason: 'No token info' };

    // =========================================================================
    // 🛡️ DEFENSIVE PROGRAMMING: Safe number extraction with data validation
    // Distinguish between:
    //   1. Missing data (null/undefined) → Should REJECT trade (data unavailable)
    //   2. Format issues (string numbers) → Should CONVERT (e.g., "1000" → 1000)
    // =========================================================================
    const safeNumber = (value: any, fieldName: string): number => {
        // Missing data - this is a critical error
        if (value === null || value === undefined) {
            throw new Error(`Missing ${fieldName}`);
        }

        // Convert string to number if needed
        const num = typeof value === 'string' ? parseFloat(value) : Number(value);

        // Invalid number - this is also a critical error
        if (isNaN(num) || !isFinite(num)) {
            throw new Error(`Invalid ${fieldName}: ${value}`);
        }

        return num;
    };

    // Try to extract critical data - if any fails, reject the token
    let price: number;

    // Non-critical data (default to 0 if missing/invalid to allow new tokens)
    // 🚀 COPY TRADE FIX: liquidity 改为非关键数据，允许 liquidity=0 的新代币通过
    let liquidity: number = 0;
    let volume24h: number = 0;
    let marketCap: number = 0;

    try {
        // Critical: Must have price (for value calculation)
        price = safeNumber(tokenInfo.price, 'price');

        // Non-Critical: Liquidity (often 0 for brand new launchpad tokens)
        if (tokenInfo.liquidity !== null && tokenInfo.liquidity !== undefined) {
            try { liquidity = safeNumber(tokenInfo.liquidity, 'liquidity'); } catch { }
        }

        // Non-Critical: Volume and MCap (often missing for fresh tokens)
        if (tokenInfo.volume24h !== null && tokenInfo.volume24h !== undefined) {
            try { volume24h = safeNumber(tokenInfo.volume24h, 'volume24h'); } catch { }
        }

        if (tokenInfo.marketCap !== null && tokenInfo.marketCap !== undefined) {
            try { marketCap = safeNumber(tokenInfo.marketCap, 'marketCap'); } catch { }
        } else if (tokenInfo.fdv !== null && tokenInfo.fdv !== undefined) {
            try { marketCap = safeNumber(tokenInfo.fdv, 'fdv'); } catch { }
        }
    } catch (err: any) {
        return { passed: false, reason: `[DATA ERROR] ${err.message}` };
    }

    // =========================================================================
    // 🛡️ UNIVERSAL USER FILTERS (Checked in both Fast and Normal modes)
    // =========================================================================

    // 1. Min Target Buy Value (Safety logic: Don't copy tiny dust trades)
    if (config.minTargetValueUsd && isBelowMinTargetValue(targetSwapValueUsd, config.minTargetValueUsd)) {
        const effectiveFloor = getMinTargetEffectiveFloorUsd(Number(config.minTargetValueUsd || 0));
        return {
            passed: false,
            reason: `Target buy value $${targetSwapValueUsd.toFixed(2)} < min floor $${effectiveFloor.toFixed(2)} (configured $${Number(config.minTargetValueUsd).toFixed(2)})`
        };
    }

    // 2. Market Cap Filters (Safety logic: Only buy tokens within user's risk profile)
    const minMarketCapUsd = (config.minMarketCapUsd ?? config.minMarketCap) || 0;
    const maxMarketCapUsd = (config.maxMarketCapUsd ?? config.maxMarketCap) || 0;

    if (marketCap > 0) { // Only apply if we actually have MCap data
        if (minMarketCapUsd > 0 && marketCap < minMarketCapUsd) {
            return { passed: false, reason: `MCap $${marketCap.toFixed(0)} < min $${minMarketCapUsd.toFixed(0)}` };
        }
        if (maxMarketCapUsd > 0 && marketCap > maxMarketCapUsd) {
            return { passed: false, reason: `MCap $${marketCap.toFixed(0)} > max $${maxMarketCapUsd.toFixed(0)}` };
        }
    } else {
        // marketCap = 0 means no data (turbo/disableTokenInfo mode with RPC fallback).
        // If user configured a minMarketCapUsd filter, we cannot verify it — block the trade.
        if (minMarketCapUsd > 0) {
            return { passed: false, reason: `MCap data unavailable (token info disabled) — cannot verify min $${minMarketCapUsd.toFixed(0)} filter` };
        }
    }

    // 3. User-defined Liquidity filter (Safety logic: Ensure pool depth is sufficient)
    const minLiquidityUsd = config.minLiquidityUsd || 0;
    if (minLiquidityUsd > 0 && liquidity < minLiquidityUsd) {
        return { passed: false, reason: `Liquidity $${liquidity.toFixed(0)} < min $${minLiquidityUsd.toFixed(0)}` };
    }

    // =========================================================================
    // 🛡️ HONEYPOT DETECTION & MODE-SPECIFIC LOGIC
    // =========================================================================
    const MIN_LIQUIDITY_FAST = 500; // $500 minimum for fast mode
    const MIN_LIQUIDITY_NORMAL = 1000; // $1000 minimum for normal mode
    const MIN_VOLUME_RATIO = 0.01; // Volume should be at least 1% of liquidity

    const isFastMode = config.fastExecutionEnabled !== false; // Default to fast

    // FAST MODE: Quick entry for new tokens (TRUST the target wallet's judgment)
    if (isFastMode) {
        // 🚀 COPY TRADE FIX: 对于新代币，完全信任跟单目标的判断
        // 如果流动性为 0 或未知，仍然允许交易（目标钱包已经验证过）
        // 只在 liquidity > 0 时才做最低流动性检查
        if (liquidity > 0 && liquidity < MIN_LIQUIDITY_FAST) {
            return { passed: false, reason: `[HONEYPOT/FAST] Liquidity $${liquidity.toFixed(0)} < $${MIN_LIQUIDITY_FAST}` };
        }
        // liquidity === 0: 允许通过（新代币可能尚未索引流动性数据）

        // Price Impact check in Fast Mode (8% loose limit)
        if (config.buyAmountUsd && liquidity > 0) {
            const buyAmount = safeNumber(config.buyAmountUsd, 'buyAmountUsd');
            const singleSideLiquidity = liquidity / 2;
            const estimatedPriceImpact = (buyAmount / singleSideLiquidity) * 100;
            const MAX_PRICE_IMPACT = 8;

            if (estimatedPriceImpact > MAX_PRICE_IMPACT) {
                return { passed: false, reason: `[PRICE IMPACT] Est. impact ${estimatedPriceImpact.toFixed(2)}% > ${MAX_PRICE_IMPACT}%` };
            }
        }

        return { passed: true };
    }

    // NORMAL MODE: Thorough checks
    // 🚀 COPY TRADE FIX: 同样只在 liquidity > 0 时才检查
    if (liquidity > 0 && liquidity < MIN_LIQUIDITY_NORMAL) {
        return { passed: false, reason: `[HONEYPOT] Liquidity $${liquidity.toFixed(0)} < $${MIN_LIQUIDITY_NORMAL}` };
    }

    // Check volume/liquidity ratio
    if (liquidity > 50000 && volume24h > 0) {
        const volumeRatio = volume24h / liquidity;
        if (volumeRatio < MIN_VOLUME_RATIO) {
            return { passed: false, reason: `[HONEYPOT] Suspicious volume ratio: ${(volumeRatio * 100).toFixed(2)}%` };
        }
    }

    // Price Impact in Normal Mode (5% strict limit)
    if (config.buyAmountUsd && liquidity > 0) {
        const buyAmount = safeNumber(config.buyAmountUsd, 'buyAmountUsd');
        const singleSideLiquidity = liquidity / 2;
        const estimatedPriceImpact = (buyAmount / singleSideLiquidity) * 100;
        const MAX_PRICE_IMPACT = 5;

        if (estimatedPriceImpact > MAX_PRICE_IMPACT) {
            return { passed: false, reason: `[PRICE IMPACT] Est. impact ${estimatedPriceImpact.toFixed(2)}% > ${MAX_PRICE_IMPACT}%` };
        }
    }

    return { passed: true };
}
const SELL_PREHEAT_DELAY_MS = Math.max(0, Number(process.env.COPYTRADE_SELL_APPROVAL_PREHEAT_DELAY_MS || '15000'));
const SELL_PREHEAT_CONFIRM_TIMEOUT_MS = Math.max(5000, Number(process.env.COPYTRADE_SELL_APPROVAL_PREHEAT_CONFIRM_TIMEOUT_MS || '45000'));
const SELL_PREHEAT_CONFIRM_POLL_MS = Math.max(500, Number(process.env.COPYTRADE_SELL_APPROVAL_PREHEAT_CONFIRM_POLL_MS || '1200'));

async function waitTxConfirmedForPreheat(chainId: number, txHash: string): Promise<boolean> {
    const started = Date.now();
    while (Date.now() - started < SELL_PREHEAT_CONFIRM_TIMEOUT_MS) {
        const receipt = await getTransactionReceipt(chainId, txHash).catch(() => null);
        if (receipt) {
            const statusRaw = String((receipt as any)?.status || '0x0');
            const status = statusRaw.startsWith('0x')
                ? Number.parseInt(statusRaw, 16)
                : Number(statusRaw);
            return status === 1;
        }
        await new Promise((resolve) => setTimeout(resolve, SELL_PREHEAT_CONFIRM_POLL_MS));
    }
    return false;
}
