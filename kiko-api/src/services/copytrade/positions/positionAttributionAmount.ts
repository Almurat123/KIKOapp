export function hasPositiveAttributionAmount(value: unknown): boolean {
  const normalized = String(value ?? '').trim();
  if (!normalized) return false;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return false;
  return Number(normalized) > 0;
}
