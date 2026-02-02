/**
 * 调试 V4 TVL 计算
 * 目标：对比我们计算的 V4 TVL 和 DEX Screener 数据
 */

import { findV4Pools } from './src/services/dex/uniswapV4.js';

const CLAWNCH = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const MOLT = '0xB695559b26BB2c9703ef1935c37AeaE9526bab07';
const WETH = '0x4200000000000000000000000000000000000006';

// ETH 价格 (假设)
const ETH_PRICE = 3300;

/**
 * V3/V4 TVL 计算公式
 * 来自 Uniswap V3 白皮书
 */
function calculateTVL(
    sqrtPriceX96: bigint,
    liquidity: bigint,
    decimals0: number,
    decimals1: number,
    price0USD: number,
    price1USD: number
): number {
    const Q96 = BigInt(2) ** BigInt(96);

    // 计算当前价格
    const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
    const price = sqrtPrice * sqrtPrice;

    // 计算 token 数量
    // amount0 = L / sqrtPrice
    // amount1 = L * sqrtPrice
    const L = Number(liquidity);
    const amount0Raw = L / sqrtPrice;
    const amount1Raw = L * sqrtPrice;

    // 调整精度
    const amount0 = amount0Raw / (10 ** decimals0);
    const amount1 = amount1Raw / (10 ** decimals1);

    // 计算 TVL
    const tvl0 = amount0 * price0USD;
    const tvl1 = amount1 * price1USD;

    return tvl0 + tvl1;
}

async function debug() {
    console.log('🔍 调试 V4 TVL 计算\n');
    console.log('ETH Price: $' + ETH_PRICE);
    console.log('');

    // CLAWNCH/WETH
    console.log('=== CLAWNCH/WETH V4 ===');
    const clawnchPools = await findV4Pools(CLAWNCH, WETH, 8453);
    console.log('找到', clawnchPools.length, '个池子');

    for (const pool of clawnchPools) {
        console.log('');
        console.log('PoolId:', pool.poolId.slice(0, 30) + '...');
        console.log('Liquidity:', pool.liquidity);
        console.log('sqrtPriceX96:', pool.sqrtPriceX96.slice(0, 30) + '...');
        console.log('lpFee:', pool.lpFee, '(' + (pool.lpFee / 10000) + '%)');

        // currency0 = WETH (较小), currency1 = CLAWNCH (较大)
        // price = token1/token0 = CLAWNCH/WETH
        // 我们需要 WETH 的 USD 价值
        const tvl = calculateTVL(
            BigInt(pool.sqrtPriceX96),
            BigInt(pool.liquidity),
            18, // WETH decimals
            18, // CLAWNCH decimals
            ETH_PRICE, // price0USD (WETH)
            0          // price1USD (CLAWNCH, unknown)
        );

        console.log('计算的 TVL (仅 WETH 侧): $' + tvl.toLocaleString());
        console.log('完整 TVL 估算 (x2): $' + (tvl * 2).toLocaleString());
        console.log('DEX Screener: $1,180,000');
    }

    // MOLT/WETH
    console.log('\n=== MOLT/WETH V4 ===');
    const moltPools = await findV4Pools(MOLT, WETH, 8453);
    console.log('找到', moltPools.length, '个池子');

    for (const pool of moltPools) {
        console.log('');
        console.log('PoolId:', pool.poolId.slice(0, 30) + '...');
        console.log('Liquidity:', pool.liquidity);

        const tvl = calculateTVL(
            BigInt(pool.sqrtPriceX96),
            BigInt(pool.liquidity),
            18,
            18,
            ETH_PRICE,
            0
        );

        console.log('计算的 TVL (仅 WETH 侧): $' + tvl.toLocaleString());
        console.log('完整 TVL 估算 (x2): $' + (tvl * 2).toLocaleString());
        console.log('DEX Screener: $1,870,000');
    }
}

debug().catch(console.error);
