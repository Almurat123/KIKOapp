/**
 * Solana Swap Service
 * Aggregates multiple Solana DEX aggregators:
 * - Jupiter Ultra Swap API (primary) - Aggregates 20+ DEXs including Orca, Raydium, Serum, etc.
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

export interface SolanaQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpact: string;
  aggregator: 'jupiter' | 'raydium' | 'orca';
  swapTransaction?: string; // Base64 encoded transaction (for Jupiter)
  routePlan?: any;
  fee?: string;
  estimatedGas?: string;
  otherAmountThreshold?: string; // Required for Jupiter V6/Ultra swap
  swapMode?: string;             // Required for Jupiter V6/Ultra swap
  slippageBps?: number;          // Required for Jupiter V6/Ultra swap
}

export interface SolanaPrice {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpact?: string;
}

// Jupiter Ultra Swap API base URLs
// Jupiter V6/V1 Quote API
// - Public: https://public.jupiterapi.com (No Key)
const JUPITER_PUBLIC_API = 'https://public.jupiterapi.com';

// Jupiter Ultra API (Authenticated)
// Documentation: https://station.jup.ag/docs/ultra/get-order
const JUPITER_ULTRA_API = 'https://api.jup.ag/ultra/v1';

const FETCH_TIMEOUT = 15000; // 15 seconds timeout

// Get Jupiter API key from environment
const getJupiterApiKey = (): string | undefined => {
  return env.apiKeys.jupiter || process.env.JUPITER_API_KEY;
};

// Raydium API base URLs - according to latest docs
const RAYDIUM_SWAP_HOST = 'https://transaction-v1.raydium.io';
const RAYDIUM_BASE_HOST = 'https://api-v3.raydium.io';

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
  userAddress?: string
): Promise<SolanaQuote | null> {
  try {
    // Build headers with API key if available
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const apiKey = getJupiterApiKey();
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    // STRATEGY:
    // - If API Key is present, use ULTRA API (/order) - Faster, 1-step (Quote + TX)
    // - If NO Key, use PUBLIC API (/quote + /swap) - Slower, 2-step, Rate-limited

    let quoteUrl: string;
    let isUltra = false;

    if (apiKey) {
      // ULTRA API: /order
      isUltra = true;
      const takerParam = userAddress ? `&taker=${userAddress}` : '';
      quoteUrl = `${JUPITER_ULTRA_API}/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}${takerParam}`;
      console.log('[Jupiter Ultra] Fetching order/quote...');
    } else {
      // PUBLIC API: /quote
      quoteUrl = `${JUPITER_PUBLIC_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
      console.log('[Jupiter Public] Fetching quote...');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const quoteStartTime = Date.now();
    const quoteResponse = await fetch(quoteUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`[Jupiter API] Quote took ${Date.now() - quoteStartTime}ms`);

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error(`[Jupiter API] Request failed: ${quoteResponse.status}`, errorText);
      return null;
    }

    let quoteData: any;
    let swapTransaction: string | undefined;

    if (isUltra) {
      // Parse ULTRA response
      const ultraData = await quoteResponse.json() as any;
      if (ultraData.error) {
        console.error('[Jupiter Ultra] API error:', ultraData.error);
        return null;
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
      // Parse PUBLIC response
      quoteData = await quoteResponse.json() as {
        inputMint: string;
        outputMint: string;
        inAmount: string;
        outAmount: string;
        routePlan?: any;
        error?: string;
      };
    }

    if (!quoteData || quoteData.error) {
      console.error('[Jupiter API] Quote data error:', quoteData?.error);
      return null;
    }

    // Step 2: Swap Transaction Logic (only if needed)
    if (userAddress && !swapTransaction) {
      if (isUltra) {
        console.warn('[Jupiter Ultra] User address provided but no transaction returned.');
      } else {
        console.log('[Jupiter Public] Getting swap transaction...');
        const swapResponse = await fetch(`${JUPITER_PUBLIC_API}/swap`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            quoteResponse: quoteData,
            userPublicKey: userAddress,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: 'auto',
          }),
        });

        if (swapResponse.ok) {
          const swapData = await swapResponse.json() as { swapTransaction: string };
          swapTransaction = swapData.swapTransaction;
          console.log('[Jupiter Public] Got swap transaction successfully');
        } else {
          const errorText = await swapResponse.text();
          console.error('[Jupiter Public] Swap transaction failed:', errorText);
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
      aggregator: 'jupiter',
      routePlan: quoteData.routePlan,
      swapTransaction,
    };
  } catch (error) {
    console.error('[Jupiter API] Error fetching quote:', error);
    return null;
  }
}

/**
 * Get swap transaction from Jupiter API
 */
export async function getJupiterSwapTransaction(
  quote: SolanaQuote,
  userPublicKey: string,
  wrapUnwrapSOL: boolean = true
): Promise<string | null> {
  try {
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

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        quoteResponse: {
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
        prioritizationFeeLamports: 'auto',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Jupiter API] Swap transaction request failed: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json() as { swapTransaction: string };
    return data.swapTransaction;
  } catch (error) {
    console.error('[Jupiter API] Error fetching swap transaction:', error);
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
  } catch (error) {
    console.warn('[Raydium API] Error fetching priority fee:', error);
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
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`[Raydium API] Quote took ${Date.now() - quoteStartTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Raydium API] Quote request failed: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json() as {
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
    };

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
  } catch (error) {
    console.error('[Raydium API] Error fetching quote:', error);
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
        process.env.NODE_ENV !== 'production' && console.log('[Raydium API] Added inputAccount (ATA):', requestBody.inputAccount);
      } catch (error) {
        console.warn('[Raydium API] Failed to derive input ATA:', error);
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Raydium API] Transaction request failed: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json() as {
      success: boolean;
      data: Array<{ transaction: string }>;
    };

    // Debug: Log the full response to understand structure
    console.log('[Raydium API] Transaction response:', {
      success: data.success,
      hasData: !!data.data,
      dataLength: data.data?.length,
      fullResponse: JSON.stringify(data).substring(0, 500) // First 500 chars
    });

    if (!data.success || !data.data || data.data.length === 0) {
      console.error('[Raydium API] No transaction data in response');
      return null;
    }

    // Return the first transaction (Raydium may return multiple transactions)
    return data.data[0].transaction;
  } catch (error) {
    console.error('[Raydium API] Error building transaction:', error);
    return null;
  }
}

/**
 * Get Solana swap quote from a specific aggregator
 */
export async function getSolanaQuoteFromAggregator(
  aggregator: 'jupiter' | 'raydium',
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50,
  userAddress?: string
): Promise<SolanaQuote | null> {
  switch (aggregator) {
    case 'jupiter':
      return getJupiterQuote(inputMint, outputMint, amount, slippageBps, userAddress);
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
  aggregator?: 'jupiter' | 'raydium' | 'auto',
  userAddress?: string
): Promise<SolanaQuote | null> {
  try {
    // If specific aggregator is requested, use only that one
    if (aggregator && aggregator !== 'auto') {
      const quote = await getSolanaQuoteFromAggregator(aggregator, inputMint, outputMint, amount, slippageBps, userAddress);
      if (quote) {
        process.env.NODE_ENV !== 'production' && console.log(`[Solana Swap] Quote from ${aggregator}: ${quote.outAmount}`);
      }
      return quote;
    }

    // Otherwise, fetch quotes from all available aggregators in parallel
    // OPTIMIZATION: Call without userAddress first to get prices rapidly, then build tx for best only
    console.log('[Solana Swap] Fetching multiple quotes in parallel (Price-First strategy)...');

    const startTime = Date.now();
    const quotes = await Promise.allSettled([
      getJupiterQuote(inputMint, outputMint, amount, slippageBps, undefined),
      getRaydiumQuote(inputMint, outputMint, amount, slippageBps, undefined),
    ]);

    // Filter successful quotes
    const validQuotes = quotes
      .filter((q): q is PromiseFulfilledResult<SolanaQuote | null> =>
        q.status === 'fulfilled' && q.value !== null
      )
      .map(q => q.value as SolanaQuote);

    if (validQuotes.length === 0) {
      console.error('[Solana Swap] No valid quotes found from any aggregator');
      return null;
    }

    // Select the quote with the highest output amount
    let bestQuote = validQuotes.reduce((best, current) => {
      const bestAmount = BigInt(best.outAmount);
      const currentAmount = BigInt(current.outAmount);
      return currentAmount > bestAmount ? current : best;
    });

    console.log(`[Solana Swap] Selected ${bestQuote.aggregator} as best route (${Date.now() - startTime}ms)`);

    // If userAddress was provided, build the transaction only for the BEST quote
    if (userAddress) {
      console.log(`[Solana Swap] Building transaction for best quote (${bestQuote.aggregator})...`);

      if (bestQuote.aggregator === 'jupiter') {
        const tx = await getJupiterSwapTransaction(bestQuote, userAddress);
        if (tx) {
          bestQuote.swapTransaction = tx;
        } else {
          // Jupiter TX build failed - fallback to Raydium if available
          console.warn('[Solana Swap] Jupiter transaction build failed, trying Raydium fallback...');
          const raydiumQuote = validQuotes.find(q => q.aggregator === 'raydium');
          if (raydiumQuote) {
            const isInputSol = inputMint === SOLANA_NATIVE_MINT || inputMint === 'SOL';
            const isOutputSol = outputMint === SOLANA_NATIVE_MINT || outputMint === 'SOL';
            const raydiumTx = await getRaydiumSwapTransaction(raydiumQuote, userAddress, isInputSol, isOutputSol);
            if (raydiumTx) {
              raydiumQuote.swapTransaction = raydiumTx;
              bestQuote = raydiumQuote; // Switch to Raydium
              console.log('[Solana Swap] Successfully fell back to Raydium');
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
          console.warn('[Solana Swap] Raydium transaction build failed, trying Jupiter fallback...');
          const jupiterQuote = validQuotes.find(q => q.aggregator === 'jupiter');
          if (jupiterQuote) {
            const jupiterTx = await getJupiterSwapTransaction(jupiterQuote, userAddress);
            if (jupiterTx) {
              jupiterQuote.swapTransaction = jupiterTx;
              bestQuote = jupiterQuote; // Switch to Jupiter
              console.log('[Solana Swap] Successfully fell back to Jupiter');
            }
          }
        }
      }

      console.log(`[Solana Swap] Best quote with transaction complete (${Date.now() - startTime}ms)`);
    }

    return bestQuote;
  } catch (error) {
    console.error('[Solana Swap] Error getting best quote:', error);
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
  } catch (error) {
    console.error('[Solana Swap] Error getting price:', error);
    return null;
  }
}


/**
 * Common Solana token addresses
 */
export const SOLANA_NATIVE_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL
export const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const SOLANA_USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

/**
 * Convert native SOL address to wrapped SOL mint
 */
export function normalizeSolanaTokenAddress(address: string): string {
  // Native SOL is represented as 'So11111111111111111111111111111111111111112' (Wrapped SOL)
  if (address === 'So11111111111111111111111111111111111111112' ||
    address === 'SOL' ||
    address === '') {
    return SOLANA_NATIVE_MINT;
  }
  return address;
}

