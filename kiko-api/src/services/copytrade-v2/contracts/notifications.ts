import type { CopytradeOrderAggregate } from './aggregate.js';
import type { CopytradeReasonCode } from './lifecycle.js';

export type CopytradeNotificationEventType =
  | 'BUY_ACCEPTED'
  | 'BUY_CONFIRMED_OPEN'
  | 'EXIT_SUBMITTED'
  | 'EXIT_CONFIRMED_CLOSED'
  | 'EXECUTION_FAILED'
  | 'SKIPPED';

export interface CopytradeNotificationEvent {
  type: CopytradeNotificationEventType;
  order: CopytradeOrderAggregate;
  reasonCode: CopytradeReasonCode;
  txHash?: string | null;
  sourceTxHash?: string | null;
  error?: string | null;
}
