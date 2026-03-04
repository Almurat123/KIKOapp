import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';
import {
  resolveMaxEntryDeviationBps,
  type EntryDeviationSource,
} from './entryDeviationPolicy.js';

export const NORMAL_MIN_ENTRY_DEVIATION_BPS = 1500;
export const TURBO_MIN_ENTRY_DEVIATION_BPS = 3000;

export type EntryDeviationThresholdPolicy =
  | 'normal_min_1500bps'
  | 'turbo_min_3000bps';

export interface ResolvedEntryDeviationModePolicy {
  maxEntryDeviationBps: number;
  source: EntryDeviationSource;
  reasonCode:
    | 'entry_deviation_config_field'
    | 'entry_deviation_signed_payload'
    | 'entry_deviation_legacy_default';
  thresholdPolicy: EntryDeviationThresholdPolicy;
  modeFloorBps: number;
}

function resolveModeFloorBps(executionMode: CopyTradeExecutionMode): number {
  return executionMode === 'turbo'
    ? TURBO_MIN_ENTRY_DEVIATION_BPS
    : NORMAL_MIN_ENTRY_DEVIATION_BPS;
}

function resolveThresholdPolicy(executionMode: CopyTradeExecutionMode): EntryDeviationThresholdPolicy {
  return executionMode === 'turbo'
    ? 'turbo_min_3000bps'
    : 'normal_min_1500bps';
}

export function resolveEntryDeviationModePolicy(
  config: unknown,
  executionMode: CopyTradeExecutionMode,
): ResolvedEntryDeviationModePolicy {
  const base = resolveMaxEntryDeviationBps(config);
  const modeFloorBps = resolveModeFloorBps(executionMode);

  return {
    ...base,
    maxEntryDeviationBps: Math.max(base.maxEntryDeviationBps, modeFloorBps),
    thresholdPolicy: resolveThresholdPolicy(executionMode),
    modeFloorBps,
  };
}
