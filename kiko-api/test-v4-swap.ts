/**
 * 测试 V4 Swap 编码
 */

import { buildV4SwapTransaction, UNIVERSAL_ROUTER_V4 } from './src/services/dex/uniswapV4Swap.js';
import { findV4Pools, V4PoolKey } from './src/services/dex/uniswapV4.js';

const CLAWNCH = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const WETH = '0x4200000000000000000000000000000000000006';

async function test() {
    console.log('🔍 测试 V4 Swap 编码\n');

    // 1. 找到 V4 池子
    console.log('=== 查找 V4 池子 ===');
    const pools = await findV4Pools(CLAWNCH, WETH, 8453);
    if (pools.length === 0) {
        console.log('未找到 V4 池子');
        return;
    }

    const pool = pools[0];
    console.log('PoolId:', pool.poolId.slice(0, 30) + '...');
    console.log('Fee:', pool.lpFee, '(' + (pool.lpFee / 10000) + '%)');

    // 2. 构建交易
    console.log('\n=== 构建交易 ===');
    const amountIn = BigInt('1000000000000000'); // 0.001 ETH
    const minAmountOut = BigInt('0'); // 测试用

    // 确定方向: WETH(token0) -> CLAWNCH(token1) = zeroForOne = true
    const zeroForOne = pool.poolKey.currency0.toLowerCase() === WETH.toLowerCase();
    console.log('zeroForOne:', zeroForOne);
    console.log('Swapping:', zeroForOne ? 'WETH -> CLAWNCH' : 'CLAWNCH -> WETH');

    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 分钟
    const recipient = '0x0000000000000000000000000000000000000001'; // 测试地址

    try {
        const tx = buildV4SwapTransaction(
            8453,
            pool.poolKey,
            zeroForOne,
            amountIn,
            minAmountOut,
            recipient,
            deadline
        );

        console.log('\nRouter:', tx.to);
        console.log('Data length:', tx.data.length);
        console.log('Data preview:', tx.data.slice(0, 100) + '...');

        console.log('\n✅ 编码成功!');
        console.log('\n完整交易数据:');
        console.log(JSON.stringify({
            to: tx.to,
            data: tx.data,
            value: zeroForOne ? amountIn.toString() : '0' // 如果输入是 ETH
        }, null, 2));
    } catch (err) {
        console.error('❌ 编码失败:', err);
    }
}

test().catch(console.error);
