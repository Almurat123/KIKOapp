/**
 * RPC Performance Test Script
 * Tests all RPC endpoints for response time, success rate, and availability
 */

import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';

// Chain configurations
const CHAINS = {
    'Base': {
        chainId: 8453,
        rpcUrls: [
            process.env.BASE_RPC_URL,
            'https://base-mainnet.infura.io/v3/' + process.env.INFURA_API_KEY,
            'https://base.llamarpc.com',
            'https://mainnet.base.org'
        ].filter(Boolean),
        testToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
        testAddress: '0x4200000000000000000000000000000000000006' // WETH
    },
    'BSC': {
        chainId: 56,
        rpcUrls: [
            process.env.BSC_RPC_URL,
            'https://bsc-mainnet.infura.io/v3/' + process.env.INFURA_API_KEY,
            'https://bsc-dataseed1.binance.org',
            'https://bsc-dataseed.bnbchain.org'
        ].filter(Boolean),
        testToken: '0x55d398326f99059ff775485246999027b3197955', // USDT
        testAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' // WBNB
    },
    'Ethereum': {
        chainId: 1,
        rpcUrls: [
            process.env.ETH_RPC_URL,
            'https://mainnet.infura.io/v3/' + process.env.INFURA_API_KEY,
            'https://eth.llamarpc.com',
            'https://rpc.ankr.com/eth'
        ].filter(Boolean),
        testToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
        testAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' // WETH
    },
    'Arbitrum': {
        chainId: 42161,
        rpcUrls: [
            process.env.ARBITRUM_RPC_URL,
            'https://arbitrum-mainnet.infura.io/v3/' + process.env.INFURA_API_KEY,
            'https://arb1.arbitrum.io/rpc',
            'https://rpc.ankr.com/arbitrum'
        ].filter(Boolean),
        testToken: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
        testAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' // WETH
    },
    'Optimism': {
        chainId: 10,
        rpcUrls: [
            process.env.OPTIMISM_RPC_URL,
            'https://optimism-mainnet.infura.io/v3/' + process.env.INFURA_API_KEY,
            'https://mainnet.optimism.io',
            'https://rpc.ankr.com/optimism'
        ].filter(Boolean),
        testToken: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC
        testAddress: '0x4200000000000000000000000000000000000006' // WETH
    },
    'Polygon': {
        chainId: 137,
        rpcUrls: [
            process.env.POLYGON_RPC_URL,
            'https://polygon-mainnet.infura.io/v3/' + process.env.INFURA_API_KEY,
            'https://polygon-rpc.com',
            'https://rpc.ankr.com/polygon'
        ].filter(Boolean),
        testToken: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // USDC
        testAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' // WMATIC
    },
    'Solana': {
        chainId: 900,
        rpcUrls: [
            process.env.SOLANA_RPC_URL,
            'https://api.mainnet-beta.solana.com',
            'https://solana-api.projectserum.com'
        ].filter(Boolean),
        testToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        testAddress: 'So11111111111111111111111111111111111111112' // SOL
    }
};

// ERC20 ABI (minimal)
const ERC20_ABI = [
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)'
];

interface TestResult {
    chain: string;
    rpcUrl: string;
    tests: {
        blockNumber?: { success: boolean; time: number; result?: any; error?: string };
        tokenSymbol?: { success: boolean; time: number; result?: any; error?: string };
        tokenName?: { success: boolean; time: number; result?: any; error?: string };
        tokenDecimals?: { success: boolean; time: number; result?: any; error?: string };
    };
    avgTime: number;
    successRate: number;
    status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
}

async function testEvmRpc(chain: string, rpcUrl: string, config: any): Promise<TestResult> {
    const result: TestResult = {
        chain,
        rpcUrl: rpcUrl.replace(/\/[a-f0-9-]{36,}/gi, '/***'), // Mask API keys
        tests: {},
        avgTime: 0,
        successRate: 0,
        status: 'FAILED'
    };

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl, config.chainId);
        const tokenContract = new ethers.Contract(config.testToken, ERC20_ABI, provider);

        // Test 1: Get Block Number
        const blockStart = Date.now();
        try {
            const blockNumber = await provider.getBlockNumber();
            result.tests.blockNumber = {
                success: true,
                time: Date.now() - blockStart,
                result: blockNumber
            };
        } catch (error: any) {
            result.tests.blockNumber = {
                success: false,
                time: Date.now() - blockStart,
                error: error.message
            };
        }

        // Test 2: Get Token Symbol
        const symbolStart = Date.now();
        try {
            const symbol = await tokenContract.symbol();
            result.tests.tokenSymbol = {
                success: true,
                time: Date.now() - symbolStart,
                result: symbol
            };
        } catch (error: any) {
            result.tests.tokenSymbol = {
                success: false,
                time: Date.now() - symbolStart,
                error: error.message
            };
        }

        // Test 3: Get Token Name
        const nameStart = Date.now();
        try {
            const name = await tokenContract.name();
            result.tests.tokenName = {
                success: true,
                time: Date.now() - nameStart,
                result: name
            };
        } catch (error: any) {
            result.tests.tokenName = {
                success: false,
                time: Date.now() - nameStart,
                error: error.message
            };
        }

        // Test 4: Get Token Decimals
        const decimalsStart = Date.now();
        try {
            const decimals = await tokenContract.decimals();
            result.tests.tokenDecimals = {
                success: true,
                time: Date.now() - decimalsStart,
                result: decimals
            };
        } catch (error: any) {
            result.tests.tokenDecimals = {
                success: false,
                time: Date.now() - decimalsStart,
                error: error.message
            };
        }

        // Calculate metrics
        const times = Object.values(result.tests).map(t => t.time);
        const successes = Object.values(result.tests).filter(t => t.success).length;
        const total = Object.values(result.tests).length;

        result.avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        result.successRate = (successes / total) * 100;

        if (result.successRate === 100 && result.avgTime < 100) {
            result.status = 'HEALTHY';
        } else if (result.successRate >= 75) {
            result.status = 'DEGRADED';
        } else {
            result.status = 'FAILED';
        }

    } catch (error: any) {
        result.tests.blockNumber = {
            success: false,
            time: 0,
            error: error.message
        };
    }

    return result;
}

async function testSolanaRpc(chain: string, rpcUrl: string, config: any): Promise<TestResult> {
    const result: TestResult = {
        chain,
        rpcUrl: rpcUrl.replace(/\/[a-f0-9-]{36,}/gi, '/***'),
        tests: {},
        avgTime: 0,
        successRate: 0,
        status: 'FAILED'
    };

    try {
        const connection = new Connection(rpcUrl, 'confirmed');

        // Test 1: Get Slot (equivalent to block number)
        const slotStart = Date.now();
        try {
            const slot = await connection.getSlot();
            result.tests.blockNumber = {
                success: true,
                time: Date.now() - slotStart,
                result: slot
            };
        } catch (error: any) {
            result.tests.blockNumber = {
                success: false,
                time: Date.now() - slotStart,
                error: error.message
            };
        }

        // Test 2: Get Account Info (token mint)
        const accountStart = Date.now();
        try {
            const pubkey = new PublicKey(config.testToken);
            const accountInfo = await connection.getAccountInfo(pubkey);
            result.tests.tokenSymbol = {
                success: accountInfo !== null,
                time: Date.now() - accountStart,
                result: accountInfo ? 'Account exists' : 'Not found'
            };
        } catch (error: any) {
            result.tests.tokenSymbol = {
                success: false,
                time: Date.now() - accountStart,
                error: error.message
            };
        }

        // Calculate metrics
        const times = Object.values(result.tests).map(t => t.time);
        const successes = Object.values(result.tests).filter(t => t.success).length;
        const total = Object.values(result.tests).length;

        result.avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        result.successRate = (successes / total) * 100;

        if (result.successRate === 100 && result.avgTime < 200) {
            result.status = 'HEALTHY';
        } else if (result.successRate >= 50) {
            result.status = 'DEGRADED';
        } else {
            result.status = 'FAILED';
        }

    } catch (error: any) {
        result.tests.blockNumber = {
            success: false,
            time: 0,
            error: error.message
        };
    }

    return result;
}

async function runTests() {
    console.log('🚀 Starting RPC Performance Tests...\n');
    console.log('='.repeat(80));

    const allResults: TestResult[] = [];

    for (const [chainName, config] of Object.entries(CHAINS)) {
        console.log(`\n📊 Testing ${chainName} (Chain ID: ${config.chainId})`);
        console.log('-'.repeat(80));

        for (const rpcUrl of config.rpcUrls) {
            if (!rpcUrl) continue;

            const maskedUrl = rpcUrl.replace(/\/[a-f0-9-]{36,}/gi, '/***');
            console.log(`\n  🔗 RPC: ${maskedUrl}`);

            try {
                const result = config.chainId === 900
                    ? await testSolanaRpc(chainName, rpcUrl, config)
                    : await testEvmRpc(chainName, rpcUrl, config);

                allResults.push(result);

                // Display results
                const statusEmoji = result.status === 'HEALTHY' ? '✅' : result.status === 'DEGRADED' ? '⚠️' : '❌';
                console.log(`  ${statusEmoji} Status: ${result.status}`);
                console.log(`  ⏱️  Avg Response Time: ${result.avgTime.toFixed(0)}ms`);
                console.log(`  📈 Success Rate: ${result.successRate.toFixed(0)}%`);

                // Show individual test results
                for (const [testName, testResult] of Object.entries(result.tests)) {
                    const icon = testResult.success ? '✓' : '✗';
                    const timeStr = `${testResult.time}ms`;
                    console.log(`     ${icon} ${testName}: ${timeStr}${testResult.error ? ` (${testResult.error.substring(0, 50)})` : ''}`);
                }

            } catch (error: any) {
                console.log(`  ❌ FAILED: ${error.message}`);
            }
        }
    }

    // Summary Report
    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY REPORT');
    console.log('='.repeat(80));

    const healthyCount = allResults.filter(r => r.status === 'HEALTHY').length;
    const degradedCount = allResults.filter(r => r.status === 'DEGRADED').length;
    const failedCount = allResults.filter(r => r.status === 'FAILED').length;

    console.log(`\n✅ Healthy: ${healthyCount}`);
    console.log(`⚠️  Degraded: ${degradedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`📊 Total Tested: ${allResults.length}`);

    const avgResponseTime = allResults
        .filter(r => r.avgTime > 0)
        .reduce((sum, r) => sum + r.avgTime, 0) / allResults.filter(r => r.avgTime > 0).length;

    console.log(`\n⏱️  Overall Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);

    // Fastest RPC per chain
    console.log('\n🏆 FASTEST RPC PER CHAIN:');
    console.log('-'.repeat(80));

    const chainGroups = allResults.reduce((acc, r) => {
        if (!acc[r.chain]) acc[r.chain] = [];
        acc[r.chain].push(r);
        return acc;
    }, {} as Record<string, TestResult[]>);

    for (const [chain, results] of Object.entries(chainGroups)) {
        const fastest = results
            .filter(r => r.status === 'HEALTHY')
            .sort((a, b) => a.avgTime - b.avgTime)[0];

        if (fastest) {
            console.log(`  ${chain}: ${fastest.rpcUrl} (${fastest.avgTime.toFixed(0)}ms)`);
        } else {
            console.log(`  ${chain}: ❌ No healthy RPC found`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Testing Complete!\n');
}

// Run tests
runTests().catch(console.error);
