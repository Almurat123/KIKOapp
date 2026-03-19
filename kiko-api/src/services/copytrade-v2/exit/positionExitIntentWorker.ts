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
import { executePositionExit } from '../runtime/positionMonitor.js';
import { preheatSellApprovalForToken } from '../../sellApprovalPreheater.js';
import { prewarmSellQuoteForToken } from '../../sellQuotePreheater.js';
import {
  resolveExitIntentRetryDelayMs,
  STANDARD_EXIT_INTENT_RETRY_MS,
} from './exitHotPathPolicy.js';
import {
  classifyExitIntentExecutionError,
  getMaxSameJobRetryAttempts,
  isTerminalExitBlockReason,
  resolveSameJobRetryDelayMs,
} from './exitIntentExecutionPolicy.js';
import { recordExitIntentProgress } from './exitIntentProgress.js';
import { persistTerminalExitBlockState } from './persistence.js';
import { advanceCanonicalOrderState, findCanonicalOrderByIdentity } from '../orders/canonicalOrderState.js';
import { shouldAwaitBuyConfirmationForMirrorSell } from '../orders/canonicalOrderPolicy.js';

const EVM_EXIT_CONCURRENCY = Math.max(2, Number(process.env.COPYTRADE_EVM_EXIT_CONCURRENCY || '6'));
const SOLANA_EXIT_CONCURRENCY = Math.max(1, Number(process.env.COPYTRADE_SOLANA_EXIT_CONCURRENCY || '2'));
const CONFIRMATION_RECONCILE_CONCURRENCY = Math.max(1, Number(process.env.COPYTRADE_CONFIRM_RECONCILE_CONCURRENCY || '3'));
const POLL_INTERVAL_MS = Math.max(300, Number(process.env.COPYTRADE_EXIT_INTENT_POLL_INTERVAL_MS || '800'));
const CONFIRMATION_RECHECK_MS = Math.max(15_000, Number(process.env.COPYTRADE_EXIT_CONFIRMATION_RECHECK_MS || '30000'));
const RETRY_COOLDOWN_MS = Math.max(
  1_000,
  Number(process.env.COPYTRADE_EXIT_INTENT_RETRY_COOLDOWN_MS || String(STANDARD_EXIT_INTENT_RETRY_MS))
);
const MAX_QUEUE_RETRY_ATTEMPTS = Math.max(
  0,
  Number(process.env.COPYTRADE_EXIT_INTENT_QUEUE_RETRY_LIMIT || '3')
);

const laneLimits: Record<ExitIntentLane, number> = {
  'evm-exit': EVM_EXIT_CONCURRENCY,
  'solana-exit': SOLANA_EXIT_CONCURRENCY,
  'confirmation-reconcile': CONFIRMATION_RECONCILE_CONCURRENCY,
};

const laneInflight = new Map<ExitIntentLane, number>();
const timers = new Map<ExitIntentLane, NodeJS.Timeout>();
const laneWakeScheduled = new Set<ExitIntentLane>();
const workerId = `ct-exit-worker-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
let started = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLaneInflight(lane: ExitIntentLane): number {
  return laneInflight.get(lane) || 0;
}

function bumpLaneInflight(lane: ExitIntentLane, delta: number): void {
  laneInflight.set(lane, Math.max(0, getLaneInflight(lane) + delta));
}

function readQueueRetryCount(intent: { metadata?: Record<string, unknown> | null }): number {
  const raw = Number((intent.metadata as Record<string, unknown> | null)?.queueRetryCount || 0);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

async function markIntentRetryable(params: {
  intent: any;
  reasonCode: string;
  retryDelayMs: number;
  queueRetryCount: number;
  lane?: ExitIntentLane | string | null;
}): Promise<void> {
  await updatePositionExitIntentState({
    id: params.intent.id,
    lifecycleState: 'EXIT_RETRYABLE_UNRESOLVED',
    lastReasonCode: params.reasonCode,
    lane: (params.lane || params.intent.lane) as ExitIntentLane,
    notBefore: new Date(Date.now() + params.retryDelayMs),
    clearClaim: true,
    metadataPatch: {
      queueRetryCount: params.queueRetryCount,
      lastQueueRetryReasonCode: params.reasonCode,
      lastQueueRetryAt: new Date().toISOString(),
    },
  });
}

async function markIntentTerminal(params: {
  intent: any;
  reasonCode: string;
  position?: any | null;
  targetWallet?: string | null;
  archivePosition?: boolean;
}): Promise<void> {
  if (params.archivePosition && params.position) {
    await persistTerminalExitBlockState({
      positions: [params.position],
      targetWallet: params.targetWallet || null,
      reasonCode: params.reasonCode,
    }).catch(() => undefined);
  }
  await updatePositionExitIntentState({
    id: params.intent.id,
    lifecycleState: 'EXIT_FAILED_TERMINAL',
    lastReasonCode: params.reasonCode,
    clearClaim: true,
    close: true,
    metadataPatch: {
      queueRetryCount: readQueueRetryCount(params.intent),
      terminalReasonCode: params.reasonCode,
      terminalizedAt: new Date().toISOString(),
    },
  });
}

async function loadIntentPosition(positionId: string) {
  return prisma.position.findUnique({
    where: { id: positionId },
    include: {
      user: true,
    },
  });
}

async function processConfirmationIntent(intent: any): Promise<'confirmed_success' | 'retryable_unresolved' | 'confirmed_failed'> {
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
    return 'confirmed_failed';
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
    return 'confirmed_success';
  }

  const queueRetryCount = readQueueRetryCount(intent) + 1;
  if (queueRetryCount > MAX_QUEUE_RETRY_ATTEMPTS) {
    await markIntentTerminal({
      intent,
      reasonCode: 'confirmation_retry_budget_exhausted',
      archivePosition: false,
    });
    return 'confirmed_failed';
  }

  await markIntentRetryable({
    intent,
    reasonCode: 'confirmation_reconcile_retry',
    retryDelayMs: RETRY_COOLDOWN_MS,
    queueRetryCount,
    lane: intent.chainId === 900 ? 'solana-exit' : 'evm-exit',
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
      queueRetryCount,
    },
  });
  return 'retryable_unresolved';
}

async function processExitIntent(intent: any): Promise<void> {
  let finalityState: 'confirmed_success' | 'pending_visibility' | 'retryable_unresolved' | 'confirmed_failed' = 'retryable_unresolved';
  let settleRetryIntervalMs = RETRY_COOLDOWN_MS;
  if (intent.lane === 'confirmation-reconcile') {
    try {
      finalityState = await processConfirmationIntent(intent);
      return;
    } finally {
      await settleExitIntentExecution({
        identityKey: intent.identityKey,
        finalityState,
        minRetryIntervalMs: settleRetryIntervalMs,
      }).catch(() => undefined);
    }
  }

  const claim = await claimExitIntentExecution({
    identityKey: intent.identityKey,
    minRetryIntervalMs: RETRY_COOLDOWN_MS,
  });
  if (!claim.allowed) {
    const retryDelayMs = resolveExitIntentRetryDelayMs({
      reasonCode: claim.blockedReason === 'cooldown' ? 'intent_cooldown_active' : 'intent_inflight_active',
      retryAfterMs: claim.retryAfterMs || RETRY_COOLDOWN_MS,
    });
    const reasonCode = claim.blockedReason === 'cooldown' ? 'intent_cooldown_active' : 'intent_inflight_active';
    const queueRetryCount = readQueueRetryCount(intent) + 1;
    if (queueRetryCount > MAX_QUEUE_RETRY_ATTEMPTS) {
      await markIntentTerminal({
        intent,
        reasonCode: 'exit_retry_budget_exhausted',
        archivePosition: false,
      });
      return;
    }
    await markIntentRetryable({
      intent,
      reasonCode,
      retryDelayMs,
      queueRetryCount,
    });
    return;
  }

  let loadedPosition: any | null = null;
  let loadedTargetWallet: string | null = null;
  let canonicalOrderId: string | null = String(intent.metadata?.orderId || '').trim() || null;
  let canonicalOrderLifecycleState: string | null = null;
  try {
    await updatePositionExitIntentState({
      id: intent.id,
      lifecycleState: 'EXIT_SUBMITTING',
      clearClaim: false,
      metadataPatch: {
        hotPathStage: 'routing',
        hotPathStageAt: new Date().toISOString(),
        hotPathWorkerId: workerId,
      },
    });

    const [position, config] = await Promise.all([
      loadIntentPosition(intent.positionId),
      prisma.copyTradeConfig.findUnique({
        where: { id: intent.configId },
        include: {
          user: true,
        },
      }),
    ]);
    loadedPosition = position;
    loadedTargetWallet = config?.targetWallet || null;

    if (!canonicalOrderId && position?.leaderTxHash && loadedTargetWallet) {
      const canonicalOrder = await findCanonicalOrderByIdentity({
        userId: intent.userId,
        configId: intent.configId,
        chainId: intent.chainId,
        targetWallet: loadedTargetWallet,
        tokenAddress: intent.tokenAddress,
        leaderTxHash: position.leaderTxHash,
        direction: 'buy',
      }).catch(() => null);
      canonicalOrderId = canonicalOrder?.id || null;
      canonicalOrderLifecycleState = canonicalOrder?.lifecycleState || null;
    } else if (canonicalOrderId) {
      const canonicalOrder = await prisma.copytradeOrder.findUnique({
        where: { id: canonicalOrderId },
        select: { lifecycleState: true },
      }).catch(() => null);
      canonicalOrderLifecycleState = canonicalOrder?.lifecycleState || null;
    }

    if (!position) {
      await markIntentTerminal({
        intent,
        reasonCode: 'intent_position_missing',
      });
      finalityState = 'confirmed_failed';
      return;
    }

    if (shouldAwaitBuyConfirmationForMirrorSell({
      exitReason: intent.exitReason,
      positionStatus: position.status,
      canonicalOrderLifecycle: canonicalOrderLifecycleState,
    })) {
      const queueRetryCount = readQueueRetryCount(intent) + 1;
      if (queueRetryCount > MAX_QUEUE_RETRY_ATTEMPTS) {
        await markIntentTerminal({
          intent,
          reasonCode: 'buy_confirmation_retry_budget_exhausted',
          position,
          targetWallet: loadedTargetWallet,
          archivePosition: false,
        });
        finalityState = 'confirmed_failed';
        return;
      }
      await recordExitIntentProgress({
        intentId: intent.id,
        workerId,
        stage: 'retry_wait',
        reasonCode: 'buy_confirmation_pending',
        metadata: {
          positionStatus: position.status,
          canonicalOrderLifecycle: canonicalOrderLifecycleState,
          retryAfterMs: CONFIRMATION_RECHECK_MS,
        },
      }).catch(() => undefined);
      if (canonicalOrderId) {
        await advanceCanonicalOrderState({
          orderId: canonicalOrderId,
          lifecycleState: 'EXIT_ARMED',
          reasonCode: 'sell_preempted_before_buy_confirm',
          eventType: 'ORDER_EXIT_AWAITING_BUY_CONFIRM',
          metadataPatch: {
            exitIntentId: intent.id,
            targetSellTxHash: intent.targetSellTxHash || null,
            positionIdLegacy: intent.positionId,
            lastKnownExposureSource: 'exit_waiting_for_buy_confirm',
          },
        }).catch(() => null);
      }
      await markIntentRetryable({
        intent,
        reasonCode: 'buy_confirmation_pending',
        retryDelayMs: CONFIRMATION_RECHECK_MS,
        queueRetryCount,
        lane: intent.chainId === 900 ? 'solana-exit' : 'evm-exit',
      });
      finalityState = 'retryable_unresolved';
      settleRetryIntervalMs = CONFIRMATION_RECHECK_MS;
      return;
    }

    if (canonicalOrderId) {
      await advanceCanonicalOrderState({
        orderId: canonicalOrderId,
        lifecycleState: 'EXIT_SUBMITTING',
        reasonCode: 'ok_exit_submitted',
        eventType: 'ORDER_EXIT_SUBMITTING',
        metadataPatch: {
          exitIntentId: intent.id,
          targetSellTxHash: intent.targetSellTxHash || null,
          positionIdLegacy: intent.positionId,
          lastKnownExposureSource: 'exit_intent_worker',
        },
      }).catch(() => null);
    }

    if (!['open', 'pending'].includes(String(position.status || '').toLowerCase())) {
      const normalizedStatus = String(position.status || '').toLowerCase();
      if (normalizedStatus === 'closed') {
        await updatePositionExitIntentState({
          id: intent.id,
          lifecycleState: 'EXIT_CONFIRMED',
          lastReasonCode: `intent_position_${normalizedStatus}`,
          clearClaim: true,
          close: true,
        });
        finalityState = 'confirmed_success';
        return;
      }
      await markIntentTerminal({
        intent,
        reasonCode: isTerminalExitBlockReason(position.exitReason)
          ? String(position.exitReason)
          : `intent_position_${normalizedStatus || 'missing'}`,
        position,
        targetWallet: loadedTargetWallet,
        archivePosition: false,
      });
      finalityState = 'confirmed_failed';
      return;
    }

    if (!config?.user) {
      await markIntentTerminal({
        intent,
        reasonCode: 'intent_config_or_user_missing',
      });
      finalityState = 'confirmed_failed';
      return;
    }

    const [tokenInfo, pendingAttributedLots] = await Promise.all([
      intent.exitReason === 'mirror_sell'
        ? Promise.resolve({ price: 0, symbol: 'UNKNOWN' })
        : getTokenInfo(intent.tokenAddress, intent.chainId).catch(() => ({ price: 0, symbol: 'UNKNOWN' })),
      intent.exitReason === 'mirror_sell'
        ? listPendingAttributedPositions({
            userId: intent.userId,
            chainId: intent.chainId,
            tokenAddress: intent.tokenAddress,
            positionIds: [intent.positionId],
            statuses: ['armed', 'sell_armed'],
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    if (intent.exitReason === 'mirror_sell' && intent.chainId !== 900 && config.user.walletAddress) {
      const amountInBase = String(intent.desiredSellRaw || '').trim();
      const approvalPreheatPromise = preheatSellApprovalForToken({
        userId: intent.userId,
        walletAddress: config.user.walletAddress,
        chainId: intent.chainId,
        tokenAddress: intent.tokenAddress,
        tokenPriceUsd: Number(tokenInfo?.price || 0),
      }, {
        queueBehavior: 'allow_queue',
        txPurpose: 'approval',
      }).catch(() => ({ status: 'deferred', reasonCode: 'approval_prewarm_failed' }));
      const quotePrewarmPromise = amountInBase
        ? prewarmSellQuoteForToken({
            chainId: intent.chainId,
            walletAddress: config.user.walletAddress,
            tokenAddress: intent.tokenAddress,
            amountInBase,
            tokenDecimals: Number(tokenInfo?.decimals || 0) || undefined,
          }).catch(() => ({ status: 'deferred', reasonCode: 'quote_prewarm_failed', preferredDexes: [] }))
        : Promise.resolve({ status: 'noop', reasonCode: 'desired_sell_raw_missing', preferredDexes: [] as any[] });
      void Promise.allSettled([approvalPreheatPromise, quotePrewarmPromise]).then((results) => {
        void recordExitIntentProgress({
          intentId: intent.id,
          workerId,
          stage: 'routing',
          metadata: {
            approvalPreheatStatus: (results[0].status === 'fulfilled' ? results[0].value.status : 'deferred'),
            quotePreheatStatus: (results[1].status === 'fulfilled' ? results[1].value.status : 'deferred'),
            preferredDexes: results[1].status === 'fulfilled' ? results[1].value.preferredDexes : [],
          },
        });
      });
    }

    const maxSameJobRetryAttempts = getMaxSameJobRetryAttempts();
    let txHash: string | null = null;
    let lastExecutionError: unknown = null;
    for (let sameJobAttempt = 1; sameJobAttempt <= maxSameJobRetryAttempts + 1; sameJobAttempt += 1) {
      try {
        await recordExitIntentProgress({
          intentId: intent.id,
          workerId,
          stage: 'routing',
          metadata: {
            sameJobAttempt,
            sameJobAttemptStartedAt: new Date().toISOString(),
          },
        });
        txHash = await executePositionExit({
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
        lastExecutionError = null;
        break;
      } catch (error: any) {
        lastExecutionError = error;
        const disposition = classifyExitIntentExecutionError(error);
        if (!disposition.sameJobRetry || sameJobAttempt > maxSameJobRetryAttempts) {
          throw error;
        }
        const retryDelayMs = resolveSameJobRetryDelayMs(sameJobAttempt);
        settleRetryIntervalMs = retryDelayMs;
        await recordExitIntentProgress({
          intentId: intent.id,
          workerId,
          stage: 'retry_wait',
          reasonCode: disposition.reasonCode,
          metadata: {
            sameJobAttempt,
            retryAfterMs: retryDelayMs,
            lastErrorMessage: error?.message || String(error),
          },
        });
        await sleep(retryDelayMs);
      }
    }

    if (lastExecutionError) {
      throw lastExecutionError;
    }

    const refreshed = await prisma.position.findUnique({
      where: { id: intent.positionId },
      select: {
        status: true,
        exitReason: true,
        exitTxHash: true,
      },
    });

    if (txHash) {
      await recordExitIntentProgress({
        intentId: intent.id,
        workerId,
        stage: 'confirmed',
        reasonCode: 'exit_confirmed',
        executionTxHash: txHash,
      });
      await updatePositionExitIntentState({
        id: intent.id,
        lifecycleState: 'EXIT_CONFIRMED',
        lastReasonCode: 'exit_confirmed',
        executionTxHash: txHash,
        clearClaim: true,
        close: true,
      });
      if (canonicalOrderId) {
        await advanceCanonicalOrderState({
          orderId: canonicalOrderId,
          lifecycleState: 'EXIT_CONFIRMED_CLOSED',
          reasonCode: 'ok_exit_confirmed_closed',
          eventType: 'ORDER_EXIT_CONFIRMED',
          metadataPatch: {
            sellTxHash: txHash,
            targetSellTxHash: intent.targetSellTxHash || null,
            positionIdLegacy: intent.positionId,
            lastKnownExposureSource: 'exit_execution',
          },
          closedAt: new Date(),
        }).catch(() => null);
      }
      finalityState = 'confirmed_success';
      return;
    }

    if (['balance_dust', 'balance_empty'].includes(String(refreshed?.exitReason || '').toLowerCase())) {
      await recordExitIntentProgress({
        intentId: intent.id,
        workerId,
        stage: 'confirmed',
        reasonCode: String(refreshed?.exitReason || 'balance_dust'),
        executionTxHash: refreshed?.exitTxHash || null,
      });
      await updatePositionExitIntentState({
        id: intent.id,
        lifecycleState: 'EXIT_CLOSED_DUST',
        lastReasonCode: String(refreshed?.exitReason || 'balance_dust'),
        executionTxHash: refreshed?.exitTxHash || null,
        clearClaim: true,
        close: true,
      });
      if (canonicalOrderId) {
        await advanceCanonicalOrderState({
          orderId: canonicalOrderId,
          lifecycleState: 'EXIT_CONFIRMED_CLOSED',
          reasonCode: String(refreshed?.exitReason || 'ok_exit_confirmed_closed'),
          eventType: 'ORDER_EXIT_CONFIRMED_DUST',
          metadataPatch: {
            sellTxHash: refreshed?.exitTxHash || null,
            targetSellTxHash: intent.targetSellTxHash || null,
            positionIdLegacy: intent.positionId,
            lastKnownExposureSource: 'exit_execution',
          },
          closedAt: new Date(),
        }).catch(() => null);
      }
      finalityState = 'confirmed_success';
      return;
    }

    if (['failed', 'failed_final'].includes(String(refreshed?.status || '').toLowerCase())) {
      await recordExitIntentProgress({
        intentId: intent.id,
        workerId,
        stage: 'confirmed',
        reasonCode: String(refreshed?.exitReason || 'exit_failed_terminal'),
        executionTxHash: refreshed?.exitTxHash || null,
      });
      await markIntentTerminal({
        intent,
        reasonCode: String(refreshed?.exitReason || 'exit_failed_terminal'),
        position: loadedPosition,
        targetWallet: loadedTargetWallet,
        archivePosition: false,
      });
      if (canonicalOrderId) {
        await advanceCanonicalOrderState({
          orderId: canonicalOrderId,
          lifecycleState: 'FAILED_TERMINAL',
          reasonCode: String(refreshed?.exitReason || 'failed_terminal'),
          eventType: 'ORDER_EXIT_FAILED',
          metadataPatch: {
            sellTxHash: refreshed?.exitTxHash || null,
            targetSellTxHash: intent.targetSellTxHash || null,
            positionIdLegacy: intent.positionId,
            lastKnownExposureSource: 'exit_failed',
          },
          closedAt: new Date(),
        }).catch(() => null);
      }
      finalityState = 'confirmed_failed';
      return;
    }

    if (refreshed?.exitTxHash) {
      await recordExitIntentProgress({
        intentId: intent.id,
        workerId,
        stage: 'swap_visible',
        reasonCode: 'exit_pending_finality',
        executionTxHash: refreshed.exitTxHash,
      });
      await updatePositionExitIntentState({
        id: intent.id,
        lifecycleState: 'EXIT_PENDING_FINALITY',
        lastReasonCode: 'exit_pending_finality',
        executionTxHash: refreshed.exitTxHash,
        lane: 'confirmation-reconcile',
        notBefore: new Date(Date.now() + CONFIRMATION_RECHECK_MS),
        clearClaim: true,
      });
      if (canonicalOrderId) {
        await advanceCanonicalOrderState({
          orderId: canonicalOrderId,
          lifecycleState: 'EXIT_ACCEPTED',
          reasonCode: 'ok_exit_accepted',
          eventType: 'ORDER_EXIT_ACCEPTED',
          metadataPatch: {
            sellTxHash: refreshed.exitTxHash,
            targetSellTxHash: intent.targetSellTxHash || null,
            positionIdLegacy: intent.positionId,
            lastKnownExposureSource: 'exit_visible',
          },
        }).catch(() => null);
      }
      finalityState = 'pending_visibility';
      settleRetryIntervalMs = CONFIRMATION_RECHECK_MS;
      return;
    }

    settleRetryIntervalMs = RETRY_COOLDOWN_MS;
    const queueRetryCount = readQueueRetryCount(intent) + 1;
    if (queueRetryCount > MAX_QUEUE_RETRY_ATTEMPTS) {
      await markIntentTerminal({
        intent,
        reasonCode: 'exit_retry_budget_exhausted',
        position: loadedPosition,
        targetWallet: loadedTargetWallet,
        archivePosition: false,
      });
      finalityState = 'confirmed_failed';
      return;
    }
    await markIntentRetryable({
      intent,
      reasonCode: 'exit_no_txhash_retry',
      retryDelayMs: RETRY_COOLDOWN_MS,
      queueRetryCount,
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
    const disposition = classifyExitIntentExecutionError(error);
    const reasonCode = disposition.reasonCode;
    const retryDelayMs = resolveExitIntentRetryDelayMs({
      reasonCode,
      retryAfterMs: (error as any)?.retryAfterMs,
    });
    await recordExitIntentProgress({
      intentId: intent.id,
      workerId,
      stage: 'retry_wait',
      reasonCode,
      metadata: {
        retryAfterMs: retryDelayMs,
        lastErrorMessage: error?.message || String(error),
      },
    }).catch(() => undefined);
    if (!disposition.queueRetryAllowed) {
      await markIntentTerminal({
        intent,
        reasonCode,
        position: loadedPosition,
        targetWallet: loadedTargetWallet,
        archivePosition: disposition.archivePosition,
      }).catch(() => undefined);
      finalityState = 'confirmed_failed';
      return;
    }
    const queueRetryCount = readQueueRetryCount(intent) + 1;
    if (queueRetryCount > MAX_QUEUE_RETRY_ATTEMPTS) {
      await markIntentTerminal({
        intent,
        reasonCode: 'exit_retry_budget_exhausted',
        position: loadedPosition,
        targetWallet: loadedTargetWallet,
        archivePosition: false,
      }).catch(() => undefined);
      finalityState = 'confirmed_failed';
      return;
    }
    settleRetryIntervalMs = retryDelayMs;
    await markIntentRetryable({
      intent,
      reasonCode,
      retryDelayMs,
      queueRetryCount,
    }).catch(() => undefined);
    finalityState = 'retryable_unresolved';
  } finally {
    await settleExitIntentExecution({
      identityKey: intent.identityKey,
      finalityState,
      minRetryIntervalMs: settleRetryIntervalMs,
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
        requestLaneDrain(lane);
      });
  }
}

function requestLaneDrain(lane: ExitIntentLane): void {
  if (!started || laneWakeScheduled.has(lane)) return;
  laneWakeScheduled.add(lane);
  setImmediate(async () => {
    laneWakeScheduled.delete(lane);
    try {
      await drainLane(lane);
    } catch (error: any) {
      logger.warn(LogCode.SYS_ERROR, '[CopyTradeExitIntent] immediate lane drain failed', {
        lane,
        error: error?.message || String(error),
      });
    }
  });
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

export function nudgePositionExitIntentWorker(lane?: ExitIntentLane): void {
  if (lane) {
    requestLaneDrain(lane);
    return;
  }
  requestLaneDrain('evm-exit');
  requestLaneDrain('solana-exit');
  requestLaneDrain('confirmation-reconcile');
}

export function stopPositionExitIntentWorker(): void {
  started = false;
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}
