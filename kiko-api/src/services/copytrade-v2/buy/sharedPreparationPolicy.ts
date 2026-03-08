import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';

export type CopytradeSharedPreparationPolicy = {
  allTurbo: boolean;
  skipLiquidityScan: boolean;
  skipMarketCapDerivation: boolean;
};

export function resolveCopytradeSharedPreparationPolicy<T>(
  configs: readonly T[],
  resolveExecutionMode: (config: T) => CopyTradeExecutionMode
): CopytradeSharedPreparationPolicy {
  const allTurbo =
    configs.length > 0 &&
    configs.every((config) => String(resolveExecutionMode(config) || '').toLowerCase() === 'turbo');

  return {
    allTurbo,
    skipLiquidityScan: allTurbo,
    skipMarketCapDerivation: allTurbo,
  };
}
