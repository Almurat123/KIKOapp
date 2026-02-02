/**
 * 调试所有找到的池子
 */

import { findTokenPools } from './src/services/dex/poolInfo.js';

const CLAWNCH = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

const ETH_PRICE = 2400;
const USDC_PRICE = 1;

async function debug() {
    console.log('🔍 调试 CLAWNCH 池子发现\n');

    // WETH 配对
    console.log('=== CLAWNCH/WETH ===');
    const wethPools = await findTokenPools(CLAWNCH, WETH, 8453);
    console.log('找到', wethPools.length, '个池子');
    for (const pool of wethPools) {
        console.log('  -', pool.version || 'v2/v3', 'fee:', pool.fee, 'liq:', pool.liquidity?.slice(0, 15) + '...');
    }

    // USDC 配对
    console.log('\n=== CLAWNCH/USDC ===');
    const usdcPools = await findTokenPools(CLAWNCH, USDC, 8453);
    console.log('找到', usdcPools.length, '个池子');
    for (const pool of usdcPools) {
        console.log('  -', pool.version || 'v2/v3', 'fee:', pool.fee, 'liq:', pool.liquidity?.slice(0, 15) + '...');
    }
}

debug().catch(console.error);
