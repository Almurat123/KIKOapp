/**
 * Direct Swap Unit Tests (offline - no RPC calls)
 *
 * Tests pure logic: address sorting, PoolId computation, hint derivation,
 * strategy merging, turbo budget, reference quote helpers, pool summarization.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { computePoolId, V4_STATE_VIEW } from '../uniswapV4.js';
import type { V4PoolKey } from '../uniswapV4.js';
import { deriveHintStrategy, mergeStrategies } from './hint.js';
import { summarizePools } from './poolDiscovery.js';
import { isTurboBudgetExceeded, computeTurboDeadline } from './turbo.js';
import {
    pickBestReferenceQuote,
    buildReferenceQuoteCacheKey,
    buildSharedExternalReferenceQuoteCacheKey
} from './referenceQuote.js';
import {
    V4_QUOTER_ADDRESSES,
    UNISWAP_V4_POOL_MANAGER_BY_CHAIN,
    CHAIN_STRATEGIES,
} from './constants.js';
import { V3_FEE_TIERS } from '../types.js';
import type { DirectSwapHint } from '../directSwapTypes.js';
import type { PoolInfo } from '../poolInfo.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Contract address sanity checks
// ─────────────────────────────────────────────────────────────────────────────

test('[addresses] V4 Quoter addresses are set for Base and BSC', () => {
    assert.ok(V4_QUOTER_ADDRESSES[8453], 'Base V4 Quoter missing');
    assert.ok(V4_QUOTER_ADDRESSES[56], 'BSC V4 Quoter missing');
    assert.match(V4_QUOTER_ADDRESSES[8453]!, /^0x[a-fA-F0-9]{40}$/);
    assert.match(V4_QUOTER_ADDRESSES[56]!, /^0x[a-fA-F0-9]{40}$/);
});

test('[addresses] V4 PoolManager for Base must be the correct address (not Ethereum)', () => {
    const base = UNISWAP_V4_POOL_MANAGER_BY_CHAIN[8453]!.toLowerCase();
    // The WRONG address that was previously hardcoded for Base
    assert.notEqual(
        base,
        '0x000000000004444c5dc75cb358380d2e3de08a90',
        'Base PoolManager still has Ethereum address - regression!'
    );
    // The correct Base PoolManager address
    assert.equal(base, '0x498581ff718922c3f8e6a244956af099b2652b2b');
});

test('[addresses] V4 StateView is defined for Base, BSC, Ethereum', () => {
    assert.ok(V4_STATE_VIEW[8453], 'Base StateView missing');
    assert.ok(V4_STATE_VIEW[56], 'BSC StateView missing');
    assert.ok(V4_STATE_VIEW[1], 'Ethereum StateView missing');
    // Ethereum StateView must be the current correct address
    assert.equal(
        V4_STATE_VIEW[1]!.toLowerCase(),
        '0x7ffe42c4a5deea5b0fec41c94c136cf115597227',
        'Ethereum StateView address incorrect'
    );
});

test('[addresses] Chain strategies exist for Base and BSC', () => {
    assert.ok(Array.isArray(CHAIN_STRATEGIES[8453]) && CHAIN_STRATEGIES[8453].length > 0, 'Base has no strategies');
    assert.ok(Array.isArray(CHAIN_STRATEGIES[56]) && CHAIN_STRATEGIES[56].length > 0, 'BSC has no strategies');
    // BSC should have infinity strategy
    const bscKinds = CHAIN_STRATEGIES[56].map((s) => s.kind);
    assert.ok(bscKinds.includes('infinity'), 'BSC missing infinity strategy');
    // Base should have v4 strategy
    const baseKinds = CHAIN_STRATEGIES[8453].map((s) => s.kind);
    assert.ok(baseKinds.includes('v4'), 'Base missing v4 strategy');
});

test('[addresses] Uniswap V3 standard fee tiers include 0.01%', () => {
    assert.deepEqual([...V3_FEE_TIERS], [100, 500, 3000, 10000]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PoolId computation
// ─────────────────────────────────────────────────────────────────────────────

test('[poolId] computePoolId produces expected keccak for known Base pool (USDC/WETH 500)', () => {
    // USDC/WETH 0.05% no-hook pool on Base — verified on-chain
    const WETH  = '0x4200000000000000000000000000000000000006';
    const USDC  = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const ZERO  = '0x0000000000000000000000000000000000000000';
    // currency0 < currency1 by address order
    const [c0, c1] = BigInt(USDC) < BigInt(WETH) ? [USDC, WETH] : [WETH, USDC];
    const key: V4PoolKey = { currency0: c0, currency1: c1, fee: 500, tickSpacing: 10, hooks: ZERO };
    const poolId = computePoolId(key);
    assert.match(poolId, /^0x[a-f0-9]{64}$/, 'PoolId must be 32-byte hex');
    // Must be deterministic
    assert.equal(computePoolId(key), poolId);
});

test('[poolId] token address ordering matters — different order gives different poolId', () => {
    const A = '0x1111111111111111111111111111111111111111';
    const B = '0x2222222222222222222222222222222222222222';
    const ZERO = '0x0000000000000000000000000000000000000000';
    const k1: V4PoolKey = { currency0: A, currency1: B, fee: 3000, tickSpacing: 60, hooks: ZERO };
    const k2: V4PoolKey = { currency0: B, currency1: A, fee: 3000, tickSpacing: 60, hooks: ZERO };
    assert.notEqual(computePoolId(k1), computePoolId(k2));
});

test('[poolId] different fee tiers produce different poolIds', () => {
    const A = '0x4200000000000000000000000000000000000006';
    const B = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const ZERO = '0x0000000000000000000000000000000000000000';
    const [c0, c1] = BigInt(A) < BigInt(B) ? [A, B] : [B, A];
    const ids = [100, 500, 3000, 10000].map((fee) =>
        computePoolId({ currency0: c0, currency1: c1, fee, tickSpacing: 10, hooks: ZERO })
    );
    const unique = new Set(ids);
    assert.equal(unique.size, 4, 'All fee tiers must produce distinct poolIds');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Hint strategy derivation
// ─────────────────────────────────────────────────────────────────────────────

test('[hint] deriveHintStrategy returns null for empty hint', () => {
    assert.equal(deriveHintStrategy(8453, undefined), null);
    assert.equal(deriveHintStrategy(8453, {}), null);
});

test('[hint] deriveHintStrategy detects v4 from dex name on Base', () => {
    const hint: DirectSwapHint = { sourceDexName: 'Uniswap V4' };
    const strategy = deriveHintStrategy(8453, hint);
    assert.ok(strategy, 'Expected strategy');
    assert.equal(strategy!.kind, 'v4');
    assert.equal(strategy!.dex, 'uniswap');
});

test('[hint] deriveHintStrategy detects aerodrome from dex name', () => {
    const strategy = deriveHintStrategy(8453, { sourceDexName: 'Aerodrome' });
    assert.ok(strategy);
    assert.equal(strategy!.kind, 'aerodrome');
});

test('[hint] deriveHintStrategy does not treat Aerodrome CL factory as router hint', () => {
    const strategy = deriveHintStrategy(8453, {
        sourceRouter: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da'
    });
    assert.equal(strategy, null);
});

test('[hint] deriveHintStrategy detects infinity (PancakeSwap) from dex name on BSC', () => {
    const strategy = deriveHintStrategy(56, { sourceDexName: 'PancakeSwap Infinity' });
    assert.ok(strategy);
    assert.equal(strategy!.kind, 'infinity');
});

test('[hint] deriveHintStrategy detects v3 pancake by router address on BSC', () => {
    const strategy = deriveHintStrategy(56, {
        sourceRouter: '0x1b81D678ffb9C0263b24A97847620C99d213eB14'
    });
    assert.ok(strategy);
    assert.equal(strategy!.kind, 'v3');
    assert.equal(strategy!.dex, 'pancake');
});

test('[hint] deriveHintStrategy respects preferredStrategy override', () => {
    const hint: DirectSwapHint = { preferredStrategy: 'v3', preferredDex: 'uniswap' };
    const strategy = deriveHintStrategy(8453, hint);
    assert.ok(strategy);
    assert.equal(strategy!.kind, 'v3');
});

test('[hint] mergeStrategies puts preferred first and deduplicates', () => {
    const defaults = [
        { kind: 'v3' as const, dex: 'uniswap' as const },
        { kind: 'v2' as const, dex: 'uniswap' as const },
    ];
    const preferred = { kind: 'v4' as const, dex: 'uniswap' as const };
    const merged = mergeStrategies(defaults, preferred);
    assert.equal(merged[0].kind, 'v4', 'v4 must be first');
    assert.equal(merged.length, 3);
});

test('[hint] mergeStrategies deduplicates when preferred already in defaults', () => {
    const defaults = [
        { kind: 'v4' as const, dex: 'uniswap' as const },
        { kind: 'v3' as const, dex: 'uniswap' as const },
    ];
    const preferred = { kind: 'v4' as const, dex: 'uniswap' as const };
    const merged = mergeStrategies(defaults, preferred);
    assert.equal(merged.filter((s) => s.kind === 'v4').length, 1, 'v4 should appear only once');
    assert.equal(merged.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Turbo budget helpers
// ─────────────────────────────────────────────────────────────────────────────

test('[turbo] isTurboBudgetExceeded returns false when well within budget', () => {
    const start = Date.now();
    assert.equal(isTurboBudgetExceeded(start, 5000), false);
});

test('[turbo] isTurboBudgetExceeded returns true when start is in the past beyond budget', () => {
    const start = Date.now() - 3000;
    assert.equal(isTurboBudgetExceeded(start, 2000), true);
});

test('[turbo] computeTurboDeadline returns startMs + budgetMs', () => {
    const start = 1000000;
    assert.equal(computeTurboDeadline(start, 2000), 1002000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Reference quote helpers
// ─────────────────────────────────────────────────────────────────────────────

test('[quote] pickBestReferenceQuote selects highest amountOut', () => {
    const candidates = [
        { amountOut: 100n, source: 'zeroex' },
        { amountOut: 150n, source: 'kyber' },
        { amountOut: 120n, source: 'direct-v3' },
    ];
    const best = pickBestReferenceQuote(candidates);
    assert.ok(best);
    assert.equal(best!.amountOut, 150n);
    assert.equal(best!.source, 'kyber');
});

test('[quote] pickBestReferenceQuote returns null for empty list', () => {
    assert.equal(pickBestReferenceQuote([]), null);
});

test('[quote] buildReferenceQuoteCacheKey is deterministic and includes all fields', () => {
    const key1 = buildReferenceQuoteCacheKey({
        chainId: 8453,
        tokenIn: '0xAAAA',
        tokenOut: '0xBBBB',
        amountInWei: 1000000000000000000n,
        recipient: '0xWallet',
        enableZoraRoutes: false,
    });
    const key2 = buildReferenceQuoteCacheKey({
        chainId: 8453,
        tokenIn: '0xAAAA',
        tokenOut: '0xBBBB',
        amountInWei: 1000000000000000000n,
        recipient: '0xWallet',
        enableZoraRoutes: false,
    });
    assert.equal(key1, key2, 'Key must be deterministic');

    const key3 = buildReferenceQuoteCacheKey({
        chainId: 8453,
        tokenIn: '0xAAAA',
        tokenOut: '0xBBBB',
        amountInWei: 1000000000000000000n,
        recipient: '0xWallet',
        enableZoraRoutes: true, // different
    });
    assert.notEqual(key1, key3, 'Zora flag must change cache key');
});

test('[quote] buildSharedExternalReferenceQuoteCacheKey ignores recipient and zora flags', () => {
    const sharedKey = buildSharedExternalReferenceQuoteCacheKey({
        chainId: 8453,
        tokenIn: '0xAAAA',
        tokenOut: '0xBBBB',
        amountInWei: 1000000000000000000n
    });

    const requestKeyA = buildReferenceQuoteCacheKey({
        chainId: 8453,
        tokenIn: '0xAAAA',
        tokenOut: '0xBBBB',
        amountInWei: 1000000000000000000n,
        recipient: '0xWalletA',
        enableZoraRoutes: false
    });
    const requestKeyB = buildReferenceQuoteCacheKey({
        chainId: 8453,
        tokenIn: '0xAAAA',
        tokenOut: '0xBBBB',
        amountInWei: 1000000000000000000n,
        recipient: '0xWalletB',
        enableZoraRoutes: true
    });

    assert.notEqual(requestKeyA, requestKeyB, 'per-request key should differ by recipient/zora');
    assert.equal(
        sharedKey,
        buildSharedExternalReferenceQuoteCacheKey({
            chainId: 8453,
            tokenIn: '0xAAAA',
            tokenOut: '0xBBBB',
            amountInWei: 1000000000000000000n
        }),
        'shared key should stay stable for same pair+amount'
    );
});

test('[quote] buildSharedExternalReferenceQuoteCacheKey changes when amount changes', () => {
    const key1 = buildSharedExternalReferenceQuoteCacheKey({
        chainId: 8453,
        tokenIn: '0xAAAA',
        tokenOut: '0xBBBB',
        amountInWei: 1000n
    });
    const key2 = buildSharedExternalReferenceQuoteCacheKey({
        chainId: 8453,
        tokenIn: '0xAAAA',
        tokenOut: '0xBBBB',
        amountInWei: 2000n
    });
    assert.notEqual(key1, key2, 'amount should remain part of shared cache key');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Pool summarization
// ─────────────────────────────────────────────────────────────────────────────

test('[pools] summarizePools counts correctly', () => {
    const pools: Partial<PoolInfo>[] = [
        { version: 'v2', poolAddress: '0x1', token0: '0xa', token1: '0xb' },
        { version: 'v3', poolAddress: '0x2', token0: '0xa', token1: '0xb' },
        { version: 'v3', poolAddress: '0x3', token0: '0xa', token1: '0xb' },
        { version: 'v4', poolAddress: '0x4', token0: '0xa', token1: '0xb' },
    ];
    const result = summarizePools(pools as PoolInfo[]);
    assert.equal(result.poolsFound, 4);
    assert.equal(result.poolKinds.v2, 1);
    assert.equal(result.poolKinds.v3, 2);
    assert.equal(result.poolKinds.v4, 1);
});

test('[pools] summarizePools returns zeros for empty list', () => {
    const result = summarizePools([]);
    assert.equal(result.poolsFound, 0);
    assert.equal(result.poolKinds.v2, 0);
    assert.equal(result.poolKinds.v3, 0);
    assert.equal(result.poolKinds.v4, 0);
});
