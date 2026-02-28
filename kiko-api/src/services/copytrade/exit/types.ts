import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';

export type PositionExitReason = 'mirror_sell' | 'take_profit' | 'stop_loss' | 'manual' | 'dynamic_take_profit';
export type SellRoutePolicy = 'external_primary' | 'direct_primary';

export interface ExitTokenInfo {
  price?: number;
  symbol?: string;
}

export interface ExitNoopPlan {
  kind: 'noop';
  action: 'keep_open' | 'close_position';
  closeReason?: 'balance_empty' | 'balance_dust';
  balance: bigint;
  decimals: number;
  balanceUsd: number;
  isMirrorSell: boolean;
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
  amountInHuman: string;
  retryAmountInHuman: string;
  initialSlippageBps: number;
  retrySlippageBps: number;
  executionMode: CopyTradeExecutionMode;
  sellRoutePolicy: SellRoutePolicy;
  runtimeContext: OrderRuntimeContext;
}

export type EvmExitPlan = ExitNoopPlan | EvmExitSwapPlan;

export interface EvmExitExecutionResult {
  success: boolean;
  txHash?: string;
  runtimeContext?: OrderRuntimeContext;
  error?: string;
  isPartialSell: boolean;
}
