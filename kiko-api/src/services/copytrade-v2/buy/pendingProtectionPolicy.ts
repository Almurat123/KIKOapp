function normalizeEntryTxHash(value: unknown): string {
  return String(value || '').trim();
}

const RECOVERABLE_PENDING_PREFIX = 'SUBMISSION_UNRESOLVED_';

export function isPlaceholderPendingEntryTxHash(value: unknown): boolean {
  const txHash = normalizeEntryTxHash(value);
  return txHash.length === 0 || txHash.startsWith('PENDING_');
}

export function buildRecoverablePendingEntryTxHash(seed?: string | null): string {
  const normalizedSeed = String(seed || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  return `${RECOVERABLE_PENDING_PREFIX}${normalizedSeed || Date.now()}`;
}

export function isRecoverablePendingEntryTxHash(value: unknown): boolean {
  const txHash = normalizeEntryTxHash(value);
  return /^0x[a-fA-F0-9]{64}$/.test(txHash) || txHash.startsWith(RECOVERABLE_PENDING_PREFIX);
}

export function shouldTerminalFailStalePendingPosition(entryTxHash: unknown): boolean {
  return !isRecoverablePendingEntryTxHash(entryTxHash);
}
