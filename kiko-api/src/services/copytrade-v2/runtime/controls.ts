import { determineCopyTradeDirection } from '../../copyTradeDirection.js';
import type { DecodedSwap } from '../../txDecoder.js';
import type { CopytradeMode } from '../contracts/modePolicy.js';

export interface CopytradeRuntimeControls {
  globalFreeze: boolean;
  exitOnly: boolean;
  forceMode?: CopytradeMode;
}

export interface CopytradeIngressGuardDecision {
  allowed: boolean;
  reason?: 'global_freeze' | 'exit_only_buy_blocked';
}

function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseForceMode(value: string | undefined): CopytradeMode | undefined {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'turbo') return 'turbo';
  if (normalized === 'normal') return 'normal';
  if (normalized === 'safety' || normalized === 'safe') return 'safety';
  return undefined;
}

export function resolveRuntimeControls(): CopytradeRuntimeControls {
  return {
    globalFreeze: parseBoolean(process.env.COPYTRADE_V2_GLOBAL_FREEZE, false),
    exitOnly: parseBoolean(process.env.COPYTRADE_V2_EXIT_ONLY, false),
    forceMode: parseForceMode(process.env.COPYTRADE_V2_FORCE_MODE),
  };
}

export function evaluateIngressGuards(params: {
  controls: CopytradeRuntimeControls;
  chainId: number;
  swap: DecodedSwap;
}): CopytradeIngressGuardDecision {
  const { controls } = params;

  if (controls.globalFreeze) {
    return {
      allowed: false,
      reason: 'global_freeze',
    };
  }

  if (!controls.exitOnly) {
    return { allowed: true };
  }

  const direction = determineCopyTradeDirection({
    chainId: params.chainId,
    tokenIn: params.swap.tokenIn,
    tokenOut: params.swap.tokenOut,
    cashLegHint: params.swap.cashLegHint,
  });

  if (!direction.isSell) {
    return {
      allowed: false,
      reason: 'exit_only_buy_blocked',
    };
  }

  return { allowed: true };
}
