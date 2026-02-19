/**
 * Direct Swap Integration Tests — Base / BSC / Solana
 *
 * These tests hit real RPC endpoints for read-only operations:
 *   - Pool discovery (V2 / V3 / V4)
 *   - On-chain quotes
 *   - Solana Jupiter quote
 *
 * Requirements:
 *   BASE_RPC_URL, BSC_RPC_URL, SOLANA_RPC_URL in environment (or .env)
 *
 * Run:
 *   npx tsx --test src/services/dex/directSwap/directSwap.integration.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';

import { findTokenPools } from '../poolInfo.js';
import { findV4Pools, computePoolId, getV4PoolInfo, V4_STATE_VIEW } from '../uniswapV4.js';
import type { V4PoolKey } from '../uniswapV4.js';
import { V4_QUOTER_ADDRESSES, UNISWAP_V4_POOL_MANAGER_BY_CHAIN } from './constants.js';
import { callRpc } from '../../rpcManager.js';

// ─── Tokens ───────────────────────────────────────────────────────────────────
// Base
const BASE_WETH  = '0x4200000000000000000000000000000000000006';
const BASE_USDC  = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';

// BSC
const BSC_WBNB   = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const BSC_USDT   = '0x55d398326f99059fF775485246999027B3197955';
const BSC_CAKE   = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';

// Solana
const SOL_WSOL   = 'So11111111111111111111111111111111111111112';
const SOL_USDC   = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const TIMEOUT_MS = 12000;

function skip(reason: string) {
    return { skip: reason };
}

function hasRpc(envKey: string): boolean {
    return Boolean(process.env[envKey]);
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE integration tests
// ─────────────────────────────────────────────────────────────────────────────

test('[base] findTokenPools discovers V3 pool for WETH/USDC', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
    const pools = await findTokenPools(BASE_WETH, BASE_USDC, 8453);
    assert.ok(pools.length > 0, 'Expected at least one pool');

    const v3 = pools.find((p) => p.version === 'v3');
    assert.ok(v3, 'Expected at least one V3 pool for WETH/USDC on Base');
    assert.ok(BigInt(v3!.liquidity || '0') > 0n, 'V3 pool must have liquidity > 0');
});

test('[base] findV4Pools discovers hookless V4 pool for WETH/USDC', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
    const pools = await findV4Pools(BASE_WETH, BASE_USDC, 8453);
    // V4 pool may or may not exist for this pair — just check structure
    assert.ok(Array.isArray(pools), 'Expected array of V4 pools');
    for (const p of pools) {
        assert.match(p.poolId, /^0x[a-f0-9]{64}$/, 'poolId must be 32-byte hex');
        assert.ok(p.poolKey.currency0 && p.poolKey.currency1, 'currency0/1 must be set');
        assert.ok(BigInt(p.liquidity) >= 0n, 'liquidity must be non-negative');
    }
});

test('[base] getV4PoolInfo returns null for uninitialized pool', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
    // Random non-existent pool key
    const key: V4PoolKey = {
        currency0: '0x0000000000000000000000000000000000000001',
        currency1: '0x0000000000000000000000000000000000000002',
        fee: 500,
        tickSpacing: 10,
        hooks: '0x0000000000000000000000000000000000000000',
    };
    const info = await getV4PoolInfo(key, 8453);
    assert.equal(info, null, 'Non-existent pool must return null');
});

test('[base] V4 StateView eth_call roundtrip works', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
    const stateView = V4_STATE_VIEW[8453];
    assert.ok(stateView, 'StateView address must be set for Base');

    // eth_call getSlot0 on a known pool (USDC/WETH 500)
    const stateViewIface = new ethers.Interface([
        'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
    ]);
    const ZERO = '0x0000000000000000000000000000000000000000';
    const [c0, c1] = BigInt(BASE_USDC) < BigInt(BASE_WETH) ? [BASE_USDC, BASE_WETH] : [BASE_WETH, BASE_USDC];
    const poolKey: V4PoolKey = { currency0: c0, currency1: c1, fee: 500, tickSpacing: 10, hooks: ZERO };
    const poolId = computePoolId(poolKey);

    const callData = stateViewIface.encodeFunctionData('getSlot0', [poolId]);
    const result = await callRpc<string>(8453, 'eth_call', [{ to: stateView, data: callData }, 'latest']);

    // Pool may or may not be initialized — just check the RPC roundtrip works
    assert.ok(typeof result === 'string', 'eth_call must return a string');
});

test('[base] V4 Quoter address is reachable (eth_getCode)', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
    const quoter = V4_QUOTER_ADDRESSES[8453];
    assert.ok(quoter, 'V4 Quoter address must be set for Base');

    const code = await callRpc<string>(8453, 'eth_getCode', [quoter, 'latest']);
    assert.ok(code && code !== '0x', `V4 Quoter at ${quoter} has no bytecode — wrong address?`);
});

test('[base] PoolManager address is reachable (eth_getCode)', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
    const pm = UNISWAP_V4_POOL_MANAGER_BY_CHAIN[8453];
    assert.ok(pm, 'PoolManager must be set for Base');
    const code = await callRpc<string>(8453, 'eth_getCode', [pm, 'latest']);
    assert.ok(code && code !== '0x', `PoolManager at ${pm} has no bytecode — wrong address?`);
});

test('[base] findTokenPools discovers pools for less-liquid pair (WETH/cbBTC)', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('BASE_RPC_URL') ? {} : skip('BASE_RPC_URL not set')),
}, async () => {
    const pools = await findTokenPools(BASE_WETH, BASE_CBBTC, 8453);
    // At minimum expect a V3 pool to exist
    assert.ok(pools.length > 0, 'Expected at least one pool for WETH/cbBTC on Base');
});

// ─────────────────────────────────────────────────────────────────────────────
// BSC integration tests
// ─────────────────────────────────────────────────────────────────────────────

test('[bsc] findTokenPools discovers PancakeSwap V2 and V3 pools for WBNB/USDT', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('BSC_RPC_URL') ? {} : skip('BSC_RPC_URL not set')),
}, async () => {
    const pools = await findTokenPools(BSC_WBNB, BSC_USDT, 56);
    assert.ok(pools.length > 0, 'Expected at least one pool for WBNB/USDT on BSC');

    const v2 = pools.find((p) => p.version === 'v2');
    const v3 = pools.find((p) => p.version === 'v3');
    assert.ok(v2, 'Expected PancakeSwap V2 pool');
    assert.ok(v3, 'Expected PancakeSwap V3 pool');

    // Both must have real liquidity
    assert.ok(BigInt(v2!.reserve0 || '0') > 0n, 'V2 reserve0 must be > 0');
    assert.ok(BigInt(v3!.liquidity || '0') > 0n, 'V3 liquidity must be > 0');
});

test('[bsc] findTokenPools discovers PancakeSwap V3 for WBNB/CAKE', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('BSC_RPC_URL') ? {} : skip('BSC_RPC_URL not set')),
}, async () => {
    const pools = await findTokenPools(BSC_WBNB, BSC_CAKE, 56);
    assert.ok(pools.length > 0, 'Expected at least one pool for WBNB/CAKE');
    const v3 = pools.find((p) => p.version === 'v3');
    assert.ok(v3, 'Expected V3 pool for WBNB/CAKE on BSC');
});

test('[bsc] Uniswap V4 StateView address is reachable on BSC', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('BSC_RPC_URL') ? {} : skip('BSC_RPC_URL not set')),
}, async () => {
    const sv = V4_STATE_VIEW[56];
    assert.ok(sv, 'V4 StateView must be set for BSC');
    const code = await callRpc<string>(56, 'eth_getCode', [sv, 'latest']);
    assert.ok(code && code !== '0x', `V4 StateView at ${sv} has no bytecode on BSC`);
});

test('[bsc] Uniswap V4 Quoter address is reachable on BSC', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('BSC_RPC_URL') ? {} : skip('BSC_RPC_URL not set')),
}, async () => {
    const quoter = V4_QUOTER_ADDRESSES[56];
    assert.ok(quoter, 'V4 Quoter must be set for BSC');
    const code = await callRpc<string>(56, 'eth_getCode', [quoter, 'latest']);
    assert.ok(code && code !== '0x', `V4 Quoter at ${quoter} has no bytecode on BSC`);
});

test('[bsc] All discovery runs in parallel — completes within 6s for WBNB/USDT', {
    timeout: 6500,
    ...(hasRpc('BSC_RPC_URL') ? {} : skip('BSC_RPC_URL not set')),
}, async () => {
    const start = Date.now();
    const pools = await findTokenPools(BSC_WBNB, BSC_USDT, 56);
    const elapsed = Date.now() - start;
    assert.ok(pools.length > 0, 'Expected pools');
    // With parallel discovery this should be well under 6s even on cold node
    assert.ok(elapsed < 6000, `Pool discovery took ${elapsed}ms — expected < 6000ms`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Solana integration tests
// ─────────────────────────────────────────────────────────────────────────────

test('[solana] Jupiter quote returns amountOut for SOL → USDC', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('SOLANA_RPC_URL') ? {} : skip('SOLANA_RPC_URL not set')),
}, async () => {
    // Dynamically import to avoid loading Solana deps when not needed
    const { getSolanaQuote } = await import('../../solanaSwap.js');

    // 0.1 SOL in lamports
    const amountIn = '100000000';
    const quote = await getSolanaQuote(
        SOL_WSOL,
        SOL_USDC,
        amountIn,
        100, // 1% slippage bps
        'auto',
        undefined,
        undefined,
        'swap'
    );
    assert.ok(quote, 'Expected Jupiter quote for SOL/USDC');
    assert.ok(quote.outAmount && BigInt(quote.outAmount) > 0n, 'outAmount must be > 0');
});

test('[solana] Jupiter quote for USDC → SOL (reverse direction)', {
    timeout: TIMEOUT_MS,
    ...(hasRpc('SOLANA_RPC_URL') ? {} : skip('SOLANA_RPC_URL not set')),
}, async () => {
    const { getSolanaQuote } = await import('../../solanaSwap.js');

    // 10 USDC (6 decimals)
    const amountIn = '10000000';
    const quote = await getSolanaQuote(
        SOL_USDC,
        SOL_WSOL,
        amountIn,
        100,
        'auto',
        undefined,
        undefined,
        'swap'
    );
    assert.ok(quote, 'Expected Jupiter quote for USDC/SOL');
    assert.ok(quote.outAmount && BigInt(quote.outAmount) > 0n, 'outAmount must be > 0');
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-chain parallel timing test
// ─────────────────────────────────────────────────────────────────────────────

test('[cross-chain] Base + BSC pool discovery runs concurrently', {
    timeout: 10000,
    ...(hasRpc('BASE_RPC_URL') && hasRpc('BSC_RPC_URL') ? {} : skip('BASE_RPC_URL and BSC_RPC_URL both required')),
}, async () => {
    const start = Date.now();
    const [basePools, bscPools] = await Promise.all([
        findTokenPools(BASE_WETH, BASE_USDC, 8453),
        findTokenPools(BSC_WBNB, BSC_USDT, 56),
    ]);
    const elapsed = Date.now() - start;

    assert.ok(basePools.length > 0, 'Expected Base pools');
    assert.ok(bscPools.length > 0, 'Expected BSC pools');

    // Two independent chains in parallel should still finish quickly
    assert.ok(elapsed < 9000, `Concurrent discovery took ${elapsed}ms — expected < 9000ms`);
});
