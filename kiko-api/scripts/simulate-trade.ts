/**
 * Simulation Script for Auto Trade
 * Usage: npx tsx scripts/simulate-trade.ts
 */

import prisma from '../src/lib/prisma';
import { handleSwapDetected } from '../src/services/autoTradeService';
import { DecodedSwap } from '../src/services/txDecoder';

async function main() {
    console.log('🚀 Starting Auto Trade Simulation...');

    // 1. Setup Test Data
    const TEST_USER_ID = 'did:privy:test_user_sim';
    const TARGET_WALLET = '0x1234567890123456789012345678901234567890';
    // BRETT token on Base
    const TOKEN_IN = '0x532f27101965dd16442e59d40670faf5ebb142e4';

    console.log('\n1️⃣  Setting up test user and config...');

    // Ensure user exists
    let user = await prisma.user.findUnique({ where: { privyDid: TEST_USER_ID } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                privyDid: TEST_USER_ID,
                walletAddress: '0xMyWalletAddress000000000000000000000000',
            },
        });
        console.log('✅ Created test user');
    } else {
        console.log('ℹ️  Test user already exists');
    }

    // Upsert Config
    const config = await prisma.copyTradeConfig.findFirst({
        where: { userId: user.id, targetWallet: TARGET_WALLET }
    });

    if (!config) {
        await prisma.copyTradeConfig.create({
            data: {
                userId: user.id,
                targetWallet: TARGET_WALLET,
                buyAmountUsd: 50, // Buy $50 worth
                maxSlippageBps: 300,
                chainId: 8453,
                status: 'active',
            },
        });
        console.log('✅ Created copy trade config: Follow 0x123... buy $50');
    } else {
        console.log('ℹ️  Config already exists');
    }

    // 2. Simulate Swap Event
    console.log('\n2️⃣  Simulating Swap Event...');
    console.log(`Target ${TARGET_WALLET} is buying BRETT (${TOKEN_IN})...`);

    // Mock a DecodedSwap object
    const mockSwap: DecodedSwap = {
        tokenIn: TOKEN_IN, // The token they bought (BRETT)
        tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // They sold ETH
        amountIn: '1000000000000000000', // 1 BRETT (dummy amount)
        amountOut: '100000000000000', // 0.0001 ETH
        router: '0xUniswapRouter...',
        dexName: 'Uniswap V3',
    };

    try {
        // Trigger the handler directly
        await handleSwapDetected(TARGET_WALLET, mockSwap, 8453);
        console.log('✅ Simulation triggered successfully');
    } catch (error) {
        console.error('❌ Simulation failed:', error);
    }

    // 3. Verify Result
    console.log('\n3️⃣  Verifying Results...');

    // Check if position was created
    const positions = await prisma.position.findMany({
        where: {
            userId: user.id,
            tokenAddress: TOKEN_IN,
            status: 'pending' // Initial status is pending
        },
        orderBy: { createdAt: 'desc' },
        take: 1
    });

    if (positions.length > 0) {
        console.log('🎉 SUCCESS! Position created:');
        console.log(positions[0]);
    } else {
        console.error('❌ FAILURE: No position found in database.');
        console.log('Check logs for "Skipping" messages (maybe market cap filter blocked it).');
    }
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
