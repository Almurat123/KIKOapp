import type { FeeContext } from '../../platformFeeService.js';

export type SolDirectProvider = 'pumpfun' | 'pumpswap' | 'raydium_launchlab';

export type SolDirectFailureReason =
  | 'unsupported_provider'
  | 'missing_creator'
  | 'pool_not_found'
  | 'insufficient_liquidity'
  | 'invalid_amount'
  | 'build_failed'
  | 'send_failed';

export type SolDirectExecutionRequest = {
  userId: string;
  mint: string;
  amountAtomic: string;
  isBuy: boolean;
  slippageBps: number;
  provider: SolDirectProvider;
  feeContext?: FeeContext;
  creatorAddress?: string | null;
  poolId?: string | null;
};

export type SolDirectExecutionResult =
  | {
      ok: true;
      txHash: string;
      provider: SolDirectProvider;
      route: 'direct';
      metadata?: Record<string, unknown>;
    }
  | {
      ok: false;
      provider: SolDirectProvider;
      reasonCode: SolDirectFailureReason;
      message: string;
      metadata?: Record<string, unknown>;
    };

export type SolDirectLiquiditySnapshot = {
  liquidityUsd: number;
  provider: SolDirectProvider;
  reliable: boolean;
  poolCount: number;
  metadata?: Record<string, unknown>;
};
