import { ethers } from 'ethers';

import { del as cacheDel, getJson as cacheGetJson, setJson as cacheSetJson } from '../../cache/cacheClient.js';
import type { QuoteDex } from '../MainSwapService.js';

const SELL_QUOTE_PREHEAT_STATE_TTL_SEC = Math.max(
  15,
  Number(process.env.COPYTRADE_SELL_QUOTE_PREHEAT_STATE_TTL_SEC || '90')
);

export interface SellQuotePreheatStateRecord {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  amountInBase: string;
  preferredDexes: QuoteDex[];
  warmedAt: string;
}

function normalizeAddress(value: string): string {
  return ethers.getAddress(String(value || '').trim());
}

function buildSellQuotePreheatStateKey(params: {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
}): string {
  return [
    'copytrade:sell-quote-preheat:v1',
    params.chainId,
    normalizeAddress(params.walletAddress).toLowerCase(),
    normalizeAddress(params.tokenAddress).toLowerCase(),
  ].join(':');
}

export async function upsertSellQuotePreheatState(params: {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  amountInBase: string;
  preferredDexes: QuoteDex[];
}): Promise<SellQuotePreheatStateRecord> {
  const record: SellQuotePreheatStateRecord = {
    chainId: params.chainId,
    walletAddress: normalizeAddress(params.walletAddress),
    tokenAddress: normalizeAddress(params.tokenAddress),
    amountInBase: String(params.amountInBase || '0'),
    preferredDexes: Array.from(new Set((params.preferredDexes || []).filter(Boolean))) as QuoteDex[],
    warmedAt: new Date().toISOString(),
  };
  await cacheSetJson(buildSellQuotePreheatStateKey(record), record, SELL_QUOTE_PREHEAT_STATE_TTL_SEC).catch(() => undefined);
  return record;
}

export async function getSellQuotePreheatState(params: {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
}): Promise<SellQuotePreheatStateRecord | null> {
  return await cacheGetJson<SellQuotePreheatStateRecord>(buildSellQuotePreheatStateKey(params)).catch(() => null);
}

export async function clearSellQuotePreheatState(params: {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
}): Promise<void> {
  await cacheDel(buildSellQuotePreheatStateKey(params)).catch(() => undefined);
}

export const __sellQuotePreheatStateTest = {
  buildSellQuotePreheatStateKey,
};
