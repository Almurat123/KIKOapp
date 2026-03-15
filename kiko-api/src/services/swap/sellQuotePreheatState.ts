import { ethers } from 'ethers';

import { del as cacheDel, getJson as cacheGetJson, setJson as cacheSetJson } from '../../cache/cacheClient.js';
import type { QuoteDex } from '../MainSwapService.js';
import type { QuoteResult } from '../quoteService.js';

const SELL_QUOTE_PREHEAT_STATE_TTL_SEC = Math.max(
  15,
  Number(process.env.COPYTRADE_SELL_QUOTE_PREHEAT_STATE_TTL_SEC || '90')
);
const SELL_QUOTE_PREHEAT_QUOTE_MAX_AGE_MS = Math.max(
  1000,
  Number(process.env.COPYTRADE_SELL_QUOTE_PREHEAT_QUOTE_MAX_AGE_MS || '12000')
);

export interface SellQuoteWarmQuote {
  dex: QuoteResult['dex'];
  dexName: QuoteResult['dexName'];
  amountOut: QuoteResult['amountOut'];
  amountOutBase: QuoteResult['amountOutBase'];
  gasEstimate: QuoteResult['gasEstimate'];
  priceImpact: QuoteResult['priceImpact'];
  path: QuoteResult['path'];
  router: QuoteResult['router'];
  data: QuoteResult['data'];
  to: QuoteResult['to'];
  value: QuoteResult['value'];
  allowanceTarget: QuoteResult['allowanceTarget'];
  deadline: QuoteResult['deadline'];
  tokenInDecimals: QuoteResult['tokenInDecimals'];
  tokenOutDecimals: QuoteResult['tokenOutDecimals'];
  priceImpactVsMkt?: QuoteResult['priceImpactVsMkt'];
  approvalKind?: QuoteResult['approvalKind'];
  requiresTypedSignature?: QuoteResult['requiresTypedSignature'];
  permit2Payload?: QuoteResult['permit2Payload'];
  permit2Spender?: QuoteResult['permit2Spender'];
  permit2Expiry?: QuoteResult['permit2Expiry'];
}

export interface SellQuotePreheatStateRecord {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  amountInBase: string;
  preferredDexes: QuoteDex[];
  warmQuote?: SellQuoteWarmQuote | null;
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
  warmQuote?: SellQuoteWarmQuote | null;
}): Promise<SellQuotePreheatStateRecord> {
  const record: SellQuotePreheatStateRecord = {
    chainId: params.chainId,
    walletAddress: normalizeAddress(params.walletAddress),
    tokenAddress: normalizeAddress(params.tokenAddress),
    amountInBase: String(params.amountInBase || '0'),
    preferredDexes: Array.from(new Set((params.preferredDexes || []).filter(Boolean))) as QuoteDex[],
    warmQuote: params.warmQuote || null,
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

export function getUsableWarmSellQuote(params: {
  state: SellQuotePreheatStateRecord | null | undefined;
  amountInBase: string;
  now?: number;
}): SellQuoteWarmQuote | null {
  const state = params.state;
  if (!state?.warmQuote) return null;
  if (String(state.amountInBase || '0') !== String(params.amountInBase || '0')) return null;
  const warmedAt = Date.parse(state.warmedAt || '');
  if (!Number.isFinite(warmedAt)) return null;
  const ageMs = (params.now ?? Date.now()) - warmedAt;
  if (ageMs < 0 || ageMs > SELL_QUOTE_PREHEAT_QUOTE_MAX_AGE_MS) return null;
  return state.warmQuote;
}

export const __sellQuotePreheatStateTest = {
  buildSellQuotePreheatStateKey,
  getUsableWarmSellQuote,
};
