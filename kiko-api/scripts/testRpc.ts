/**
 * Standalone RPC Performance Test
 * Tests RPC endpoints configured in .env
 */

import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Test configurations
const TESTS = [
    {
        name: 'Base',
        chainId: 8453,
        rpcUrl: process.env.SECURITY_RPC_BASE,
        testToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
    },
    {
        name: 'BSC',
        chainId: 56,
        rpcUrl: process.env.SECURITY_RPC_BNB,
        testToken: '0x55d398326f99059ff775485246999027b3197955', // USDT
    },
    {
        name: 'Ethereum',
        chainId: 1,
        rpcUrl: process.env.SECURITY_RPC_ETH,
        testToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    },
    {
        name: 'Arbitrum',
        chainId: 42161,
        rpcUrl: process.env.SECURITY_RPC_ARB,
        testToken: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
    },
    {
        name: 'Optimism',
        chainId: 10,
        rpcUrl: process.env.SECURITY_RPC_OPTIMISM,
        testToken: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC
    },
    {
        name: 'Polygon',
        chainId: 137,
        rpcUrl: process.env.SECURITY_RPC_POLYGON,
        testToken: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // USDC
    },
    {
        name: 'Solana',
        chainId: 900,
        rpcUrl: process.env.SOLANA_RPC_URL,
        testToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    }
];

const ERC20_ABI = [
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
];

interface TestResult {
    name: string;
    blockNumber: { success: boolean; time: number; error?: string };
    tokenCall: { success: boolean; time: number; error?: string };
    avgTime: number;
    status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
}

async function testEvmRpc(name: string, rpcUrl: string, chainId: number, tokenAddress: string): Promise<TestResult> {
    const result: TestResult = {
        name,
        blockNumber: { success: false, time: 0 },
        tokenCall: { success: false, time: 0 },
        avgTime: 0,
        status: 'FAILED'
    };

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl, chainId, {
            staticNetwork: true
        });

        // Test 1: Get Block Number
        const blockStart = Date.now();
        try {
            await provider.getBlockNumber();
            result.blockNumber = { success: true, time: Date.now() - blockStart };
        } catch (error: any) {
            result.blockNumber = { success: false, time: Date.now() - blockStart, error: error.message };
        }

        // Test 2: Token Contract Call
        const tokenStart = Date.now();
        try {
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            await contract.symbol();
            result.tokenCall = { success: true, time: Date.now() - tokenStart };
        } catch (error: any) {
            result.tokenCall = { success: false, time: Date.now() - tokenStart, error: error.message };
        }

        // Calculate metrics
        const times = [result.blockNumber.time, result.tokenCall.time];
        result.avgTime = times.reduce((a, b) => a + b, 0) / times.length;

        const successCount = [result.blockNumber.success, result.tokenCall.success].filter(Boolean).length;
        if (successCount === 2 && result.avgTime < 100) {
            result.status = 'HEALTHY';
        } else if (successCount >= 1) {
            result.status = 'DEGRADED';
        }

    } catch (error: any) {
        result.blockNumber.error = error.message;
    }

    return result;
}

async function testSolanaRpc(name: string, rpcUrl: string, tokenAddress: string): Promise<TestResult> {
    const result: TestResult = {
        name,
        blockNumber: { success: false, time: 0 },
        tokenCall: { success: false, time: 0 },
        avgTime: 0,
        status: 'FAILED'
    };

    try {
        const connection = new Connection(rpcUrl, 'confirmed');

        // Test 1: Get Slot
        const slotStart = Date.now();
        try {
            await connection.getSlot();
            result.blockNumber = { success: true, time: Date.now() - slotStart };
        } catch (error: any) {
            result.blockNumber = { success: false, time: Date.now() - slotStart, error: error.message };
        }

        // Test 2: Get Account Info
        const accountStart = Date.now();
        try {
            const pubkey = new PublicKey(tokenAddress);
            const accountInfo = await connection.getAccountInfo(pubkey);
            result.tokenCall = { success: accountInfo !== null, time: Date.now() - accountStart };
        } catch (error: any) {
            result.tokenCall = { success: false, time: Date.now() - accountStart, error: error.message };
        }

        // Calculate metrics
        const times = [result.blockNumber.time, result.tokenCall.time];
        result.avgTime = times.reduce((a, b) => a + b, 0) / times.length;

        const successCount = [result.blockNumber.success, result.tokenCall.success].filter(Boolean).length;
        if (successCount === 2 && result.avgTime < 200) {
            result.status = 'HEALTHY';
        } else if (successCount >= 1) {
            result.status = 'DEGRADED';
        }

    } catch (error: any) {
        result.blockNumber.error = error.message;
    }

    return result;
}

async function runTests() {
    console.log('🚀 RPC Performance Test\n');
    console.log('='.repeat(80));

    const results: TestResult[] = [];

    for (const test of TESTS) {
        if (!test.rpcUrl) {
            console.log(`\n⚠️  ${test.name}: RPC URL not configured in .env`);
            continue;
        }

        console.log(`\n📊 Testing ${test.name} (Chain ID: ${test.chainId})`);
        console.log('-'.repeat(80));

        try {
            const result = test.chainId === 900
                ? await testSolanaRpc(test.name, test.rpcUrl, test.testToken)
                : await testEvmRpc(test.name, test.rpcUrl, test.chainId, test.testToken);

            results.push(result);

            const statusEmoji = result.status === 'HEALTHY' ? '✅' : result.status === 'DEGRADED' ? '⚠️' : '❌';
            console.log(`${statusEmoji} Status: ${result.status}`);
            console.log(`⏱️  Avg Response Time: ${result.avgTime.toFixed(0)}ms`);

            const blockIcon = result.blockNumber.success ? '✓' : '✗';
            console.log(`   ${blockIcon} Block Number: ${result.blockNumber.time}ms${result.blockNumber.error ? ` (${result.blockNumber.error.substring(0, 40)})` : ''}`);

            const tokenIcon = result.tokenCall.success ? '✓' : '✗';
            console.log(`   ${tokenIcon} Token Call: ${result.tokenCall.time}ms${result.tokenCall.error ? ` (${result.tokenCall.error.substring(0, 40)})` : ''}`);

        } catch (error: any) {
            console.log(`❌ FAILED: ${error.message}`);
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));

    const healthy = results.filter(r => r.status === 'HEALTHY').length;
    const degraded = results.filter(r => r.status === 'DEGRADED').length;
    const failed = results.filter(r => r.status === 'FAILED').length;

    console.log(`\n✅ Healthy: ${healthy}/${results.length}`);
    console.log(`⚠️  Degraded: ${degraded}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);

    if (results.length > 0) {
        const avgTime = results.reduce((sum, r) => sum + r.avgTime, 0) / results.length;
        console.log(`\n⏱️  Overall Avg: ${avgTime.toFixed(0)}ms`);

        console.log('\n📊 Performance Ranking:');
        console.log('-'.repeat(80));
        results
            .sort((a, b) => a.avgTime - b.avgTime)
            .forEach(r => {
                const emoji = r.status === 'HEALTHY' ? '✅' : r.status === 'DEGRADED' ? '⚠️' : '❌';
                console.log(`${emoji} ${r.name.padEnd(12)} ${r.avgTime.toFixed(0).padStart(4)}ms`);
            });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test Complete!\n');
}

runTests().catch(console.error);
