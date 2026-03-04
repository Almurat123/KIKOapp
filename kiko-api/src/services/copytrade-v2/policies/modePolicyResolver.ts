import type { CopytradeMode, CopytradeModePolicy, CopytradeModeResolver } from '../contracts/modePolicy.js';
import { turboPolicy } from './modes/turboPolicy.js';
import { normalPolicy } from './modes/normalPolicy.js';
import { safetyPolicy } from './modes/safetyPolicy.js';

const policyMap: Record<CopytradeMode, CopytradeModePolicy> = {
  turbo: turboPolicy,
  normal: normalPolicy,
  safety: safetyPolicy,
};

export class DefaultCopytradeModeResolver implements CopytradeModeResolver {
  resolve(mode: CopytradeMode): CopytradeModePolicy {
    return policyMap[mode] || normalPolicy;
  }
}

export function resolveSignalMode(input?: string | null): CopytradeMode {
  const normalized = String(input || '').trim().toLowerCase();
  if (normalized === 'turbo') return 'turbo';
  if (normalized === 'safety' || normalized === 'safe') return 'safety';
  return 'normal';
}
