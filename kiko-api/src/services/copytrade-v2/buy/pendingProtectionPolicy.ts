function normalizeEntryTxHash(value: unknown): string {
  return String(value || '').trim();
}

export function isPlaceholderPendingEntryTxHash(value: unknown): boolean {
  const txHash = normalizeEntryTxHash(value);
  return txHash.length === 0 || txHash.startsWith('PENDING_');
}

export function isRecoverablePendingEntryTxHash(value: unknown): boolean {
  const txHash = normalizeEntryTxHash(value);
  return /^0x[a-fA-F0-9]{64}$/.test(txHash);
}

export function shouldTerminalFailStalePendingPosition(entryTxHash: unknown): boolean {
  return !isRecoverablePendingEntryTxHash(entryTxHash);
}
