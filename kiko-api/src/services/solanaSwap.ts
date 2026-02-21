/**
 * Solana Swap Service
 * Aggregates multiple Solana DEX aggregators:
 * - Jupiter Ultra Swap API (primary) - Aggregates 20+ DEXs including Orca, Raydium, Serum, etc.
 * - Jupiter (DEX-filtered) for Meteora routes
 * - Raydium API (alternative)
 * 
 * **Note**: Jupiter aggregator already includes Orca Whirlpools and 20+ other DEXs,
 * so there's no need for separate Orca integration.
 * 
 * Documentation:
 * - Jupiter Ultra Swap: https://dev.jup.ag/get-started
 * - Raydium: https://docs.raydium.io/raydium/traders/trade-api
 */

import { env } from '../config/env.js';
import {
  getAssociatedTokenAddress,
  getSolanaTokenMetadata,
  type SolanaTokenMetadata
} from '../utils/solanaToken.js';
import { PublicKey } from '@solana/web3.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { AppError } from '../middleware/errorHandler.js';
import { TOKEN_REGISTRY, SOLANA_NATIVE_MINT } from '../config/tokenRegistry.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { getPlatformFee } from './platformFeeService.js';

export interface SolanaQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpact: string;
  aggregator: 'jupiter' | 'raydium' | 'meteora' | 'orca';
  swapTransaction?: string; // Base64 encoded transaction (for Jupiter)
  routePlan?: any;
  fee?: string;
  estimatedGas?: string;
  otherAmountThreshold?: string; // Required for Jupiter V6/Ultra swap
  swapMode?: string;             // Required for Jupiter V6/Ultra swap
  slippageBps?: number;          // Required for Jupiter V6/Ultra swap
  rawQuoteResponse?: any;        // Raw quote response from API (for swap endpoint)
  priorityFeeMaxLamports?: number; // Jupiter /swap prioritizationFeeLamports maxLamports cap
  computeUnitPriceMicroLamports?: number; // Deprecated alias kept for backward compatibility
}

export type SolanaAggregator = 'jupiter' | 'raydium' | 'meteora' | 'auto';

export interface SolanaPrice {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpact?: string;
}

// Jupiter Ultra Swap API base URLs
// Jupiter Legacy Swap API base (official public endpoint).
// [Ref] https://dev.jup.ag/api-reference/swap/quote
const JUPITER_PUBLIC_API = process.env.JUPITER_PUBLIC_API_BASE || 'https://lite-api.jup.ag/swap/v1';

// Jupiter Ultra API (Authenticated)
// Documentation: https://station.jup.ag/docs/ultra/get-order
const JUPITER_ULTRA_API = 'https://api.jup.ag/ultra/v1';

const FETCH_TIMEOUT = 30000; // 30 seconds timeout

// Get Jupiter API key from environment
const getJupiterApiKey = (): string | undefined => {
  return env.apiKeys.jupiter || process.env.JUPITER_API_KEY;
};

// Raydium API base URLs - according to latest docs
const RAYDIUM_SWAP_HOST = 'https://transaction-v1.raydium.io';
const RAYDIUM_BASE_HOST = 'https://api-v3.raydium.io';

function normalizePriorityFeeMaxLamports(value?: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Number.isFinite(value)) return undefined;
  const normalized = Math.floor(value);
  if (normalized <= 0) return undefined;
  return normalized;
}

function resolvePriorityFeeMaxLamportsFromQuote(quote: SolanaQuote): number | undefined {
  return normalizePriorityFeeMaxLamports(
    quote.priorityFeeMaxLamports ?? quote.computeUnitPriceMicroLamports
  );
}

/**
 * Get swap quote from Jupiter Ultra API
 * Documentation: https://dev.jup.ag/api-reference/ultra/order
 * 
 * Strategy: For max balance swaps, we use a two-step approach:
 * 1. Get quote from Ultra API WITHOUT taker (bypasses balance check)
 * 2. Get transaction from Legacy /swap endpoint
 */
async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50,
  userAddress?: string,
  priorityFeeMaxLamports?: number,
  feeContext?: string,
  options?: {
    dexes?: string[];
    forcePublicApi?: boolean;
    aggregatorLabel?: SolanaQuote['aggregator'];
  }
): Promise<SolanaQuote | null> {
  try {
    const normalizedPriorityFeeMaxLamports = normalizePriorityFeeMaxLamports(priorityFeeMaxLamports);
    // Build headers with API key if available
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const apiKey = getJupiterApiKey();
    const dexesParam = options?.dexes?.length
      ? `&dexes=${encodeURIComponent(options.dexes.join(','))}`
      : '';

    if (apiKey && !options?.forcePublicApi) {
      headers['x-api-key'] = apiKey;
    }

    // STRATEGY:
    // - If API Key is present, use ULTRA API (/order) - Faster, 1-step (Quote + TX)
    // - If NO Key, use PUBLIC API (/quote + /swap) - Slower, 2-step, Rate-limited

    let quoteUrl: string;
    let isUltra = false;

    if (apiKey && !options?.forcePublicApi) {
      // ULTRA API: /order
      isUltra = true;
      const takerParam = userAddress ? `&taker=${userAddress}` : '';
      const fee = getPlatformFee(feeContext === 'copyTrade' ? 'copyTrade' : 'swap');
      const referralParam =
        fee.bps > 0 && fee.solanaRecipient
          ? `&referralAccount=${encodeURIComponent(fee.solanaRecipient)}&referralFee=${fee.bps}`
          : '';
      quoteUrl = `${JUPITER_ULTRA_API}/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}${takerParam}${referralParam}`;
      logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Fetching Jupiter Ultra quote', { inputMint, outputMint, amount });
    } else {
      // PUBLIC API: /quote
      quoteUrl = `${JUPITER_PUBLIC_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}${dexesParam}`;
      logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Fetching Jupiter Public quote', {
        inputMint,
        outputMint,
        amount,
        dexes: options?.dexes
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const quoteStartTime = Date.now();
    let quoteData = await fetchJson({
      url: quoteUrl,
      method: 'GET',
      headers,
      timeout: FETCH_TIMEOUT
    });

    logger.debug(LogCode.SYS_INFO, 'Jupiter API quote fetched', { duration: `${Date.now() - quoteStartTime}ms` });

    let swapTransaction: string | undefined;

    if (isUltra) {
      // Parse ULTRA response
      const ultraData = quoteData as any;
      if (ultraData.error) {
        const ultraErr = String(ultraData.error || '');
        logger.warn(LogCode.API_FETCH_FAILED, 'Jupiter Ultra API error, falling back to Public Quote', {
          error: ultraErr,
          inputMint,
          outputMint
        });

        // Fallback path: use Public Quote endpoint (optionally with dex filters)
        return getJupiterQuote(
          inputMint,
          outputMint,
          amount,
          slippageBps,
          userAddress,
          priorityFeeMaxLamports,
          feeContext,
          {
            ...(options || {}),
            forcePublicApi: true
          }
        );
      }
      quoteData = {
        inputMint: ultraData.inputMint,
        outputMint: ultraData.outputMint,
        inAmount: ultraData.inAmount,
        outAmount: ultraData.outAmount,
        otherAmountThreshold: ultraData.otherAmountThreshold,
        swapMode: ultraData.swapMode || 'ExactIn',
        priceImpactPct: ultraData.priceImpactPct || ultraData.priceImpact,
        slippageBps: ultraData.slippageBps,
        routePlan: ultraData.routePlan.map((r: any) => ({
          ...r,
          percent: Math.round(r.percent)
        }))
      };
      // Ultra returns transaction directly if taker was provided
      if (ultraData.transaction) {
        swapTransaction = ultraData.transaction;
      }
    } else {
      // Parse PUBLIC response - store the full raw response for /swap endpoint
      // quoteData is already parsed from fetchJson
    }

    if (!quoteData || quoteData.error) {
      logger.error(LogCode.API_FETCH_FAILED, 'Jupiter API quote data error', { error: quoteData?.error });
      return null;
    }

    // Step 2: Swap Transaction Logic (only if needed)
    if (userAddress && !swapTransaction) {
      if (isUltra) {
        logger.warn(LogCode.EXE_TX_BROADCAST, 'Jupiter Ultra: User address provided but no transaction returned');
      } else {
        logger.debug(LogCode.EXE_TX_BROADCAST, 'Jupiter Public: Getting swap transaction');
        try {
          const swapData = await fetchJson({
            url: `${JUPITER_PUBLIC_API}/swap`,
            method: 'POST',
            headers,
            body: JSON.stringify({
              quoteResponse: quoteData,
              userPublicKey: userAddress,
              wrapAndUnwrapSol: true,
              dynamicComputeUnitLimit: true,
              // Jupiter /swap expects max lamports cap for prioritizationFeeLamports.
              prioritizationFeeLamports: normalizedPriorityFeeMaxLamports
                ? { priorityLevelWithMaxLamports: { priorityLevel: "veryHigh", maxLamports: normalizedPriorityFeeMaxLamports } }
                : 'auto',
            })
          });

          swapTransaction = swapData.swapTransaction;
          logger.debug(LogCode.EXE_TX_BROADCAST, 'Jupiter Public: Got swap transaction successfully');
        } catch (error: any) {
          logger.error(LogCode.API_FETCH_FAILED, 'Jupiter Public swap transaction failed', { error: error.message });
        }
      }
    }

    return {
      inputMint: quoteData.inputMint,
      outputMint: quoteData.outputMint,
      inAmount: quoteData.inAmount,
      outAmount: quoteData.outAmount,
      otherAmountThreshold: quoteData.otherAmountThreshold,
      swapMode: quoteData.swapMode,
      slippageBps: quoteData.slippageBps,
      priceImpact: quoteData.priceImpactPct || '0',
      aggregator: options?.aggregatorLabel || 'jupiter',
      routePlan: quoteData.routePlan,
      swapTransaction,
      rawQuoteResponse: quoteData, // Store full response for /swap endpoint
      priorityFeeMaxLamports: normalizedPriorityFeeMaxLamports,
      computeUnitPriceMicroLamports: normalizedPriorityFeeMaxLamports,
    };
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Jupiter API error fetching quote', { error: error.message });
    return null;
  }
}

/**
 * Get swap transaction from Jupiter API
 */
export async function getJupiterSwapTransaction(
  quote: SolanaQuote,
  userPublicKey: string,
  wrapUnwrapSOL: boolean = true,
  feeContext?: string
): Promise<string | null> {
  try {
    const priorityFeeMaxLamports = resolvePriorityFeeMaxLamportsFromQuote(quote);
    // Build headers with API key if available
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Note: With Ultra API strategy, swap transaction is usually returned in the quote response directly.
    // This function is primarily a fallback for the Public API flow.

    const apiKey = getJupiterApiKey();
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    // If we are here, we are likely using the Public API or need a standalone swap build.
    // The standalone /swap endpoint is part of the V6/Public API.
    // Ultra does not seem to have a standalone /swap endpoint documented in the same way.
    const url = `${JUPITER_PUBLIC_API}/swap`;

    const data = await fetchJson<{ swapTransaction: string }>({
      url,
      method: 'POST',
      headers,
      body: JSON.stringify({
        // CRITICAL: Use the raw quote response if available to include all market data
        // This prevents "Market not found" errors from stale/incomplete quote data
        quoteResponse: quote.rawQuoteResponse || {
          inputMint: quote.inputMint,
          outputMint: quote.outputMint,
          inAmount: quote.inAmount,
          outAmount: quote.outAmount,
          otherAmountThreshold: quote.otherAmountThreshold,
          swapMode: quote.swapMode || 'ExactIn',
          slippageBps: quote.slippageBps,
          priceImpactPct: quote.priceImpact,
          routePlan: quote.routePlan,
        },
        userPublicKey,
        wrapUnwrapSOL,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: priorityFeeMaxLamports
          ? { priorityLevelWithMaxLamports: { priorityLevel: "veryHigh", maxLamports: priorityFeeMaxLamports } }
          : 'auto',
      })
    });

    return data.swapTransaction;
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Jupiter API error fetching swap transaction', { error: error.message });
    return null;
  }
}

/**
 * Get priority fee from Raydium API
 * Note: Priority fee endpoint may vary, using default value for now
 * According to docs: https://docs.raydium.io/raydium/traders/trade-api
 */
async function getRaydiumPriorityFee(): Promise<string> {
  try {
    // Try the priority fee endpoint (may need to be updated based on actual API)
    // For now, return a default value as the endpoint structure may differ
    // Priority fees are typically in microLamports (e.g., "1000" = 0.000001 SOL)
    return '1000'; // Default priority fee in microLamports
  } catch (error: any) {
    logger.warn(LogCode.API_FETCH_FAILED, 'Raydium API error fetching priority fee', { error: error.message });
    return '1000'; // Default fallback
  }
}

/**
 * Get swap quote from Raydium API
 * According to: https://docs.raydium.io/raydium/traders/trade-api
 */
async function getRaydiumQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50,
  userAddress?: string
): Promise<SolanaQuote | null> {
  try {
    // Raydium uses GET request to compute/swap-base-in endpoint
    const url = `${RAYDIUM_SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}&txVersion=V0`;

    const quoteStartTime = Date.now();

    const data = await fetchJson<{
      id: string;
      success: boolean;
      version: string;
      data: {
        swapType: string;
        inputMint: string;
        inputAmount: string;
        outputMint: string;
        outputAmount: string;
        otherAmountThreshold: string;
        slippageBps: number;
        priceImpactPct: number;
        routePlan: Array<{
          poolId: string;
          inputMint: string;
          outputMint: string;
          feeMint: string;
          feeRate: number;
          feeAmount: string;
          remainingAccounts: string[];
          lastPoolPriceX64: string;
        }>;
      };
    }>({
      url,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 2500 // Use a very aggressive timeout for Raydium (2.5s) to prevent blocking Jupiter
    });

    logger.debug(LogCode.SYS_INFO, 'Raydium API quote fetched', { duration: `${Date.now() - quoteStartTime}ms` });

    if (!data.success || !data.data) {
      return null;
    }

    const quote: SolanaQuote = {
      inputMint: data.data.inputMint,
      outputMint: data.data.outputMint,
      inAmount: data.data.inputAmount,
      outAmount: data.data.outputAmount,
      priceImpact: data.data.priceImpactPct?.toString() || '0',
      aggregator: 'raydium',
      // Store the COMPLETE API response (including id, success, version, data)
      routePlan: data,
    };

    // If userAddress is provided, build the swap transaction
    if (userAddress) {
      const isInputSol = inputMint === SOLANA_NATIVE_MINT || inputMint === 'SOL';
      const isOutputSol = outputMint === SOLANA_NATIVE_MINT || outputMint === 'SOL';

      const swapTransaction = await getRaydiumSwapTransaction(
        quote,
        userAddress,
        isInputSol,
        isOutputSol
      );

      if (swapTransaction) {
        quote.swapTransaction = swapTransaction;
      }
    }

    return quote;
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Raydium API error fetching quote', { error: error.message });
    return null;
  }
}

/**
 * Build Raydium swap transaction
 * According to: https://docs.raydium.io/raydium/traders/trade-api
 */
async function getRaydiumSwapTransaction(
  quote: SolanaQuote,
  userPublicKey: string,
  wrapSol: boolean = true,
  unwrapSol: boolean = true
): Promise<string | null> {
  try {
    const url = `${RAYDIUM_SWAP_HOST}/transaction/swap-base-in`;

    // Get priority fee (use default for now)
    const priorityFee = await getRaydiumPriorityFee();

    const requestBody: any = {
      computeUnitPriceMicroLamports: priorityFee,
      swapResponse: quote.routePlan, // The route plan from the quote
      txVersion: 'V0',
      wallet: userPublicKey,
      wrapSol,
      unwrapSol,
    };

    // CRITICAL: For non-SOL input tokens, Raydium requires inputAccount (ATA)
    // Otherwise it returns REQ_INPUT_ACCOUT_ERROR
    if (quote.inputMint !== 'So11111111111111111111111111111111111111112' && quote.inputMint !== 'SOL') {
      try {
        const mint = new PublicKey(quote.inputMint);
        const owner = new PublicKey(userPublicKey);
        const ata = await getAssociatedTokenAddress(mint, owner);

        requestBody.inputAccount = ata.toString();
        logger.debug(LogCode.SYS_INFO, 'Raydium API: Added inputAccount (ATA)', { ata: requestBody.inputAccount });
      } catch (error: any) {
        logger.warn(LogCode.SYS_INFO, 'Raydium API: Failed to derive input ATA', { error: error.message });
      }
    }

    const data = await fetchJson<{
      success: boolean;
      data: Array<{ transaction: string }>;
    }>({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    // Debug: Log the full response to understand structure
    logger.debug(LogCode.API_FETCH_SUCCESS, 'Raydium API transaction response', {
      success: data.success,
      hasData: !!data.data,
      dataLength: data.data?.length
    });

    if (!data.success || !data.data || data.data.length === 0) {
      logger.error(LogCode.API_FETCH_FAILED, 'Raydium API: No transaction data in response');
      return null;
    }

    // Return the first transaction (Raydium may return multiple transactions)
    return data.data[0].transaction;
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Raydium API error building transaction', { error: error.message });
    return null;
  }
}

/**
 * Get Solana swap quote from a specific aggregator
 */
export async function getSolanaQuoteFromAggregator(
  aggregator: 'jupiter' | 'raydium' | 'meteora',
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50,
  userAddress?: string,
  priorityFeeMaxLamports?: number,
  feeContext?: string,
  options?: {
    forcePublicApi?: boolean;
    dexes?: string[];
  }
): Promise<SolanaQuote | null> {
  switch (aggregator) {
    case 'jupiter':
      return getJupiterQuote(
        inputMint,
        outputMint,
        amount,
        slippageBps,
        userAddress,
        priorityFeeMaxLamports,
        feeContext,
        {
          forcePublicApi: options?.forcePublicApi,
          dexes: options?.dexes
        }
      );
    case 'meteora':
      // Jupiter supports DEX filtering via `dexes`.
      // [Ref] https://dev.jup.ag/api-reference/swap/quote
      return getJupiterQuote(
        inputMint,
        outputMint,
        amount,
        slippageBps,
        userAddress,
        priorityFeeMaxLamports,
        feeContext,
        {
          dexes: ['Meteora DLMM', 'Meteora'],
          forcePublicApi: true,
          aggregatorLabel: 'meteora'
        }
      );
    case 'raydium':
      return getRaydiumQuote(inputMint, outputMint, amount, slippageBps, userAddress);
    default:
      return null;
  }
}

/**
 * Get best Solana swap quote by aggregating multiple DEXs
 * 
 * **Aggregator options**:
 * - 'jupiter': Jupiter aggregator (includes 20+ DEXs: Orca, Raydium, Serum, etc.)
 * - 'meteora': Jupiter quote constrained to Meteora DLMM/Meteora pools
 * - 'raydium': Raydium only
 * - 'auto': Try all available aggregators and pick best quote
 * 
 * **Recommendation**: Use 'jupiter' or 'auto' as Jupiter already routes through
 * Orca Whirlpools and provides the best execution across all major Solana DEXs.
 */
export async function getSolanaQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50,
  aggregator?: 'jupiter' | 'raydium' | 'meteora' | 'auto',
  userAddress?: string,
  priorityFeeMaxLamports?: number,
  feeContext?: string
): Promise<SolanaQuote | null> {
  try {
    // If specific aggregator is requested, use only that one
    if (aggregator && aggregator !== 'auto') {
      const quote = await getSolanaQuoteFromAggregator(aggregator, inputMint, outputMint, amount, slippageBps, userAddress, priorityFeeMaxLamports, feeContext);
      if (quote) {
        logger.info(LogCode.EXE_QUOTE_FETCHED, `Solana Swap: Quote from ${aggregator}`, { outAmount: quote.outAmount });
      }
      return quote;
    }

    // Otherwise, fetch quotes from all available aggregators in parallel
    // OPTIMIZATION: Call without userAddress first to get prices rapidly, then build tx for best only
    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Solana Swap: Fetching multiple quotes in parallel');

    const startTime = Date.now();
    const quotes = await Promise.allSettled([
      getJupiterQuote(inputMint, outputMint, amount, slippageBps, undefined, priorityFeeMaxLamports, feeContext),
      getSolanaQuoteFromAggregator('meteora', inputMint, outputMint, amount, slippageBps, undefined, priorityFeeMaxLamports, feeContext),
      getRaydiumQuote(inputMint, outputMint, amount, slippageBps, undefined),
    ]);

    // Filter successful quotes
    const validQuotes = quotes
      .filter((q): q is PromiseFulfilledResult<SolanaQuote | null> =>
        q.status === 'fulfilled' && q.value !== null
      )
      .map(q => q.value as SolanaQuote);

    if (validQuotes.length === 0) {
      logger.error(LogCode.API_FETCH_FAILED, 'Solana Swap: No valid quotes found from any aggregator');
      return null;
    }

    // Select the quote with the highest output amount
    let bestQuote = validQuotes.reduce((best, current) => {
      const bestAmount = BigInt(best.outAmount);
      const currentAmount = BigInt(current.outAmount);
      return currentAmount > bestAmount ? current : best;
    });

    logger.info(LogCode.EXE_QUOTE_FETCHED, `Solana Swap: Selected ${bestQuote.aggregator} as best route`, { duration: `${Date.now() - startTime}ms` });

    // If userAddress was provided, build the transaction only for the BEST quote
    if (userAddress) {
      logger.debug(LogCode.EXE_TX_BROADCAST, `Solana Swap: Building transaction for best quote (${bestQuote.aggregator})`);

      if (bestQuote.aggregator === 'jupiter' || bestQuote.aggregator === 'meteora') {
        const tx = await getJupiterSwapTransaction(bestQuote, userAddress, true, feeContext);
        if (tx) {
          bestQuote.swapTransaction = tx;
        } else {
          // Jupiter/Meteora TX build failed - fallback to Raydium if available
          logger.warn(LogCode.EXE_TX_BROADCAST, 'Solana Swap: Jupiter/Meteora transaction build failed, trying Raydium fallback');

          // CRITICAL: Don't use the stale raydium quote from the parallel fetch!
          // It might be 5-10 seconds old by now, causing 0x9ca deadline errors.
          // Re-fetch a FRESH Raydium quote.
          const freshRaydiumQuote = await getRaydiumQuote(inputMint, outputMint, amount, slippageBps, undefined);

          if (freshRaydiumQuote) {
            const isInputSol = inputMint === SOLANA_NATIVE_MINT || inputMint === 'SOL';
            const isOutputSol = outputMint === SOLANA_NATIVE_MINT || outputMint === 'SOL';
            const raydiumTx = await getRaydiumSwapTransaction(freshRaydiumQuote, userAddress, isInputSol, isOutputSol);
            if (raydiumTx) {
              freshRaydiumQuote.swapTransaction = raydiumTx;
              bestQuote = freshRaydiumQuote; // Switch to Raydium
              logger.info(LogCode.EXE_TX_BROADCAST, 'Solana Swap: Successfully fell back to fresh Raydium quote');
            }
          }
        }
      } else if (bestQuote.aggregator === 'raydium') {
        const isInputSol = inputMint === SOLANA_NATIVE_MINT || inputMint === 'SOL';
        const isOutputSol = outputMint === SOLANA_NATIVE_MINT || outputMint === 'SOL';
        const tx = await getRaydiumSwapTransaction(bestQuote, userAddress, isInputSol, isOutputSol);
        if (tx) {
          bestQuote.swapTransaction = tx;
        } else {
          // Raydium TX build failed - fallback to Jupiter if available
          logger.warn(LogCode.EXE_TX_BROADCAST, 'Solana Swap: Raydium transaction build failed, trying Jupiter fallback');
          const jupiterQuote = validQuotes.find(q => q.aggregator === 'jupiter');
          if (jupiterQuote) {
            const jupiterTx = await getJupiterSwapTransaction(jupiterQuote, userAddress, true, feeContext);
            if (jupiterTx) {
              jupiterQuote.swapTransaction = jupiterTx;
              bestQuote = jupiterQuote; // Switch to Jupiter
              logger.info(LogCode.EXE_TX_BROADCAST, 'Solana Swap: Successfully fell back to Jupiter');
            }
          }
        }
      }

      logger.info(LogCode.EXE_TX_BROADCAST, 'Solana Swap: Best quote with transaction complete', { duration: `${Date.now() - startTime}ms` });
    }

    return bestQuote;
  } catch (error: any) {
    logger.error(LogCode.EXE_TX_BROADCAST, 'Solana Swap: Error getting best quote', { error: error.message });
    return null;
  }
}

/**
 * Get price quote from Solana DEXs
 */
export async function getSolanaPrice(
  inputMint: string,
  outputMint: string,
  amount: string
): Promise<SolanaPrice | null> {
  try {
    // Use Jupiter for price quotes (most reliable)
    const quote = await getJupiterQuote(inputMint, outputMint, amount, 50);

    if (!quote) {
      return null;
    }

    return {
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpact,
    };
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Solana Swap: Error getting price', { error: error.message });
    return null;
  }
}


export { SOLANA_NATIVE_MINT };

export const __solanaSwapTest = {
  normalizePriorityFeeMaxLamports,
  resolvePriorityFeeMaxLamportsFromQuote
};

/**
 * Convert token symbols to Solana Mint addresses
 * Handles both symbols (SOL, USDC) and addresses (So111..., EPjF...)
 */
export function normalizeSolanaTokenAddress(address: string): string {
  // 1. If it's already a valid Solana address (base58, 32-44 chars), return it
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return address;
  }

  // 2. Lookup in Centralized Token Registry
  const upperSymbol = address.toUpperCase();
  const token = TOKEN_REGISTRY[upperSymbol];

  if (token && token.addresses[SOLANA_CONFIG.CHAIN_ID]) {
    return token.addresses[SOLANA_CONFIG.CHAIN_ID];
  }

  return address;
}
