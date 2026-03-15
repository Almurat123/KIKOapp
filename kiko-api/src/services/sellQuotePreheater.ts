import { ethers } from 'ethers';

import { NATIVE_TOKEN_ADDRESS } from '../config/tokenRegistry.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getErc20Decimals } from './rpcManager.js';
import { getBestQuote, type QuoteResult } from './quoteService.js';
import { upsertSellQuotePreheatState } from './swap/sellQuotePreheatState.js';
import type { QuoteDex } from './MainSwapService.js';

const SELL_QUOTE_PREHEAT_ENABLED = (process.env.COPYTRADE_SELL_QUOTE_PREHEAT_ENABLED || 'true') === 'true';
const SELL_QUOTE_PREHEAT_ZEROX_TIMEOUT_MS = Math.max(
  400,
  Number(process.env.COPYTRADE_SELL_QUOTE_PREHEAT_ZEROX_TIMEOUT_MS || '1200')
);

export interface SellQuotePreheatParams {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  amountInBase: string;
  tokenDecimals?: number;
}

export interface SellQuotePreheatResult {
  status: 'completed' | 'noop' | 'deferred';
  reasonCode: string;
  preferredDexes: QuoteDex[];
}

function normalizeDexes(quotes: QuoteResult[]): QuoteDex[] {
  const seen = new Set<string>();
  const ordered: QuoteDex[] = [];
  for (const quote of quotes) {
    const dex = String(quote.dex || '').toLowerCase();
    if ((dex !== '0x' && dex !== 'kyber') || seen.has(dex)) continue;
    seen.add(dex);
    ordered.push(dex as QuoteDex);
  }
  return ordered;
}

export async function prewarmSellQuoteForToken(params: SellQuotePreheatParams): Promise<SellQuotePreheatResult> {
  if (!SELL_QUOTE_PREHEAT_ENABLED) {
    return { status: 'noop', reasonCode: 'sell_quote_prewarm_disabled', preferredDexes: [] };
  }

  const amountInBase = String(params.amountInBase || '').trim();
  if (!/^\d+$/.test(amountInBase) || BigInt(amountInBase) <= 0n) {
    return { status: 'noop', reasonCode: 'invalid_amount', preferredDexes: [] };
  }

  try {
    const tokenDecimals = typeof params.tokenDecimals === 'number'
      ? params.tokenDecimals
      : await getErc20Decimals(params.tokenAddress, params.chainId, 'latest', { lane: 'critical' }).catch(() => 18);
    const amountInHuman = Number(ethers.formatUnits(amountInBase, tokenDecimals));
    if (!Number.isFinite(amountInHuman) || amountInHuman <= 0) {
      return { status: 'noop', reasonCode: 'amount_human_unavailable', preferredDexes: [] };
    }

    const quoteBundle = await getBestQuote({
      tokenIn: params.tokenAddress,
      tokenOut: NATIVE_TOKEN_ADDRESS,
      actualTokenIn: params.tokenAddress,
      actualTokenOut: NATIVE_TOKEN_ADDRESS,
      amountInBase,
      amountInHuman,
      tokenInDecimals: tokenDecimals,
      tokenOutDecimals: 18,
      chainId: params.chainId,
      slippageBps: 1500,
      userAddress: params.walletAddress,
      feeContext: 'copyTrade',
      isSell: true,
      executionMode: 'turbo',
      sellQuotePolicy: 'first_executable',
      preferPermit2: false,
      zeroExQuoteTimeoutMs: SELL_QUOTE_PREHEAT_ZEROX_TIMEOUT_MS,
    });

    const preferredDexes = normalizeDexes([
      ...(quoteBundle.best ? [quoteBundle.best] : []),
      ...(quoteBundle.quotes || []).filter((quote) => !quoteBundle.best || quote.dex !== quoteBundle.best.dex),
    ]);
    if (!preferredDexes.length) {
      return { status: 'deferred', reasonCode: 'quote_unavailable', preferredDexes: [] };
    }

    await upsertSellQuotePreheatState({
      chainId: params.chainId,
      walletAddress: params.walletAddress,
      tokenAddress: params.tokenAddress,
      amountInBase,
      preferredDexes,
    }).catch(() => undefined);

    return {
      status: 'completed',
      reasonCode: 'sell_quote_prewarmed',
      preferredDexes,
    };
  } catch (error: any) {
    logger.info(LogCode.SYS_INFO, '[SellQuotePreheat] Non-fatal prewarm miss', {
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      error: String(error?.message || error || 'unknown_error'),
    });
    return {
      status: 'deferred',
      reasonCode: String(error?.message || error || 'unknown_error'),
      preferredDexes: [],
    };
  }
}
