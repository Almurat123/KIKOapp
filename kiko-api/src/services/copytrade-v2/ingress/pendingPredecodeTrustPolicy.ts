type PendingPredecodeLike = {
  timing?: {
    source?: string;
  } | null;
} | null | undefined;

export function getPendingPredecodeSource(snapshot: PendingPredecodeLike): string {
  return String(snapshot?.timing?.source || '').trim().toLowerCase();
}

export function isPendingPredecodeTrusted(snapshot: PendingPredecodeLike): boolean {
  const source = getPendingPredecodeSource(snapshot);
  // Trusted only when swap was decoded from a confirmed receipt prefetch path.
  return source.includes('pending_prefetch');
}

