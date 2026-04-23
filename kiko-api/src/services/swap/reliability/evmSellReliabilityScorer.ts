import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import { resolveEvmApprovalPolicy } from '../capabilities/evmApprovalPolicy.js';

export interface EvmSellReliabilityDecision {
  preferPermit2: boolean;
  allowSignedPermit: boolean;
  reasonCode?:
  | 'copytrade_exit_explicit_approval_preferred'
  | 'confirmed_sell_explicit_approval_preferred'
  | 'wallet_erc20_input_explicit_approval_preferred'
  | 'native_input_allowance_holder_preferred';
}

export function scoreEvmSellReliability(params: {
  chainId: number;
  isSellTx: boolean;
  tokenInRequiresApproval?: boolean;
  waitForConfirmation?: boolean;
  runtimeContext?: OrderRuntimeContext;
}): EvmSellReliabilityDecision {
  return resolveEvmApprovalPolicy(params);
}
