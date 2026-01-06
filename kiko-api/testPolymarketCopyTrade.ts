/**
 * Test Polymarket Copy Trade Flow
 * End-to-end test of the copy trading system
 */

import 'dotenv/config';
import prisma from './src/lib/prisma.js';
import { getWalletPositions, diffPositions } from './src/services/polymarketDataService.js';
import { placeBuyOrder, isClobConfigured } from './src/services/polymarketExecutor.js';

// Use your Privy DID for testing
const TEST_USER_ID = process.env.TEST_PRIVY_USER_ID || 'did:privy:cmj0a3j3f005fl20c4xkl7195';
// Known active trader from Polymarket leaderboard
const TARGET_WALLET = '0x6a72f61820b26b1fe4d956e17b6dc2a1ea3033ee';

async function test() {
    console.log('=== Polymarket Copy Trade Integration Test ===\n');

    // Step 1: Check CLOB credentials
    console.log('1. Checking CLOB API credentials...');
    if (!isClobConfigured()) {
        console.log('   ❌ CLOB credentials not configured');
        return;
    }
    console.log('   ✅ CLOB credentials configured');

    // Step 2: Get or create test user
    console.log('\n2. Setting up test user...');
    let user = await prisma.user.findFirst({
        where: { privyDid: TEST_USER_ID }
    });

    if (!user) {
        // Create a test user if not exists
        user = await prisma.user.create({
            data: {
                privyDid: TEST_USER_ID,
                walletAddress: '0xTestWallet' + Date.now().toString(16).slice(0, 32)
            }
        });
        console.log('   Created test user:', user.id);
    } else {
        console.log('   Using existing user:', user.id);
    }

    // Step 3: Create or find PolymarketCopyConfig
    console.log('\n3. Setting up copy config...');
    let config = await prisma.polymarketCopyConfig.findFirst({
        where: { userId: user.id, targetWallet: TARGET_WALLET.toLowerCase() }
    });

    if (!config) {
        config = await prisma.polymarketCopyConfig.create({
            data: {
                userId: user.id,
                targetWallet: TARGET_WALLET.toLowerCase(),
                betSizeUsd: 1, // Small test amount
                maxOpenBets: 5,
                status: 'active',
                mirrorSell: true
            }
        });
        console.log('   Created config:', config.id);
    } else {
        console.log('   Using existing config:', config.id);
    }

    // Step 4: Fetch target wallet positions
    console.log('\n4. Fetching target wallet positions...');
    const positions = await getWalletPositions(TARGET_WALLET);
    console.log(`   Found ${positions.length} positions`);

    if (positions.length === 0) {
        console.log('   ⚠️  No positions found for target wallet');
        return;
    }

    // Show first 3 positions
    positions.slice(0, 3).forEach((p, i) => {
        console.log(`   [${i + 1}] ${p.title.slice(0, 50)}... (${p.outcome})`);
        console.log(`       Size: ${p.size.toFixed(2)} | Entry: $${p.avgPrice.toFixed(3)}`);
    });

    // Step 5: Test buy order (use a position we don't have yet)
    console.log('\n5. Testing buy order creation...');

    // Find a position we don't have yet
    let testPosition = null;
    for (const pos of positions.slice(0, 5)) {
        const existingPosition = await prisma.polymarketPosition.findFirst({
            where: {
                userId: user.id,
                configId: config.id,
                conditionId: pos.conditionId,
                status: 'open'
            }
        });

        if (!existingPosition && pos.assetId) {
            testPosition = pos;
            break;
        }
    }

    if (!testPosition) {
        console.log('   ⚠️  All top positions already exist or have no asset ID');
    } else {
        console.log('   Attempting to place buy order...');
        console.log(`   Token: ${testPosition.assetId?.slice(0, 20) || 'NO_TOKEN_ID'}...`);
        console.log(`   Price: $${testPosition.avgPrice || testPosition.currentPrice || 0.5}`);
        console.log(`   Amount: $${config.betSizeUsd}`);

        if (!testPosition.assetId) {
            console.log('   ❌ No asset ID available for this position, cannot place order');
        } else {
            try {
                const result = await placeBuyOrder({
                    userId: TEST_USER_ID,
                    configId: config.id,
                    tokenId: testPosition.assetId,
                    price: testPosition.avgPrice || testPosition.currentPrice || 0.5,
                    amountUsd: config.betSizeUsd,
                    question: testPosition.title,
                    outcome: testPosition.outcome,
                    marketSlug: testPosition.market,
                    conditionId: testPosition.conditionId
                });

                if (result.success) {
                    console.log('   ✅ Order placed successfully!');
                    console.log(`   Order ID: ${result.orderId}`);
                } else {
                    console.log('   ❌ Order failed:', result.error);
                }
            } catch (e: any) {
                console.log('   ❌ Exception:', e.message);
            }
        }
    }

    // Step 6: Show current positions in DB
    console.log('\n6. Checking database positions...');
    const dbPositions = await prisma.polymarketPosition.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    if (dbPositions.length === 0) {
        console.log('   No positions in database');
    } else {
        console.log(`   Found ${dbPositions.length} position(s):`);
        dbPositions.forEach((p, i) => {
            console.log(`   [${i + 1}] ${p.question.slice(0, 40)}... (${p.status})`);
            console.log(`       Entry: $${p.entryPrice} | Shares: ${p.shares.toFixed(2)}`);
        });
    }

    console.log('\n=== Test Complete ===');
}

test()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
