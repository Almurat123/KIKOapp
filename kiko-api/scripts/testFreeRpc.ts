/**
 * 测试项目实际使用的免费 RPC 节点
 * 基于 apiEndpoints.ts 的配置
 */

import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';

// 项目实际使用的免费 RPC 节点 (来自 apiEndpoints.ts Line 104-147)
const FREE_RPC_ENDPOINTS = {
    'Ethereum': [
        { name: 'PublicNode', url: 'https://ethereum-rpc.publicnode.com' },
        { name: 'DRPC', url: 'https://eth.drpc.org' },
    ],
    'Base': [
        { name: 'Base Official', url: 'https://mainnet.base.org' },
        { name: 'Coinbase', url: 'https://api.developer.coinbase.com/rpc/v1/base/ilSV6rJjgR0WwRdvqjG5cL07exQrmr8t' },
        { name: 'PublicNode', url: 'https://base-rpc.publicnode.com' },
        { name: 'DRPC', url: 'https://base.drpc.org' },
    ],
    'BSC': [
        { name: 'Binance Official', url: 'https://bsc-dataseed.binance.org' },
        { name: 'Defibit', url: 'https://bsc-dataseed1.defibit.io' },
        { name: 'PublicNode', url: 'https://bsc-rpc.publicnode.com' },
    ],
    'Polygon': [
        { name: 'PublicNode', url: 'https://polygon-bor-rpc.publicnode.com' },
        { name: 'DRPC', url: 'https://polygon.drpc.org' },
    ],
    'Arbitrum': [
        { name: 'PublicNode', url: 'https://arbitrum-one-rpc.publicnode.com' },
        { name: 'DRPC', url: 'https://arbitrum.drpc.org' },
    ],
    'Optimism': [
        { name: 'PublicNode', url: 'https://optimism-rpc.publicnode.com' },
        { name: 'DRPC', url: 'https://optimism.drpc.org' },
    ],
};

const CHAIN_IDS: Record<string, number> = {
    'Ethereum': 1,
    'Base': 8453,
    'BSC': 56,
    'Polygon': 137,
    'Arbitrum': 42161,
    'Optimism': 10,
};

const TEST_TOKENS: Record<string, string> = {
    'Ethereum': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    'Base': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',     // USDC
    'BSC': '0x55d398326f99059ff775485246999027b3197955',      // USDT
    'Polygon': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',  // USDC
    'Arbitrum': '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
    'Optimism': '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC
};

const ERC20_ABI = ['function symbol() view returns (string)'];

interface TestResult {
    chain: string;
    endpoint: string;
    name: string;
    blockNumber: { success: boolean; time: number; error?: string };
    tokenCall: { success: boolean; time: number; error?: string };
    avgTime: number;
    status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
}

async function testEndpoint(
    chain: string,
    name: string,
    url: string,
    chainId: number,
    tokenAddress: string
): Promise<TestResult> {
    const result: TestResult = {
        chain,
        endpoint: url,
        name,
        blockNumber: { success: false, time: 0 },
        tokenCall: { success: false, time: 0 },
        avgTime: 0,
        status: 'FAILED'
    };

    try {
        // 使用 staticNetwork 避免额外的网络检测调用
        const provider = new ethers.JsonRpcProvider(url, chainId, {
            staticNetwork: true
        });

        // Test 1: Get Block Number
        const blockStart = Date.now();
        try {
            await provider.getBlockNumber();
            result.blockNumber = { success: true, time: Date.now() - blockStart };
        } catch (error: any) {
            result.blockNumber = { success: false, time: Date.now() - blockStart, error: error.message?.substring(0, 50) };
        }

        // Test 2: Token Contract Call
        const tokenStart = Date.now();
        try {
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            await contract.symbol();
            result.tokenCall = { success: true, time: Date.now() - tokenStart };
        } catch (error: any) {
            result.tokenCall = { success: false, time: Date.now() - tokenStart, error: error.message?.substring(0, 50) };
        }

        // Calculate metrics
        const times = [result.blockNumber.time, result.tokenCall.time];
        result.avgTime = times.reduce((a, b) => a + b, 0) / times.length;

        const successCount = [result.blockNumber.success, result.tokenCall.success].filter(Boolean).length;
        if (successCount === 2 && result.avgTime < 300) {
            result.status = 'HEALTHY';
        } else if (successCount >= 1) {
            result.status = 'DEGRADED';
        }

    } catch (error: any) {
        result.blockNumber.error = error.message?.substring(0, 50);
    }

    return result;
}

async function runTests() {
    console.log('🚀 免费 RPC 节点性能测试\n');
    console.log('测试项目实际使用的公共 RPC 端点（来自 apiEndpoints.ts）');
    console.log('='.repeat(80));

    const allResults: TestResult[] = [];

    for (const [chain, endpoints] of Object.entries(FREE_RPC_ENDPOINTS)) {
        console.log(`\n📊 ${chain} (Chain ID: ${CHAIN_IDS[chain]})`);
        console.log('-'.repeat(80));

        for (const endpoint of endpoints) {
            try {
                const result = await testEndpoint(
                    chain,
                    endpoint.name,
                    endpoint.url,
                    CHAIN_IDS[chain],
                    TEST_TOKENS[chain]
                );

                allResults.push(result);

                const statusEmoji = result.status === 'HEALTHY' ? '✅' : result.status === 'DEGRADED' ? '⚠️' : '❌';
                const blockIcon = result.blockNumber.success ? '✓' : '✗';
                const tokenIcon = result.tokenCall.success ? '✓' : '✗';

                console.log(`${statusEmoji} ${endpoint.name.padEnd(16)} | Avg: ${result.avgTime.toFixed(0).padStart(4)}ms | ${blockIcon} Block: ${result.blockNumber.time.toString().padStart(4)}ms | ${tokenIcon} Token: ${result.tokenCall.time.toString().padStart(4)}ms`);

                if (result.blockNumber.error) {
                    console.log(`   ⚠️ Block Error: ${result.blockNumber.error}`);
                }
                if (result.tokenCall.error) {
                    console.log(`   ⚠️ Token Error: ${result.tokenCall.error}`);
                }

            } catch (error: any) {
                console.log(`❌ ${endpoint.name.padEnd(16)} | FAILED: ${error.message?.substring(0, 50)}`);
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 总结');
    console.log('='.repeat(80));

    const healthy = allResults.filter(r => r.status === 'HEALTHY').length;
    const degraded = allResults.filter(r => r.status === 'DEGRADED').length;
    const failed = allResults.filter(r => r.status === 'FAILED').length;
    const total = allResults.length;

    console.log(`\n✅ Healthy: ${healthy}/${total} (${(healthy / total * 100).toFixed(0)}%)`);
    console.log(`⚠️  Degraded: ${degraded}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);

    if (allResults.length > 0) {
        const avgTime = allResults.filter(r => r.status !== 'FAILED').reduce((sum, r) => sum + r.avgTime, 0) / allResults.filter(r => r.status !== 'FAILED').length;
        console.log(`\n⏱️  平均响应时间: ${avgTime.toFixed(0)}ms`);

        // 每条链的最快端点
        console.log('\n🏆 每条链的最快免费 RPC:');
        console.log('-'.repeat(80));

        for (const chain of Object.keys(FREE_RPC_ENDPOINTS)) {
            const chainResults = allResults
                .filter(r => r.chain === chain && r.status !== 'FAILED')
                .sort((a, b) => a.avgTime - b.avgTime);

            if (chainResults.length > 0) {
                const fastest = chainResults[0];
                console.log(`${chain.padEnd(12)} 🥇 ${fastest.name.padEnd(16)} ${fastest.avgTime.toFixed(0).padStart(4)}ms`);
            } else {
                console.log(`${chain.padEnd(12)} ❌ 无可用端点`);
            }
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ 测试完成!\n');
}

runTests().catch(console.error);
