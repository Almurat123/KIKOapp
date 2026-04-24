import type { TxLifecycleResult } from '../txLifecycle.js';

export type OrderRuntimeMode = 'fast-swap' | 'swap-card' | 'allowance' | 'copytrade' | 'launchpad' | 'direct' | 'unknown';

export type OrderSide = 'buy' | 'sell' | 'unknown';

export type OrderState =
  | 'created'
  | 'route_selected'
  | 'tx_prepared'
  | 'send_started'
  | 'hash_accepted'
  | 'rpc_uncertain'
  | 'mempool_visible'
  | 'included'
  | 'confirmed_success'
  | 'confirmed_failed'
  | 'fallback_started'
  | 'fallback_succeeded'
  | 'fallback_failed'
  | 'failed';

export type OrderReasonCode =
  | 'none'
  | 'rpc_uncertain'
  | 'pending_visibility'
  | 'underpriced'
  | 'nonce_conflict'
  | 'send_rejected'
  | 'visibility_timeout'
  | 'route_not_found'
  | 'direct_timeout'
  | 'fallback_skipped'
  | 'duplicate_lock'
  | 'insufficient_balance'
  | 'reverted'
  | 'unknown';

export interface OrderRouteSelection {
  provider?: string;
  poolAddress?: string;
  poolKind?: 'v4' | 'v3' | 'v2' | 'aerodrome' | 'infinity' | 'external';
  router?: string;
}

export interface OrderTiming {
  createdAt: number;
  routeStartedAt?: number;
  routeSelectedAt?: number;
  txPreparedAt?: number;
  sendStartedAt?: number;
  hashAcceptedAt?: number;
  visibleAt?: number;
  includedAt?: number;
  finishedAt?: number;
}

export interface TxAttempt {
  id: string;
  attempt: number;
  channel: 'privy_sendtx' | 'raw_broadcast' | 'local_signer' | 'flashbots' | 'external' | 'unknown';
  state: 'created' | 'sending' | 'accepted' | 'uncertain' | 'visible' | 'confirmed_success' | 'confirmed_failed' | 'failed';
  txHash?: string;
  nonce?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  startedAt: number;
  updatedAt: number;
  reasonCode?: OrderReasonCode;
  error?: string;
}

export interface OrderRuntimeContext {
  orderId: string;
  requestKey?: string;
  chainId: number;
  userId: string;
  walletAddress: string;
  side: OrderSide;
  mode: OrderRuntimeMode;
  state: OrderState;
  reasonCode: OrderReasonCode;
  sourceTxHash?: string;
  canonicalTxHash?: string;
  relatedTxHashes: string[];
  route: OrderRouteSelection;
  timing: OrderTiming;
  attempts: TxAttempt[];
  fallbackUsed: boolean;
  metadata: Record<string, string | number | boolean | null | undefined>;
  lastLifecycle?: TxLifecycleResult;
}

export interface OrderRuntimeSnapshot {
  orderId: string;
  requestKey?: string;
  chainId: number;
  userId: string;
  walletAddress: string;
  side: OrderSide;
  mode: OrderRuntimeMode;
  state: OrderState;
  reasonCode: OrderReasonCode;
  sourceTxHash?: string;
  canonicalTxHash?: string;
  relatedTxHashes: string[];
  route: OrderRouteSelection;
  attempts: TxAttempt[];
  fallbackUsed: boolean;
  metrics: {
    routeMs: number | null;
    sendMs: number | null;
    visibleMs: number | null;
    totalMs: number | null;
  };
  lastLifecycle?: TxLifecycleResult;
  metadata: Record<string, string | number | boolean | null | undefined>;
}
