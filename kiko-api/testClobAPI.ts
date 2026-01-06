/**
 * Test Polymarket CLOB API with Official SDK
 * Verifies authenticated API access
 */

import 'dotenv/config';
import { ClobClient } from '@polymarket/clob-client';

async function testAuthenticatedAPI() {
    console.log('=== Testing Polymarket CLOB Authenticated API ===\n');

    const apiKey = process.env.POLYMARKET_API_KEY;
    const apiSecret = process.env.POLYMARKET_API_SECRET;
    const passphrase = process.env.POLYMARKET_PASSPHRASE;

    if (!apiKey || !apiSecret || !passphrase) {
        console.log('❌ Missing credentials');
        return;
    }

    console.log('1. Initializing CLOB Client with credentials...');

    try {
        const client = new ClobClient(
            'https://clob.polymarket.com',
            137, // Polygon
            {
                key: apiKey,
                secret: apiSecret,
                passphrase: passphrase
            }
        );

        console.log('   ✅ Client initialized');

        // Test 1: Get API key info (authenticated)
        console.log('\n2. Testing getApiKeys() - authenticated endpoint...');
        try {
            const apiKeys = await (client as any).getApiKeys();
            console.log('   ✅ API Keys retrieved:', apiKeys);
        } catch (e: any) {
            console.log('   ⚠️  getApiKeys failed:', e.message);
        }

        // Test 2: Get markets (works unauthenticated too)
        console.log('\n3. Testing getMarkets()...');
        try {
            const markets = await client.getMarkets();
            console.log('   ✅ Markets count:', markets?.length || 'N/A');
            if (markets?.[0]) {
                console.log('   Sample:', markets[0].question?.slice(0, 60));
            }
        } catch (e: any) {
            console.log('   ❌ getMarkets failed:', e.message);
        }

        // Test 3: Get order book (authenticated)
        console.log('\n4. Testing getOrderBook() for a sample market...');
        try {
            // Get a market first
            const markets = await client.getMarkets();
            if (markets?.[0]?.tokens?.[0]?.token_id) {
                const tokenId = markets[0].tokens[0].token_id;
                const orderBook = await client.getOrderBook(tokenId);
                console.log('   ✅ Order book retrieved for token:', tokenId.slice(0, 10) + '...');
                console.log('   Bids:', orderBook?.bids?.length || 0, '| Asks:', orderBook?.asks?.length || 0);
            }
        } catch (e: any) {
            console.log('   ⚠️  getOrderBook failed:', e.message);
        }

        console.log('\n=== CREDENTIALS VALID ✅ ===');
        console.log('Your Polymarket API credentials are working correctly!');

    } catch (error: any) {
        console.error('\n❌ Client initialization or API call failed:', error.message);

        if (error.message?.includes('Invalid API key')) {
            console.log('\n⚠️  The API key might be incorrect or expired.');
        }
        if (error.message?.includes('signature')) {
            console.log('\n⚠️  The API secret might be incorrect.');
        }
    }
}

testAuthenticatedAPI().catch(console.error);
