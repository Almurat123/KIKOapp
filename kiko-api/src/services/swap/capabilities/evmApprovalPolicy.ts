import type { OrderRuntimeContext } from '../../order-runtime/types.js';

export interface EvmApprovalPolicyDecision {
  preferPermit2: boolean;
  allowSignedPermit: boolean;
  reasonCode?:
  | 'copytrade_exit_explicit_approval_preferred'
  | 'confirmed_sell_explicit_approval_preferred'
  | 'wallet_erc20_input_explicit_approval_preferred';
}

function isCopytradeExit(runtimeContext?: OrderRuntimeContext): boolean {
  return String(runtimeContext?.metadata?.flow || '') === 'copytrade_exit';
}

function isWalletSellRuntime(runtimeContext?: OrderRuntimeContext): boolean {
  const mode = String(runtimeContext?.mode || '').trim().toLowerCase();
  return mode === 'allowance' || mode === 'swap-card' || mode === 'fast-swap';
}

export function resolveEvmApprovalPolicy(params: {
  chainId: number;
  isSellTx: boolean;
  tokenInRequiresApproval?: boolean;
  waitForConfirmation?: boolean;
  runtimeContext?: OrderRuntimeContext;
}): EvmApprovalPolicyDecision {
  // CONTEXT MEMORY
  // Updated: 2026-04-23
  // Status: mixed
  // Why: confirmed wallet sells should stay on 0x allowance-holder instead of Permit2.
  // Runtime logs showed Base swap-card sells approving Permit2, then the actual swap tx
  // reverted. Using explicit approval for confirmed sell flows keeps the spender aligned
  // with 0x and removes a confusing auth mode from the wallet UI path.
  // Debug Goal: confirmed sell flows use explicit 0x approval; buy flows can still use Permit2.
  // Search Tags: wallet page permit2 spender not 0x confirmed sell explicit approval
  // Invariants:
  // - wallet EVM swaps with ERC20 input do not prefer Permit2 or signed permits.
  // - native-input buy flows keep Permit2 enabled because no token approval is needed.
  // Failure Modes:
  // - user sees Permit2 / uniswap-style spender on wallet-page sell approval.
  // - permit2 sell path succeeds on approval but fails on execution with limited diagnosis.
  // - allowance-mode chat sells skip confirmation wait, accidentally re-enable Permit2,
  //   and then broadcast a quote that still needs an off-chain signature.
  const walletRuntime = isWalletSellRuntime(params.runtimeContext);

  if (params.waitForConfirmation && isCopytradeExit(params.runtimeContext)) {
    return {
      preferPermit2: false,
      allowSignedPermit: false,
      reasonCode: 'copytrade_exit_explicit_approval_preferred'
    };
  }

  if (walletRuntime && params.tokenInRequiresApproval) {
    return {
      preferPermit2: false,
      allowSignedPermit: false,
      reasonCode: 'wallet_erc20_input_explicit_approval_preferred'
    };
  }

  if (!params.isSellTx) {
    return {
      preferPermit2: true,
      allowSignedPermit: true
    };
  }

  if (walletRuntime) {
    return {
      preferPermit2: false,
      allowSignedPermit: false,
      reasonCode: 'confirmed_sell_explicit_approval_preferred'
    };
  }

  if (params.waitForConfirmation) {
    return {
      preferPermit2: false,
      allowSignedPermit: false,
      reasonCode: 'confirmed_sell_explicit_approval_preferred'
    };
  }

  return {
    preferPermit2: true,
    allowSignedPermit: true
  };
}
