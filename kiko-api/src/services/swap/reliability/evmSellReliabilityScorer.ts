import type { OrderRuntimeContext } from '../../order-runtime/types.js';

export interface EvmSellReliabilityDecision {
  preferPermit2: boolean;
  allowSignedPermit: boolean;
  reasonCode?: 'copytrade_exit_explicit_approval_preferred';
}

function isCopytradeExit(runtimeContext?: OrderRuntimeContext): boolean {
  return String(runtimeContext?.metadata?.flow || '') === 'copytrade_exit';
}

export function scoreEvmSellReliability(params: {
  isSellTx: boolean;
  waitForConfirmation?: boolean;
  runtimeContext?: OrderRuntimeContext;
}): EvmSellReliabilityDecision {
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

  return {
    preferPermit2: true,
    allowSignedPermit: true
  };
}
