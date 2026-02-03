/**
 * Simplified RPC Performance Test
 * Uses the actual RpcManager from the project
 */

import { rpcManager } from '../services/rpcManager.js';
import { getOnChainPrice } from '../services/onChainPriceService.js';
import { getTokenMetadata } from '../services/rpcService.js';

const TEST_TOKENS = {
    8453: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Base USDC
    56: '0x55d398326f99059ff775485246999027b3197955',   // BSC USDT
    1: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',    // ETH USDC
    42161: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // ARB USDC
    10: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',   // OP USDC
    137: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359'  // Polygon USDC
};

const CHAIN_NAMES: Record<number, string> = {
    8453: 'Base',
    56: 'BSC',
    1: 'Ethereum',
    42161: 'Arbitrum',
    10: 'Optimism',
    137: 'Polygon'
};

interface TestResult {
    chain: string;
    chainId: number;
    blockNumber?: { success: boolean; time: number; result?: any; error?: string };
    tokenPrice?: { success: boolean; time: number; result?: any; error?: string };
    tokenMetadata?: { success: boolean; time: number; result?: any; error?: string };
    avgTime: number;
    successRate: number;
    status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
}

async function testChainRpc(chainId: number, tokenAddress: string): Promise<TestResult> {
    const result: TestResult = {
        chain: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
        chainId,
        avgTime: 0,
        successRate: 0,
        status: 'FAILED'
    };

    try {
        // Test 1: Get Block Number
        const blockStart = Date.now();
        try {
            const blockNumber = await rpcManager.getBlockNumber(chainId);
            result.blockNumber = {
                success: true,
                time: Date.now() - blockStart,
                result: blockNumber
            };
        } catch (error: any) {
            result.blockNumber = {
                success: false,
                time: Date.now() - blockStart,
                error: error.message
            };
        }

        // Test 2: Get Token Price (via RPC)
        const priceStart = Date.now();
        try {
            const price = await getOnChainPrice(tokenAddress, chainId);
            result.tokenPrice = {
                success: price > 0,
                time: Date.now() - priceStart,
                result: price
            };
        } catch (error: any) {
            result.tokenPrice = {
                success: false,
                time: Date.now() - priceStart,
                error: error.message
            };
        }

        // Test 3: Get Token Metadata
        const metadataStart = Date.now();
        try {
            const metadata = await getTokenMetadata(chainId, tokenAddress);
            result.tokenMetadata = {
                success: !!metadata.symbol,
                time: Date.now() - metadataStart,
                result: metadata
            };
        } catch (error: any) {
            result.tokenMetadata = {
                success: false,
                time: Date.now() - metadataStart,
                error: error.message
            };
        }

        // Calculate metrics
        const tests = [result.blockNumber, result.tokenPrice, result.tokenMetadata].filter(Boolean);
        const times = tests.map(t => t!.time);
        const successes = tests.filter(t => t!.success).length;

        result.avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        result.successRate = (successes / tests.length) * 100;

        if (result.successRate === 100 && result.avgTime < 100) {
            result.status = 'HEALTHY';
        } else if (result.successRate >= 66) {
            result.status = 'DEGRADED';
        } else {
            result.status = 'FAILED';
        }

    } catch (error: any) {
        console.error(`Error testing ${result.chain}:`, error.message);
    }

    return result;
}

async function runTests() {
    console.log('🚀 RPC Performance Test (Using Project RPC Manager)\n');
    console.log('='.repeat(80));

    const results: TestResult[] = [];

    for (const [chainIdStr, tokenAddress] of Object.entries(TEST_TOKENS)) {
        const chainId = parseInt(chainIdStr);
        const chainName = CHAIN_NAMES[chainId];

        console.log(`\n📊 Testing ${chainName} (Chain ID: ${chainId})`);
        console.log('-'.repeat(80));

        const result = await testChainRpc(chainId, tokenAddress);
        results.push(result);

        // Display results
        const statusEmoji = result.status === 'HEALTHY' ? '✅' : result.status === 'DEGRADED' ? '⚠️' : '❌';
        console.log(`${statusEmoji} Status: ${result.status}`);
        console.log(`⏱️  Avg Response Time: ${result.avgTime.toFixed(0)}ms`);
        console.log(`📈 Success Rate: ${result.successRate.toFixed(0)}%`);

        // Show individual test results
        if (result.blockNumber) {
            const icon = result.blockNumber.success ? '✓' : '✗';
            console.log(`   ${icon} Block Number: ${result.blockNumber.time}ms${result.blockNumber.error ? ` (${result.blockNumber.error.substring(0, 50)})` : ` (Block: ${result.blockNumber.result})`}`);
        }
        if (result.tokenPrice) {
            const icon = result.tokenPrice.success ? '✓' : '✗';
            console.log(`   ${icon} Token Price (RPC): ${result.tokenPrice.time}ms${result.tokenPrice.error ? ` (${result.tokenPrice.error.substring(0, 50)})` : ` ($${result.tokenPrice.result})`}`);
        }
        if (result.tokenMetadata) {
            const icon = result.tokenMetadata.success ? '✓' : '✗';
            const metadata = result.tokenMetadata.result as any;
            console.log(`   ${icon} Token Metadata: ${result.tokenMetadata.time}ms${result.tokenMetadata.error ? ` (${result.tokenMetadata.error.substring(0, 50)})` : ` (${metadata?.symbol})`}`);
        }
    }

    // Summary Report
    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY REPORT');
    console.log('='.repeat(80));

    const healthyCount = results.filter(r => r.status === 'HEALTHY').length;
    const degradedCount = results.filter(r => r.status === 'DEGRADED').length;
    const failedCount = results.filter(r => r.status === 'FAILED').length;

    console.log(`\n✅ Healthy: ${healthyCount}/${results.length}`);
    console.log(`⚠️  Degraded: ${degradedCount}/${results.length}`);
    console.log(`❌ Failed: ${failedCount}/${results.length}`);

    const avgResponseTime = results
        .filter(r => r.avgTime > 0)
        .reduce((sum, r) => sum + r.avgTime, 0) / results.filter(r => r.avgTime > 0).length;

    console.log(`\n⏱️  Overall Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);

    // Performance breakdown
    console.log('\n📊 PERFORMANCE BY CHAIN:');
    console.log('-'.repeat(80));
    results
        .sort((a, b) => a.avgTime - b.avgTime)
        .forEach(r => {
            const statusEmoji = r.status === 'HEALTHY' ? '✅' : r.status === 'DEGRADED' ? '⚠️' : '❌';
            console.log(`${statusEmoji} ${r.chain.padEnd(12)} ${r.avgTime.toFixed(0).padStart(4)}ms  (${r.successRate.toFixed(0)}% success)`);
        });

    console.log('\n' + '='.repeat(80));

    // Recommendations
    if (failedCount > 0) {
        console.log('\n⚠️  RECOMMENDATIONS:');
        results.filter(r => r.status === 'FAILED').forEach(r => {
            console.log(`   - ${r.chain}: Check RPC configuration in .env`);
        });
    }

    if (avgResponseTime > 100) {
        console.log('\n⚠️  WARNING: Average response time exceeds 100ms target');
        console.log('   Consider using faster RPC providers or adding more fallback endpoints');
    }

    console.log('\n✅ Testing Complete!\n');
}

// Run tests
runTests().catch(console.error);
