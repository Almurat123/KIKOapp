/**
 * Solana Swap Service - Frontend
 * Handles Solana swap operations using Privy Solana wallet integration
 */

import { VersionedTransaction } from '@solana/web3.js';
import { getStoredSlippageBps } from '@/config/slippageConfig';
import { getSolanaRpcConnection } from '@/utils/solanaRpcConnection';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface SolanaSwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageBps?: number;
  userAddress?: string;
  aggregator?: 'jupiter' | 'raydium' | 'auto';
}

export interface SolanaSwapQuote {
  dex: string;
  amountOut: string;
  amountOutBase: string;
  gasEstimate: number;
  priceImpact: number;
  path: string[];
  router: string;
  deadline: number;
  swapTransaction?: string;
  routePlan?: any;
  chainId: number;
  // Additional fields from backend
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
}

/**
 * Get Solana swap quote from backend
 */
export async function getSolanaSwapQuote(
  params: SolanaSwapParams
): Promise<SolanaSwapQuote | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/swap/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        chainId: 900, // Solana mainnet
        slippageBps: params.slippageBps ?? getStoredSlippageBps(),
        userAddress: params.userAddress,
        aggregator: params.aggregator || 'auto',
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.message || 'Failed to get quote');
    }

    return data.data as SolanaSwapQuote;
  } catch (error) {
    console.error('[SolanaSwapService] Error fetching quote:', error);
    return null;
  }
}

/**
 * Execute Solana swap transaction
 * @param quote - Swap quote from backend
 * @param sendTransaction - Privy Solana wallet sendTransaction function
 * @returns Transaction signature
 */
export async function executeSolanaSwap(
  quote: SolanaSwapQuote,
  sendTransaction: (transaction: VersionedTransaction) => Promise<string>,
  userAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!quote.swapTransaction) {
      throw new Error('Quote missing swap transaction. Please get a new quote.');
    }

    // Decode base64 transaction (browser-compatible)
    // Convert base64 string to Uint8Array
    const binaryString = atob(quote.swapTransaction);
    const transactionBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      transactionBytes[i] = binaryString.charCodeAt(i);
    }

    // Deserialize transaction using @solana/web3.js
    const transaction = VersionedTransaction.deserialize(transactionBytes);

    console.log('[SolanaSwapService] Transaction deserialized, refreshing blockhash...');

    // CRITICAL: Refresh blockhash before sending to prevent "Blockhash not found" errors
    // Solana blockhashes expire after ~60-90 seconds
    let latestBlockhash: Awaited<ReturnType<ReturnType<typeof getSolanaRpcConnection>['getLatestBlockhash']>> | null = null;
    try {
      const connection = getSolanaRpcConnection({ commitment: 'confirmed' });

      latestBlockhash = await connection.getLatestBlockhash('finalized');
      transaction.message.recentBlockhash = latestBlockhash.blockhash;
      console.log('[SolanaSwapService] Blockhash refreshed:', latestBlockhash.blockhash.slice(0, 8) + '...');
    } catch (error) {
      console.warn('[SolanaSwapService] Failed to refresh blockhash, using original:', error);
    }

    // Send transaction using Privy wallet
    const txHash = await sendTransaction(transaction);

    // CONTEXT MEMORY
    // Updated: 2026-04-22
    // Status: mixed
    // Why: A Solana signature means the transaction was submitted, not necessarily finalized successfully. The swap card needs a terminal success/failure state after broadcast.
    // Debug Goal: Local Solana swaps must wait for confirmation and surface failed signatures as swap failures.
    // Search Tags: solana swap wait for signature confirmation
    // Invariants:
    // - A submitted Solana signature is not reported as success until confirmed without an error.
    // - Confirmation failures are returned to the card as failed execution results.
    // Failure Modes:
    // - UI shows success for a dropped or failed Solana transaction.
    // - User never sees a terminal state after Solana signAndSend.
    try {
      const connection = getSolanaRpcConnection({ commitment: 'confirmed' });
      const confirmation = latestBlockhash
        ? await connection.confirmTransaction({
          signature: txHash,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, 'confirmed')
        : await connection.confirmTransaction(txHash, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Solana transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
    } catch (confirmError) {
      const message = confirmError instanceof Error ? confirmError.message : 'Solana transaction confirmation failed';
      console.error('[SolanaSwapService] Confirmation failed:', confirmError);
      return {
        success: false,
        txHash,
        error: message,
      };
    }

    // Record transaction to backend (optional)
    try {
      const recordData = {
        tokenIn: quote.inputMint || quote.path?.[0] || '',
        tokenOut: quote.outputMint || quote.path?.[quote.path?.length - 1] || '',
        amountIn: quote.inAmount || quote.amountOutBase || '0',
        chainId: 900,
        txHash,
        userAddress,
      };

      console.log('[SolanaSwapService] Recording transaction to backend:', recordData);

      const response = await fetch(`${API_BASE_URL}/api/swap/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[SolanaSwapService] Backend returned error:', response.status, errorText);
      } else {
        console.log('[SolanaSwapService] Transaction recorded successfully');
      }
    } catch (recordError) {
      console.warn('[SolanaSwapService] Failed to record transaction to backend:', recordError);
    }

    return {
      success: true,
      txHash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transaction failed';
    console.error('[SolanaSwapService] Error executing swap:', error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Get Solana token price
 */
export async function getSolanaPrice(
  tokenIn: string,
  tokenOut: string,
  amount: string
): Promise<{ price: number; priceImpact?: number } | null> {
  try {
    const quote = await getSolanaSwapQuote({
      tokenIn,
      tokenOut,
      amountIn: amount,
    });

    if (!quote) {
      return null;
    }

    const price = parseFloat(quote.amountOut) / parseFloat(amount);
    return {
      price,
      priceImpact: quote.priceImpact,
    };
  } catch (error) {
    console.error('[SolanaSwapService] Error getting price:', error);
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
 * Normalize Solana token address
 */
export function normalizeSolanaTokenAddress(address: string): string {
  if (address === 'So11111111111111111111111111111111111111112' ||
    address === 'SOL' ||
    address === '') {
    return SOLANA_NATIVE_MINT;
  }
  return address;
}

/**
 * Get Solana token USD prices from Jupiter Price API
 */
export async function getSolanaTokenUsdPrices(
  mints: string[]
): Promise<Record<string, number>> {
  if (mints.length === 0) return {};

  try {
    // Deduplicate and filter empty
    const uniqueMints = [...new Set(mints.filter(m => m))];
    const ids = uniqueMints.join(',');

    // Use Jupiter Price API V2
    const response = await fetch(`https://api.jup.ag/price/v2?ids=${ids}`);

    if (!response.ok) {
      throw new Error(`Jupiter Price API error: ${response.statusText}`);
    }

    const data = await response.json();
    const prices: Record<string, number> = {};

    if (data && data.data) {
      Object.keys(data.data).forEach(mint => {
        const priceData = data.data[mint];
        if (priceData && priceData.price) {
          prices[mint] = parseFloat(priceData.price);
        }
      });
    }

    return prices;
  } catch (error) {
    console.warn('[SolanaSwapService] Error fetching USD prices:', error);
    return {};
  }
}
