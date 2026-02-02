/**
 * 测试用户提供的免费 RPC 节点
 */

const NEW_FREE_RPC_ENDPOINTS = [
    // BSC
    { chain: 'bsc', name: 'Defibit-3', url: 'https://bsc-dataseed3.defibit.io' },
    { chain: 'bsc', name: 'Defibit-2', url: 'https://bsc-dataseed2.defibit.io' },
    { chain: 'bsc', name: 'Defibit-1', url: 'https://bsc-dataseed1.defibit.io' },
    { chain: 'bsc', name: 'Llamarpc', url: 'https://binance.llamarpc.com' },
    { chain: 'bsc', name: 'Binance Official', url: 'https://bsc-dataseed.binance.org' },

    // ETH
    { chain: 'eth', name: 'Mybitkeep', url: 'https://web3.mybitkeep.vip' },
    { chain: 'eth', name: 'Mybitkeep-geth', url: 'https://geth.mybitkeep.vip' },
    { chain: 'eth', name: 'Jccdex', url: 'https://eth626892d.jccdex.cn' },
    { chain: 'eth', name: 'Llamarpc', url: 'https://eth.llamarpc.com' },

    // Base
    { chain: 'base', name: 'Base Official', url: 'https://mainnet.base.org' },

    // 其他常用免费节点
    { chain: 'eth', name: 'Cloudflare', url: 'https://cloudflare-eth.com' },
    { chain: 'polygon', name: 'Llamarpc', url: 'https://polygon.llamarpc.com' },
    { chain: 'arbitrum', name: 'Llamarpc', url: 'https://arbitrum.llamarpc.com' },
];

async function testEndpoint(chain: string, name: string, url: string) {
    const start = Date.now();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_blockNumber',
                params: [],
            }),
            signal: AbortSignal.timeout(10000),
        });

        const data = await response.json() as any;
        const latency = Date.now() - start;

        if (data.error) {
            return { chain, name, url, success: false, latency, error: data.error.message };
        }

        const blockNumber = parseInt(data.result, 16);
        return { chain, name, url, success: true, latency, blockNumber };
    } catch (err: any) {
        return {
            chain,
            name,
            url,
            success: false,
            latency: Date.now() - start,
            error: err.message?.substring(0, 50)
        };
    }
}

async function runTests() {
    console.log('🧪 测试用户提供的免费 RPC 节点\n');
    console.log('='.repeat(80));

    const results: any[] = [];

    // 基本连接测试
    console.log('\n📌 基本连接测试 (eth_blockNumber)');
    console.log('-'.repeat(60));

    for (const ep of NEW_FREE_RPC_ENDPOINTS) {
        const result = await testEndpoint(ep.chain, ep.name, ep.url);
        results.push(result);

        if (result.success) {
            console.log(`✅ ${ep.chain.padEnd(8)} ${ep.name.padEnd(18)} ${result.latency}ms  block=${result.blockNumber}`);
        } else {
            console.log(`❌ ${ep.chain.padEnd(8)} ${ep.name.padEnd(18)} ${result.latency}ms  ${result.error}`);
        }
    }

    // 并发测试 (对成功的节点)
    console.log('\n📌 并发压力测试 (5个并发请求)');
    console.log('-'.repeat(60));

    const successfulEndpoints = results.filter(r => r.success);

    for (const ep of successfulEndpoints.slice(0, 8)) { // 只测前8个
        const startAll = Date.now();
        const concurrentRequests = Array(5).fill(null).map(() =>
            testEndpoint(ep.chain, ep.name, ep.url)
        );

        const concurrentResults = await Promise.all(concurrentRequests);
        const totalTime = Date.now() - startAll;
        const successCount = concurrentResults.filter(r => r.success).length;
        const avgLatency = Math.round(concurrentResults.reduce((a, b) => a + b.latency, 0) / 5);

        console.log(`${successCount === 5 ? '✅' : '⚠️'} ${ep.chain.padEnd(8)} ${ep.name.padEnd(18)} ${successCount}/5 成功, 总耗时=${totalTime}ms, 平均=${avgLatency}ms`);
    }

    // 汇总
    console.log('\n\n📊 推荐使用的节点 (按成功率和延迟排序)');
    console.log('='.repeat(80));

    const successfulSorted = results
        .filter(r => r.success)
        .sort((a, b) => a.latency - b.latency);

    console.log('\n按链分组:');

    const chains = [...new Set(successfulSorted.map(r => r.chain))];
    for (const chain of chains) {
        console.log(`\n  ${chain.toUpperCase()}:`);
        const chainEndpoints = successfulSorted.filter(r => r.chain === chain);
        chainEndpoints.forEach((ep, i) => {
            console.log(`    ${i + 1}. ${ep.name} - ${ep.latency}ms - ${ep.url}`);
        });
    }

    console.log('\n');
}

runTests().catch(console.error);
