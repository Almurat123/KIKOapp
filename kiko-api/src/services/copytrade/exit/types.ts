import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { AttributedPositionLike, PositionAttributionReasonCode } from '../positions/positionAttribution.js';
import type { PendingAttributedPositionLotLike } from '../positions/pendingAttributedPositionLedger.js';

export type PositionExitReason = 'mirror_sell' | 'take_profit' | 'stop_loss' | 'manual' | 'dynamic_take_profit';
export type SellRoutePolicy = 'external_primary' | 'direct_primary';

export interface ExitTokenInfo {
  price?: number;
  symbol?: string;
}

export interface ExitNoopPlan {
  kind: 'noop';
  action: 'keep_open' | 'close_position' | 'quarantine';
  closeReason?: 'balance_empty' | 'balance_dust';
  balance: bigint;
  decimals: number;
  balanceUsd: number;
  isMirrorSell: boolean;
  attributedReasonCode?: PositionAttributionReasonCode;
  attributionMetrics?: Record<string, unknown>;
  positions: AttributedPositionLike[];
}

export interface EvmExitSwapPlan {
  kind: 'swap';
  userId: string;
  walletAddress: string;
  tokenAddress: string;
  chainId: number;
  exitReason: PositionExitReason;
  tokenInfo: ExitTokenInfo;
  balance: bigint;
  decimals: number;
  balanceUsd: number;
  attributedBalance: bigint;
  amountInHuman: string;
  retryAmountInHuman: string;
  initialSlippageBps: number;
  retrySlippageBps: number;
  executionMode: CopyTradeExecutionMode;
  sellRoutePolicy: SellRoutePolicy;
  runtimeContext: OrderRuntimeContext;
  positions: AttributedPositionLike[];
  pendingAttributedLotIds?: string[];
  attributedReasonCode: PositionAttributionReasonCode;
  attributionMetrics?: Record<string, unknown>;
  hasExternalBalance: boolean;
}

export type EvmExitPlan = ExitNoopPlan | EvmExitSwapPlan;

export interface PendingAttributedExitContext {
  pendingLots?: PendingAttributedPositionLotLike[];
}

export interface EvmExitExecutionResult {
  success: boolean;
  txHash?: string;
  runtimeContext?: OrderRuntimeContext;
  error?: string;
  isPartialSell: boolean;
}
