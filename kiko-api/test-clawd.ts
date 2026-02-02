/**
 * 测试 CLAWD 代币的池子查找 - 验证 ETH->WETH 转换修复
 */
import { findTokenPools } from './src/services/dex/poolInfo.js';
import dotenv from 'dotenv';

dotenv.config();

// CLAWD 代币地址 (Base)
const CLAWD = '0x9f86db9fc6f7c9408e8fda3ff8ce4e78ac7a6b07';
const WETH_BASE = '0x4200000000000000000000000000000000000006';
const ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const CHAIN_ID = 8453;

async function testPoolFinding() {
    console.log('=== 验证 ETH->WETH 转换修复 ===\n');

    // 模拟 findBestPool 的逻辑
    function normalizeAddress(addr: string, chainId: number): string {
        const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const WETH_ADDRESSES: Record<number, string> = {
            8453: '0x4200000000000000000000000000000000000006',
            1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        };
        const weth = WETH_ADDRESSES[chainId];
        return addr.toLowerCase() === ETH_ADDRESS.toLowerCase() ? weth : addr;
    }

    // 1. 原始查询 (不转换)
    console.log('--- 1. 原始查询 ETH -> CLAWD (无转换) ---');
    const pools1 = await findTokenPools(ETH, CLAWD, CHAIN_ID);
    console.log(`结果: ${pools1.length} 个池子 ${pools1.length === 0 ? '❌' : '✅'}`);

    // 2. 使用修复后的逻辑 (ETH -> WETH 转换)
    console.log('\n--- 2. 修复后查询 (ETH->WETH 转换) ---');
    const normalizedIn = normalizeAddress(ETH, CHAIN_ID);
    const normalizedOut = normalizeAddress(CLAWD, CHAIN_ID);
    console.log(`normalizedIn: ${normalizedIn.slice(0, 20)}...`);
    console.log(`normalizedOut: ${normalizedOut.slice(0, 20)}...`);

    const pools2 = await findTokenPools(normalizedIn, normalizedOut, CHAIN_ID);
    console.log(`结果: ${pools2.length} 个池子 ${pools2.length > 0 ? '✅' : '❌'}`);

    for (const pool of pools2) {
        console.log(`  - ${pool.version}: fee=${pool.fee}`);
    }

    console.log('\n=== 总结 ===');
    console.log(`修复前: ${pools1.length} 个池子`);
    console.log(`修复后: ${pools2.length} 个池子`);
    console.log(`修复有效: ${pools2.length > 0 ? '✅ 是' : '❌ 否'}`);
}

testPoolFinding().catch(console.error);
