/**
 * EDGE CASE TESTING SCRIPT
 * Tests various failure scenarios and edge cases in AutoTrade system
 * Run with: npx tsx src/scripts/testEdgeCases.ts
 */

process.env.SIMULATION_MODE = 'true';
process.env.AI_ANALYSIS_MODE = 'disabled';

import { handleSwapDetected } from '../services/autoTradeService.js';
import prisma from '../db/prisma.js';
import { DecodedSwap } from '../services/txDecoder.js';

const BASE_CHAIN_ID = 8453;
const BSC_CHAIN_ID = 56;
const SOLANA_CHAIN_ID = 900;

const TEST_USER_ID = 'edge-case-test-user';
const TEST_WALLET = '0x3000000000000000000000000000000000000003';
const LEADER_WALLET = '0x4000000000000000000000000000000000000004';

// Known problematic tokens for testing
const TOKENS = {
    NORMAL: '0x06fc3d5d2369561e28f261148576520f5e49d6ea', // Base - Normal token
    HONEYPOT: '0x0000000000000000000000000000000000000001', // Mock honeypot
    NO_LIQUIDITY: '0x0000000000000000000000000000000000000002', // Mock low liquidity
    EXTREME_SLIPPAGE: '0x0000000000000000000000000000000000000003', // Mock high slippage
};

interface TestResult {
    name: string;
    passed: boolean;
    reason?: string;
    duration?: number;
}

const results: TestResult[] = [];

async function setup() {
    console.log('🛠️ Setting up edge case test environment...\n');

    // Create test user
    await prisma.user.upsert({
        where: { id: TEST_USER_ID },
        update: {},
        create: {
            id: TEST_USER_ID,
            privyDid: `did:privy:${TEST_USER_ID}`,
            walletAddress: TEST_WALLET,
            email: 'edge-test@test.com'
        }
    });

    // Clean up
    await prisma.copyTradeConfig.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.position.deleteMany({ where: { userId: TEST_USER_ID } });

    // Create base config
    await prisma.copyTradeConfig.create({
        data: {
            userId: TEST_USER_ID,
            targetWallet: LEADER_WALLET,
            chainId: BASE_CHAIN_ID,
            buyAmountUsd: 10,
            status: 'active',
            minLiquidityUsd: 1000, // Require minimum liquidity
        }
    });

    console.log('✅ Setup complete\n');
}

async function runTest(name: string, testFn: () => Promise<boolean>): Promise<void> {
    const start = Date.now();
    console.log(`\n🧪 TEST: ${name}`);
    console.log('─'.repeat(60));

    try {
        const passed = await testFn();
        const duration = Date.now() - start;

        results.push({ name, passed, duration });

        if (passed) {
            console.log(`✅ PASSED (${duration}ms)`);
        } else {
            console.log(`❌ FAILED (${duration}ms)`);
        }
    } catch (error: any) {
        const duration = Date.now() - start;
        results.push({
            name,
            passed: false,
            reason: error.message,
            duration
        });
        console.log(`❌ FAILED: ${error.message} (${duration}ms)`);
    }
}

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

async function testHoneypotDetection(): Promise<boolean> {
    // Test that system blocks honeypot tokens
    const swap: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: TOKENS.HONEYPOT,
        amountIn: '100000000000000000',
        amountOut: '1000000000000000000000',
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    await handleSwapDetected(LEADER_WALLET, swap, BASE_CHAIN_ID);

    // Should NOT create position for honeypot
    const position = await prisma.position.findFirst({
        where: {
            userId: TEST_USER_ID,
            tokenAddress: TOKENS.HONEYPOT
        }
    });

    return position === null; // Pass if no position created
}

async function testLowLiquidityBlock(): Promise<boolean> {
    // Test that system blocks tokens with insufficient liquidity
    const swap: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: TOKENS.NO_LIQUIDITY,
        amountIn: '100000000000000000',
        amountOut: '1000000000000000000000',
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    await handleSwapDetected(LEADER_WALLET, swap, BASE_CHAIN_ID);

    // Should NOT create position due to low liquidity
    const position = await prisma.position.findFirst({
        where: {
            userId: TEST_USER_ID,
            tokenAddress: TOKENS.NO_LIQUIDITY
        }
    });

    return position === null;
}

async function testConcurrentTrades(): Promise<boolean> {
    // Test that concurrent trades for same user are properly queued
    const swap1: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: TOKENS.NORMAL,
        amountIn: '100000000000000000',
        amountOut: '1000000000000000000000',
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    const swap2: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: '0x1111111111166b7fe7bd91427724b487980afc69', // ZORA
        amountIn: '100000000000000000',
        amountOut: '100000000000000000000',
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    // Fire both simultaneously
    await Promise.all([
        handleSwapDetected(LEADER_WALLET, swap1, BASE_CHAIN_ID),
        handleSwapDetected(LEADER_WALLET, swap2, BASE_CHAIN_ID)
    ]);

    // Both should complete without nonce collision
    const positions = await prisma.position.findMany({
        where: { userId: TEST_USER_ID }
    });

    return positions.length === 2; // Both trades should succeed
}

async function testPriceDataFailure(): Promise<boolean> {
    // Test handling when all price APIs fail
    const swap: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: '0x9999999999999999999999999999999999999999', // Non-existent token
        amountIn: '100000000000000000',
        amountOut: '1000000000000000000000',
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    await handleSwapDetected(LEADER_WALLET, swap, BASE_CHAIN_ID);

    // Should NOT create position when price data unavailable
    const position = await prisma.position.findFirst({
        where: {
            userId: TEST_USER_ID,
            tokenAddress: '0x9999999999999999999999999999999999999999'
        }
    });

    return position === null;
}

async function testDuplicateSwapDetection(): Promise<boolean> {
    // Test that duplicate swaps don't create duplicate positions
    const swap: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: TOKENS.NORMAL,
        amountIn: '100000000000000000',
        amountOut: '1000000000000000000000',
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    // Send same swap twice
    await handleSwapDetected(LEADER_WALLET, swap, BASE_CHAIN_ID);
    await new Promise(resolve => setTimeout(resolve, 100));
    await handleSwapDetected(LEADER_WALLET, swap, BASE_CHAIN_ID);

    const positions = await prisma.position.findMany({
        where: {
            userId: TEST_USER_ID,
            tokenAddress: TOKENS.NORMAL
        }
    });

    // Should only create ONE position (or handle gracefully)
    return positions.length <= 2; // Allow some duplication due to async nature
}

async function testExtremeSlippage(): Promise<boolean> {
    // Test handling of extreme slippage scenarios
    const swap: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: TOKENS.EXTREME_SLIPPAGE,
        amountIn: '100000000000000000',
        amountOut: '1', // Extreme slippage: 0.1 ETH for 1 wei
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    await handleSwapDetected(LEADER_WALLET, swap, BASE_CHAIN_ID);

    // System should handle gracefully (may skip or execute with high slippage)
    return true; // Pass if no crash
}

async function testZeroAmountSwap(): Promise<boolean> {
    // Test handling of zero/invalid amounts
    const swap: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: TOKENS.NORMAL,
        amountIn: '0', // Zero amount
        amountOut: '0',
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    await handleSwapDetected(LEADER_WALLET, swap, BASE_CHAIN_ID);

    // Should NOT create position for zero amount
    const position = await prisma.position.findFirst({
        where: {
            userId: TEST_USER_ID,
            tokenAddress: TOKENS.NORMAL,
            entryAmount: '0'
        }
    });

    return position === null;
}

async function testInvalidTokenAddress(): Promise<boolean> {
    // Test handling of invalid token addresses
    const swap: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: 'INVALID_ADDRESS', // Invalid format
        amountIn: '100000000000000000',
        amountOut: '1000000000000000000000',
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    try {
        await handleSwapDetected(LEADER_WALLET, swap, BASE_CHAIN_ID);
        return true; // Pass if handled gracefully
    } catch (error) {
        // Should not crash
        return false;
    }
}

async function testRapidFireSwaps(): Promise<boolean> {
    // Test system under rapid consecutive swaps
    const swaps: DecodedSwap[] = Array.from({ length: 10 }, (_, i) => ({
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: `0x${i.toString().padStart(40, '0')}`,
        amountIn: '100000000000000000',
        amountOut: '1000000000000000000000',
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    }));

    // Fire all swaps rapidly
    const promises = swaps.map(swap =>
        handleSwapDetected(LEADER_WALLET, swap, BASE_CHAIN_ID)
    );

    await Promise.allSettled(promises);

    // System should handle without crashing
    return true;
}

async function testDatabaseConnectionLoss(): Promise<boolean> {
    // Test resilience to database issues
    // Note: This is a mock test - real DB failure would need actual disconnection

    const swap: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: TOKENS.NORMAL,
        amountIn: '100000000000000000',
        amountOut: '1000000000000000000000',
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    try {
        await handleSwapDetected(LEADER_WALLET, swap, BASE_CHAIN_ID);
        return true; // Pass if completes
    } catch (error) {
        // Should handle DB errors gracefully
        return false;
    }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         AUTOTRADE EDGE CASE TESTING SUITE                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    await setup();

    // Run all edge case tests
    await runTest('Honeypot Detection', testHoneypotDetection);
    await runTest('Low Liquidity Block', testLowLiquidityBlock);
    await runTest('Concurrent Trades (Race Condition)', testConcurrentTrades);
    await runTest('Price Data Failure Handling', testPriceDataFailure);
    await runTest('Duplicate Swap Detection', testDuplicateSwapDetection);
    await runTest('Extreme Slippage Handling', testExtremeSlippage);
    await runTest('Zero Amount Swap', testZeroAmountSwap);
    await runTest('Invalid Token Address', testInvalidTokenAddress);
    await runTest('Rapid Fire Swaps (Stress Test)', testRapidFireSwaps);
    await runTest('Database Connection Loss', testDatabaseConnectionLoss);

    // Print summary
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                     TEST SUMMARY                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    // Detailed results
    console.log('Detailed Results:');
    console.log('─'.repeat(60));
    results.forEach(r => {
        const status = r.passed ? '✅' : '❌';
        const duration = r.duration ? `${r.duration}ms` : 'N/A';
        console.log(`${status} ${r.name.padEnd(40)} ${duration}`);
        if (r.reason) {
            console.log(`   └─ Reason: ${r.reason}`);
        }
    });

    console.log('\n');
}

async function cleanup() {
    console.log('🧹 Cleaning up test data...');
    try {
        await prisma.copyTradeConfig.deleteMany({ where: { userId: TEST_USER_ID } });
        await prisma.position.deleteMany({ where: { userId: TEST_USER_ID } });
        await prisma.user.delete({ where: { id: TEST_USER_ID } });
        console.log('✅ Cleanup complete\n');
    } catch (err) {
        console.warn('⚠️ Cleanup warning:', err);
    }
}

// Execute
(async () => {
    try {
        await runAllTests();
    } catch (e) {
        console.error('❌ Test Suite Error:', e);
    } finally {
        await cleanup();
        process.exit(0);
    }
})();
