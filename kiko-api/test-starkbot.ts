/**
 * 测试 STARKBOT 代币的池子查找
 */
import { findTokenPools } from './src/services/dex/poolInfo.js';
import dotenv from 'dotenv';

dotenv.config();

// STARKBOT 代币 (Base) - 从日志中获取
const STARKBOT = '0x587cd533f418825521f3a1daa7ccd1e7339a1b07';
const WETH_BASE = '0x4200000000000000000000000000000000000006';
const CHAIN_ID = 8453;

async function testPoolFinding() {
    console.log('=== 测试 STARKBOT 池子查找 ===\n');
    console.log('Token:', STARKBOT);
    console.log('WETH:', WETH_BASE);
    console.log();

    try {
        const pools = await findTokenPools(WETH_BASE, STARKBOT, CHAIN_ID);
        console.log(`找到 ${pools.length} 个池子:`);
        for (const pool of pools) {
            console.log(`  - ${pool.version}: fee=${pool.fee}, liquidity=${pool.liquidity?.slice(0, 15)}...`);
        }

        if (pools.length === 0) {
            console.log('\n❌ 没有找到池子 - 这解释了为什么 DirectSwap 失败');
        } else {
            console.log('\n✅ 找到池子 - DirectSwap 应该能工作');
        }
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

testPoolFinding().catch(console.error);
