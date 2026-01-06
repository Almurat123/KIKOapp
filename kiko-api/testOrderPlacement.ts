/**
 * Test complete order placement flow
 * This test validates the entire pipeline even if order fails due to missing approvals
 */

import 'dotenv/config';
import prisma from './src/lib/prisma.js';
import { placeBuyOrder, hasUserApiCreds } from './src/services/polymarketExecutor.js';
import { getWalletPositions } from './src/services/polymarketDataService.js';
import { checkTradingReadiness } from './src/services/polymarketApprovalService.js';

const REAL_USER_PRIVY_DID = 'did:privy:cmj0a3j3f005fl20c4xkl7195';
const TARGET_WALLET = '0xa2c5c3a9c7b6539211a78564844748d45f1d4a25'; // Your Polymarket trader

async function testOrderPlacement() {
    console.log('=== Polymarket Order Placement Test ===\n');

    // 1. Check user readiness
    console.log('1. Checking trading readiness...');
    const readiness = await checkTradingReadiness(REAL_USER_PRIVY_DID);
    console.log(`   Credentials: ${readiness.hasCredentials ? '✅' : '❌'}`);
    console.log(`   USDC Approval: ${readiness.hasUsdcApproval ? '✅' : '❌'}`);
    console.log(`   USDC Balance: ${readiness.usdcBalance}`);
    console.log(`   Ready: ${readiness.isReady ? '✅' : '❌'}`);

    if (!readiness.hasCredentials) {
        console.log('   ❌ No credentials - cannot proceed');
        await prisma.$disconnect();
        return;
    }

    // 2. Fetch target wallet positions
    console.log('\n2. Fetching target wallet positions...');
    const positions = await fetchUserPositions(TARGET_WALLET);
    console.log(`   Found ${positions.length} positions`);

    if (positions.length === 0) {
        console.log('   ❌ No positions to copy');
        await prisma.$disconnect();
        return;
    }

    // Find an active market position
    const testPosition = positions[0];
    console.log(`   Test Position: ${testPosition.question?.slice(0, 40)}...`);
    console.log(`   Token ID: ${testPosition.assetId?.slice(0, 25)}...`);
    console.log(`   Entry Price: $${testPosition.entryPrice}`);

    // 3. Get or create copy config
    console.log('\n3. Getting copy config...');
    const user = await prisma.user.findFirst({
        where: { privyDid: REAL_USER_PRIVY_DID }
    });

    if (!user) {
        console.log('   ❌ User not found');
        await prisma.$disconnect();
        return;
    }

    let config = await prisma.polymarketCopyConfig.findFirst({
        where: { userId: user.id }
    });

    if (!config) {
        config = await prisma.polymarketCopyConfig.create({
            data: {
                userId: user.id,
                targetWallet: TARGET_WALLET,
                betSizeUsd: 1, // $1 test bet
                maxOpenBets: 10
            }
        });
        console.log('   ✅ Created new config');
    } else {
        console.log(`   ✅ Using existing config: ${config.id.slice(0, 15)}...`);
    }

    // 4. Attempt to place order (will likely fail due to missing approvals/balance)
    console.log('\n4. Attempting to place order...');
    console.log('   ⚠️  This may fail due to missing approvals or balance');

    try {
        const result = await placeBuyOrder({
            userId: REAL_USER_PRIVY_DID,
            configId: config.id,
            tokenId: testPosition.assetId || '',
            price: testPosition.entryPrice || 0.5,
            amountUsd: 1, // $1 test
            question: testPosition.question || 'Test',
            outcome: testPosition.outcome || 'Yes',
            marketSlug: testPosition.marketSlug || 'test',
            conditionId: testPosition.conditionId || ''
        });

        if (result.success) {
            console.log('   ✅ Order placed successfully!');
            console.log(`   Order ID: ${result.orderId}`);
        } else {
            console.log(`   ❌ Order failed: ${result.error}`);
        }
    } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // 5. Check database for position record
    console.log('\n5. Checking database for position record...');
    const recentPositions = await prisma.polymarketPosition.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 3
    });

    console.log(`   Found ${recentPositions.length} positions for user`);
    for (const pos of recentPositions) {
        console.log(`   - ${pos.question?.slice(0, 30)}... (${pos.status})`);
    }

    console.log('\n=== Test Complete ===');
    await prisma.$disconnect();
}

testOrderPlacement().catch(async (error) => {
    console.error('Test failed:', error);
    await prisma.$disconnect();
});
