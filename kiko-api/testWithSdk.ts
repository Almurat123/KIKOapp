/**
 * Test using Polymarket SDK order builder with Privy signing
 */

import 'dotenv/config';
import prisma from './src/lib/prisma.js';
import { ClobClient, Chain, SignatureType } from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';
import { signTypedData, getEmbeddedWalletInfo } from './src/services/privyWallet.js';

const REAL_USER_PRIVY_DID = 'did:privy:cmj0a3j3f005fl20c4xkl7195';
const CLOB_API = 'https://clob.polymarket.com';

async function testWithSdk() {
    console.log('=== Testing with Polymarket SDK ===\n');

    // Get user's credentials
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId: REAL_USER_PRIVY_DID }
    });

    if (!creds) {
        console.log('❌ No credentials');
        await prisma.$disconnect();
        return;
    }

    console.log('User wallet:', creds.walletAddress);

    // Create a dummy signer just for order building (we'll replace signature with Privy's)
    const dummyKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const wallet = new Wallet(dummyKey);

    // Initialize ClobClient with funder = user's wallet address
    console.log('\n1. Initializing ClobClient...');
    const client = new ClobClient(
        CLOB_API,
        Chain.POLYGON,
        wallet as any,       // Will override signature
        creds            // L2 credentials
    );

    // Find a market
    console.log('\n2. Finding active market...');
    const response = await fetch('https://clob.polymarket.com/sampling-simplified-markets?next_cursor=');
    const data = await response.json() as any;

    if (!data.data || data.data.length === 0) {
        console.log('❌ No markets');
        await prisma.$disconnect();
        return;
    }

    const market = data.data[0];
    const token = market.tokens[0];

    console.log('   Market:', market.question?.slice(0, 50));
    console.log('   Token:', token.token_id.slice(0, 30) + '...');
    console.log('   Price:', token.price);

    // Create order using SDK
    console.log('\n3. Creating order with SDK...');
    try {
        // Use SDK's createOrder method
        const orderArgs = {
            tokenID: token.token_id,
            price: parseFloat(token.price) || 0.5,
            side: 'BUY' as const,
            size: 0.2, // Buy 0.2 shares
            feeRateBps: 0,
            nonce: 0,
            expiration: 0
        };

        console.log('   Order args:', JSON.stringify(orderArgs, null, 2));

        // This will fail because we need the right signer, but let's see the format
        const signedOrder = await client.createOrder(orderArgs);
        console.log('   SDK created order:', JSON.stringify(signedOrder, null, 2));

    } catch (error: any) {
        console.log('   SDK error:', error.message);
        console.log('   (Expected - wrong signer)');
    }

    // Let's try a different approach - manually inspect what SDK expects
    console.log('\n4. Checking SDK order format requirements...');

    // Get order book to understand market
    const orderBook = await client.getOrderBook(token.token_id);
    console.log('   Order book:', JSON.stringify({
        asks: orderBook.asks?.slice(0, 2),
        bids: orderBook.bids?.slice(0, 2)
    }, null, 2));

    await prisma.$disconnect();
}

testWithSdk().catch(async (error) => {
    console.error('Test failed:', error);
    await prisma.$disconnect();
});
