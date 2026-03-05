import { normalizeWallet } from '../runtime/chainIdentityNormalizer.js';

type AllowlistDecision = {
  allowed: boolean;
  reasonCode: string;
  envKey: string;
  configuredCount: number;
};

const CHAIN_ENV_SUFFIX: Record<number, string> = {
  1: 'ETH',
  10: 'OPTIMISM',
  56: 'BSC',
  137: 'POLYGON',
  900: 'SOLANA',
  8453: 'BASE',
  42161: 'ARBITRUM',
};

function parseAllowlistFromEnv(raw: string, chainId: number): Set<string> {
  const normalized = String(raw || '').trim();
  if (!normalized) return new Set();
  const entries = normalized
    .split(',')
    .map((value) => normalizeWallet(chainId, value))
    .filter((value) => Boolean(value));
  return new Set(entries);
}

function resolveAllowlistEnvKey(chainId: number): string {
  const suffix = CHAIN_ENV_SUFFIX[chainId];
  if (suffix) return `COPYTRADE_TARGET_ALLOWLIST_${suffix}`;
  return `COPYTRADE_TARGET_ALLOWLIST_${chainId}`;
}

export function evaluateCopytradeTargetAllowlist(chainId: number, targetWallet: string): AllowlistDecision {
  const envKey = resolveAllowlistEnvKey(chainId);
  const allowlist = parseAllowlistFromEnv(process.env[envKey] || '', chainId);
  const normalizedTarget = normalizeWallet(chainId, targetWallet);
  if (!normalizedTarget) {
    return {
      allowed: false,
      reasonCode: 'target_identity_invalid',
      envKey,
      configuredCount: allowlist.size,
    };
  }
  if (allowlist.size === 0) {
    return {
      allowed: false,
      reasonCode: 'target_allowlist_missing',
      envKey,
      configuredCount: 0,
    };
  }
  if (!allowlist.has(normalizedTarget)) {
    return {
      allowed: false,
      reasonCode: 'target_not_allowlisted',
      envKey,
      configuredCount: allowlist.size,
    };
  }
  return {
    allowed: true,
    reasonCode: 'target_allowlisted',
    envKey,
    configuredCount: allowlist.size,
  };
}
