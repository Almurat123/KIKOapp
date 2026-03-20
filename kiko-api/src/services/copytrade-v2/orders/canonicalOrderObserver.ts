import type { ConfirmationOutcome } from '../../swap/confirmationCoordinator.js';
import { waitForTransactionConfirmation } from '../../swap/confirmationCoordinator.js';
import {
  clearCanonicalOrderObservation,
  getCanonicalOrderById,
  markCanonicalOrderAwaitingObservation,
  type CanonicalOrderAwaitingKind,
  type CanonicalOrderSnapshot,
} from './canonicalOrderState.js';

export type CanonicalObservationKind = 'buy' | 'exit';

export interface CanonicalOrderObservationResult {
  order: CanonicalOrderSnapshot | null;
  confirmation: ConfirmationOutcome;
  resolvedState: string;
  resolvedTxHash: string | null;
  visible: boolean;
  final: boolean;
  reasonCode: string;
}

const inflightObservations = new Map<string, Promise<CanonicalOrderObservationResult>>();
const DEFAULT_BUY_RECHECK_MS = Math.max(5_000, Number(process.env.COPYTRADE_ORDER_BUY_RECHECK_MS || '15000'));
const DEFAULT_EXIT_RECHECK_MS = Math.max(5_000, Number(process.env.COPYTRADE_ORDER_EXIT_RECHECK_MS || '15000'));

function readMetadataString(order: CanonicalOrderSnapshot | null, key: string): string | null {
  const value = String(order?.metadata?.[key] || '').trim();
  return value || null;
}

function buildObservationKey(orderId: string, kind: CanonicalObservationKind): string {
  return `${orderId}:${kind}`;
}

function mapAwaitingKind(kind: CanonicalObservationKind): CanonicalOrderAwaitingKind {
  return kind === 'buy' ? 'buy_finality' : 'exit_finality';
}

function resolveAwaitingLifecycle(order: CanonicalOrderSnapshot, kind: CanonicalObservationKind): string {
  const current = String(order.lifecycleState || '').trim().toUpperCase();
  if (kind === 'buy') {
    if (current.startsWith('EXIT_') || current === 'SELL_PREEMPTED') {
      return current || 'EXIT_ARMED';
    }
    return 'BUY_AWAITING_FINALITY';
  }
  return current === 'EXIT_CONFIRMED_CLOSED' ? current : 'EXIT_AWAITING_FINALITY';
}

function deriveTxHashes(order: CanonicalOrderSnapshot | null, kind: CanonicalObservationKind, explicitTxHashes?: string[]): string[] {
  const raw = [
    ...(explicitTxHashes || []),
    kind === 'buy' ? readMetadataString(order, 'buyTxHash') : readMetadataString(order, 'sellTxHash'),
    readMetadataString(order, 'lastObservedTxHash'),
    order?.txHash || null,
  ];
  return [...new Set(raw.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))];
}

export async function scheduleCanonicalOrderObservation(params: {
  orderId: string;
  kind: CanonicalObservationKind;
  txHash?: string | null;
  delayMs?: number;
  reasonCode: string;
  metadataPatch?: Record<string, unknown>;
}): Promise<CanonicalOrderSnapshot | null> {
  const order = await getCanonicalOrderById(params.orderId);
  if (!order) return null;
  return markCanonicalOrderAwaitingObservation({
    orderId: params.orderId,
    kind: mapAwaitingKind(params.kind),
    txHash: params.txHash || readMetadataString(order, params.kind === 'buy' ? 'buyTxHash' : 'sellTxHash'),
    delayMs: params.delayMs ?? (params.kind === 'buy' ? DEFAULT_BUY_RECHECK_MS : DEFAULT_EXIT_RECHECK_MS),
    lifecycleState: resolveAwaitingLifecycle(order, params.kind),
    reasonCode: params.reasonCode,
    eventType: 'ORDER_OBSERVATION_DEFERRED',
    metadataPatch: params.metadataPatch,
  });
}

async function runObservation(params: {
  orderId: string;
  kind: CanonicalObservationKind;
  chainId: number;
  txHashes?: string[];
  timeoutMs?: number;
  pollMs?: number;
  forceRefresh?: boolean;
}): Promise<CanonicalOrderObservationResult> {
  const order = await getCanonicalOrderById(params.orderId);
  if (!order) {
    return {
      order: null,
      confirmation: {
        success: false,
        kind: 'uncertain',
        reason: 'canonical_order_missing',
        visible: false,
      },
      resolvedState: 'UNKNOWN',
      resolvedTxHash: null,
      visible: false,
      final: false,
      reasonCode: 'canonical_order_missing',
    };
  }

  const txHashes = deriveTxHashes(order, params.kind, params.txHashes);
  const primaryTxHash = txHashes[0] || null;
  if (!primaryTxHash) {
    await scheduleCanonicalOrderObservation({
      orderId: order.id,
      kind: params.kind,
      reasonCode: 'order_observation_uncertain',
      metadataPatch: {
        lastObservedTxState: 'missing_tx_hash',
      },
    }).catch(() => null);
    const updated = await getCanonicalOrderById(order.id);
    return {
      order: updated,
      confirmation: {
        success: false,
        kind: 'uncertain',
        reason: 'missing_tx_hash',
        visible: false,
      },
      resolvedState: updated?.lifecycleState || order.lifecycleState,
      resolvedTxHash: null,
      visible: false,
      final: false,
      reasonCode: 'missing_tx_hash',
    };
  }

  const confirmation = await waitForTransactionConfirmation({
    txHash: primaryTxHash,
    chainId: params.chainId,
    dexName: params.kind === 'buy' ? 'copytrade_order_buy' : 'copytrade_order_exit',
    timeoutMs: params.timeoutMs,
    pollMs: params.pollMs,
    forceRefresh: params.forceRefresh,
    allowCachedUncertain: false,
  });

  const observedTxHash = confirmation.resolvedTxHash || primaryTxHash;
  const observedAt = new Date().toISOString();

  if (confirmation.kind === 'confirmed_success') {
    const lifecycleState = params.kind === 'buy'
      ? (String(order.lifecycleState || '').startsWith('EXIT_') || String(order.lifecycleState || '').toUpperCase() === 'SELL_PREEMPTED'
          ? order.lifecycleState
          : 'BUY_VISIBLE')
      : (String(order.lifecycleState || '').toUpperCase() === 'EXIT_CONFIRMED_CLOSED' ? order.lifecycleState : 'EXIT_VISIBLE');
    const updated = await clearCanonicalOrderObservation({
      orderId: order.id,
      lifecycleState,
      reasonCode: params.kind === 'buy' ? 'buy_tx_visible' : 'ok_exit_visible',
      eventType: 'ORDER_OBSERVATION_CONFIRMED_SUCCESS',
      metadataPatch: {
        lastObservedTxHash: observedTxHash,
        lastObservedTxState: 'confirmed_success',
        lastObservedAt: observedAt,
        ...(params.kind === 'buy' ? { buyTxHash: observedTxHash } : { sellTxHash: observedTxHash }),
      },
    }).catch(() => order);
    return {
      order: updated,
      confirmation,
      resolvedState: updated?.lifecycleState || lifecycleState,
      resolvedTxHash: observedTxHash,
      visible: true,
      final: true,
      reasonCode: params.kind === 'buy' ? 'buy_tx_visible' : 'ok_exit_visible',
    };
  }

  if (confirmation.kind === 'confirmed_failed') {
    const updated = await clearCanonicalOrderObservation({
      orderId: order.id,
      reasonCode: confirmation.reason || 'failed_terminal',
      eventType: 'ORDER_OBSERVATION_CONFIRMED_FAILED',
      metadataPatch: {
        lastObservedTxHash: observedTxHash,
        lastObservedTxState: 'confirmed_failed',
        lastObservedAt: observedAt,
      },
    }).catch(() => order);
    return {
      order: updated,
      confirmation,
      resolvedState: updated?.lifecycleState || order.lifecycleState,
      resolvedTxHash: observedTxHash,
      visible: Boolean(confirmation.visible),
      final: true,
      reasonCode: confirmation.reason || 'failed_terminal',
    };
  }

  const reasonCode = confirmation.kind === 'timeout'
    ? 'order_observation_timeout'
    : 'order_observation_uncertain';
  const updated = await scheduleCanonicalOrderObservation({
    orderId: order.id,
    kind: params.kind,
    txHash: observedTxHash,
    reasonCode,
    metadataPatch: {
      lastObservedTxHash: observedTxHash,
      lastObservedTxState: confirmation.kind,
      lastObservedAt: observedAt,
      ...(params.kind === 'buy' ? { buyTxHash: observedTxHash } : { sellTxHash: observedTxHash }),
    },
  }).catch(() => order);
  return {
    order: updated,
    confirmation,
    resolvedState: updated?.lifecycleState || resolveAwaitingLifecycle(order, params.kind),
    resolvedTxHash: observedTxHash,
    visible: Boolean(confirmation.visible),
    final: false,
    reasonCode,
  };
}

export async function observeCanonicalOrderState(params: {
  orderId: string;
  kind: CanonicalObservationKind;
  chainId: number;
  txHashes?: string[];
  timeoutMs?: number;
  pollMs?: number;
  forceRefresh?: boolean;
}): Promise<CanonicalOrderObservationResult> {
  const key = buildObservationKey(params.orderId, params.kind);
  const existing = inflightObservations.get(key);
  if (existing) return existing;

  const task = runObservation(params).finally(() => {
    const current = inflightObservations.get(key);
    if (current === task) {
      inflightObservations.delete(key);
    }
  });
  inflightObservations.set(key, task);
  return task;
}
