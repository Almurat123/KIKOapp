/**
 * 免费 RPC 节点生产环境压力测试
 * 在修改优先级之前，先验证免费节点的可靠性
 */

// 免费 RPC 节点配置 (正确URL格式)
const FREE_RPC_ENDPOINTS: Record<string, { publicNode: string; drpc: string }> = {
    eth: {
        publicNode: 'https://ethereum-rpc.publicnode.com',
        drpc: 'https://eth.drpc.org',
    },
    base: {
        publicNode: 'https://base-rpc.publicnode.com',
        drpc: 'https://base.drpc.org',
    },
    bsc: {
        publicNode: 'https://bsc-rpc.publicnode.com',
        drpc: 'https://bsc.drpc.org',
    },
    polygon: {
        publicNode: 'https://polygon-bor-rpc.publicnode.com',
        drpc: 'https://polygon.drpc.org',
    },
    arbitrum: {
        publicNode: 'https://arbitrum-one-rpc.publicnode.com',
        drpc: 'https://arbitrum.drpc.org',
    },
    optimism: {
        publicNode: 'https://optimism-rpc.publicnode.com',
        drpc: 'https://optimism.drpc.org',
    },
};

interface TestResult {
    chain: string;
    provider: string;
    url: string;
    success: boolean;
    latency: number;
    error?: string;
}

async function testRpcEndpoint(
    chain: string,
    provider: string,
    url: string,
    method: string,
    params: any[]
): Promise<TestResult> {
    const start = Date.now();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method,
                params,
            }),
            signal: AbortSignal.timeout(10000), // 10秒超时
        });

        const data = await response.json() as any;
        const latency = Date.now() - start;

        if (data.error) {
            return { chain, provider, url, success: false, latency, error: data.error.message };
        }

        return { chain, provider, url, success: true, latency };
    } catch (err: any) {
        return {
            chain,
            provider,
            url,
            success: false,
            latency: Date.now() - start,
            error: err.message
        };
    }
}

async function runProductionSimulation() {
    console.log('🧪 免费 RPC 节点生产环境测试\n');
    console.log('='.repeat(70));

    const results: TestResult[] = [];
    const chains = Object.keys(FREE_RPC_ENDPOINTS);

    // ============================================
    // 测试 1: 基本连接测试 (eth_blockNumber)
    // ============================================
    console.log('\n📌 测试 1: 基本连接测试 (eth_blockNumber)');
    console.log('-'.repeat(50));

    for (const chain of chains) {
        const endpoints = FREE_RPC_ENDPOINTS[chain];

        // Test PublicNode
        const pnResult = await testRpcEndpoint(chain, 'PublicNode', endpoints.publicNode, 'eth_blockNumber', []);
        results.push(pnResult);
        console.log(`${pnResult.success ? '✅' : '❌'} ${chain.padEnd(10)} PublicNode  ${pnResult.latency}ms ${pnResult.error || ''}`);

        // Test DRPC
        const drpcResult = await testRpcEndpoint(chain, 'DRPC', endpoints.drpc, 'eth_blockNumber', []);
        results.push(drpcResult);
        console.log(`${drpcResult.success ? '✅' : '❌'} ${chain.padEnd(10)} DRPC        ${drpcResult.latency}ms ${drpcResult.error || ''}`);
    }

    // ============================================
    // 测试 2: eth_call 测试 (合约调用)
    // ============================================
    console.log('\n📌 测试 2: eth_call 测试 (WETH decimals)');
    console.log('-'.repeat(50));

    const WETH_CONTRACTS: Record<string, string> = {
        eth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        base: '0x4200000000000000000000000000000000000006',
        bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        optimism: '0x4200000000000000000000000000000000000006',
    };

    const decimalsSelector = '0x313ce567';

    for (const chain of chains) {
        const endpoints = FREE_RPC_ENDPOINTS[chain];
        const weth = WETH_CONTRACTS[chain];
        const params = [{ to: weth, data: decimalsSelector }, 'latest'];

        const pnResult = await testRpcEndpoint(chain, 'PublicNode', endpoints.publicNode, 'eth_call', params);
        results.push(pnResult);
        console.log(`${pnResult.success ? '✅' : '❌'} ${chain.padEnd(10)} PublicNode  ${pnResult.latency}ms ${pnResult.error || ''}`);

        const drpcResult = await testRpcEndpoint(chain, 'DRPC', endpoints.drpc, 'eth_call', params);
        results.push(drpcResult);
        console.log(`${drpcResult.success ? '✅' : '❌'} ${chain.padEnd(10)} DRPC        ${drpcResult.latency}ms ${drpcResult.error || ''}`);
    }

    // ============================================
    // 测试 3: 并发压力测试 (模拟生产负载)
    // ============================================
    console.log('\n📌 测试 3: 并发压力测试 (每个节点 10 个并发请求)');
    console.log('-'.repeat(50));

    for (const chain of ['base', 'eth']) { // 只测试主要链
        const endpoints = FREE_RPC_ENDPOINTS[chain];

        for (const [provider, url] of [['PublicNode', endpoints.publicNode], ['DRPC', endpoints.drpc]]) {
            const startAll = Date.now();
            const concurrentRequests = Array(10).fill(null).map(() =>
                testRpcEndpoint(chain, provider, url, 'eth_blockNumber', [])
            );

            const concurrentResults = await Promise.all(concurrentRequests);
            const totalTime = Date.now() - startAll;
            const successCount = concurrentResults.filter(r => r.success).length;
            const avgLatency = Math.round(concurrentResults.reduce((a, b) => a + b.latency, 0) / 10);

            console.log(`${successCount === 10 ? '✅' : '⚠️'} ${chain.padEnd(10)} ${provider.padEnd(12)} ${successCount}/10 成功, 总耗时=${totalTime}ms, 平均=${avgLatency}ms`);
        }
    }

    // ============================================
    // 汇总报告
    // ============================================
    console.log('\n\n📊 测试汇总报告');
    console.log('='.repeat(70));

    const byProvider: Record<string, { total: number; success: number; avgLatency: number }> = {};

    for (const r of results) {
        if (!byProvider[r.provider]) {
            byProvider[r.provider] = { total: 0, success: 0, avgLatency: 0 };
        }
        byProvider[r.provider].total++;
        if (r.success) {
            byProvider[r.provider].success++;
            byProvider[r.provider].avgLatency += r.latency;
        }
    }

    console.log('\n按提供商统计:');
    for (const [provider, stats] of Object.entries(byProvider)) {
        const successRate = ((stats.success / stats.total) * 100).toFixed(1);
        const avgLatency = stats.success > 0 ? Math.round(stats.avgLatency / stats.success) : 0;
        console.log(`  ${provider.padEnd(12)} 成功率: ${successRate.padStart(5)}%  平均延迟: ${avgLatency}ms`);
    }

    const totalSuccess = results.filter(r => r.success).length;
    const totalTests = results.length;
    const overallRate = ((totalSuccess / totalTests) * 100).toFixed(1);

    console.log(`\n总体成功率: ${overallRate}% (${totalSuccess}/${totalTests})`);

    // 结论
    console.log('\n' + '='.repeat(70));
    if (parseFloat(overallRate) >= 95) {
        console.log('✅ 结论: 免费 RPC 节点可靠性良好，可以作为首选使用');
        console.log('   建议: 可以将免费节点优先级调高');
    } else if (parseFloat(overallRate) >= 80) {
        console.log('⚠️ 结论: 免费 RPC 节点可靠性一般');
        console.log('   建议: 仅作为备用，Alchemy 保持首选');
    } else {
        console.log('❌ 结论: 免费 RPC 节点可靠性不足');
        console.log('   建议: 不要使用免费节点作为首选');
    }
    console.log('');
}

runProductionSimulation().catch(console.error);
