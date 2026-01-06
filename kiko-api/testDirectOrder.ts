/**
 * Test direct order placement on Polymarket
 * Places a small order on an active market to verify the complete flow
 */

import 'dotenv/config';
import prisma from './src/lib/prisma.js';
import { placeBuyOrder } from './src/services/polymarketExecutor.js';
import { ClobClient } from '@polymarket/clob-client';

const REAL_USER_PRIVY_DID = 'did:privy:cmj0a3j3f005fl20c4xkl7195';
const CLOB_API = 'https://clob.polymarket.com';

async function testDirectOrder() {
    console.log('=== Direct Order Placement Test ===\n');

    // 1. Get or create a config for this user
    console.log('1. Getting user and config...');
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
                targetWallet: '0x0000000000000000000000000000000000000000', // dummy
                betSizeUsd: 0.10,
                maxOpenBets: 10
            }
        });
    }

    console.log(`   ✅ User: ${user.id.slice(0, 15)}...`);
    console.log(`   ✅ Config: ${config.id.slice(0, 15)}...`);

    // 2. Find an active market
    console.log('\n2. Finding an active market...');
    const clobClient = new ClobClient(CLOB_API, 137);

    try {
        // Get sampling markets (active ones)
        const response = await fetch('https://clob.polymarket.com/sampling-simplified-markets?next_cursor=');
        const data = await response.json() as any;

        if (!data.data || data.data.length === 0) {
            console.log('   ❌ No active markets found');
            await prisma.$disconnect();
            return;
        }

        // Find a market with a reasonable price
        let testMarket = null;
        for (const market of data.data.slice(0, 10)) {
            if (market.tokens && market.tokens.length > 0) {
                const token = market.tokens[0];
                const price = parseFloat(token.price || '0.5');
                if (price >= 0.1 && price <= 0.9) {
                    testMarket = {
                        question: market.question,
                        conditionId: market.condition_id,
                        tokenId: token.token_id,
                        outcome: token.outcome || 'Yes',
                        price: price
                    };
                    break;
                }
            }
        }

        if (!testMarket) {
            // Use first available
            const market = data.data[0];
            const token = market.tokens[0];
            testMarket = {
                question: market.question,
                conditionId: market.condition_id,
                tokenId: token.token_id,
                outcome: token.outcome || 'Yes',
                price: parseFloat(token.price || '0.5')
            };
        }

        console.log(`   ✅ Found market: ${testMarket.question?.slice(0, 50)}...`);
        console.log(`   Token ID: ${testMarket.tokenId?.slice(0, 25)}...`);
        console.log(`   Price: $${testMarket.price.toFixed(4)}`);

        // 3. Place a small test order
        console.log('\n3. Placing $0.10 test order...');
        console.log('   ⚠️ This will use real USDC!');

        const result = await placeBuyOrder({
            userId: REAL_USER_PRIVY_DID,
            configId: config.id,
            tokenId: testMarket.tokenId,
            price: testMarket.price,
            amountUsd: 0.10, // Only $0.10 for testing
            question: testMarket.question || 'Test Market',
            outcome: testMarket.outcome,
            marketSlug: 'test',
            conditionId: testMarket.conditionId || ''
        });

        if (result.success) {
            console.log('\n   🎉 ORDER PLACED SUCCESSFULLY!');
            console.log(`   Order ID: ${result.orderId}`);
        } else {
            console.log(`\n   ❌ Order failed: ${result.error}`);
        }

    } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // 4. Check database positions
    console.log('\n4. Checking positions in database...');
    const positions = await prisma.polymarketPosition.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    console.log(`   Found ${positions.length} position(s)`);
    for (const pos of positions) {
        console.log(`   - ${pos.question?.slice(0, 40)}... ($${pos.costBasis.toFixed(2)}) [${pos.status}]`);
    }

    console.log('\n=== Test Complete ===');
    await prisma.$disconnect();
}

testDirectOrder().catch(async (error) => {
    console.error('Test failed:', error);
    await prisma.$disconnect();
});
