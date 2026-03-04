import { resolveCopytradeTransition } from './copytradeTransitionPolicy.js';
import type {
  CopytradeDomainEvent,
  CopytradeStateContext,
  CopytradeTransitionDecision,
} from './copytradeStateTypes.js';

export function handleCopytradeStateEvent(
  context: CopytradeStateContext,
  event: CopytradeDomainEvent,
): CopytradeTransitionDecision {
  return resolveCopytradeTransition(context, event);
}
