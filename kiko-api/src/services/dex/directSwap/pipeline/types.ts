import type { DirectSwapResult, DirectSwapTraceState } from '../types.js';
import type { DexStrategy } from '../../directSwapTypes.js';

export interface DirectSwapRunContext {
  chainId: number;
  traceId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountInWei: bigint;
  executionMode: 'safe' | 'normal' | 'turbo';
  startedAtMs: number;
}

export interface ResolvedHintFastPathResult {
  success: boolean;
  reason?: string;
  selectedHint?: {
    kind: string;
    dex?: string;
    poolAddress?: string;
  };
  errorCode?: string;
  result?: DirectSwapResult;
}

export interface TurboFlowResult {
  success: boolean;
  provider?: DirectSwapResult['provider'];
  error?: string;
  phase: 'single_pool' | 'rescue' | 'none';
  result?: DirectSwapResult;
}

export interface StrategyEvaluationContext {
  referenceQuote: bigint;
  minReasonable: bigint;
  forceV4: boolean;
  strategies: DexStrategy[];
}

export interface DirectSwapPipelineDeps {
  traceState: DirectSwapTraceState;
  traceId: string;
}
