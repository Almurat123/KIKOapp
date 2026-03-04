export const PRE_CONFIRMATION_STRONG_RPC_MIN_AGE_MS = Math.max(
  60_000,
  Number(process.env.COPYTRADE_PRE_CONFIRMATION_STRONG_RPC_MIN_AGE_MS || '120000'),
);

export function shouldDeferStrongRpcMonitoring(createdAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!createdAt) return true;
  const createdAtMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) return true;
  return now - createdAtMs < PRE_CONFIRMATION_STRONG_RPC_MIN_AGE_MS;
}
