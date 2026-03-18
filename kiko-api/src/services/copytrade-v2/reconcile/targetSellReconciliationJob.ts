import { Prisma } from '@prisma/client';
import { ethers } from 'ethers';
import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { classifyCopytradeAssetEligibility } from '../../copytradeAssetEligibility.js';
import { verifyTargetFullExit, formatTargetRemainingBalance } from './targetSellFullExitVerifier.js';
import { armPendingAttributedPositionsForMirrorSell } from '../positions/pendingAttributedPositionLedger.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { applyCopytradeStateEvent } from '../state/copytradeStateRuntime.js';
import { resolveTargetSellLink } from './copytradeTargetSellLinkResolver.js';
import {
  findLedgerFirstReconcileOpenCandidates,
  findLedgerFirstReconcilePendingCandidates,
} from '../ledger/copytradeLedgerSelectors.js';
import { emitCopytradeSummaryAudit } from '../audit/copytradeSummaryAudit.js';
import {
  buildTargetSellEventPayload,
  persistTargetSellEventAndSchedulePositions,
} from '../exit/positionExitIntentScheduler.js';
import { findRecentTargetSellEvents, replaceTargetSellEventMetadata } from '../exit/targetSellEventStore.js';
import {
  cloneTargetSellEventReconcileMetadata,
  isTargetSellEventConfigDue,
  markTargetSellEventConfigResolved,
  markTargetSellEventConfigRetry,
} from '../exit/targetSellEventReconcileState.js';
import { normalizeToken, normalizeWallet } from '../runtime/chainIdentityNormalizer.js';
import {
  readEvmTokenBalanceFast,
  readEvmTokenDecimalsFast,
  readSolanaTokenBalanceFast,
} from '../../rpc/balanceRpcReader.js';

const TARGET_SELL_RECONCILE_WINDOW_MS = Math.max(60_000, Number(process.env.COPYTRADE_TARGET_SELL_RECONCILE_WINDOW_MS || '21600000'));
const TARGET_SELL_EVENT_RECONCILE_LOOKBACK_MS = Math.max(
  15 * 60_000,
  Number(process.env.COPYTRADE_TARGET_SELL_EVENT_RECONCILE_LOOKBACK_MS || '3600000'),
);
const TARGET_SELL_EVENT_RECONCILE_BATCH_SIZE = Math.max(
  20,
  Number(process.env.COPYTRADE_TARGET_SELL_EVENT_RECONCILE_BATCH_SIZE || '120'),
);
const TARGET_SELL_POSITION_SWEEP_INTERVAL_MS = Math.max(
  5 * 60_000,
  Number(process.env.COPYTRADE_TARGET_SELL_POSITION_SWEEP_INTERVAL_MS || '900000'),
);
const ORPHAN_RECOVERY_ENTRY_TX_PREFIX = 'RECOVERED_ONCHAIN_';
const ORPHAN_RECOVERY_LEADER_TX_PREFIX = 'ORPHAN_RECOVERY_';
const ORPHAN_RECOVERY_RESIDUAL_RATIO_SKIP_BPS = Math.max(
  0,
  Number(process.env.COPYTRADE_ORPHAN_RECOVERY_RESIDUAL_RATIO_SKIP_BPS || '500')
);

type RecentTargetSellSignal = {
  chainId: number;
  targetWallet: string;
  tokenAddress: string;
  targetSellTxHash: string;
  tokenSymbol: string | null;
  amountIn: string | null;
  blockTimestamp: Date;
};

type WalletTransactionSellRow = {
  walletAddress: string;
  chainId: number | null;
  txHash: string;
  txType: string;
  tokenAddress: string | null;
  tokenInAddress: string | null;
  tokenSymbol: string | null;
  tokenInSymbol: string | null;
  amountIn: string | null;
  blockTimestamp: Date;
};

let lastTrackedPositionSweepAt = 0;

function computeDustThresholdRaw(decimals: number): bigint {
  const normalized = Math.max(0, Number.isFinite(decimals) ? Math.floor(decimals) : 0);
  const exponent = normalized > 6 ? normalized - 6 : 0;
  return 10n ** BigInt(exponent);
}

function parsePositiveBigInt(value: unknown): bigint {
  const raw = String(value || '').trim();
  if (!raw || !/^\d+$/.test(raw)) return 0n;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

export function shouldSkipOrphanRecoveryResidual(params: {
  followerBalanceRaw: bigint;
  targetSellAmountRaw?: bigint;
  skipRatioBps?: number;
}): boolean {
  const followerBalanceRaw = params.followerBalanceRaw > 0n ? params.followerBalanceRaw : 0n;
  const targetSellAmountRaw = params.targetSellAmountRaw && params.targetSellAmountRaw > 0n
    ? params.targetSellAmountRaw
    : 0n;
  const skipRatioBps = Number.isFinite(params.skipRatioBps)
    ? Math.max(0, Math.floor(Number(params.skipRatioBps)))
    : ORPHAN_RECOVERY_RESIDUAL_RATIO_SKIP_BPS;
  if (skipRatioBps <= 0 || followerBalanceRaw <= 0n || targetSellAmountRaw <= 0n) return false;
  return (followerBalanceRaw * 10_000n) <= (targetSellAmountRaw * BigInt(skipRatioBps));
}

export function shouldSkipOrphanRecoveryForResolvedMirrorSell(params: {
  hasResolvedMirrorSellForTargetSell: boolean;
}): boolean {
  return params.hasResolvedMirrorSellForTargetSell === true;
}

function resolveSellSignalTokenAddress(row: WalletTransactionSellRow): string | null {
  if (String(row.txType || '').toUpperCase() === 'TARGET_TOKEN_SWAP') {
    return row.tokenInAddress || null;
  }
  return row.tokenInAddress || row.tokenAddress || null;
}

function resolveSellSignalTokenSymbol(row: WalletTransactionSellRow): string | null {
  if (String(row.txType || '').toUpperCase() === 'TARGET_TOKEN_SWAP') {
    return row.tokenInSymbol || row.tokenSymbol || null;
  }
  return row.tokenInSymbol || row.tokenSymbol || null;
}

export function resolveRecentTargetSellSignals(rows: WalletTransactionSellRow[]): RecentTargetSellSignal[] {
  const deduped = new Map<string, RecentTargetSellSignal>();
  for (const row of rows) {
    const chainId = Number(row.chainId || 0);
    if (!chainId) continue;
    const targetWallet = normalizeWallet(chainId, row.walletAddress);
    const tokenAddress = normalizeToken(chainId, resolveSellSignalTokenAddress(row));
    const targetSellTxHash = String(row.txHash || '').trim();
    if (!targetWallet || !tokenAddress || !targetSellTxHash) continue;
    const signal: RecentTargetSellSignal = {
      chainId,
      targetWallet,
      tokenAddress,
      targetSellTxHash,
      tokenSymbol: resolveSellSignalTokenSymbol(row),
      amountIn: row.amountIn || null,
      blockTimestamp: row.blockTimestamp,
    };
    const key = `${chainId}:${targetWallet}:${tokenAddress}:${targetSellTxHash.toLowerCase()}`;
    const existing = deduped.get(key);
    if (!existing || existing.blockTimestamp.getTime() < signal.blockTimestamp.getTime()) {
      deduped.set(key, signal);
    }
  }
  return [...deduped.values()].sort((left, right) => right.blockTimestamp.getTime() - left.blockTimestamp.getTime());
}

export function buildOrphanRecoveryMarkers(targetSellTxHash: string): {
  entryTxHash: string;
  leaderTxHash: string;
} {
  const normalized = String(targetSellTxHash || '').trim().toLowerCase();
  return {
    entryTxHash: `${ORPHAN_RECOVERY_ENTRY_TX_PREFIX}${normalized}`,
    leaderTxHash: `${ORPHAN_RECOVERY_LEADER_TX_PREFIX}${normalized}`,
  };
}

async function loadFollowerTokenBalance(params: {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
}): Promise<{ balanceRaw: bigint; decimals: number }> {
  if (params.chainId === 900) {
    return readSolanaTokenBalanceFast({
      walletAddress: params.walletAddress,
      tokenAddress: params.tokenAddress,
      path: 'copytrade_orphan_recovery_balance',
    });
  }
  const [balanceRaw, decimals] = await Promise.all([
    readEvmTokenBalanceFast({
      tokenAddress: params.tokenAddress,
      walletAddress: params.walletAddress,
      chainId: params.chainId,
      path: 'copytrade_orphan_recovery_balance',
      lane: 'critical',
    }),
    readEvmTokenDecimalsFast({
      tokenAddress: params.tokenAddress,
      chainId: params.chainId,
      path: 'copytrade_orphan_recovery_decimals',
      lane: 'critical',
    }).catch(() => 18),
  ]);
  return { balanceRaw, decimals };
}

async function hasActivePositionContext(params: {
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
}): Promise<boolean> {
  const position = await prisma.position.findFirst({
    where: {
      userId: params.userId,
      configId: params.configId,
      chainId: params.chainId,
      tokenAddress: {
        equals: params.tokenAddress,
        mode: 'insensitive',
      },
      status: { in: ['open', 'pending'] },
    },
    select: { id: true },
  });
  return Boolean(position?.id);
}

async function loadFollowerRecoveryEvidence(params: {
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
  targetSellTxHash: string;
}): Promise<{
  hasActivePosition: boolean;
  hasPendingAttributedLot: boolean;
  hasLedgerContext: boolean;
  hasResolvedMirrorSellForTargetSell: boolean;
}> {
  const normalizedTargetSellTxHash = String(params.targetSellTxHash || '').trim().toLowerCase();
  const [hasActivePosition, pendingLot, ledger, resolvedMirrorSell] = await Promise.all([
    hasActivePositionContext(params),
    prisma.pendingAttributedPosition.findFirst({
      where: {
        userId: params.userId,
        chainId: params.chainId,
        tokenAddress: {
          equals: params.tokenAddress,
          mode: 'insensitive',
        },
        status: { in: ['armed', 'sell_armed', 'consumed'] },
        position: {
          configId: params.configId,
        },
      },
      select: { id: true },
    }),
    prisma.copytradePositionLedger.findFirst({
      where: {
        userId: params.userId,
        configId: params.configId,
        chainId: params.chainId,
        tokenAddress: {
          equals: params.tokenAddress,
          mode: 'insensitive',
        },
        OR: [
          { positionIdLegacy: { not: null } },
          { pendingLotIdLegacy: { not: null } },
          { leaderBuyTxHash: { not: null } },
          { followerBuyTxHash: { not: null } },
        ],
      },
      select: { id: true },
    }),
    prisma.copytradePositionLedger.findFirst({
      where: {
        userId: params.userId,
        configId: params.configId,
        chainId: params.chainId,
        tokenAddress: {
          equals: params.tokenAddress,
          mode: 'insensitive',
        },
        targetSellTxHash: normalizedTargetSellTxHash,
        OR: [
          { followerExitTxHash: { not: null } },
          { closedAt: { not: null } },
          { lifecycleState: { in: ['closed', 'exit_confirmed', 'consumed', 'fully_exited'] } },
          { exitExecutionState: { in: ['EXIT_CONFIRMED', 'confirmed_success'] } },
          { lastExecutionState: { in: ['EXIT_CONFIRMED', 'confirmed_success'] } },
        ],
      },
      select: { id: true },
    }),
  ]);
  return {
    hasActivePosition,
    hasPendingAttributedLot: Boolean(pendingLot?.id),
    hasLedgerContext: Boolean(ledger?.id),
    hasResolvedMirrorSellForTargetSell: Boolean(resolvedMirrorSell?.id),
  };
}

async function createOrReuseRecoveredPosition(params: {
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string | null;
  targetSellTxHash: string;
  balanceRaw: bigint;
  decimals: number;
}): Promise<{
  id: string;
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
  entryAmountExact: string | null;
  entryAmountDec: string | null;
  status: string;
  created: boolean;
}> {
  const markers = buildOrphanRecoveryMarkers(params.targetSellTxHash);
  const humanAmount = ethers.formatUnits(params.balanceRaw, params.decimals);
  const existing = await prisma.position.findFirst({
    where: {
      userId: params.userId,
      configId: params.configId,
      chainId: params.chainId,
      tokenAddress: {
        equals: params.tokenAddress,
        mode: 'insensitive',
      },
      leaderTxHash: markers.leaderTxHash,
    },
    select: {
      id: true,
      userId: true,
      configId: true,
      chainId: true,
      tokenAddress: true,
      entryAmountExact: true,
      entryAmountDec: true,
      status: true,
    },
  });
  if (existing) {
    return {
      ...existing,
      entryAmountDec: existing.entryAmountDec ? String(existing.entryAmountDec) : null,
      created: false,
    };
  }

  try {
    const created = await prisma.position.create({
      data: {
        userId: params.userId,
        configId: params.configId,
        chainId: params.chainId,
        tokenAddress: params.tokenAddress,
        tokenSymbol: params.tokenSymbol || 'UNKNOWN',
        entryPrice: 0,
        entryAmount: humanAmount,
        entryAmountDec: humanAmount,
        entryAmountExact: params.balanceRaw.toString(),
        entryTxHash: markers.entryTxHash,
        leaderTxHash: markers.leaderTxHash,
        entryUsdValue: 0,
        status: 'open',
        exitReason: 'mirror_sell',
        exitRetryCount: 1,
        lastExitAttempt: null,
      },
      select: {
        id: true,
        userId: true,
        configId: true,
        chainId: true,
        tokenAddress: true,
        entryAmountExact: true,
        entryAmountDec: true,
        status: true,
      },
    });
    return {
      ...created,
      entryAmountDec: created.entryAmountDec ? String(created.entryAmountDec) : null,
      created: true,
    };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }
    const raced = await prisma.position.findFirst({
      where: {
        userId: params.userId,
        configId: params.configId,
        chainId: params.chainId,
        tokenAddress: {
          equals: params.tokenAddress,
          mode: 'insensitive',
        },
        leaderTxHash: markers.leaderTxHash,
      },
      select: {
        id: true,
        userId: true,
        configId: true,
        chainId: true,
        tokenAddress: true,
        entryAmountExact: true,
        entryAmountDec: true,
        status: true,
      },
    });
    if (!raced) throw error;
    return {
      ...raced,
      entryAmountDec: raced.entryAmountDec ? String(raced.entryAmountDec) : null,
      created: false,
    };
  }
}

async function recoverMissingOrphanMirrorSellPositions(params: {
  hasInFlightMirrorSellOrder: typeof hasInFlightMirrorSellOrder;
}): Promise<{ recoveredOrphans: number; scheduledRecoveredOrphans: number }> {
  const activeConfigs = await prisma.copyTradeConfig.findMany({
    where: {
      status: 'active',
      mirrorSell: true,
    },
    include: {
      user: {
        select: {
          walletAddress: true,
          solanaWalletAddress: true,
        },
      },
    },
  });
  if (activeConfigs.length === 0) {
    return { recoveredOrphans: 0, scheduledRecoveredOrphans: 0 };
  }

  const configMap = new Map<string, typeof activeConfigs>();
  for (const config of activeConfigs) {
    const key = `${config.chainId}:${normalizeWallet(config.chainId, config.targetWallet)}`;
    const existing = configMap.get(key) || [];
    existing.push(config);
    configMap.set(key, existing);
  }

  const chainIds = [...new Set(activeConfigs.map((config) => config.chainId).filter((value) => Number.isFinite(value)))];
  const targetWallets = [...new Set(activeConfigs.map((config) => normalizeWallet(config.chainId, config.targetWallet)).filter(Boolean))];
  if (chainIds.length === 0 || targetWallets.length === 0) {
    return { recoveredOrphans: 0, scheduledRecoveredOrphans: 0 };
  }

  const events = await findRecentTargetSellEvents({
    chainIds,
    targetWallets,
    detectedAfter: new Date(Date.now() - TARGET_SELL_EVENT_RECONCILE_LOOKBACK_MS),
    take: TARGET_SELL_EVENT_RECONCILE_BATCH_SIZE,
  });
  let recoveredOrphans = 0;
  let scheduledRecoveredOrphans = 0;

  for (const event of events) {
    const assetEligibility = classifyCopytradeAssetEligibility({
      chainId: event.chainId,
      tokenAddress: event.tokenAddress,
    });
    if (!assetEligibility.allowed) continue;

    const configs = configMap.get(`${event.chainId}:${event.targetWallet}`) || [];
    if (configs.length === 0) continue;

    let metadata = cloneTargetSellEventReconcileMetadata(event.metadata);
    let metadataChanged = false;
    const now = new Date();
    const dueConfigs = configs.filter((config) => isTargetSellEventConfigDue(metadata, config.id, now.getTime()));
    if (dueConfigs.length === 0) continue;

    const fullExit = event.targetFullExitVerified
      ? {
        isFullExit: true,
        reasonCode: 'TARGET_SELL_EVENT_PERSISTED_FULL_EXIT',
        remainingBalanceRaw: event.targetRemainingBalanceRaw || '0',
        dustThresholdRaw: '0',
      }
      : await verifyTargetFullExit({
        targetWallet: event.targetWallet,
        chainId: event.chainId,
        tokenAddress: event.tokenAddress,
      });

    if (!fullExit.isFullExit) {
      for (const config of dueConfigs) {
        markTargetSellEventConfigResolved({
          metadata,
          configId: config.id,
          blockedReason: 'target_not_full_exit',
          reasonCode: fullExit.reasonCode || 'TARGET_SELL_BALANCE_UNVERIFIED',
          now,
        });
        metadataChanged = true;
      }
      if (metadataChanged) {
        await replaceTargetSellEventMetadata(event.id, metadata).catch(() => null);
      }
      continue;
    }

    for (const config of dueConfigs) {
      const hasInFlight = await params.hasInFlightMirrorSellOrder({
        userId: config.userId,
        configId: config.id,
        chainId: event.chainId,
        tokenAddress: event.tokenAddress,
      });
      if (hasInFlight) {
        markTargetSellEventConfigResolved({
          metadata,
          configId: config.id,
          blockedReason: 'inflight',
          reasonCode: 'reconcile_inflight_exit_order',
          now,
        });
        metadataChanged = true;
        continue;
      }

      const recoveryEvidence = await loadFollowerRecoveryEvidence({
        userId: config.userId,
        configId: config.id,
        chainId: event.chainId,
        tokenAddress: event.tokenAddress,
        targetSellTxHash: event.targetSellTxHash,
      });
      if (recoveryEvidence.hasActivePosition) {
        markTargetSellEventConfigResolved({
          metadata,
          configId: config.id,
          blockedReason: 'active_position_present',
          reasonCode: 'orphan_recovery_active_position_present',
          now,
        });
        metadataChanged = true;
        continue;
      }
      if (shouldSkipOrphanRecoveryForResolvedMirrorSell({
        hasResolvedMirrorSellForTargetSell: recoveryEvidence.hasResolvedMirrorSellForTargetSell,
      })) {
        markTargetSellEventConfigResolved({
          metadata,
          configId: config.id,
          blockedReason: 'resolved_mirror_sell_present',
          reasonCode: 'orphan_recovery_resolved_mirror_sell_present',
          now,
        });
        metadataChanged = true;
        continue;
      }
      if (!recoveryEvidence.hasPendingAttributedLot && !recoveryEvidence.hasLedgerContext) {
        const retry = markTargetSellEventConfigRetry({
          metadata,
          configId: config.id,
          blockedReason: 'missing_follower_evidence',
          reasonCode: 'orphan_recovery_evidence_missing',
          now,
        });
        metadataChanged = true;
        if (retry.shouldAudit) {
          emitCopytradeDomainAudit('mirror_sell_idempotent_skip', {
            extra: {
              userId: config.userId,
              configId: config.id,
              chainId: event.chainId,
              tokenAddress: event.tokenAddress,
              targetWallet: event.targetWallet,
              targetSellTxHash: event.targetSellTxHash,
              blockedReason: 'missing_follower_evidence',
              reasonCode: retry.exhausted
                ? 'orphan_recovery_evidence_missing_exhausted'
                : 'orphan_recovery_evidence_missing',
              retryAttemptCount: retry.attemptCount,
              retryExhausted: retry.exhausted,
              retryAfterMs: retry.nextRetryAt ? Math.max(0, retry.nextRetryAt.getTime() - now.getTime()) : null,
            },
          });
        }
        continue;
      }

      const followerWallet = event.chainId === 900
        ? String(config.user?.solanaWalletAddress || '').trim()
        : normalizeWallet(event.chainId, config.user?.walletAddress || '');
      if (!followerWallet) {
        markTargetSellEventConfigResolved({
          metadata,
          configId: config.id,
          blockedReason: 'missing_follower_wallet',
          reasonCode: 'orphan_recovery_missing_follower_wallet',
          now,
        });
        metadataChanged = true;
        continue;
      }

      const followerBalance = await loadFollowerTokenBalance({
        chainId: event.chainId,
        walletAddress: followerWallet,
        tokenAddress: event.tokenAddress,
      }).catch(() => null);
      if (!followerBalance) {
        const retry = markTargetSellEventConfigRetry({
          metadata,
          configId: config.id,
          blockedReason: 'follower_balance_unavailable',
          reasonCode: 'orphan_recovery_balance_unavailable',
          now,
        });
        metadataChanged = true;
        if (retry.shouldAudit) {
          emitCopytradeDomainAudit('mirror_sell_idempotent_skip', {
            extra: {
              userId: config.userId,
              configId: config.id,
              chainId: event.chainId,
              tokenAddress: event.tokenAddress,
              targetWallet: event.targetWallet,
              targetSellTxHash: event.targetSellTxHash,
              blockedReason: 'follower_balance_unavailable',
              reasonCode: retry.exhausted
                ? 'orphan_recovery_balance_unavailable_exhausted'
                : 'orphan_recovery_balance_unavailable',
              retryAttemptCount: retry.attemptCount,
              retryExhausted: retry.exhausted,
            },
          });
        }
        continue;
      }

      const dustThresholdRaw = computeDustThresholdRaw(followerBalance.decimals);
      if (followerBalance.balanceRaw <= dustThresholdRaw) {
        markTargetSellEventConfigResolved({
          metadata,
          configId: config.id,
          blockedReason: 'follower_balance_dust',
          reasonCode: 'orphan_recovery_balance_dust',
          now,
        });
        metadataChanged = true;
        continue;
      }
      const targetSellAmountRaw = parsePositiveBigInt((event.metadata as Record<string, unknown> | null)?.targetSellAmountRaw);
      if (shouldSkipOrphanRecoveryResidual({
        followerBalanceRaw: followerBalance.balanceRaw,
        targetSellAmountRaw,
      })) {
        logger.info(LogCode.WTC_TX_SKIPPED, '[TargetSellReconcile] Skip orphan recovery for residual tail balance', {
          userId: config.userId,
          configId: config.id,
          chainId: event.chainId,
          tokenAddress: event.tokenAddress,
          targetWallet: event.targetWallet,
          targetSellTxHash: event.targetSellTxHash,
          followerWallet,
          followerBalanceRaw: followerBalance.balanceRaw.toString(),
          targetSellAmountRaw: targetSellAmountRaw.toString(),
          residualRatioBps: Number((followerBalance.balanceRaw * 10_000n) / targetSellAmountRaw),
          residualSkipBps: ORPHAN_RECOVERY_RESIDUAL_RATIO_SKIP_BPS,
          reasonCode: 'orphan_recovery_residual_tail_skip',
        });
        markTargetSellEventConfigResolved({
          metadata,
          configId: config.id,
          blockedReason: 'residual_tail_balance',
          reasonCode: 'orphan_recovery_residual_tail_skip',
          now,
        });
        metadataChanged = true;
        continue;
      }

      const recoveredPosition = await createOrReuseRecoveredPosition({
        userId: config.userId,
        configId: config.id,
        chainId: event.chainId,
        tokenAddress: event.tokenAddress,
        tokenSymbol: String((event.metadata as Record<string, unknown> | null)?.tokenSymbol || '') || null,
        targetSellTxHash: event.targetSellTxHash,
        balanceRaw: followerBalance.balanceRaw,
        decimals: followerBalance.decimals,
      });
      if (String(recoveredPosition.status || '').toLowerCase() === 'closed') continue;

      recoveredOrphans += recoveredPosition.created ? 1 : 0;
      emitCopytradeDomainAudit('FOLLOWER_ORPHAN_POSITION_ADOPTED', {
        extra: {
          userId: config.userId,
          configId: config.id,
          positionId: recoveredPosition.id,
          tokenAddress: event.tokenAddress,
          chainId: event.chainId,
          targetWallet: event.targetWallet,
          targetSellTxHash: event.targetSellTxHash,
          followerWallet,
          balanceRaw: followerBalance.balanceRaw.toString(),
          dustThresholdRaw: dustThresholdRaw.toString(),
          recoveryCreated: recoveredPosition.created,
          reasonCode: 'verified_target_full_exit_orphan_balance_detected',
        },
      });

      const scheduled = await persistTargetSellEventAndSchedulePositions({
        event: buildTargetSellEventPayload({
          chainId: event.chainId,
          targetWallet: event.targetWallet,
          tokenAddress: event.tokenAddress,
          targetSellTxHash: event.targetSellTxHash,
          targetFullExitVerified: true,
          targetRemainingBalanceRaw: fullExit.remainingBalanceRaw || null,
          source: 'reconcile',
          metadata: {
            orphanRecovery: true,
            targetFullExitReasonCode: fullExit.reasonCode,
            orphanRecoveryDetectedAt: event.detectedAt.toISOString(),
          },
        }),
        positions: [{
          id: recoveredPosition.id,
          userId: recoveredPosition.userId,
          configId: recoveredPosition.configId,
          chainId: recoveredPosition.chainId,
          tokenAddress: recoveredPosition.tokenAddress,
          entryAmountExact: recoveredPosition.entryAmountExact,
          entryAmountDec: recoveredPosition.entryAmountDec,
        }],
        priority: 245,
        metadata: {
          reconcileScheduled: true,
          orphanRecovery: true,
        },
      }).catch(() => null);

      if (scheduled && scheduled.scheduled > 0) {
        metadata = cloneTargetSellEventReconcileMetadata(scheduled.event.metadata);
        markTargetSellEventConfigResolved({
          metadata,
          configId: config.id,
          blockedReason: 'scheduled',
          reasonCode: 'orphan_recovery_exit_scheduled',
          now,
        });
        metadataChanged = true;
        scheduledRecoveredOrphans += scheduled.scheduled;
        emitCopytradeDomainAudit('FOLLOWER_ORPHAN_EXIT_SCHEDULED', {
          extra: {
            userId: config.userId,
            configId: config.id,
            positionId: recoveredPosition.id,
            tokenAddress: event.tokenAddress,
            chainId: event.chainId,
            targetWallet: event.targetWallet,
            targetSellTxHash: event.targetSellTxHash,
            reasonCode: 'orphan_recovery_exit_scheduled',
          },
        });
      }
    }

    if (metadataChanged) {
      await replaceTargetSellEventMetadata(event.id, metadata).catch(() => null);
    }
  }

  return { recoveredOrphans, scheduledRecoveredOrphans };
}

async function hasInFlightMirrorSellOrder(params: {
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
}): Promise<boolean> {
  const order = await prisma.copytradeOrder.findFirst({
    where: {
      userId: params.userId,
      configId: params.configId,
      chainId: params.chainId,
      direction: 'sell',
      closedAt: null,
      lifecycleState: { in: ['EXIT_SUBMITTING', 'EXIT_ACCEPTED'] },
      tokenIn: {
        equals: params.tokenAddress,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  });
  return Boolean(order?.id);
}

export async function runTargetSellReconciliationCycle(): Promise<{
  scannedOpen: number;
  scannedPending: number;
  armedPending: number;
  scheduledOpen: number;
  fullExitMatches: number;
  recoveredOrphans: number;
  scheduledRecoveredOrphans: number;
}> {
  const createdAfter = new Date(Date.now() - TARGET_SELL_RECONCILE_WINDOW_MS);
  const nowMs = Date.now();
  const shouldRunTrackedPositionSweep = nowMs - lastTrackedPositionSweepAt >= TARGET_SELL_POSITION_SWEEP_INTERVAL_MS;
  let scannedOpen = 0;
  let scannedPending = 0;
  let armedPending = 0;
  let scheduledOpen = 0;
  let fullExitMatches = 0;

  const openCandidates = shouldRunTrackedPositionSweep
    ? await findLedgerFirstReconcileOpenCandidates({ createdAfter })
    : [];

  for (const position of openCandidates) {
    const assetEligibility = classifyCopytradeAssetEligibility({
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
    });
    if (!assetEligibility.allowed) continue;
    scannedOpen += 1;
    const fullExit = await verifyTargetFullExit({
      targetWallet: position.config.targetWallet,
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
    });
    if (!fullExit.isFullExit) continue;
    const latestSell = await resolveTargetSellLink({
      targetWallet: position.config.targetWallet,
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
      leaderBuyTxHash: position.leaderTxHash,
      positionCreatedAt: position.createdAt,
      allowUnanchoredVerifiedFallback: true,
      targetFullExitVerified: true,
    });
    if (!latestSell.txHash) continue;
    const hasInFlight = await hasInFlightMirrorSellOrder({
      userId: position.userId,
      configId: position.configId,
      chainId: position.chainId,
      tokenAddress: position.tokenAddress,
    });
    if (hasInFlight) {
      emitCopytradeDomainAudit('mirror_sell_idempotent_skip', {
        extra: {
          userId: position.userId,
          tokenAddress: position.tokenAddress,
          chainId: position.chainId,
          targetWallet: position.config.targetWallet,
          targetSellTxHash: latestSell.txHash,
          blockedReason: 'inflight',
          reasonCode: 'reconcile_inflight_exit_order',
        },
      });
      continue;
    }
    fullExitMatches += 1;
    emitCopytradeDomainAudit('TARGET_FULL_EXIT_VERIFIED', {
      extra: {
        userId: position.userId,
        tokenAddress: position.tokenAddress,
        chainId: position.chainId,
        targetWallet: position.config.targetWallet,
        targetSellTxHash: latestSell.txHash,
        reasonCode: fullExit.reasonCode,
        remainingBalanceRaw: fullExit.remainingBalanceRaw,
      }
    });

    const updated = await prisma.position.updateMany({
      where: {
        id: position.id,
        status: 'open',
        OR: [
          { exitReason: null },
          { exitReason: { not: 'mirror_sell' } },
          { exitRetryCount: 0 },
        ],
      },
      data: {
        exitReason: 'mirror_sell',
        exitRetryCount: 1,
        lastExitAttempt: null,
      },
    });
    if (updated.count > 0) {
      await applyCopytradeStateEvent({
        event: { type: 'TARGET_FULL_EXIT_VERIFIED' },
        chainId: position.chainId,
        tokenAddress: position.tokenAddress,
        targetWallet: position.config.targetWallet,
        positionIds: [position.id],
        targetFullExitVerified: true,
        targetSellTxHash: latestSell.txHash,
        lastExecutionState: 'target_full_exit_verified',
        lastExecutionReasonCode: fullExit.reasonCode,
      });
      scheduledOpen += updated.count;
      logger.info(LogCode.SYS_INFO, '[TargetSellReconcile] Scheduled open position for mirror-sell retry after strict full-exit verification', {
        positionId: position.id,
        userId: position.userId,
        token: position.tokenAddress,
        chainId: position.chainId,
        targetWallet: position.config.targetWallet,
        targetSellTxHash: latestSell.txHash,
        remainingBalanceRaw: fullExit.remainingBalanceRaw,
        remainingBalance: formatTargetRemainingBalance(fullExit),
        dustThresholdRaw: fullExit.dustThresholdRaw,
        reasonCode: fullExit.reasonCode,
      });
      await persistTargetSellEventAndSchedulePositions({
        event: buildTargetSellEventPayload({
          chainId: position.chainId,
          targetWallet: position.config.targetWallet,
          tokenAddress: position.tokenAddress,
          targetSellTxHash: latestSell.txHash,
          targetFullExitVerified: true,
          targetRemainingBalanceRaw: fullExit.remainingBalanceRaw || null,
          source: 'reconcile',
          metadata: {
            targetFullExitReasonCode: fullExit.reasonCode,
          },
        }),
        positions: [{
          id: position.id,
          userId: position.userId,
          configId: position.configId,
          chainId: position.chainId,
          tokenAddress: position.tokenAddress,
          entryAmountExact: position.entryAmountExact,
          entryAmountDec: position.entryAmountDec,
        }],
        priority: 240,
        metadata: {
          reconcileScheduled: true,
        },
      }).catch(() => null);
    }
  }

  const pendingCandidates = shouldRunTrackedPositionSweep
    ? await findLedgerFirstReconcilePendingCandidates({ createdAfter })
    : [];

  for (const lot of pendingCandidates) {
    const assetEligibility = classifyCopytradeAssetEligibility({
      chainId: lot.chainId,
      tokenAddress: lot.tokenAddress,
    });
    if (!assetEligibility.allowed) continue;
    scannedPending += 1;
    const fullExit = await verifyTargetFullExit({
      targetWallet: lot.position.config.targetWallet,
      chainId: lot.chainId,
      tokenAddress: lot.tokenAddress,
    });
    if (!fullExit.isFullExit) continue;
    const latestSell = await resolveTargetSellLink({
      targetWallet: lot.position.config.targetWallet,
      chainId: lot.chainId,
      tokenAddress: lot.tokenAddress,
      leaderBuyTxHash: lot.position.leaderTxHash,
      positionCreatedAt: lot.position.createdAt,
      pendingCreatedAt: lot.createdAt,
      allowUnanchoredVerifiedFallback: true,
      targetFullExitVerified: true,
    });
    if (!latestSell.txHash) continue;
    const hasInFlight = await hasInFlightMirrorSellOrder({
      userId: lot.userId,
      configId: lot.position.configId,
      chainId: lot.chainId,
      tokenAddress: lot.tokenAddress,
    });
    if (hasInFlight) {
      emitCopytradeDomainAudit('mirror_sell_idempotent_skip', {
        extra: {
          userId: lot.userId,
          tokenAddress: lot.tokenAddress,
          chainId: lot.chainId,
          targetWallet: lot.position.config.targetWallet,
          targetSellTxHash: latestSell.txHash,
          blockedReason: 'inflight',
          reasonCode: 'reconcile_inflight_exit_order',
        },
      });
      continue;
    }
    fullExitMatches += 1;
    emitCopytradeDomainAudit('TARGET_FULL_EXIT_VERIFIED', {
      extra: {
        userId: lot.userId,
        tokenAddress: lot.tokenAddress,
        chainId: lot.chainId,
        targetWallet: lot.position.config.targetWallet,
        targetSellTxHash: latestSell.txHash,
        reasonCode: fullExit.reasonCode,
        remainingBalanceRaw: fullExit.remainingBalanceRaw,
      }
    });

    const count = await armPendingAttributedPositionsForMirrorSell({
      userId: lot.userId,
      chainId: lot.chainId,
      tokenAddress: lot.tokenAddress,
      positionIds: [lot.positionId],
      targetSellTxHash: latestSell.txHash,
      reasonCode: 'strict_full_exit_reconciled',
    });
    armedPending += count;
    if (count > 0) {
      const nextRetryCount = Math.max(1, Number((lot.position as any)?.exitRetryCount || 0));
      await prisma.position.updateMany({
        where: {
          id: lot.positionId,
          status: { in: ['open', 'pending'] },
        },
        data: {
          exitReason: 'mirror_sell',
          exitRetryCount: nextRetryCount,
          lastExitAttempt: null,
        },
      }).catch(() => null);
    }
    if (count > 0) {
      await applyCopytradeStateEvent({
        event: { type: 'TARGET_FULL_EXIT_VERIFIED' },
        chainId: lot.chainId,
        tokenAddress: lot.tokenAddress,
        targetWallet: lot.position.config.targetWallet,
        positionIds: [lot.positionId],
        targetFullExitVerified: true,
        targetSellTxHash: latestSell.txHash,
        lastExecutionState: 'target_full_exit_verified',
        lastExecutionReasonCode: fullExit.reasonCode,
      });
      logger.info(LogCode.SYS_INFO, '[TargetSellReconcile] Armed pending attributed lot after strict full-exit verification', {
        lotId: lot.id,
        positionId: lot.positionId,
        userId: lot.userId,
        token: lot.tokenAddress,
        chainId: lot.chainId,
        targetWallet: lot.position.config.targetWallet,
        targetSellTxHash: latestSell.txHash,
        remainingBalanceRaw: fullExit.remainingBalanceRaw,
        remainingBalance: formatTargetRemainingBalance(fullExit),
        dustThresholdRaw: fullExit.dustThresholdRaw,
        reasonCode: fullExit.reasonCode,
      });
      await persistTargetSellEventAndSchedulePositions({
        event: buildTargetSellEventPayload({
          chainId: lot.chainId,
          targetWallet: lot.position.config.targetWallet,
          tokenAddress: lot.tokenAddress,
          targetSellTxHash: latestSell.txHash,
          targetFullExitVerified: true,
          targetRemainingBalanceRaw: fullExit.remainingBalanceRaw || null,
          source: 'reconcile',
          metadata: {
            targetFullExitReasonCode: fullExit.reasonCode,
          },
        }),
        positions: [{
          id: lot.positionId,
          userId: lot.userId,
          configId: lot.position.configId,
          chainId: lot.chainId,
          tokenAddress: lot.tokenAddress,
          entryAmountExact: lot.position.entryAmountExact,
          entryAmountDec: lot.position.entryAmountDec,
        }],
        priority: 240,
        metadata: {
          reconcileScheduled: true,
          pendingLotId: lot.id,
        },
      }).catch(() => null);
    }
  }

  if (shouldRunTrackedPositionSweep) {
    lastTrackedPositionSweepAt = nowMs;
  }

  const orphanRecovery = await recoverMissingOrphanMirrorSellPositions({
    hasInFlightMirrorSellOrder,
  });

  const result = {
    scannedOpen,
    scannedPending,
    armedPending,
    scheduledOpen,
    fullExitMatches,
    recoveredOrphans: orphanRecovery.recoveredOrphans,
    scheduledRecoveredOrphans: orphanRecovery.scheduledRecoveredOrphans,
  };
  emitCopytradeSummaryAudit('RECONCILE_CYCLE_SUMMARY', {
    action: fullExitMatches > 0
      ? 'processed_full_exit_matches'
      : orphanRecovery.scheduledRecoveredOrphans > 0
        ? 'orphan_exit_scheduled'
        : 'noop',
    scannedOpen,
    scannedPending,
    armedPending,
    scheduledOpen,
    fullExitMatches,
    recoveredOrphans: orphanRecovery.recoveredOrphans,
    scheduledRecoveredOrphans: orphanRecovery.scheduledRecoveredOrphans,
    legacyFallbackUsed: false,
  });
  return result;
}
