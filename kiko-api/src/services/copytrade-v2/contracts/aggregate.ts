import type { CopytradeLifecycleState, CopytradeReasonCode } from './lifecycle.js';
import type { CopytradeMode } from './modePolicy.js';

export type CopytradeOrderDirection = 'buy' | 'sell' | 'token_swap' | 'unknown';

export interface CopytradeOrderIdentity {
  chainId: number;
  txHash: string;
  targetWallet: string;
  tokenIn: string;
  tokenOut: string;
}

export interface CopytradeOrderAggregate extends CopytradeOrderIdentity {
  id: string;
  canonicalKey?: string | null;
  requestKey: string;
  requestPayloadHash?: string | null;
  mode: CopytradeMode;
  lifecycleState: CopytradeLifecycleState;
  lastReasonCode: CopytradeReasonCode;
  retryCount: number;
  direction: CopytradeOrderDirection;
  userId?: string | null;
  configId?: string | null;
  detectedAt?: Date | null;
  lastExecutionAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | null;
  metadata?: Record<string, unknown>;
}
