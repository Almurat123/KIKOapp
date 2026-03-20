import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { processCanonicalBuyFinality } from '../buy/canonicalBuyFinalityProcessor.js';
import { syncOrderProjections } from './canonicalOrderProjectionSync.js';
import {
  getCanonicalOrderById,
  listCanonicalOrdersForObservation,
  type CanonicalOrderSnapshot,
} from './canonicalOrderState.js';
import { observeCanonicalOrderState } from './canonicalOrderObserver.js';

const POLL_INTERVAL_MS = Math.max(2_000, Number(process.env.COPYTRADE_ORDER_OBSERVATION_POLL_MS || '5000'));
const MAX_BATCH = Math.max(10, Number(process.env.COPYTRADE_ORDER_OBSERVATION_BATCH || '50'));
const inflight = new Set<string>();
let started = false;
let timer: NodeJS.Timeout | null = null;

function readMetadataString(order: CanonicalOrderSnapshot, key: string): string | null {
  const value = String(order.metadata?.[key] || '').trim();
  return value || null;
}

function shouldObserve(order: CanonicalOrderSnapshot): boolean {
  const awaitingKind = readMetadataString(order, 'awaitingKind');
  if (!awaitingKind) return false;
  const nextObservationAt = readMetadataString(order, 'nextObservationAt');
  if (!nextObservationAt) return true;
  const timestamp = Date.parse(nextObservationAt);
  return Number.isFinite(timestamp) ? timestamp <= Date.now() : true;
}

async function processOrder(order: CanonicalOrderSnapshot): Promise<void> {
  const awaitingKind = readMetadataString(order, 'awaitingKind');
  if (!awaitingKind) return;

  const txHashes = [
    readMetadataString(order, awaitingKind === 'buy_finality' ? 'buyTxHash' : 'sellTxHash'),
    readMetadataString(order, 'lastObservedTxHash'),
  ].filter(Boolean) as string[];

  if (awaitingKind === 'projection_repair') {
    await syncOrderProjections(order.id).catch(() => null);
    return;
  }

  const observation = await observeCanonicalOrderState({
    orderId: order.id,
    kind: awaitingKind === 'buy_finality' ? 'buy' : 'exit',
    chainId: order.chainId,
    txHashes,
    forceRefresh: true,
  });

  if (awaitingKind === 'buy_finality' && observation.final) {
    await processCanonicalBuyFinality({
      orderId: order.id,
      confirmation: observation.confirmation,
      recoverySource: 'late_recovery',
    }).catch((error: any) => {
      logger.error(LogCode.SYS_ERROR, '[CanonicalOrderObserver] buy finality processing failed', {
        orderId: order.id,
        error: error?.message || String(error),
      });
    });
  }

  if (awaitingKind === 'exit_finality' && observation.final) {
    const refreshed = await getCanonicalOrderById(order.id);
    if (refreshed && readMetadataString(refreshed, 'awaitingKind') !== 'projection_repair') {
      await syncOrderProjections(order.id).catch(() => null);
    }
  }
}

async function drain(): Promise<void> {
  const candidates = await listCanonicalOrdersForObservation({ take: MAX_BATCH });
  for (const order of candidates) {
    if (!shouldObserve(order) || inflight.has(order.id)) continue;
    inflight.add(order.id);
    void processOrder(order)
      .catch((error: any) => {
        logger.error(LogCode.SYS_ERROR, '[CanonicalOrderObserver] observation cycle failed', {
          orderId: order.id,
          error: error?.message || String(error),
        });
      })
      .finally(() => {
        inflight.delete(order.id);
      });
  }
}

function schedule(): void {
  if (!started) return;
  timer = setTimeout(async () => {
    try {
      await drain();
    } catch (error: any) {
      logger.error(LogCode.SYS_ERROR, '[CanonicalOrderObserver] observation job tick failed', {
        error: error?.message || String(error),
      });
    } finally {
      schedule();
    }
  }, POLL_INTERVAL_MS);
}

export function startOrderObservationJob(): void {
  if (started) return;
  started = true;
  schedule();
  logger.info(LogCode.SYS_STARTUP, '[CanonicalOrderObserver] job started', {
    pollIntervalMs: POLL_INTERVAL_MS,
    batchSize: MAX_BATCH,
  });
}

export function stopOrderObservationJob(): void {
  started = false;
  if (timer) clearTimeout(timer);
  timer = null;
}
