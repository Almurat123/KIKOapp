import crypto from 'node:crypto';

import prisma from '../../../db/prisma.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { getTokenInfo } from '../../tokenService.js';
import { listPendingAttributedPositions } from '../positions/pendingAttributedPositionLedger.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { claimExitIntentExecution, settleExitIntentExecution } from './exitIntentIdempotency.js';
import type { ExitIntentLane } from './intentTypes.js';
import { claimPendingExitIntents, updatePositionExitIntentState } from './positionExitIntentStore.js';
import { executePositionExit } from '../../autoTradeService.js';

const EVM_EXIT_CONCURRENCY = Math.max(2, Number(process.env.COPYTRADE_EVM_EXIT_CONCURRENCY || '6'));
const SOLANA_EXIT_CONCURRENCY = Math.max(1, Number(process.env.COPYTRADE_SOLANA_EXIT_CONCURRENCY || '2'));
const CONFIRMATION_RECONCILE_CONCURRENCY = Math.max(1, Number(process.env.COPYTRADE_CONFIRM_RECONCILE_CONCURRENCY || '3'));
const POLL_INTERVAL_MS = Math.max(300, Number(process.env.COPYTRADE_EXIT_INTENT_POLL_INTERVAL_MS || '800'));
const CONFIRMATION_RECHECK_MS = Math.max(15_000, Number(process.env.COPYTRADE_EXIT_CONFIRMATION_RECHECK_MS || '30000'));
const RETRY_COOLDOWN_MS = Math.max(30_000, Number(process.env.COPYTRADE_EXIT_INTENT_RETRY_COOLDOWN_MS || '60000'));

const laneLimits: Record<ExitIntentLane, number> = {
  'evm-exit': EVM_EXIT_CONCURRENCY,
  'solana-exit': SOLANA_EXIT_CONCURRENCY,
  'confirmation-reconcile': CONFIRMATION_RECONCILE_CONCURRENCY,
};

const laneInflight = new Map<ExitIntentLane, number>();
const timers = new Map<ExitIntentLane, NodeJS.Timeout>();
const workerId = `ct-exit-worker-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
let started = false;

function getLaneInflight(lane: ExitIntentLane): number {
  return laneInflight.get(lane) || 0;
}

function bumpLaneInflight(lane: ExitIntentLane, delta: number): void {
  laneInflight.set(lane, Math.max(0, getLaneInflight(lane) + delta));
}

async function loadIntentPosition(positionId: string) {
  return prisma.position.findUnique({
    where: { id: positionId },
    include: {
      user: true,
    },
  });
}

async function processConfirmationIntent(intent: any): Promise<void> {
  const position = await prisma.position.findUnique({
    where: { id: intent.positionId },
    select: {
      id: true,
      status: true,
      exitReason: true,
      exitTxHash: true,
      updatedAt: true,
    },
  });

  if (!position) {
    await updatePositionExitIntentState({
      id: intent.id,
      lifecycleState: 'EXIT_FAILED_TERMINAL',
      lastReasonCode: 'intent_position_missing',
      clearClaim: true,
      close: true,
    });
    return;
  }

  if (String(position.status || '').toLowerCase() === 'closed') {
    await updatePositionExitIntentState({
      id: intent.id,
      lifecycleState: ['balance_dust', 'balance_empty'].includes(String(position.exitReason || '').toLowerCase())
        ? 'EXIT_CLOSED_DUST'
        : 'EXIT_CONFIRMED',
      lastReasonCode: String(position.exitReason || 'exit_confirmed'),
      executionTxHash: position.exitTxHash || intent.executionTxHash || null,
      clearClaim: true,
      close: true,
    });
    return;
  }

  await updatePositionExitIntentState({
    id: intent.id,
    lifecycleState: 'EXIT_RETRYABLE_UNRESOLVED',
    lastReasonCode: 'confirmation_reconcile_retry',
    lane: intent.chainId === 900 ? 'solana-exit' : 'evm-exit',
    notBefore: new Date(Date.now() + RETRY_COOLDOWN_MS),
    clearClaim: true,
  });
  emitCopytradeDomainAudit('exit_confirmation_unresolved_retry', {
    extra: {
      positionId: intent.positionId,
      chainId: intent.chainId,
      tokenAddress: intent.tokenAddress,
      userId: intent.userId,
      targetSellTxHash: intent.targetSellTxHash || null,
      executionTxHash: intent.executionTxHash || null,
      reasonCode: 'confirmation_reconcile_retry',
    },
  });
}

async function processExitIntent(intent: any): Promise<void> {
  if (intent.lane === 'confirmation-reconcile') {
    await processConfirmationIntent(intent);
    return;
  }

  const claim = await claimExitIntentExecution({
    identityKey: intent.identityKey,
    minRetryIntervalMs: RETRY_COOLDOWN_MS,
  });
  if (!claim.allowed) {
    await updatePositionExitIntentState({
      id: intent.id,
      lifecycleState: 'EXIT_RETRYABLE_UNRESOLVED',
      lastReasonCode: claim.blockedReason === 'cooldown' ? 'intent_cooldown_active' : 'intent_inflight_active',
      notBefore: new Date(Date.now() + Math.max(5_000, claim.retryAfterMs || RETRY_COOLDOWN_MS)),
      clearClaim: true,
    });
    return;
  }

  let finalityState: 'confirmed_success' | 'pending_visibility' | 'retryable_unresolved' | 'confirmed_failed' = 'retryable_unresolved';
  try {
    await updatePositionExitIntentState({
      id: intent.id,
      lifecycleState: 'EXIT_SUBMITTING',
      clearClaim: false,
    });

    const position = await loadIntentPosition(intent.positionId);
    if (!position) {
      await updatePositionExitIntentState({
        id: intent.id,
        lifecycleState: 'EXIT_FAILED_TERMINAL',
        lastReasonCode: 'intent_position_missing',
        clearClaim: true,
        close: true,
      });
      finalityState = 'confirmed_failed';
      return;
    }

    if (!['open', 'pending'].includes(String(position.status || '').toLowerCase())) {
      await updatePositionExitIntentState({
        id: intent.id,
        lifecycleState: String(position.status || '').toLowerCase() === 'closed' ? 'EXIT_CONFIRMED' : 'EXIT_FAILED_TERMINAL',
        lastReasonCode: `intent_position_${String(position.status || 'missing').toLowerCase()}`,
        clearClaim: true,
        close: true,
      });
      finalityState = String(position.status || '').toLowerCase() === 'closed' ? 'confirmed_success' : 'confirmed_failed';
      return;
    }

    const config = await prisma.copyTradeConfig.findUnique({
      where: { id: intent.configId },
      include: {
        user: true,
      },
    });
    if (!config?.user) {
      await updatePositionExitIntentState({
        id: intent.id,
        lifecycleState: 'EXIT_FAILED_TERMINAL',
        lastReasonCode: 'intent_config_or_user_missing',
        clearClaim: true,
        close: true,
      });
      finalityState = 'confirmed_failed';
      return;
    }

    const tokenInfo = intent.exitReason === 'mirror_sell'
      ? { price: 0, symbol: 'UNKNOWN' }
      : await getTokenInfo(intent.tokenAddress, intent.chainId).catch(() => ({ price: 0, symbol: 'UNKNOWN' }));
    const pendingAttributedLots = intent.exitReason === 'mirror_sell'
      ? await listPendingAttributedPositions({
          userId: intent.userId,
          chainId: intent.chainId,
          tokenAddress: intent.tokenAddress,
          positionIds: [intent.positionId],
          statuses: ['armed', 'sell_armed'],
        }).catch(() => [])
      : [];

    const txHash = await executePositionExit({
      userId: intent.userId,
      tokenAddress: intent.tokenAddress,
      chainId: intent.chainId,
      exitReason: intent.exitReason,
      tokenInfo,
      config,
      positions: [position],
      pendingAttributedLots,
      desiredSellRawOverride: intent.desiredSellRaw ? BigInt(intent.desiredSellRaw) : undefined,
      intentContext: {
        intentId: intent.id,
        sourceEventId: intent.sourceEventId || undefined,
        targetSellTxHash: intent.targetSellTxHash || undefined,
        targetFullExitVerified: Boolean(intent.metadata?.targetFullExitVerified),
        targetSellRatioBps: Number.isFinite(Number(intent.metadata?.targetSellRatioBps))
          ? Number(intent.metadata?.targetSellRatioBps)
          : null,
      },
    });

    const refreshed = await prisma.position.findUnique({
      where: { id: intent.positionId },
      select: {
        status: true,
        exitReason: true,
        exitTxHash: true,
      },
    });

    if (txHash) {
      await updatePositionExitIntentState({
        id: intent.id,
        lifecycleState: 'EXIT_CONFIRMED',
        lastReasonCode: 'exit_confirmed',
        executionTxHash: txHash,
        clearClaim: true,
        close: true,
      });
      finalityState = 'confirmed_success';
      return;
    }

    if (['balance_dust', 'balance_empty'].includes(String(refreshed?.exitReason || '').toLowerCase())) {
      await updatePositionExitIntentState({
        id: intent.id,
        lifecycleState: 'EXIT_CLOSED_DUST',
        lastReasonCode: String(refreshed?.exitReason || 'balance_dust'),
        executionTxHash: refreshed?.exitTxHash || null,
        clearClaim: true,
        close: true,
      });
      finalityState = 'confirmed_success';
      return;
    }

    if (refreshed?.exitTxHash) {
      await updatePositionExitIntentState({
        id: intent.id,
        lifecycleState: 'EXIT_PENDING_FINALITY',
        lastReasonCode: 'exit_pending_finality',
        executionTxHash: refreshed.exitTxHash,
        lane: 'confirmation-reconcile',
        notBefore: new Date(Date.now() + CONFIRMATION_RECHECK_MS),
        clearClaim: true,
      });
      finalityState = 'pending_visibility';
      return;
    }

    await updatePositionExitIntentState({
      id: intent.id,
      lifecycleState: 'EXIT_RETRYABLE_UNRESOLVED',
      lastReasonCode: 'exit_no_txhash_retry',
      notBefore: new Date(Date.now() + RETRY_COOLDOWN_MS),
      clearClaim: true,
    });
    finalityState = 'retryable_unresolved';
  } catch (error: any) {
    logger.error(LogCode.SYS_ERROR, '[CopyTradeExitIntent] execution failed', {
      intentId: intent.id,
      positionId: intent.positionId,
      chainId: intent.chainId,
      tokenAddress: intent.tokenAddress,
      error: error?.message || String(error),
    });
    await updatePositionExitIntentState({
      id: intent.id,
      lifecycleState: 'EXIT_RETRYABLE_UNRESOLVED',
      lastReasonCode: error?.message || 'intent_execution_failed',
      notBefore: new Date(Date.now() + RETRY_COOLDOWN_MS),
      clearClaim: true,
    }).catch(() => undefined);
    finalityState = 'retryable_unresolved';
  } finally {
    await settleExitIntentExecution({
      identityKey: intent.identityKey,
      finalityState,
      minRetryIntervalMs: RETRY_COOLDOWN_MS,
    }).catch(() => undefined);
  }
}

async function drainLane(lane: ExitIntentLane): Promise<void> {
  const limit = laneLimits[lane];
  if (getLaneInflight(lane) >= limit) return;
  const available = Math.max(1, limit - getLaneInflight(lane));
  const claimed = await claimPendingExitIntents({
    lane,
    limit: available,
    workerId,
  });
  for (const intent of claimed) {
    bumpLaneInflight(lane, 1);
    void processExitIntent(intent)
      .catch((error: any) => {
        logger.error(LogCode.SYS_ERROR, '[CopyTradeExitIntent] worker lane error', {
          lane,
          intentId: intent.id,
          error: error?.message || String(error),
        });
      })
      .finally(() => {
        bumpLaneInflight(lane, -1);
      });
  }
}

function scheduleLane(lane: ExitIntentLane): void {
  if (!started) return;
  const timer = setTimeout(async () => {
    try {
      await drainLane(lane);
    } catch (error: any) {
      logger.warn(LogCode.SYS_ERROR, '[CopyTradeExitIntent] lane poll failed', {
        lane,
        error: error?.message || String(error),
      });
    } finally {
      scheduleLane(lane);
    }
  }, POLL_INTERVAL_MS);
  timers.set(lane, timer);
}

export function startPositionExitIntentWorker(): void {
  if (started) return;
  started = true;
  scheduleLane('evm-exit');
  scheduleLane('solana-exit');
  scheduleLane('confirmation-reconcile');
  logger.info(LogCode.SYS_STARTUP, '[CopyTradeExitIntent] worker started', {
    workerId,
    evmConcurrency: EVM_EXIT_CONCURRENCY,
    solanaConcurrency: SOLANA_EXIT_CONCURRENCY,
    confirmationConcurrency: CONFIRMATION_RECONCILE_CONCURRENCY,
  });
}

export function stopPositionExitIntentWorker(): void {
  started = false;
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}
