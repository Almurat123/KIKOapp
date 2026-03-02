import { afterEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';

import { getJupiterSwapTransaction, getSolanaQuote } from '../services/solanaSwap.js';

const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USER = '9xQeWvG816bUx9EPfEZtK4HZr2P2pYDs2fzGEGZm4G1r';

afterEach(() => {
  mock.restoreAll();
});

function createJupiterQuote(outAmount: string) {
  return {
    inputMint: SOL,
    outputMint: USDC,
    inAmount: '1000',
    outAmount,
    otherAmountThreshold: '990',
    swapMode: 'ExactIn',
    slippageBps: 100,
    priceImpactPct: '0.01',
    routePlan: [{ swapInfo: { label: 'Jupiter' }, percent: 100 }]
  };
}

function createRaydiumQuote(outAmount: string) {
  return {
    id: 'ray-quote',
    success: true,
    version: 'V0',
    data: {
      swapType: 'BaseIn',
      inputMint: SOL,
      inputAmount: '1000',
      outputMint: USDC,
      outputAmount: outAmount,
      otherAmountThreshold: '990',
      slippageBps: 100,
      priceImpactPct: 0.02,
      routePlan: []
    }
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('solanaSwap: Jupiter Metis/Swap routing', () => {
  test('jupiter quote uses public Metis/Swap quote and swap endpoints only', async () => {
    const calls: string[] = [];

    mock.method(globalThis, 'fetch', async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method || 'GET'} ${url}`);
      if (url.includes('/quote?')) {
        return jsonResponse(createJupiterQuote('1234'));
      }
      if (url.endsWith('/swap')) {
        return jsonResponse({ swapTransaction: 'jupiter-public-tx' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const quote = await getSolanaQuote(SOL, USDC, '1000', 100, 'jupiter', USER);

    assert.ok(quote);
    assert.equal(quote?.aggregator, 'jupiter');
    assert.equal(quote?.swapTransaction, 'jupiter-public-tx');
    assert.equal(calls.length, 2);
    assert.match(calls[0]!, /GET https:\/\/lite-api\.jup\.ag\/swap\/v1\/quote/);
    assert.match(calls[1]!, /POST https:\/\/lite-api\.jup\.ag\/swap\/v1\/swap/);
    assert.ok(calls.every(call => !call.includes('/ultra/')));
  });

  test('meteora quote forces public dex-filtered quote path', async () => {
    const urls: string[] = [];

    mock.method(globalThis, 'fetch', async (input: string | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/quote?')) {
        return jsonResponse(createJupiterQuote('1111'));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const quote = await getSolanaQuote(SOL, USDC, '1000', 100, 'meteora');

    assert.ok(quote);
    assert.equal(quote?.aggregator, 'meteora');
    assert.equal(urls.length, 1);
    assert.match(urls[0]!, /dexes=/);
    assert.match(decodeURIComponent(urls[0]!), /Meteora DLMM,Meteora/);
    assert.ok(!urls[0]!.includes('/ultra/'));
  });

  test('auto selects highest output amount across jupiter meteora and raydium', async () => {
    mock.method(globalThis, 'fetch', async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/quote?') && url.includes('dexes=')) {
        return jsonResponse(createJupiterQuote('1500'));
      }
      if (url.includes('/quote?')) {
        return jsonResponse(createJupiterQuote('1200'));
      }
      if (url.includes('compute/swap-base-in')) {
        return jsonResponse(createRaydiumQuote('900'));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const quote = await getSolanaQuote(SOL, USDC, '1000', 100, 'auto');

    assert.ok(quote);
    assert.equal(quote?.aggregator, 'meteora');
    assert.equal(quote?.outAmount, '1500');
  });

  test('auto falls back to fresh raydium transaction when jupiter swap build fails', async () => {
    let rayQuoteCalls = 0;

    mock.method(globalThis, 'fetch', async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/quote?') && url.includes('dexes=')) {
        return jsonResponse(createJupiterQuote('900'));
      }
      if (url.includes('/quote?')) {
        return jsonResponse(createJupiterQuote('1500'));
      }
      if (url.includes('compute/swap-base-in')) {
        rayQuoteCalls += 1;
        return jsonResponse(createRaydiumQuote('1000'));
      }
      if (url.endsWith('/swap')) {
        return jsonResponse({ error: 'jupiter swap build failed' }, 500);
      }
      if (url.includes('transaction/swap-base-in')) {
        return jsonResponse({
          success: true,
          data: [{ transaction: 'raydium-fallback-tx' }]
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const quote = await getSolanaQuote(SOL, USDC, '1000', 100, 'auto', USER);

    assert.ok(quote);
    assert.equal(quote?.aggregator, 'raydium');
    assert.equal(quote?.swapTransaction, 'raydium-fallback-tx');
    assert.equal(rayQuoteCalls, 2);
  });

  test('jupiter swap transaction builder uses public swap endpoint', async () => {
    const urls: string[] = [];

    mock.method(globalThis, 'fetch', async (input: string | URL) => {
      const url = String(input);
      urls.push(url);
      return jsonResponse({ swapTransaction: 'rebuilt-public-tx' });
    });

    const tx = await getJupiterSwapTransaction(
      {
        inputMint: SOL,
        outputMint: USDC,
        inAmount: '1000',
        outAmount: '1200',
        priceImpact: '0.01',
        aggregator: 'jupiter',
        otherAmountThreshold: '990',
        swapMode: 'ExactIn',
        slippageBps: 100,
        routePlan: [],
      },
      USER
    );

    assert.equal(tx, 'rebuilt-public-tx');
    assert.equal(urls.length, 1);
    assert.match(urls[0]!, /https:\/\/lite-api\.jup\.ag\/swap\/v1\/swap$/);
    assert.ok(!urls[0]!.includes('/ultra/'));
  });
});
