/**
 * RPC 生产环境压力测试
 * 模拟真实代码场景: getTokenPrice, getBalance, swap quote 等
 */

import { callRpc } from './src/services/rpcManager';
import { getCacheStats, clearCache } from './src/services/rpcCache';

// 常用代币地址
const TOKENS = {
    base: {
        WETH: '0x4200000000000000000000000000000000000006',
        USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    },
    eth: {
        WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },
    bsc: {
        WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        USDT: '0x55d398326f99059fF775485246999027B3197955',
        BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    },
    polygon: {
        WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    },
};

// ERC20 函数选择器
const SELECTORS = {
    decimals: '0x313ce567',
    symbol: '0x95d89b41',
    name: '0x06fdde03',
    balanceOf: '0x70a08231',
    totalSupply: '0x18160ddd',
};

interface TestResult {
    scenario: string;
    chain: string;
    success: boolean;
    latency: number;
    error?: string;
    cached?: boolean;
}

const results: TestResult[] = [];

async function testScenario(
    scenario: string,
    chain: string,
    method: string,
    params: any[]
): Promise<TestResult> {
    const start = Date.now();
    try {
        const result = await callRpc(chain, method, params);
        const latency = Date.now() - start;
        return { scenario, chain, success: true, latency, cached: latency < 5 };
    } catch (err: any) {
        return {
            scenario,
            chain,
            success: false,
            latency: Date.now() - start,
            error: err.message?.substring(0, 50),
        };
    }
}

async function runProductionSimulation() {
    console.log('🔥 RPC 生产环境压力测试');
    console.log('模拟真实代码场景: Token Info, Balance, Block Data 等\n');
    console.log('='.repeat(80));

    clearCache();

    // ============================================
    // 场景 1: 获取区块号 (最常用)
    // ============================================
    console.log('\n📌 场景 1: eth_blockNumber (高频调用)');
    console.log('-'.repeat(60));

    for (const chain of ['base', 'eth', 'bsc', 'polygon']) {
        const r = await testScenario('eth_blockNumber', chain, 'eth_blockNumber', []);
        results.push(r);
        console.log(`${r.success ? '✅' : '❌'} ${chain.padEnd(8)} ${r.latency}ms ${r.error || ''}`);
    }

    // ============================================
    // 场景 2: 获取代币信息 (eth_call - decimals/symbol)
    // ============================================
    console.log('\n📌 场景 2: Token Info (eth_call - decimals, symbol)');
    console.log('-'.repeat(60));

    for (const [chain, tokens] of Object.entries(TOKENS)) {
        const tokenList = Object.entries(tokens);
        for (const [name, address] of tokenList.slice(0, 2)) {
            // decimals
            const r = await testScenario(
                `decimals(${name})`,
                chain,
                'eth_call',
                [{ to: address, data: SELECTORS.decimals }, 'latest']
            );
            results.push(r);
            console.log(`${r.success ? '✅' : '❌'} ${chain.padEnd(8)} ${name.padEnd(6)} decimals ${r.latency}ms ${r.cached ? '(cached)' : ''}`);
        }
    }

    // ============================================
    // 场景 3: 获取余额 (eth_getBalance)
    // ============================================
    console.log('\n📌 场景 3: eth_getBalance');
    console.log('-'.repeat(60));

    const testWallet = '0x0000000000000000000000000000000000000001';
    for (const chain of ['base', 'eth', 'bsc']) {
        const r = await testScenario(
            'eth_getBalance',
            chain,
            'eth_getBalance',
            [testWallet, 'latest']
        );
        results.push(r);
        console.log(`${r.success ? '✅' : '❌'} ${chain.padEnd(8)} ${r.latency}ms ${r.cached ? '(cached)' : ''}`);
    }

    // ============================================
    // 场景 4: 获取代币余额 (balanceOf)
    // ============================================
    console.log('\n📌 场景 4: Token balanceOf (eth_call)');
    console.log('-'.repeat(60));

    const paddedWallet = testWallet.slice(2).padStart(64, '0');
    for (const chain of ['base', 'eth']) {
        const tokens = TOKENS[chain as keyof typeof TOKENS];
        const firstToken = Object.values(tokens)[0];
        const r = await testScenario(
            'balanceOf',
            chain,
            'eth_call',
            [{ to: firstToken, data: SELECTORS.balanceOf + paddedWallet }, 'latest']
        );
        results.push(r);
        console.log(`${r.success ? '✅' : '❌'} ${chain.padEnd(8)} ${r.latency}ms ${r.cached ? '(cached)' : ''}`);
    }

    // ============================================
    // 场景 5: 并发压力测试 (模拟多用户)
    // ============================================
    console.log('\n📌 场景 5: 并发压力测试 (20个并发请求)');
    console.log('-'.repeat(60));

    for (const chain of ['base', 'eth']) {
        const startAll = Date.now();
        const concurrentRequests = Array(20).fill(null).map((_, i) =>
            testScenario(`concurrent-${i}`, chain, 'eth_blockNumber', [])
        );

        const concurrentResults = await Promise.all(concurrentRequests);
        const totalTime = Date.now() - startAll;
        const successCount = concurrentResults.filter(r => r.success).length;
        const cachedCount = concurrentResults.filter(r => r.cached).length;
        const avgLatency = Math.round(
            concurrentResults.reduce((a, b) => a + b.latency, 0) / 20
        );

        console.log(`${successCount >= 18 ? '✅' : '⚠️'} ${chain.padEnd(8)} ${successCount}/20 成功, ${cachedCount} 缓存命中, 总耗时=${totalTime}ms, 平均=${avgLatency}ms`);
        concurrentResults.forEach(r => results.push(r));
    }

    // ============================================
    // 场景 6: 连续重复调用 (测试缓存)
    // ============================================
    console.log('\n📌 场景 6: 缓存效果测试 (连续5次相同调用)');
    console.log('-'.repeat(60));

    for (const chain of ['base', 'eth']) {
        const latencies: number[] = [];
        for (let i = 0; i < 5; i++) {
            const r = await testScenario(`cache-test-${i}`, chain, 'eth_blockNumber', []);
            latencies.push(r.latency);
            results.push(r);
        }
        const cached = latencies.filter(l => l < 5).length;
        console.log(`${chain.padEnd(8)} 延迟分布: [${latencies.join(', ')}]ms, 缓存命中: ${cached}/5`);
    }

    // ============================================
    // 汇总报告
    // ============================================
    console.log('\n\n📊 测试汇总报告');
    console.log('='.repeat(80));

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const successRate = ((successCount / totalCount) * 100).toFixed(1);
    const avgLatency = Math.round(
        results.filter(r => r.success).reduce((a, b) => a + b.latency, 0) / successCount
    );

    console.log(`\n总请求数: ${totalCount}`);
    console.log(`成功数: ${successCount}`);
    console.log(`成功率: ${successRate}%`);
    console.log(`平均延迟: ${avgLatency}ms`);

    // 按链统计
    console.log('\n按链统计:');
    const chains = [...new Set(results.map(r => r.chain))];
    for (const chain of chains) {
        const chainResults = results.filter(r => r.chain === chain);
        const chainSuccess = chainResults.filter(r => r.success).length;
        const chainRate = ((chainSuccess / chainResults.length) * 100).toFixed(1);
        const chainAvg = chainSuccess > 0
            ? Math.round(chainResults.filter(r => r.success).reduce((a, b) => a + b.latency, 0) / chainSuccess)
            : 0;
        console.log(`  ${chain.padEnd(10)} ${chainRate.padStart(6)}% 成功率, 平均 ${chainAvg}ms`);
    }

    // 缓存统计
    const cacheStats = getCacheStats();
    console.log('\n缓存统计:');
    console.log(`  命中: ${cacheStats.hits}`);
    console.log(`  未命中: ${cacheStats.misses}`);
    console.log(`  命中率: ${cacheStats.hitRate.toFixed(1)}%`);
    console.log(`  缓存大小: ${cacheStats.size}`);

    // 失败详情
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
        console.log('\n❌ 失败详情:');
        failures.slice(0, 10).forEach(f => {
            console.log(`  ${f.chain} - ${f.scenario}: ${f.error}`);
        });
    }

    // 结论
    console.log('\n' + '='.repeat(80));
    if (parseFloat(successRate) >= 95) {
        console.log('✅ 结论: RPC 节点配置可靠，可以用于生产环境');
    } else if (parseFloat(successRate) >= 80) {
        console.log('⚠️ 结论: RPC 节点配置部分可靠，建议检查失败的链');
    } else {
        console.log('❌ 结论: RPC 节点配置不可靠，需要修复');
    }
    console.log('');
}

runProductionSimulation().catch(console.error);
