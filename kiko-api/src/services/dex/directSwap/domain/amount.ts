import { ethers } from 'ethers';

const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function sanitizeDecimals(value: unknown): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return 18;
  const integer = Math.trunc(normalized);
  if (integer < 0) return 0;
  if (integer > 255) return 255;
  return integer;
}

export function trimAmountToDecimals(amount: string, decimals: number): string {
  const normalized = String(amount || '0').trim();
  if (!normalized.includes('.')) return normalized;
  const [intPart, fracPart] = normalized.split('.');
  if (decimals <= 0) return intPart || '0';
  return `${intPart || '0'}.${(fracPart || '').slice(0, decimals)}`;
}

export function isLikelyRawWeiAmount(amount: string, decimals: number): boolean {
  const normalized = String(amount || '').trim();
  if (!/^\d+$/.test(normalized)) return false;
  if (normalized === '0') return false;
  const stripped = normalized.replace(/^0+/, '') || '0';
  if (stripped === '0') return false;
  // Heuristic:
  // - keep normal integer "human units" unchanged
  // - treat very long integer strings as already-smallest-unit values (wei-like)
  const minDigitsForRaw = Math.max(13, Math.max(0, decimals) + 1);
  return stripped.length >= minDigitsForRaw;
}

export async function parseAmountInWeiByToken(params: {
  tokenIn: string;
  amountIn: string;
  chainId: number;
  getTokenMetadata: (chainId: number, tokenAddress: string) => Promise<{ decimals?: number } | null | undefined>;
  onRawWeiDetected?: (ctx: { chainId: number; tokenIn: string; amountIn: string; decimals: number }) => void;
  /** Skip the getTokenMetadata RPC call when decimals are already known (e.g. pre-fetched in turbo pipeline). */
  preloadedDecimals?: number;
}): Promise<bigint> {
  let decimals = 18;
  if (params.preloadedDecimals !== undefined && params.preloadedDecimals >= 0) {
    decimals = sanitizeDecimals(params.preloadedDecimals);
  } else if (params.tokenIn.toLowerCase() !== ETH_ADDRESS) {
    try {
      const meta = await params.getTokenMetadata(params.chainId, params.tokenIn);
      decimals = sanitizeDecimals(meta?.decimals);
    } catch {
      decimals = 18;
    }
  }
  if (isLikelyRawWeiAmount(params.amountIn, decimals)) {
    params.onRawWeiDetected?.({
      chainId: params.chainId,
      tokenIn: params.tokenIn,
      amountIn: params.amountIn,
      decimals
    });
    return BigInt(params.amountIn);
  }
  const safe = trimAmountToDecimals(params.amountIn, decimals);
  return ethers.parseUnits(safe, decimals);
}
