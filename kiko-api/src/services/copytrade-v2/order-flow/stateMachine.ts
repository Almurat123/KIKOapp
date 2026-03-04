import {
  resolveLifecycleTransition,
  type CopytradeLifecycleEvent,
  type CopytradeReasonCode,
  type CopytradeTransitionDecision,
} from '../contracts/lifecycle.js';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';

export function applyOrderLifecycleEvent(
  order: CopytradeOrderAggregate,
  event: CopytradeLifecycleEvent,
  reasonCode?: CopytradeReasonCode,
): CopytradeTransitionDecision {
  return resolveLifecycleTransition({
    current: order.lifecycleState,
    event,
    reasonCode,
  });
}
