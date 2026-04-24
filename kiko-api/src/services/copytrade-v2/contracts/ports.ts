import type { DecodedSwap } from '../../txDecoder.js';
import type { CopytradeOrderAggregate } from './aggregate.js';
import type { CopytradeLifecycleState, CopytradeReasonCode } from './lifecycle.js';
import type { CopytradeMode } from './modePolicy.js';
import type { CopytradeExecutionOutcome } from './outcomes.js';

export interface CopytradeIngressSignal {
  targetWallet: string;
  swap: DecodedSwap;
  chainId: number;
  sourceTxFrom?: string;
  detectedAt?: number;
  mode?: CopytradeMode;
  ctIssueHintId?: `CT-${string}`;
}

export interface CopytradeOrderRepositoryPort {
  claimOrLoad(
    signal: CopytradeIngressSignal,
    mode: CopytradeMode,
  ): Promise<{
    order: CopytradeOrderAggregate;
    claimed: boolean;
    requestKeyMismatch?: boolean;
    expectedPayloadHash?: string;
    actualPayloadHash?: string | null;
  }>;

  updateState(params: {
    orderId: string;
    lifecycleState: CopytradeLifecycleState;
    reasonCode: CopytradeReasonCode;
    retryCount?: number;
    direction?: CopytradeOrderAggregate['direction'];
    lastExecutionAt?: Date;
    closedAt?: Date | null;
    metadata?: Record<string, unknown>;
  }): Promise<CopytradeOrderAggregate>;

  getById(orderId: string): Promise<CopytradeOrderAggregate | null>;

  list(params?: {
    userId?: string;
    chainId?: number;
    states?: CopytradeLifecycleState[];
    take?: number;
  }): Promise<CopytradeOrderAggregate[]>;
}

export interface CopytradeEventStorePort {
  append(params: {
    orderId: string;
    eventType: string;
    lifecycleState: CopytradeLifecycleState;
    reasonCode: CopytradeReasonCode;
    payload?: Record<string, unknown>;
  }): Promise<void>;
}

export interface CopytradeExecutionPort {
  execute(signal: CopytradeIngressSignal, order: CopytradeOrderAggregate): Promise<CopytradeExecutionOutcome>;
}

export interface CopytradeExecutionRecorderPort {
  record(params: {
    orderId: string;
    attemptNo: number;
    mode: string;
    outcome: CopytradeExecutionOutcome;
  }): Promise<void>;
}

export interface CopytradeRetrySchedulerPort {
  schedule(params: {
    orderId: string;
    retryAt: Date;
    reasonCode: CopytradeReasonCode;
    attemptNo: number;
  }): Promise<void>;
}

export interface CopytradeObservabilityPort {
  emit(event: string, fields: Record<string, unknown>): void;
}
