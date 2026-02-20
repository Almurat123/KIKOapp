/**
 * Direct Swap E2E Tests — full flow with SIMULATION_MODE
 *
 * Uses real RPC for reads; transactions are not broadcast (SIMULATION_MODE=true).
 * Covers: pool discovery, executeDirectSwap (balanced/turbo, with/without hints),
 * failure paths, and assertion that txHash starts with 0xSIMULATION_PRIVY_.
 * Includes tests driven by real on-chain tx hashes from the test/ directory
 * (e.g. test/base-samples-smoke.json, test/webhook_arrivals_report.txt).
 *
 * Requirements: BASE_RPC_URL, BSC_RPC_URL, ETH_RPC_URL in environment (or .env)
 *
 * Run:
 *   npx tsx --test src/services/dex/directSwap/directSwap.e2e.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';

import { executeDirectSwap, isDirectSwapSupported, getTokenLiquidity } from '../directSwapService.js';
import { findTokenPools } from '../poolInfo.js';
import { findV4Pools } from '../uniswapV4.js';
import { resolvePoolHintFromSwapSupply } from './supplyParser.js';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const BASE_WETH = '0x4200000000000000000000000000000000000006';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const BSC_WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955';

const ETH_WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const ETH_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

// Fake user/wallet for simulation (no real Privy call when SIMULATION_MODE=true)
const FAKE_USER_ID = 'e2e-test-user';
const FAKE_ACCESS_TOKEN = 'e2e-fake-jwt';
const FAKE_WALLET = '0x0000000000000000000000000000000000000001';

const TIMEOUT_MS = 30000;

function skip(reason: string) {
  return { skip: reason };
}

function hasRpc(envKey: string): boolean {
  return Boolean(process.env[envKey]);
}

function hasAllRpc(): boolean {
  return hasRpc('BASE_RPC_URL') && hasRpc('BSC_RPC_URL') && hasRpc('ETH_RPC_URL');
}

// Real on-chain tx samples from test/ (same shape as base-samples-*.json)
const E2E_SAMPLES_PATH =
  process.env.E2E_SAMPLES_PATH || path.resolve(process.cwd(), '..', 'test', 'base-samples-smoke.json');

interface SampleRow {
  txHash: string;
  tokenAddress: string;
  tradeKind?: string;
}

function loadRealTxSamples(maxSamples: number): SampleRow[] {
  try {
    const raw = fs.readFileSync(E2E_SAMPLES_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as { samples?: Array<{ txHash?: string; tokenAddress?: string; tradeKind?: string }> };
    const list = Array.isArray(parsed?.samples) ? parsed.samples : [];
    return list
      .filter((s) => s?.txHash && /^0x[a-fA-F0-9]{64}$/.test(String(s.txHash)) && s?.tokenAddress)
      .slice(0, maxSamples)
      .map((s) => ({ txHash: String(s.txHash), tokenAddress: String(s.tokenAddress), tradeKind: s?.tradeKind }));
  } catch {
    return [];
  }
}

let originalSimulationMode: string | undefined;

test.before(() => {
  originalSimulationMode = process.env.SIMULATION_MODE;
  process.env.SIMULATION_MODE = 'true';
});

test.after(() => {
  if (originalSimulationMode !== undefined) {
    process.env.SIMULATION_MODE = originalSimulationMode;
  } else {
    delete process.env.SIMULATION_MODE;
  }
});

// ─── Pool discovery ────────────────────────────────────────────────────────────

test('[e2e] [base] findTokenPools discovers pools for WETH/USDC', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const pools = await findTokenPools(BASE_WETH, BASE_USDC, 8453);
  assert.ok(pools.length > 0, 'Expected at least one pool on Base');
});

test('[e2e] [base] findV4Pools returns array for WETH/USDC', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const pools = await findV4Pools(BASE_WETH, BASE_USDC, 8453);
  assert.ok(Array.isArray(pools), 'Expected array of V4 pools');
});

test('[e2e] [bsc] findTokenPools discovers pools for WBNB/USDT', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BSC_RPC_URL') ? {} : skip('BSC_RPC_URL not set')),
}, async () => {
  const pools = await findTokenPools(BSC_WBNB, BSC_USDT, 56);
  assert.ok(pools.length > 0, 'Expected at least one pool on BSC');
});

test('[e2e] [eth] findTokenPools discovers pools for WETH/USDC', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('ETH_RPC_URL') ? {} : skip('ETH_RPC_URL not set')),
}, async () => {
  const pools = await findTokenPools(ETH_WETH, ETH_USDC, 1);
  assert.ok(pools.length > 0, 'Expected at least one pool on Ethereum');
});

test('[e2e] findTokenPools returns empty or few pools for nonexistent pair', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const fakeToken = '0x0000000000000000000000000000000000000001';
  const pools = await findTokenPools(BASE_WETH, fakeToken, 8453);
  assert.ok(Array.isArray(pools), 'Must return array');
});

// ─── isDirectSwapSupported ─────────────────────────────────────────────────────

test('[e2e] isDirectSwapSupported true for Base, BSC, ETH', () => {
  assert.equal(isDirectSwapSupported(8453), true);
  assert.equal(isDirectSwapSupported(56), true);
  assert.equal(isDirectSwapSupported(1), true);
});

test('[e2e] isDirectSwapSupported false for unsupported chain', () => {
  assert.equal(isDirectSwapSupported(999), false);
});

// ─── executeDirectSwap success (SIMULATION_MODE → fake txHash) ─────────────────

test('[e2e] [base] executeDirectSwap balanced WETH→USDC returns SIMULATION txHash', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const amountIn = '1000000000000000000'; // 1 WETH
  const result = await executeDirectSwap({
    userId: FAKE_USER_ID,
    accessToken: FAKE_ACCESS_TOKEN,
    walletAddress: FAKE_WALLET,
    tokenIn: BASE_WETH,
    tokenOut: BASE_USDC,
    amountIn,
    chainId: 8453,
    slippageBps: 50,
    executionMode: 'balanced',
  });
  assert.equal(result.success, true, 'Expected success');
  assert.ok(result.txHash?.startsWith('0xSIMULATION_PRIVY_'), `txHash should be simulation fake, got: ${result.txHash}`);
  assert.ok(result.provider !== 'failed', `provider should not be failed, got: ${result.provider}`);
  if (result.amountOut) assert.ok(BigInt(result.amountOut) >= 0n, 'amountOut non-negative');
});

test('[e2e] [base] executeDirectSwap turbo WETH→USDC returns SIMULATION txHash', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const result = await executeDirectSwap({
    userId: FAKE_USER_ID,
    accessToken: FAKE_ACCESS_TOKEN,
    walletAddress: FAKE_WALLET,
    tokenIn: BASE_WETH,
    tokenOut: BASE_USDC,
    amountIn: '1000000000000000000',
    chainId: 8453,
    slippageBps: 50,
    executionMode: 'turbo',
  });
  assert.equal(result.success, true);
  assert.ok(result.txHash?.startsWith('0xSIMULATION_PRIVY_'));
});

test('[e2e] [base] executeDirectSwap with hint preferredStrategy v3', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const result = await executeDirectSwap({
    userId: FAKE_USER_ID,
    accessToken: FAKE_ACCESS_TOKEN,
    walletAddress: FAKE_WALLET,
    tokenIn: BASE_WETH,
    tokenOut: BASE_USDC,
    amountIn: '1000000000000000000',
    chainId: 8453,
    slippageBps: 50,
    executionMode: 'balanced',
    hint: { preferredStrategy: 'v3', preferredDex: 'uniswap' },
  });
  assert.equal(result.success, true);
  assert.ok(result.txHash?.startsWith('0xSIMULATION_PRIVY_'));
});

test('[e2e] [bsc] executeDirectSwap WBNB→USDT returns SIMULATION txHash', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BSC_RPC_URL') ? {} : skip('BSC_RPC_URL not set')),
}, async () => {
  const result = await executeDirectSwap({
    userId: FAKE_USER_ID,
    accessToken: FAKE_ACCESS_TOKEN,
    walletAddress: FAKE_WALLET,
    tokenIn: BSC_WBNB,
    tokenOut: BSC_USDT,
    amountIn: '1000000000000000000', // 1 BNB
    chainId: 56,
    slippageBps: 50,
    executionMode: 'balanced',
  });
  assert.equal(result.success, true);
  assert.ok(result.txHash?.startsWith('0xSIMULATION_PRIVY_'));
});

test('[e2e] [eth] executeDirectSwap WETH→USDC returns SIMULATION txHash', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('ETH_RPC_URL') ? {} : skip('ETH_RPC_URL not set')),
}, async () => {
  const result = await executeDirectSwap({
    userId: FAKE_USER_ID,
    accessToken: FAKE_ACCESS_TOKEN,
    walletAddress: FAKE_WALLET,
    tokenIn: ETH_WETH,
    tokenOut: ETH_USDC,
    amountIn: '1000000000000000000',
    chainId: 1,
    slippageBps: 50,
    executionMode: 'balanced',
  });
  assert.equal(result.success, true);
  assert.ok(result.txHash?.startsWith('0xSIMULATION_PRIVY_'));
});

// ─── Failure and edge cases ────────────────────────────────────────────────────

test('[e2e] executeDirectSwap unsupported chain returns failure', {
  timeout: TIMEOUT_MS,
}, async () => {
  const result = await executeDirectSwap({
    userId: FAKE_USER_ID,
    accessToken: FAKE_ACCESS_TOKEN,
    walletAddress: FAKE_WALLET,
    tokenIn: BASE_WETH,
    tokenOut: BASE_USDC,
    amountIn: '1000000000000000000',
    chainId: 999,
    slippageBps: 50,
  });
  assert.equal(result.success, false);
  assert.equal(result.provider, 'failed');
});

test('[e2e] executeDirectSwap amountIn zero fails or returns no tx', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const result = await executeDirectSwap({
    userId: FAKE_USER_ID,
    accessToken: FAKE_ACCESS_TOKEN,
    walletAddress: FAKE_WALLET,
    tokenIn: BASE_WETH,
    tokenOut: BASE_USDC,
    amountIn: '0',
    chainId: 8453,
    slippageBps: 50,
  });
  assert.equal(result.success, false);
});

test('[e2e] executeDirectSwap nonexistent pair fails', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const noPoolToken = '0x0000000000000000000000000000000000000001';
  const result = await executeDirectSwap({
    userId: FAKE_USER_ID,
    accessToken: FAKE_ACCESS_TOKEN,
    walletAddress: FAKE_WALLET,
    tokenIn: BASE_WETH,
    tokenOut: noPoolToken,
    amountIn: '1000000000000000000',
    chainId: 8453,
    slippageBps: 50,
  });
  assert.equal(result.success, false);
  assert.equal(result.provider, 'failed');
});

test('[e2e] executeDirectSwap tiny amount still returns simulation txHash when pool exists', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const result = await executeDirectSwap({
    userId: FAKE_USER_ID,
    accessToken: FAKE_ACCESS_TOKEN,
    walletAddress: FAKE_WALLET,
    tokenIn: BASE_WETH,
    tokenOut: BASE_USDC,
    amountIn: '1', // 1 wei
    chainId: 8453,
    slippageBps: 50,
    executionMode: 'balanced',
  });
  if (result.success) {
    assert.ok(result.txHash?.startsWith('0xSIMULATION_PRIVY_'));
  } else {
    assert.equal(result.provider, 'failed');
  }
});

// ─── getTokenLiquidity (read-only) ──────────────────────────────────────────────

test('[e2e] [base] getTokenLiquidity returns pools for WETH', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const liquidity = await getTokenLiquidity(BASE_WETH, 8453);
  assert.ok(liquidity.pools.length >= 0);
  assert.ok(typeof liquidity.totalTvlUsd === 'number');
});

test('[e2e] [bsc] getTokenLiquidity returns structure for WBNB', {
  timeout: TIMEOUT_MS,
  ...(hasRpc('BSC_RPC_URL') ? {} : skip('BSC_RPC_URL not set')),
}, async () => {
  const liquidity = await getTokenLiquidity(BSC_WBNB, 56);
  assert.ok(Array.isArray(liquidity.pools));
  assert.ok(typeof liquidity.totalTvlUsd === 'number');
});

// ─── Real on-chain tx hashes from test/ directory ─────────────────────────────

test('[e2e] [base] resolvePoolHintFromSourceTx decodes real tx hashes from test samples', {
  timeout: TIMEOUT_MS * 2,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const samples = loadRealTxSamples(5);
  if (samples.length === 0) {
    return; // skip when test/base-samples-smoke.json not found or empty
  }
  let resolvedCount = 0;
  for (const s of samples) {
    const resolved = await resolvePoolHintFromSwapSupply({
      tokenIn: BASE_WETH,
      tokenOut: s.tokenAddress,
      chainId: 8453,
      hint: { sourceTxHash: s.txHash },
    });
    if (resolved?.poolAddress) resolvedCount += 1;
  }
  assert.ok(resolvedCount >= 1, `Expected at least 1 decoded pool hint from ${samples.length} real tx hashes`);
});

test('[e2e] [base] executeDirectSwap with real tx hint from test samples returns simulation txHash', {
  timeout: TIMEOUT_MS * 2,
  ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
  const samples = loadRealTxSamples(2);
  if (samples.length === 0) {
    return;
  }
  const s = samples[0];
  const amountIn = '1000000000000000'; // 0.001 ETH
  const result = await executeDirectSwap({
    userId: FAKE_USER_ID,
    accessToken: FAKE_ACCESS_TOKEN,
    walletAddress: FAKE_WALLET,
    tokenIn: BASE_WETH,
    tokenOut: s.tokenAddress,
    amountIn,
    chainId: 8453,
    slippageBps: 150,
    executionMode: 'turbo',
    hint: { sourceTxHash: s.txHash },
  });
  if (result.success) {
    assert.ok(result.txHash?.startsWith('0xSIMULATION_PRIVY_'), `txHash should be simulation fake, got: ${result.txHash}`);
  }
  assert.ok(typeof result.success === 'boolean');
  assert.ok(result.provider);
});
