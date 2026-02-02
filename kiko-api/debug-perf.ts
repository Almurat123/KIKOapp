/**
 * 性能分析 - 池子查询
 */

import { findTokenPools } from './src/services/dex/poolInfo.js';
import { findV4Pools } from './src/services/dex/uniswapV4.js';

const CLAWNCH = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

async function benchmark() {
    console.log('🔍 性能分析 - 池子查询\n');

    // V4 单独查询
    console.log('=== V4 单独查询 ===');
    let start = Date.now();
    const v4Pools = await findV4Pools(CLAWNCH, WETH, 8453);
    console.log('V4 WETH:', Date.now() - start, 'ms, 找到', v4Pools.length, '个池子');

    start = Date.now();
    const v4UsdcPools = await findV4Pools(CLAWNCH, USDC, 8453);
    console.log('V4 USDC:', Date.now() - start, 'ms, 找到', v4UsdcPools.length, '个池子');

    // 完整查询
    console.log('\n=== findTokenPools 完整查询 ===');
    start = Date.now();
    const wethPools = await findTokenPools(CLAWNCH, WETH, 8453);
    console.log('WETH 配对:', Date.now() - start, 'ms, 找到', wethPools.length, '个池子');

    start = Date.now();
    const usdcPools = await findTokenPools(CLAWNCH, USDC, 8453);
    console.log('USDC 配对:', Date.now() - start, 'ms, 找到', usdcPools.length, '个池子');

    // 并行查询
    console.log('\n=== 并行查询 ===');
    start = Date.now();
    const [p1, p2] = await Promise.all([
        findTokenPools(CLAWNCH, WETH, 8453),
        findTokenPools(CLAWNCH, USDC, 8453)
    ]);
    console.log('并行总时间:', Date.now() - start, 'ms');
    console.log('找到:', p1.length + p2.length, '个池子');
}

benchmark().catch(console.error);
