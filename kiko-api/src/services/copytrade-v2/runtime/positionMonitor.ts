import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import prisma from '../../../db/prisma.js';
import { cacheHub } from '../../../cache/DataCacheHub.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { DynamicTakeProfitService } from '../../dynamicTakeProfitService.js';
import { getSolanaConnection, SOLANA_CONFIG } from '../../../config/solanaConfig.js';
import { executeSolanaSwap } from '../../solanaExecutor.js';
import { getSolanaEmbeddedWalletAddress } from '../../privyWallet.js';
import { getTokenMetadata } from '../../rpcService.js';
import { trackCopyTrade, trackSwap } from '../../userActivityService.js';
import { publishCopytradeRawNotification } from '../notifications/copytradeNotificationPublisher.js';
import { classifyCopytradeAssetEligibility } from '../../copytradeAssetEligibility.js';
import {
  resolveExecutionModeFromConfig,
  type CopyTradeExecutionMode,
} from '../../copyTradeExecutionMode.js';
import { buildEvmExitPlan } from '../exit/planner.js';
import { executePlannedEvmExitFlow } from '../exit/evmExitExecutionFlow.js';
import {
  persistFailedExitState,
  persistDeferredExitRetryState,
  persistPendingExitFinalityState,
  persistSuccessfulExit,
  reconcileNoopExitPosition,
  persistTerminalExitBlockState,
} from '../exit/persistence.js';
import { getExitInflightRetryGraceMs, hasRecentInflightExitRetryGuard } from '../exit/retryGuard.js';
import { resolveSolanaDbBalanceFallback } from '../exit/solanaDbBalanceFallback.js';
import { resolveAttributedPositionExitAmount } from '../positions/positionAttribution.js';
import { shouldDeferStrongRpcMonitoring } from '../buy/preConfirmationRpcPolicy.js';
import { buildOrderAuditFields } from '../../order-runtime/sinks/persistence.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { recordFollowerTransactionFactByPosition } from '../data-flow/followerTransactionFactLedger.js';
import { TRADE_METADATA_PROFILE } from '../../rpc/profile.js';
import {
  acquireDistributedTokenExitLock,
  buildTokenExitLockScopeKey,
  releaseDistributedTokenExitLock,
  type DistributedTokenExitLock,
} from './tokenExitLock.js';
import { evaluateAutoExitPriceGuard } from './autoExitPriceGuard.js';
import { getGuardPriceSnapshot } from './guardPrice.js';
import { reconcileMirrorSellDustPosition } from './mirrorSellDustReconciler.js';
import { reconcileStaleOpenClosedPosition } from './staleOpenPositionReconciler.js';
import {
  ExitHotPathDeferredError,
  hasIntentContext,
  resolveExitIntentRetryDelayMs,
} from '../exit/exitHotPathPolicy.js';
import { listActiveExitIntentPositionIds } from '../exit/positionExitIntentStore.js';

const NO_OPEN_POSITIONS_LOG_WINDOW_MS = Number(process.env.NO_OPEN_POSITIONS_LOG_WINDOW_MS || '180000');
const COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP = (process.env.COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP || 'true') === 'true';
const MIN_POSITION_AGE_FOR_TPSL_MS = Math.max(0, Number(process.env.MIN_POSITION_AGE_FOR_TPSL_MS || '90000'));
const TPSL_CONSECUTIVE_HITS_REQUIRED = Math.max(1, Number(process.env.TPSL_CONSECUTIVE_HITS_REQUIRED || '2'));
const TPSL_HIT_WINDOW_MS = Math.max(1000, Number(process.env.TPSL_HIT_WINDOW_MS || '90000'));
const TPSL_TRACKER_PRUNE_MS = 10 * 60 * 1000;
const EXIT_INFLIGHT_RETRY_GRACE_MS = getExitInflightRetryGraceMs();
const MAX_EXIT_RETRIES = Math.max(1, Number(process.env.COPYTRADE_MAX_EXIT_RETRIES || '3'));
const EXIT_RETRY_COOLDOWN_MS = Math.max(5_000, Number(process.env.COPYTRADE_EXIT_RETRY_COOLDOWN_MS || '12000'));
const TOKEN_EXIT_LOCK_MAX_MS = Math.max(10_000, Number(process.env.COPYTRADE_TOKEN_EXIT_LOCK_MAX_MS || '45000'));

const positionsBeingExited = new Set<string>();
const tokenExitsBeingProcessed = new Map<string, { owner: string; startedAt: number }>();
const tpslHitTracker = new Map<string, { side: 'tp' | 'sl'; hits: number; firstHitAt: number; lastHitAt: number; lastPnlPct: number }>();

type PositionStatusCompat = {
  lockStatuses: string[];
  activeOrLockedStatuses: string[];
  pendingCreateStatus: string;
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
    const labels = new Set(rows.map((row) => String(row.enumlabel)));
    const hasFailedFinal = labels.has('failed_final');

    const compat: PositionStatusCompat = {
      lockStatuses: ['pending'],
      activeOrLockedStatuses: ['open', 'pending'],
      pendingCreateStatus: 'pending',
      failedFinalStatus: hasFailedFinal ? 'failed_final' : 'failed',
    };
    positionStatusCompatCache = { value: compat, ts: Date.now() };
    return compat;
  } catch {
    const fallback: PositionStatusCompat = {
      lockStatuses: ['pending'],
      activeOrLockedStatuses: ['open', 'pending'],
      pendingCreateStatus: 'pending',
      failedFinalStatus: 'failed',
    };
    positionStatusCompatCache = { value: fallback, ts: Date.now() };
    return fallback;
  }
}

function resolveExecutionModeForConfig(config: any): CopyTradeExecutionMode {
  return resolveExecutionModeFromConfig({
    requested: config?.executionMode,
    legacyDisableTokenInfo: config?.disableTokenInfo,
    fallback: 'normal',
  }).mode;
}

function getSlippageBps(userSettings: any): number {
  if (!userSettings || userSettings.customSlippage === null || userSettings.customSlippage === undefined) {
    return 1500;
  }
  return Math.floor(userSettings.customSlippage * 100);
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

async function deferExitRetryOrThrow(params: {
  intentDriven: boolean;
  reasonCode: string;
  positions: Array<any>;
  targetWallet?: string | null;
  exitReason: string;
}): Promise<null> {
  if (params.intentDriven) {
    throw new ExitHotPathDeferredError(
      params.reasonCode,
      resolveExitIntentRetryDelayMs({ reasonCode: params.reasonCode })
    );
  }
  await persistDeferredExitRetryState({
    positions: params.positions as any,
    targetWallet: params.targetWallet,
    exitReason: params.exitReason,
    reasonCode: params.reasonCode,
  }).catch(() => undefined);
  return null;
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
    const meta = await getTokenMetadata(chainId, tokenAddress, { profile: TRADE_METADATA_PROFILE });
    return resolveDisplayTokenSymbol(meta?.symbol, tokenAddress);
  } catch {
    return current;
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
      lastPnlPct: pnlPct,
    });
    return 1;
  }
  const nextHits = current.hits + 1;
  tpslHitTracker.set(positionId, {
    ...current,
    hits: nextHits,
    lastHitAt: now,
    lastPnlPct: pnlPct,
  });
  return nextHits;
}

function clearTpslHit(positionId: string): void {
  tpslHitTracker.delete(positionId);
}

const LOCAL_POSITION_CLOSE_GUARD_MS = 2 * 60 * 1000;

function markPositionLocallyClosed(positionId: string): void {
  clearTpslHit(positionId);
  positionsBeingExited.add(positionId);
  setTimeout(() => positionsBeingExited.delete(positionId), LOCAL_POSITION_CLOSE_GUARD_MS);
}

function tryAcquireTokenExitLock(lockKey: string, owner: string): boolean {
  const existing = tokenExitsBeingProcessed.get(lockKey);
  if (existing && Date.now() - existing.startedAt < TOKEN_EXIT_LOCK_MAX_MS) {
    return false;
  }
  tokenExitsBeingProcessed.set(lockKey, { owner, startedAt: Date.now() });
  return true;
}

function releaseTokenExitLock(lockKey: string, owner: string): void {
  const existing = tokenExitsBeingProcessed.get(lockKey);
  if (!existing || existing.owner !== owner) return;
  tokenExitsBeingProcessed.delete(lockKey);
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
    intentContext?: Record<string, unknown>;
}): Promise<string | null> {
    const { userId, tokenAddress, chainId, exitReason, config } = params;
    const tokenInfo = params.tokenInfo ?? { price: 0, symbol: 'UNKNOWN' };
    const hasValidPrice = Number.isFinite(tokenInfo?.price) && tokenInfo.price > 0;
    const intentDrivenExit = hasIntentContext(params.intentContext as Record<string, unknown> | undefined);

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
    const tokenExitLockKey = buildTokenExitLockScopeKey({
        chainId,
        tokenAddress,
        walletAddress: user?.walletAddress,
        ownerScope: userId,
    });
    const tokenExitLockOwner = `${userId}:${exitReason}:${Date.now()}`;
    let tokenExitLockAcquired = false;
    let distributedTokenExitLock: DistributedTokenExitLock | null = null;

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

        const assetEligibility = classifyCopytradeAssetEligibility({
            chainId,
            tokenAddress,
        });
        if (!assetEligibility.allowed) {
            logger.warn(LogCode.WTC_TX_SKIPPED, 'Copytrade exit blocked for forbidden asset', {
                userId,
                token: tokenAddress,
                chainId,
                reason: exitReason,
                reasonCode: assetEligibility.reasonCode,
                classification: assetEligibility.classification,
            });
            await persistTerminalExitBlockState({
                positions: exitPositions as any,
                targetWallet: config.targetWallet,
                reasonCode: assetEligibility.reasonCode || 'forbidden_asset',
            });
            return null;
        }

        tokenExitLockAcquired = tryAcquireTokenExitLock(tokenExitLockKey, tokenExitLockOwner);
        if (!tokenExitLockAcquired) {
            logger.warn(LogCode.EXE_TX_BROADCAST, 'Deferring position exit due to active wallet-token exit lock', {
                userId,
                token: tokenAddress,
                chainId,
                walletAddress: user?.walletAddress || null,
                reason: exitReason,
                lockKey: tokenExitLockKey,
            });
            return deferExitRetryOrThrow({
                intentDriven: intentDrivenExit,
                positions: exitPositions,
                targetWallet: config.targetWallet,
                exitReason,
                reasonCode: 'token_exit_lock_contended',
            });
        }
        distributedTokenExitLock = await acquireDistributedTokenExitLock({
            chainId,
            tokenAddress,
            walletAddress: user?.walletAddress,
            ownerScope: userId,
            owner: tokenExitLockOwner,
        });
        if (!distributedTokenExitLock) {
            logger.warn(LogCode.EXE_TX_BROADCAST, 'Deferring position exit due to distributed wallet-token exit lock', {
                userId,
                token: tokenAddress,
                chainId,
                walletAddress: user?.walletAddress || null,
                reason: exitReason,
                lockKey: tokenExitLockKey,
            });
            return deferExitRetryOrThrow({
                intentDriven: intentDrivenExit,
                positions: exitPositions,
                targetWallet: config.targetWallet,
                exitReason,
                reasonCode: 'token_exit_lock_contended_distributed',
            });
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
                    const fallback = resolveSolanaDbBalanceFallback({
                        positions: exitPositions,
                        tokenDecimals: tokenInfo?.decimals ?? null,
                        fallbackDecimals: 6,
                    });
                    balance = fallback.balanceRaw;
                    decimals = fallback.decimals;
                    if (balance > 0n) {
                        usedDbBalanceFallback = true;
                        logger.warn(LogCode.API_FETCH_FAILED, 'Solana RPC exhausted during mirror sell — using DB position amount as balance fallback', {
                            userId, token: tokenAddress, balanceFallback: balance.toString(), decimals,
                            positionCount: exitPositions.length,
                            fallbackSource: fallback.usedSource,
                        });
                    } else {
                        await deferExitRetryOrThrow({
                            intentDriven: intentDrivenExit,
                            positions: exitPositions,
                            targetWallet: config.targetWallet,
                            exitReason,
                            reasonCode: 'solana_balance_rpc_exhausted_no_amount_fallback',
                        });
                        logger.warn(LogCode.API_FETCH_FAILED, 'Skipping Solana sell: RPC exhausted and no usable amount in DB positions', { userId, token: tokenAddress });
                        return null;
                    }
                } else {
                    await deferExitRetryOrThrow({
                        intentDriven: intentDrivenExit,
                        positions: exitPositions,
                        targetWallet: config.targetWallet,
                        exitReason,
                        reasonCode: 'solana_balance_rpc_exhausted_keep_open',
                    });
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
            if (balance <= 1000n) {
                const treatAsEmptyOrDust = balance <= 0n || balance <= 1000n || (hasValidPrice && balanceUsd < 0.1);
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
                    for (const position of exitPositions) {
                        markPositionLocallyClosed(position.id);
                    }

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
                        // Survival retries keep the same amount and only widen slippage.
                        // Reducing sell size here causes deterministic wallet leftovers.
                        // Retry with 1.5x slippage (Survival Mode)
                        const survivalSlippage = Math.min(Math.floor(universalSlippageBps * 1.5), 2500);
                        txHash = await executeSolanaSwap({
                            userId: user.privyDid,
                            tokenInMint: tokenAddress,
                            tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                            amountIn: attribution.sellAmountRaw.toString(),
                            slippageBps: survivalSlippage
                        });
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
                    for (const position of exitPlan.positions || []) {
                        void recordFollowerTransactionFactByPosition({
                            positionId: position.id,
                            kind: 'exit',
                            phase: 'skipped',
                            walletAddress: user.walletAddress,
                            reasonCode: exitPlan.attributedReasonCode || 'PENDING_EXPECTED_AMOUNT_UNAVAILABLE',
                            metadata: {
                                exitReason,
                                chainId,
                                attributionMetrics: exitPlan.attributionMetrics || null,
                            },
                        });
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
                    for (const position of exitPlan.positions || []) {
                        void recordFollowerTransactionFactByPosition({
                            positionId: position.id,
                            kind: 'exit',
                            phase: 'deferred',
                            walletAddress: user.walletAddress,
                            reasonCode: exitPlan.attributedReasonCode || 'EXIT_BALANCE_RPC_UNCERTAIN',
                            metadata: {
                                exitReason,
                                chainId,
                                attributionMetrics: retryMetrics,
                            },
                        });
                    }
                    await deferExitRetryOrThrow({
                        intentDriven: intentDrivenExit,
                        positions: exitPlan.positions,
                        targetWallet: config.targetWallet,
                        exitReason,
                        reasonCode: exitPlan.attributedReasonCode || 'EXIT_BALANCE_RPC_UNCERTAIN',
                    });
                    return null;
                }

                logger.throttled(LogCode.WTC_TX_SKIPPED, 'No-swap exit close applied', {
                    userId,
                    tokenAddress,
                    balanceUsd: exitPlan.balanceUsd,
                    reason: exitReason,
                    isMirrorSell: exitPlan.isMirrorSell,
                    closeReason: exitPlan.closeReason
                });
                await reconcileNoopExitPosition({
                    positions: exitPlan.positions as any,
                    action: exitPlan.action,
                    closeReason: exitPlan.closeReason
                });
                for (const position of exitPlan.positions) {
                    markPositionLocallyClosed(position.id);
                }
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
            for (const position of persistedExitPositions || []) {
                void recordFollowerTransactionFactByPosition({
                    positionId: position.id,
                    kind: 'exit',
                    phase: 'confirmed',
                    txHash,
                    walletAddress: user.walletAddress,
                    amountRaw: position.entryAmountExact ? String(position.entryAmountExact) : null,
                    reasonCode: 'ok_follower_exit_confirmed',
                    metadata: {
                        exitReason,
                        chainId,
                    },
                });
            }

            // Keep sell submission hot; tracking is non-critical.
            queueMicrotask(() => {
                try {
                    trackCopyTrade(userId);
                    trackSwap(userId, sellVolUsd);
                } catch (trackingError: any) {
                    logger.debug(LogCode.SYS_ERROR, 'Copytrade exit tracking failed', {
                        userId,
                        token: tokenAddress,
                        error: trackingError?.message || String(trackingError),
                    });
                }
            });


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

            void (async () => {
                try {
                    await publishCopytradeRawNotification({
                        dedupeKey: `position-exit-success:${user.privyDid}:${chainId}:${tokenAddress}:${txHash}`,
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
                } catch (notificationError: any) {
                    logger.debug(LogCode.SYS_ERROR, 'Copytrade exit success notification failed', {
                        userId,
                        token: tokenAddress,
                        txHash,
                        error: notificationError?.message || String(notificationError),
                    });
                }
            })();
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
        for (const position of exitPositions || []) {
            void recordFollowerTransactionFactByPosition({
                positionId: position.id,
                kind: 'exit',
                phase: 'failed',
                walletAddress: user.walletAddress,
                reasonCode: String(error?.message || 'exit_failed').slice(0, 120),
                metadata: {
                    exitReason,
                    chainId,
                },
            });
        }

        if (intentDrivenExit) {
            throw error;
        }

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
                    nextRetryIn: `${Math.max(1, EXIT_RETRY_COOLDOWN_MS / 1000)}s`,
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
                    void publishCopytradeRawNotification({
                        dedupeKey: `position-exit-failure:${user.privyDid}:${chainId}:${tokenAddress}:${exitReason}`,
                        userId: user.privyDid,
                        farcasterFid: user.farcasterFid,
                        type: 'TRADE_FAILURE',
                        data: {
                            tokenSymbol: tokenInfo?.symbol || 'Unknown',
                            error: `Failed to exit after ${MAX_EXIT_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            targetWallet: config.targetWallet,
                            chainId: chainId
                        }
                    }).catch((notificationError: any) => {
                        logger.debug(LogCode.SYS_ERROR, 'Copytrade exit failure notification failed', {
                            userId,
                            token: tokenAddress,
                            error: notificationError?.message || String(notificationError),
                        });
                    });
                }
            }
        } catch (dbErr: any) {
            logger.error(LogCode.SYS_ERROR, 'Failed to update position retry counter', { error: dbErr.message });
        }

        return null;
    } finally {
        await releaseDistributedTokenExitLock(distributedTokenExitLock);
        if (tokenExitLockAcquired) {
            releaseTokenExitLock(tokenExitLockKey, tokenExitLockOwner);
        }
    }
}


export async function checkPositionsForExits(): Promise<void> {
    pruneTpslTracker();
    const positionStatusCompat = await getPositionStatusCompat();

    // 🔄 STEP 0: Retry failed exit attempts (Mirror Sell, Take Profit, Stop Loss)
    // Check for positions with exitRetryCount > 0 and retry them if cooldown has passed.
    const positionsNeedingRetry = await prisma.position.findMany({
        where: {
            status: 'open',
            exitRetryCount: { gt: 0, lte: MAX_EXIT_RETRIES },
            OR: [
                { lastExitAttempt: null }, // Never attempted (shouldn't happen, but handle it)
                { lastExitAttempt: { lt: new Date(Date.now() - EXIT_RETRY_COOLDOWN_MS) } }
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

    const activeIntentPositionIds = await listActiveExitIntentPositionIds(positionsNeedingRetry.map((position) => position.id));
    const retryablePositions = positionsNeedingRetry.filter((position) => {
        if (activeIntentPositionIds.has(position.id)) {
            return false;
        }
        const exitReason = String((position as any).exitReason || '').toLowerCase();
        if (exitReason === 'take_profit' || exitReason === 'stop_loss' || exitReason === 'dynamic_take_profit') {
            return false;
        }
        return !hasRecentInflightExitRetryGuard({
            exitTxHash: (position as any).exitTxHash,
            lastExitAttempt: position.lastExitAttempt,
            graceMs: EXIT_INFLIGHT_RETRY_GRACE_MS,
        });
    });

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

                const tokenInfo = await getGuardPriceSnapshot(position.tokenAddress, position.chainId, {
                    priority: 'high',
                    rpcStrategy: TRADE_METADATA_PROFILE,
                });
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

    const tokenPriceMap = new Map<string, any>();
    for (const { address, chainId } of uniqueTokens.values()) {
        const snapshot = cacheHub.getTokenPriceSnapshot(address, chainId);
        if (snapshot) {
            tokenPriceMap.set(`${address.toLowerCase()}_${chainId}`, snapshot);
        }
    }

    // 3. Process positions in PARALLEL (with batching)
    const POSITION_BATCH_SIZE = 20; // Process 20 positions at a time
    for (let i = 0; i < positions.length; i += POSITION_BATCH_SIZE) {
        const batch = positions.slice(i, i + POSITION_BATCH_SIZE);

        await Promise.all(batch.map(async (position) => {
            // Skip if this position is already being processed
            if (positionsBeingExited.has(position.id)) return;

            try {
                // STEP A: Use cached price data only. If no cached price exists, skip this cycle.
                const tokenKey = `${position.tokenAddress.toLowerCase()}_${position.chainId}`;
                const tokenInfo = tokenPriceMap.get(tokenKey);

                const staleOpenRepair = await reconcileStaleOpenClosedPosition({
                    position: {
                        id: position.id,
                        status: position.status,
                        exitReason: position.exitReason,
                        exitTxHash: position.exitTxHash,
                        closedAt: position.closedAt,
                        tokenAddress: position.tokenAddress,
                        tokenSymbol: position.tokenSymbol,
                        chainId: position.chainId,
                        userId: position.userId,
                        configId: position.configId,
                    },
                });
                if (staleOpenRepair.repaired) {
                    markPositionLocallyClosed(position.id);
                    return;
                }

                const mirrorSellDustReconciliation = await reconcileMirrorSellDustPosition({
                    position: {
                        id: position.id,
                        exitReason: position.exitReason,
                        status: position.status,
                        tokenAddress: position.tokenAddress,
                        chainId: position.chainId,
                        tokenSymbol: position.tokenSymbol,
                        userId: position.userId,
                        configId: position.configId,
                    },
                    walletAddress: position.user?.walletAddress,
                    currentPrice: Number(tokenInfo?.price || 0),
                });
                if (mirrorSellDustReconciliation.closed) {
                    markPositionLocallyClosed(position.id);
                    return;
                }

                if (!tokenInfo) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'TP/SL check skipped: Price not available', {
                        positionId: position.id,
                        token: resolveDisplayTokenSymbol(position.tokenSymbol, position.tokenAddress),
                        chainId: position.chainId,
                        configId: position.configId
                    });
                    return;
                }

                // STEP B: Check for TP/SL
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

                const autoExitPriceGuard = evaluateAutoExitPriceGuard({ tokenInfo });
                if (!autoExitPriceGuard.allowed) {
                    clearTpslHit(position.id);
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'TP/SL guard: anomalous price feed blocked auto-exit', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        chainId: position.chainId,
                        reasonCode: autoExitPriceGuard.reasonCode,
                        ...autoExitPriceGuard.metrics,
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
