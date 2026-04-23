import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import { resolveEvmApprovalPolicy } from '../capabilities/evmApprovalPolicy.js';

export interface EvmSellReliabilityDecision {
  preferPermit2: boolean;
  allowSignedPermit: boolean;
  reasonCode?: 'copytrade_exit_explicit_approval_preferred' | 'confirmed_sell_explicit_approval_preferred';
}

export function scoreEvmSellReliability(params: {
  chainId: number;
  isSellTx: boolean;
  waitForConfirmation?: boolean;
  runtimeContext?: OrderRuntimeContext;
}): EvmSellReliabilityDecision {
  return resolveEvmApprovalPolicy(params);
}
