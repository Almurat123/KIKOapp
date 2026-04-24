import crypto from 'node:crypto';

function normalizePart(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function sha256Hex(value: unknown): string {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function md5Hex(value: unknown): string {
  return crypto.createHash('md5').update(stableJson(value)).digest('hex');
}

export interface CopytradeRequestKeyInput {
  chainId: number;
  txHash: string;
  targetWallet: string;
  userId?: string | null;
  configId?: string | null;
}

export interface CopytradeRequestPayloadInput extends CopytradeRequestKeyInput {
  mode?: string | null;
  sourceTxFrom?: string | null;
  tokenIn?: string | null;
  tokenOut?: string | null;
  amountIn?: string | number | null;
  amountOut?: string | number | null;
  router?: string | null;
  dexName?: string | null;
}

export function buildCopytradeRequestKey(input: CopytradeRequestKeyInput): string {
  return md5Hex({
    scope: 'copytrade-order-request-key-v1',
    chainId: Number(input.chainId) || 0,
    txHash: normalizePart(input.txHash),
    targetWallet: normalizePart(input.targetWallet),
    userId: normalizePart(input.userId),
    configId: normalizePart(input.configId),
  }).slice(0, 32);
}

export function buildCopytradeRequestPayloadHash(input: CopytradeRequestPayloadInput): string {
  return sha256Hex({
    scope: 'copytrade-order-payload-v1',
    chainId: Number(input.chainId) || 0,
    txHash: normalizePart(input.txHash),
    targetWallet: normalizePart(input.targetWallet),
    userId: normalizePart(input.userId),
    configId: normalizePart(input.configId),
    mode: normalizePart(input.mode),
    sourceTxFrom: normalizePart(input.sourceTxFrom),
    tokenIn: normalizePart(input.tokenIn),
    tokenOut: normalizePart(input.tokenOut),
    amountIn: String(input.amountIn ?? ''),
    amountOut: String(input.amountOut ?? ''),
    router: normalizePart(input.router),
    dexName: normalizePart(input.dexName),
  });
}

export function isValidCopytradeRequestKey(value: unknown): value is string {
  return /^[a-f0-9]{32}$/.test(String(value || ''));
}
