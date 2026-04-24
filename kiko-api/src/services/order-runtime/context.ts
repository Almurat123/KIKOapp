import type { TxLifecycleResult } from '../txLifecycle.js';
import { inferOrderReasonCode } from './reasonCodes.js';
import { canTransitionOrderState, nextOrderStateForLifecycle } from './stateMachine.js';
import type {
  OrderReasonCode,
  OrderRouteSelection,
  OrderRuntimeContext,
  OrderRuntimeMode,
  OrderRuntimeSnapshot,
  OrderSide,
  OrderState,
  TxAttempt
} from './types.js';

function buildOrderId(seed: {
  requestKey?: string;
  userId: string;
  chainId: number;
  walletAddress: string;
  sourceTxHash?: string;
  tokenIn?: string;
  tokenOut?: string;
}): string {
  const requestKey = String(seed.requestKey || '').trim().toLowerCase();
  if (/^[a-f0-9]{32}$/.test(requestKey)) {
    return `req:${requestKey}`;
  }
  const parts = [
    seed.userId.slice(0, 12),
    String(seed.chainId),
    seed.walletAddress.toLowerCase().slice(2, 10),
    String(seed.sourceTxHash || 'nosource').toLowerCase().slice(2, 10),
    String(seed.tokenIn || 'na').toLowerCase().slice(0, 8),
    String(seed.tokenOut || 'na').toLowerCase().slice(0, 8),
    Date.now().toString(36)
  ];
  return parts.join(':');
}

export function createOrderRuntimeContext(seed: {
  requestKey?: string;
  userId: string;
  chainId: number;
  walletAddress: string;
  side?: OrderSide;
  mode?: OrderRuntimeMode;
  sourceTxHash?: string;
  tokenIn?: string;
  tokenOut?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}): OrderRuntimeContext {
  return {
    orderId: buildOrderId(seed),
    requestKey: seed.requestKey,
    chainId: seed.chainId,
    userId: seed.userId,
    walletAddress: seed.walletAddress,
    side: seed.side || 'unknown',
    mode: seed.mode || 'unknown',
    state: 'created',
    reasonCode: 'none',
    sourceTxHash: seed.sourceTxHash,
    canonicalTxHash: undefined,
    relatedTxHashes: [],
    route: {},
    timing: {
      createdAt: Date.now()
    },
    attempts: [],
    fallbackUsed: false,
    metadata: {
      requestKey: seed.requestKey || null,
      tokenIn: seed.tokenIn || null,
      tokenOut: seed.tokenOut || null,
      ...(seed.metadata || {})
    }
  };
}

export function ensureOrderRuntimeContext<T extends { runtimeContext?: OrderRuntimeContext }>(
  input: T,
  seed: Parameters<typeof createOrderRuntimeContext>[0]
): OrderRuntimeContext {
  if (input.runtimeContext) return input.runtimeContext;
  const ctx = createOrderRuntimeContext(seed);
  input.runtimeContext = ctx;
  return ctx;
}

export function recordOrderRoute(ctx: OrderRuntimeContext, route: Partial<OrderRouteSelection>): void {
  if (!ctx.timing.routeStartedAt) ctx.timing.routeStartedAt = Date.now();
  ctx.route = { ...ctx.route, ...route };
  transitionOrderState(ctx, 'route_selected');
  if (!ctx.timing.routeSelectedAt) {
    ctx.timing.routeSelectedAt = Date.now();
  }
}

export function markOrderPrepared(ctx: OrderRuntimeContext): void {
  transitionOrderState(ctx, 'tx_prepared');
  ctx.timing.txPreparedAt = Date.now();
}

export function markOrderSendStarted(ctx: OrderRuntimeContext): void {
  transitionOrderState(ctx, 'send_started');
  if (!ctx.timing.sendStartedAt) ctx.timing.sendStartedAt = Date.now();
}

export function addOrderAttempt(
  ctx: OrderRuntimeContext,
  payload: Omit<TxAttempt, 'id' | 'updatedAt'> & { id?: string }
): TxAttempt {
  const attempt: TxAttempt = {
    ...payload,
    id: payload.id || `${ctx.orderId}:attempt:${ctx.attempts.length + 1}`,
    updatedAt: Date.now()
  };
  ctx.attempts.push(attempt);
  return attempt;
}

export function updateOrderAttempt(
  ctx: OrderRuntimeContext,
  attemptId: string,
  patch: Partial<TxAttempt>
): TxAttempt | null {
  const attempt = ctx.attempts.find((item) => item.id === attemptId);
  if (!attempt) return null;
  Object.assign(attempt, patch, { updatedAt: Date.now() });
  if (patch.txHash) {
    attachOrderTxHash(ctx, patch.txHash, { canonical: attempt.state !== 'failed' });
  }
  return attempt;
}

export function attachOrderTxHash(
  ctx: OrderRuntimeContext,
  txHash?: string | null,
  options?: { canonical?: boolean }
): void {
  const normalized = String(txHash || '').toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) return;
  if (!ctx.relatedTxHashes.includes(normalized)) {
    ctx.relatedTxHashes.push(normalized);
  }
  if (options?.canonical || !ctx.canonicalTxHash) {
    ctx.canonicalTxHash = normalized;
  }
}

export function recordLifecycleOnOrder(
  ctx: OrderRuntimeContext,
  lifecycle: TxLifecycleResult,
  options?: { reasonCode?: OrderReasonCode }
): void {
  ctx.lastLifecycle = lifecycle;
  attachOrderTxHash(ctx, lifecycle.txHash, { canonical: true });
  const reasonCode = options?.reasonCode || inferOrderReasonCode(lifecycle.lastRpcError || lifecycle.status);
  if (reasonCode !== 'unknown' && reasonCode !== 'none') {
    ctx.reasonCode = reasonCode;
  }
  const nextState = nextOrderStateForLifecycle(ctx.state, lifecycle.status, ctx.reasonCode);
  transitionOrderState(ctx, nextState);
  if (nextState === 'hash_accepted' && !ctx.timing.hashAcceptedAt) ctx.timing.hashAcceptedAt = Date.now();
  if (nextState === 'rpc_uncertain' && !ctx.timing.hashAcceptedAt && lifecycle.txHash) ctx.timing.hashAcceptedAt = Date.now();
  if (nextState === 'mempool_visible' && !ctx.timing.visibleAt) ctx.timing.visibleAt = Date.now();
  if ((nextState === 'confirmed_success' || nextState === 'confirmed_failed') && !ctx.timing.finishedAt) {
    ctx.timing.finishedAt = Date.now();
  }
}

export function markOrderHashAccepted(ctx: OrderRuntimeContext, txHash: string): void {
  attachOrderTxHash(ctx, txHash, { canonical: true });
  transitionOrderState(ctx, 'hash_accepted');
  if (!ctx.timing.hashAcceptedAt) ctx.timing.hashAcceptedAt = Date.now();
}

export function markOrderFallbackStarted(ctx: OrderRuntimeContext, reasonCode?: OrderReasonCode): void {
  ctx.fallbackUsed = true;
  if (reasonCode && reasonCode !== 'none') ctx.reasonCode = reasonCode;
  if (ctx.state === 'failed') {
    ctx.state = 'fallback_started';
    return;
  }
  transitionOrderState(ctx, 'fallback_started');
}

export function markOrderFallbackResult(ctx: OrderRuntimeContext, success: boolean, reasonCode?: OrderReasonCode): void {
  if (reasonCode && reasonCode !== 'none') ctx.reasonCode = reasonCode;
  if (ctx.state === 'failed') {
    ctx.state = success ? 'fallback_succeeded' : 'fallback_failed';
    return;
  }
  transitionOrderState(ctx, success ? 'fallback_succeeded' : 'fallback_failed');
}

export function markOrderFailure(ctx: OrderRuntimeContext, input?: string | null, reasonCode?: OrderReasonCode): void {
  ctx.reasonCode = reasonCode || inferOrderReasonCode(input) || 'unknown';
  transitionOrderState(ctx, 'failed');
  if (!ctx.timing.finishedAt) ctx.timing.finishedAt = Date.now();
}

export function transitionOrderState(ctx: OrderRuntimeContext, nextState: OrderState): void {
  if (!canTransitionOrderState(ctx.state, nextState)) return;
  ctx.state = nextState;
}

export function setOrderMetadata(
  ctx: OrderRuntimeContext,
  patch: Record<string, string | number | boolean | null | undefined>
): void {
  Object.assign(ctx.metadata, patch);
}

export function snapshotOrderRuntime(ctx: OrderRuntimeContext): OrderRuntimeSnapshot {
  const routeMs = ctx.timing.routeStartedAt && ctx.timing.routeSelectedAt
    ? ctx.timing.routeSelectedAt - ctx.timing.routeStartedAt
    : ctx.timing.routeSelectedAt
      ? ctx.timing.routeSelectedAt - ctx.timing.createdAt
      : null;
  const sendMs = ctx.timing.sendStartedAt && ctx.timing.hashAcceptedAt
    ? ctx.timing.hashAcceptedAt - ctx.timing.sendStartedAt
    : null;
  const visibleMs = ctx.timing.hashAcceptedAt && ctx.timing.visibleAt
    ? ctx.timing.visibleAt - ctx.timing.hashAcceptedAt
    : null;
  const totalMs = (ctx.timing.finishedAt || ctx.timing.visibleAt || ctx.timing.hashAcceptedAt)
    ? (ctx.timing.finishedAt || ctx.timing.visibleAt || ctx.timing.hashAcceptedAt || ctx.timing.createdAt) - ctx.timing.createdAt
    : null;
  return {
    orderId: ctx.orderId,
    requestKey: ctx.requestKey,
    chainId: ctx.chainId,
    userId: ctx.userId,
    walletAddress: ctx.walletAddress,
    side: ctx.side,
    mode: ctx.mode,
    state: ctx.state,
    reasonCode: ctx.reasonCode,
    sourceTxHash: ctx.sourceTxHash,
    canonicalTxHash: ctx.canonicalTxHash,
    relatedTxHashes: [...ctx.relatedTxHashes],
    route: { ...ctx.route },
    attempts: ctx.attempts.map((attempt) => ({ ...attempt })),
    fallbackUsed: ctx.fallbackUsed,
    metrics: { routeMs, sendMs, visibleMs, totalMs },
    lastLifecycle: ctx.lastLifecycle ? { ...ctx.lastLifecycle } : undefined,
    metadata: { ...ctx.metadata }
  };
}
