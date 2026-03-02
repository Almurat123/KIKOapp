import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { AppError } from '../middleware/errorHandler.js';
import { __solanaExecutorTest, type SolanaSwapParams } from '../services/solanaExecutor.js';
import type { SolanaQuote } from '../services/solanaSwap.js';
import { getLatestSolanaBlockhash } from '../services/solana/blockhashProvider.js';

const baseParams: SolanaSwapParams = {
  userId: 'user-1',
  tokenInMint: 'So11111111111111111111111111111111111111112',
  tokenOutMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  amountIn: '1000',
  slippageBps: 100,
  waitForConfirmation: false,
};

function createQuote(overrides: Partial<SolanaQuote> = {}): SolanaQuote {
  return {
    inputMint: baseParams.tokenInMint,
    outputMint: baseParams.tokenOutMint,
    inAmount: baseParams.amountIn,
    outAmount: '1200',
    priceImpact: '0.01',
    aggregator: 'jupiter',
    swapTransaction: Buffer.from('fake-transaction').toString('base64'),
    routePlan: [],
    ...overrides,
  };
}

function createDeps(overrides: Record<string, unknown> = {}) {
  const connection = {
    getLatestBlockhash: async () => ({ blockhash: 'fresh-blockhash', lastValidBlockHeight: 1 }),
    getSignatureStatus: async () => ({ value: { confirmationStatus: 'confirmed', err: null } }),
  };
  const sent: { userId?: string; tx?: string } = {};
  const aggregatorCalls: Array<{ aggregator: string; options?: unknown }> = [];

  const deps = {
    sent,
    aggregatorCalls,
    getDelegatedSolanaWallet: async () => null,
    getServerSolanaWalletAddress: async () => 'server-wallet',
    getSolanaQuote: async (...args: unknown[]) => {
      aggregatorCalls.push({ aggregator: 'auto', options: args[7] });
      return createQuote({ aggregator: 'jupiter' });
    },
    getSolanaQuoteFromAggregator: async (aggregator: string, ...rest: unknown[]) => {
      aggregatorCalls.push({ aggregator, options: rest[7] });
      return createQuote({ aggregator: aggregator as SolanaQuote['aggregator'] });
    },
    getSolanaConnection: () => connection,
    deserializeTransaction: () => ({
      message: { recentBlockhash: 'stale-blockhash' },
      serialize: () => Buffer.from('reserialized-transaction'),
    }),
    sendSolanaTransaction: async (userId: string, tx: string) => {
      sent.userId = userId;
      sent.tx = tx;
      return 'signature-123';
    },
    getLatestSolanaBlockhash,
    ...overrides,
  };

  return deps;
}

describe('solanaExecutor helpers', () => {
  test('resolveSelectedAggregator prioritizes explicit aggregator', () => {
    assert.equal(__solanaExecutorTest.resolveSelectedAggregator('raydium', 'turbo', 'pumpswap'), 'raydium');
  });

  test('resolveSelectedAggregator uses jupiter for turbo and pumpswap', () => {
    assert.equal(__solanaExecutorTest.resolveSelectedAggregator(undefined, 'turbo', undefined), 'jupiter');
    assert.equal(__solanaExecutorTest.resolveSelectedAggregator(undefined, 'normal', 'pumpswap'), 'jupiter');
    assert.equal(__solanaExecutorTest.resolveSelectedAggregator(undefined, 'normal', undefined), 'auto');
  });

  test('applyCopyTradePriorityFee annotates quote only for copyTrade', () => {
    const quote = createQuote();
    const adjusted = __solanaExecutorTest.applyCopyTradePriorityFee(quote, 'copyTrade');
    assert.equal(adjusted?.priorityFeeMaxLamports, 100000);
    assert.equal(adjusted?.computeUnitPriceMicroLamports, 100000);

    const untouched = __solanaExecutorTest.applyCopyTradePriorityFee(createQuote(), 'swap');
    assert.equal(untouched?.priorityFeeMaxLamports, undefined);
  });
});

describe('solanaExecutor execution flow', () => {
  test('turbo mode forces jupiter public path and returns broadcast signature', async () => {
    const deps = createDeps();

    const signature = await __solanaExecutorTest.executeSolanaSwapWithDeps(
      { ...baseParams, executionMode: 'turbo' },
      deps as any
    );

    assert.equal(signature, 'signature-123');
    assert.deepEqual(deps.aggregatorCalls, [{ aggregator: 'jupiter', options: { forcePublicApi: true } }]);
    assert.equal(deps.sent.userId, 'user-1');
    assert.ok(typeof deps.sent.tx === 'string' && deps.sent.tx.length > 0);
  });

  test('copyTrade quote gets priority fee before broadcast', async () => {
    const quoteProbe: { value: SolanaQuote | null } = { value: null };
    const deps = createDeps({
      deserializeTransaction: () => ({
        message: { recentBlockhash: 'stale-blockhash' },
        serialize: () => Buffer.from('copytrade-serialized'),
      }),
      getSolanaQuoteFromAggregator: async (aggregator: string) => {
        const quote = createQuote({ aggregator: aggregator as SolanaQuote['aggregator'] });
        quoteProbe.value = quote;
        return quote;
      }
    });

    await __solanaExecutorTest.executeSolanaSwapWithDeps(
      { ...baseParams, executionMode: 'turbo', feeContext: 'copyTrade' },
      deps as any
    );

    assert.equal(quoteProbe.value?.priorityFeeMaxLamports, 100000);
    assert.equal(quoteProbe.value?.computeUnitPriceMicroLamports, 100000);
  });

  test('blockhash refresh falls back from finalized to confirmed', async () => {
    const deps = createDeps({
      getLatestSolanaBlockhash: async () => ({
        blockhash: 'confirmed-blockhash',
        lastValidBlockHeight: 2,
        commitmentUsed: 'confirmed',
        fallbackUsed: true,
      }),
      deserializeTransaction: () => ({
        message: { recentBlockhash: 'stale-blockhash' },
        serialize: function (this: any) {
          assert.equal(this.message.recentBlockhash, 'confirmed-blockhash');
          return Buffer.from('fallback-serialized');
        },
      }),
    });

    const signature = await __solanaExecutorTest.executeSolanaSwapWithDeps(
      { ...baseParams, executionMode: 'turbo' },
      deps as any
    );

    assert.equal(signature, 'signature-123');
  });

  test('throws QUOTE_FAILED when no quote is available', async () => {
    const deps = createDeps({
      getSolanaQuote: async () => null,
    });

    await assert.rejects(
      () => __solanaExecutorTest.executeSolanaSwapWithDeps({ ...baseParams, executionMode: 'normal' }, deps as any),
      (error: unknown) => error instanceof AppError && error.code === 'QUOTE_FAILED'
    );
  });

  test('throws SWAP_BUILD_FAILED when quote has no transaction', async () => {
    const deps = createDeps({
      getSolanaQuote: async () => createQuote({ swapTransaction: undefined }),
    });

    await assert.rejects(
      () => __solanaExecutorTest.executeSolanaSwapWithDeps({ ...baseParams, executionMode: 'normal' }, deps as any),
      (error: unknown) => error instanceof AppError && error.code === 'SWAP_BUILD_FAILED'
    );
  });

  test('throws SOLANA_BLOCKHASH_FETCH_FAILED when blockhash provider exhausts fallbacks', async () => {
    const deps = createDeps({
      getLatestSolanaBlockhash: async () => {
        throw new AppError(503, 'Failed to get recent blockhash for swap_executor', 'SOLANA_BLOCKHASH_FETCH_FAILED');
      }
    });

    await assert.rejects(
      () => __solanaExecutorTest.executeSolanaSwapWithDeps({ ...baseParams, executionMode: 'normal' }, deps as any),
      (error: unknown) => error instanceof AppError && error.code === 'SOLANA_BLOCKHASH_FETCH_FAILED'
    );
  });
});
