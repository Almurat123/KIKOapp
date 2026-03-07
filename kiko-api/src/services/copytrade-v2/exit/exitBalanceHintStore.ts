import { get as cacheGet, set as cacheSet } from '../../../cache/cacheClient.js';

const BALANCE_HINT_TTL_SEC = Math.max(2, Math.min(5, Number(process.env.COPYTRADE_BALANCE_HINT_TTL_SEC || '3')));

function key(chainId: number, walletAddress: string, tokenAddress: string): string {
  return `copytrade:balance_hint:${chainId}:${walletAddress.toLowerCase()}:${tokenAddress.toLowerCase()}`;
}

export async function readExitBalanceHint(params: {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
}): Promise<bigint | null> {
  const raw = await cacheGet(key(params.chainId, params.walletAddress, params.tokenAddress)).catch(() => null);
  if (!raw || !/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function writeExitBalanceHint(params: {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  balanceRaw: bigint;
}): Promise<void> {
  await cacheSet(
    key(params.chainId, params.walletAddress, params.tokenAddress),
    params.balanceRaw.toString(),
    BALANCE_HINT_TTL_SEC,
  ).catch(() => undefined);
}
