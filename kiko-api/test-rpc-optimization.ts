/**
 * RPC 优化功能测试
 * 测试缓存层和多 RPC 节点是否正常工作
 */

import { callRpc, getNativeBalance, getBlockNumber } from './src/services/rpcManager.js';
import { getCacheStats, clearCache } from './src/services/rpcCache.js';
import { getRpcEndpoints } from './src/config/apiEndpoints.js';

async function testRpcOptimization() {
    console.log('🧪 RPC 优化功能测试\n');
    console.log('='.repeat(60));

    // 1. 测试 RPC 端点优先级配置
    console.log('\n📌 1. RPC 端点优先级配置');
    console.log('-'.repeat(40));

    const chains = ['eth', 'base', 'bsc', 'polygon'];
    for (const chain of chains) {
        const endpoints = getRpcEndpoints(chain);
        console.log(`\n${chain.toUpperCase()}:`);
        endpoints.forEach((ep, i) => {
            console.log(`  ${i + 1}. [${ep.type}] ${ep.name} (priority: ${ep.priority})`);
        });
    }

    // 2. 测试缓存功能
    console.log('\n\n📌 2. RPC 缓存功能测试');
    console.log('-'.repeat(40));

    clearCache(); // 清空缓存开始测试

    // 测试 eth_blockNumber 缓存
    console.log('\n测试 eth_blockNumber (TTL: 12秒):');

    const start1 = Date.now();
    const block1 = await getBlockNumber(8453); // Base
    const time1 = Date.now() - start1;
    console.log(`  第1次调用: block=${block1}, 耗时=${time1}ms`);

    const start2 = Date.now();
    const block2 = await getBlockNumber(8453);
    const time2 = Date.now() - start2;
    console.log(`  第2次调用: block=${block2}, 耗时=${time2}ms (应该 <5ms 如果缓存命中)`);

    const stats1 = getCacheStats();
    console.log(`  缓存统计: hits=${stats1.hits}, misses=${stats1.misses}, hitRate=${stats1.hitRate}`);

    // 3. 测试 eth_call 缓存 (获取 WETH decimals)
    console.log('\n测试 eth_call 缓存 (WETH decimals):');

    const WETH_BASE = '0x4200000000000000000000000000000000000006';
    const decimalsData = '0x313ce567'; // decimals() selector

    const start3 = Date.now();
    const result1 = await callRpc<string>(8453, 'eth_call', [{ to: WETH_BASE, data: decimalsData }, 'latest']);
    const time3 = Date.now() - start3;
    console.log(`  第1次调用: result=${result1}, 耗时=${time3}ms`);

    const start4 = Date.now();
    const result2 = await callRpc<string>(8453, 'eth_call', [{ to: WETH_BASE, data: decimalsData }, 'latest']);
    const time4 = Date.now() - start4;
    console.log(`  第2次调用: result=${result2}, 耗时=${time4}ms (应该 <5ms 如果缓存命中)`);

    const stats2 = getCacheStats();
    console.log(`  缓存统计: hits=${stats2.hits}, misses=${stats2.misses}, hitRate=${stats2.hitRate}`);

    // 4. 测试多链 RPC 可用性
    console.log('\n\n📌 3. 多链 RPC 可用性测试');
    console.log('-'.repeat(40));

    const chainTests = [
        { chainId: 1, name: 'Ethereum' },
        { chainId: 8453, name: 'Base' },
        { chainId: 137, name: 'Polygon' },
        { chainId: 56, name: 'BSC' },
    ];

    for (const chain of chainTests) {
        try {
            const start = Date.now();
            const blockNum = await getBlockNumber(chain.chainId);
            const time = Date.now() - start;
            console.log(`  ✅ ${chain.name}: block=${blockNum}, 耗时=${time}ms`);
        } catch (error: any) {
            console.log(`  ❌ ${chain.name}: ${error.message}`);
        }
    }

    // 5. 最终缓存统计
    console.log('\n\n📌 4. 最终缓存统计');
    console.log('-'.repeat(40));
    const finalStats = getCacheStats();
    console.log(`  总命中: ${finalStats.hits}`);
    console.log(`  总未命中: ${finalStats.misses}`);
    console.log(`  命中率: ${finalStats.hitRate}`);
    console.log(`  缓存大小: ${finalStats.size}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ RPC 优化功能测试完成!\n');
}

testRpcOptimization().catch(console.error);
