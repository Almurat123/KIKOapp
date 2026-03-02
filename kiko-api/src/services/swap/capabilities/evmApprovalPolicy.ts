import type { OrderRuntimeContext } from '../../order-runtime/types.js';

export interface EvmApprovalPolicyDecision {
  preferPermit2: boolean;
  allowSignedPermit: boolean;
  reasonCode?: 'copytrade_exit_explicit_approval_preferred' | 'bsc_confirmed_sell_explicit_approval_preferred';
}

function isCopytradeExit(runtimeContext?: OrderRuntimeContext): boolean {
  return String(runtimeContext?.metadata?.flow || '') === 'copytrade_exit';
}

export function resolveEvmApprovalPolicy(params: {
  chainId: number;
  isSellTx: boolean;
  waitForConfirmation?: boolean;
  runtimeContext?: OrderRuntimeContext;
}): EvmApprovalPolicyDecision {
  if (!params.isSellTx) {
    return {
      preferPermit2: true,
      allowSignedPermit: true
    };
  }

  if (params.waitForConfirmation && isCopytradeExit(params.runtimeContext)) {
    return {
      preferPermit2: false,
      allowSignedPermit: false,
      reasonCode: 'copytrade_exit_explicit_approval_preferred'
    };
  }

  if (params.chainId === 56 && params.waitForConfirmation) {
    return {
      preferPermit2: false,
      allowSignedPermit: false,
      reasonCode: 'bsc_confirmed_sell_explicit_approval_preferred'
    };
  }

  return {
    preferPermit2: true,
    allowSignedPermit: true
  };
}
