import type { OrderReasonCode, OrderState } from './types.js';

const TRANSITIONS: Record<OrderState, ReadonlySet<OrderState>> = {
  created: new Set(['route_selected', 'failed']),
  route_selected: new Set(['tx_prepared', 'failed', 'fallback_started']),
  tx_prepared: new Set(['send_started', 'failed', 'fallback_started']),
  send_started: new Set(['hash_accepted', 'rpc_uncertain', 'failed', 'fallback_started']),
  hash_accepted: new Set(['rpc_uncertain', 'mempool_visible', 'included', 'confirmed_success', 'confirmed_failed', 'fallback_started', 'failed']),
  rpc_uncertain: new Set(['hash_accepted', 'mempool_visible', 'included', 'confirmed_success', 'confirmed_failed', 'fallback_started', 'failed']),
  mempool_visible: new Set(['included', 'confirmed_success', 'confirmed_failed', 'fallback_started', 'failed']),
  included: new Set(['confirmed_success', 'confirmed_failed', 'failed']),
  confirmed_success: new Set([]),
  confirmed_failed: new Set([]),
  fallback_started: new Set(['fallback_succeeded', 'fallback_failed', 'failed']),
  fallback_succeeded: new Set(['confirmed_success', 'confirmed_failed', 'failed']),
  fallback_failed: new Set(['failed']),
  failed: new Set([])
};

export function canTransitionOrderState(from: OrderState, to: OrderState): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.has(to) ?? false;
}

export function nextOrderStateForLifecycle(
  current: OrderState,
  lifecycleStatus?: string,
  reasonCode: OrderReasonCode = 'none'
): OrderState {
  const status = String(lifecycleStatus || '').toLowerCase();
  if (!status) return current;
  if (status === 'confirmed_success') return 'confirmed_success';
  if (status === 'confirmed_failed') return 'confirmed_failed';
  if (status === 'visible_pending') return canTransitionOrderState(current, 'mempool_visible') ? 'mempool_visible' : current;
  if (status === 'broadcasted_unseen') return canTransitionOrderState(current, 'rpc_uncertain') ? 'rpc_uncertain' : current;
  if (status === 'dropped_timeout') {
    if (reasonCode === 'rpc_uncertain' || reasonCode === 'pending_visibility') return canTransitionOrderState(current, 'rpc_uncertain') ? 'rpc_uncertain' : current;
    return canTransitionOrderState(current, 'failed') ? 'failed' : current;
  }
  return current;
}
