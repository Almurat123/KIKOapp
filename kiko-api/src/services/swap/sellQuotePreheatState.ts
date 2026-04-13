import { ethers } from 'ethers';

import { del as cacheDel, getJson as cacheGetJson, setJson as cacheSetJson } from '../../cache/cacheClient.js';
import type { QuoteDex } from '../MainSwapService.js';
import type { QuoteResult } from '../quoteService.js';

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Mira Chen
// Reason: Sell-quote preheat state can outlive provider removals, so state reads must collapse legacy provider data to the single supported 0x path.
// Goal: Persist and hydrate only 0x-compatible preheat hints and discard removed-provider warm quotes.
// Owns: Sell quote preheat cache schema normalization and warm-quote reuse eligibility.
// Does Not Own: Quote generation, provider selection policy, or swap execution fallback strategy.
// Design Language:
// - Read-time normalization is mandatory for long-lived cache records.
// - Removed providers are dropped, not remapped.
// - Forbidden local patch patterns: trusting cached provider lists verbatim after provider policy changes.
// Document Provenance:
// - Source: repository runtime audit of Kyber removal plan
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: sell quote preheat state hydration
// - Verification: verified in code
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-13-kyber-0x-only-removal.md
// - system-journal/owner-map/backend-swap-validation.md

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

const SUPPORTED_QUOTE_DEXES = new Set<QuoteDex>(['0x']);

function normalizeAddress(value: string): string {
  return ethers.getAddress(String(value || '').trim());
}

function normalizePreferredDexes(values: Array<string | QuoteDex> | null | undefined): QuoteDex[] {
  const normalized = (values || [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value): value is QuoteDex => SUPPORTED_QUOTE_DEXES.has(value as QuoteDex));
  return Array.from(new Set(normalized));
}

function normalizeWarmQuote(warmQuote: SellQuoteWarmQuote | null | undefined): SellQuoteWarmQuote | null {
  if (!warmQuote) return null;
  return String(warmQuote.dex || '').trim().toLowerCase() === '0x'
    ? warmQuote
    : null;
}

function normalizeStateRecord(
  record: SellQuotePreheatStateRecord | null | undefined
): SellQuotePreheatStateRecord | null {
  if (!record) return null;
  return {
    ...record,
    preferredDexes: normalizePreferredDexes(record.preferredDexes),
    warmQuote: normalizeWarmQuote(record.warmQuote),
  };
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
    preferredDexes: normalizePreferredDexes(params.preferredDexes),
    warmQuote: normalizeWarmQuote(params.warmQuote),
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
  const record = await cacheGetJson<SellQuotePreheatStateRecord>(buildSellQuotePreheatStateKey(params)).catch(() => null);
  return normalizeStateRecord(record);
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
  normalizeStateRecord,
};
