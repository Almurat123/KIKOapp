export function normalizeTxHash(txHash?: string | null): string | null {
  if (!txHash) return null;
  const normalized = String(txHash).toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

export function mergeTxHashAliases(existing: string[], txHashes: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...existing, ...txHashes]) {
    const normalized = normalizeTxHash(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}
