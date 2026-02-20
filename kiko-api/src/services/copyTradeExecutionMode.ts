export const COPYTRADE_EXECUTION_MODE_VALUES = ['safe', 'normal', 'turbo'] as const;

export type CopyTradeExecutionMode = typeof COPYTRADE_EXECUTION_MODE_VALUES[number];

export function parseExecutionModeStrict(mode: unknown): CopyTradeExecutionMode | null {
  if (typeof mode !== 'string') return null;
  const normalized = mode.trim().toLowerCase();
  if (normalized === 'safe' || normalized === 'normal' || normalized === 'turbo') {
    return normalized;
  }
  return null;
}

export function resolveExecutionModeFromConfig(args: {
  requested?: unknown;
  legacyDisableTokenInfo?: unknown;
  fallback?: CopyTradeExecutionMode;
}): { mode: CopyTradeExecutionMode; valid: boolean } {
  const fallback = args.fallback || 'normal';

  if (args.requested !== undefined) {
    const mode = parseExecutionModeStrict(args.requested);
    if (!mode) return { mode: fallback, valid: false };
    return { mode, valid: true };
  }

  if (typeof args.legacyDisableTokenInfo === 'boolean') {
    return { mode: args.legacyDisableTokenInfo ? 'turbo' : 'normal', valid: true };
  }

  return { mode: fallback, valid: true };
}

export function isTurboMode(mode: unknown): mode is 'turbo' {
  return mode === 'turbo';
}

export function isSafeMode(mode: unknown): mode is 'safe' {
  return mode === 'safe';
}

export function isNormalMode(mode: unknown): mode is 'normal' {
  return mode === 'normal';
}
