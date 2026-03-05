import type { CopytradeMode } from '../contracts/modePolicy.js';

export interface NonceConflictDecision {
  matched: boolean;
  retryDelayMs: number;
  hint: 'nonce_too_low' | 'nonce_expired' | 'replacement_underpriced' | 'nonce_conflict';
  strategy: 'aggressive_reprice' | 'balanced_backoff' | 'strict_backoff';
}

const NONCE_HINT_PATTERNS: Array<{ hint: NonceConflictDecision['hint']; patterns: string[] }> = [
  { hint: 'nonce_too_low', patterns: ['nonce too low'] },
  { hint: 'nonce_expired', patterns: ['nonce has already been used', 'already known nonce', 'invalid nonce'] },
  { hint: 'replacement_underpriced', patterns: ['replacement transaction underpriced'] },
  { hint: 'nonce_conflict', patterns: ['nonce', 'already known', 'already imported'] },
];

function resolveHint(message: string): NonceConflictDecision['hint'] | null {
  for (const item of NONCE_HINT_PATTERNS) {
    if (item.patterns.some((pattern) => message.includes(pattern))) return item.hint;
  }
  return null;
}

function resolveRetryDelayMs(mode: CopytradeMode): number {
  if (mode === 'turbo') return 350;
  if (mode === 'safety') return 2600;
  return 1200;
}

function resolveStrategy(mode: CopytradeMode): NonceConflictDecision['strategy'] {
  if (mode === 'turbo') return 'aggressive_reprice';
  if (mode === 'safety') return 'strict_backoff';
  return 'balanced_backoff';
}

export function resolveNonceConflictDecision(params: {
  error: unknown;
  chainId: number;
  mode: CopytradeMode;
}): NonceConflictDecision {
  if (params.chainId !== 56) {
    return {
      matched: false,
      retryDelayMs: 0,
      hint: 'nonce_conflict',
      strategy: 'balanced_backoff',
    };
  }

  const message = String((params.error as any)?.message || params.error || '').toLowerCase();
  const hint = resolveHint(message);
  if (!hint) {
    return {
      matched: false,
      retryDelayMs: 0,
      hint: 'nonce_conflict',
      strategy: 'balanced_backoff',
    };
  }

  return {
    matched: true,
    retryDelayMs: resolveRetryDelayMs(params.mode),
    hint,
    strategy: resolveStrategy(params.mode),
  };
}
