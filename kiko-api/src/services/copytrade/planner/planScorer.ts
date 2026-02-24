import type { PlanScore, TemplateCandidate } from './types.js';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function scoreTemplateCandidate(candidate: TemplateCandidate): PlanScore {
  const executable = candidate.isActive ? 1 : 0;
  const slippage = clamp01(1 - ((candidate.avgSlippageBps || 500) / 5000));
  const gas = (() => {
    const gas = Number(candidate.avgGasUsed || '350000');
    if (!Number.isFinite(gas) || gas <= 0) return 0.3;
    return clamp01(1 - (gas / 2000000));
  })();
  const sampleConfidence = clamp01((candidate.successRate * 0.7) + (Math.min(candidate.sampleCount, 200) / 200) * 0.3);

  const value =
    executable * 0.45
    + slippage * 0.2
    + gas * 0.15
    + sampleConfidence * 0.2;

  return {
    value,
    breakdown: {
      executable,
      slippage,
      gas,
      sampleConfidence
    }
  };
}
