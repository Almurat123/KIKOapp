import type { DirectSwapResult } from '../types.js';

export function buildTimelineMs(params: {
  startedAtMs: number;
  poolDiscoveryDoneAtMs: number;
  strategyStartAtMs: number;
  executionStartAtMs: number;
  finishedAtMs: number;
}): {
  poolDiscovery: number | null;
  strategyWait: number | null;
  executionWait: number | null;
  execution: number | null;
} {
  const {
    startedAtMs,
    poolDiscoveryDoneAtMs,
    strategyStartAtMs,
    executionStartAtMs,
    finishedAtMs
  } = params;

  return {
    poolDiscovery: poolDiscoveryDoneAtMs > 0 ? poolDiscoveryDoneAtMs - startedAtMs : null,
    strategyWait: poolDiscoveryDoneAtMs > 0 && strategyStartAtMs > 0
      ? strategyStartAtMs - poolDiscoveryDoneAtMs
      : null,
    executionWait: strategyStartAtMs > 0 && executionStartAtMs > 0
      ? executionStartAtMs - strategyStartAtMs
      : null,
    execution: executionStartAtMs > 0 ? finishedAtMs - executionStartAtMs : null
  };
}

export function withFailureCode(result: DirectSwapResult, code: string): DirectSwapResult {
  if (!result.error) return result;
  if (String(result.error || '').startsWith('failed_')) return result;
  return {
    ...result,
    error: `${code}: ${result.error}`
  };
}
