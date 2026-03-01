import { normalizeTxIdentity } from '../../utils/txIdentity.js';

export function normalizeTxHash(chainId: number, txHash?: string | null): string | null {
  return normalizeTxIdentity(chainId, txHash);
}

export function mergeTxHashAliases(chainId: number, existing: string[], txHashes: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...existing, ...txHashes]) {
    const normalized = normalizeTxHash(chainId, raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}
