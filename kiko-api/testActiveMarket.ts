/**
 * Test order placement using SDK directly with known active market
 */

import 'dotenv/config';
import { ClobClient, Side } from '@polymarket/clob-client';

async function testDirectOrder() {
    console.log('=== Test Direct Order with SDK ===\n');

    const apiKey = process.env.POLYMARKET_API_KEY;
    const apiSecret = process.env.POLYMARKET_API_SECRET;
    const passphrase = process.env.POLYMARKET_PASSPHRASE;
    const funderAddress = process.env.POLYMARKET_FUNDER_ADDRESS;
    const privateKey = process.env.PRIVATE_KEY;

    if (!apiKey || !apiSecret || !passphrase || !privateKey || !funderAddress) {
        console.log('❌ Missing credentials');
        return;
    }

    const { Wallet } = await import('@ethersproject/wallet');
    const signer = new Wallet(privateKey);

    console.log('Signer:', signer.address);
    console.log('Funder:', funderAddress);

    const creds = { key: apiKey, secret: apiSecret, passphrase };
    const client = new ClobClient(
        'https://clob.polymarket.com',
        137,
        signer,
        creds,
        1, // POLY_PROXY
        funderAddress
    );

    console.log('\n1. Fetching a well-known active market...');

    try {
        // Get prices for a known token (Bitcoin ETF approval - typically active)
        // First, let's try to get sampling active positions
        const samplingRes = await fetch('https://clob.polymarket.com/sampling-simplified-markets?next_cursor=');
        const sampling = await samplingRes.json() as any;

        console.log('   Sampling markets response type:', typeof sampling);

        let testTokenId = null;

        if (sampling.data && Array.isArray(sampling.data) && sampling.data.length > 0) {
            for (const market of sampling.data.slice(0, 10)) {
                if (market.tokens && market.tokens.length > 0) {
                    testTokenId = market.tokens[0].token_id;
                    console.log(`   Found market: ${market.question?.slice(0, 50)}...`);
                    console.log(`   Token ID: ${testTokenId?.slice(0, 20)}...`);
                    break;
                }
            }
        }

        if (!testTokenId) {
            console.log('   Could not find a market with tokens, trying manual search...');

            // Try a direct market lookup
            const marketsRes = await fetch('https://gamma-api.polymarket.com/markets?limit=5&active=true');
            const markets = await marketsRes.json() as any[];

            if (markets.length > 0) {
                for (const m of markets) {
                    if (m.tokens && m.tokens.length > 0) {
                        testTokenId = m.tokens[0].id || m.tokens[0].token_id;
                        console.log(`   Found via Gamma: ${m.question?.slice(0, 50)}...`);
                        console.log(`   Token: ${testTokenId?.slice(0, 20)}...`);
                        break;
                    }
                }
            }
        }

        if (!testTokenId) {
            console.log('❌ Could not find any active market');
            return;
        }

        // Check orderbook
        console.log('\n2. Checking orderbook...');
        const orderbook = await client.getOrderBook(testTokenId);
        console.log(`   Bids: ${orderbook.bids?.length || 0}`);
        console.log(`   Asks: ${orderbook.asks?.length || 0}`);

        // Try creating and posting an order
        console.log('\n3. Creating order...');
        const order = await client.createOrder({
            tokenID: testTokenId,
            price: 0.01,
            size: 1,
            side: Side.BUY
        });

        console.log('   Order created successfully');
        console.log('   Maker:', order.maker?.slice(0, 15) + '...');
        console.log('   Signer:', order.signer?.slice(0, 15) + '...');

        console.log('\n4. Posting order...');
        const result = await client.postOrder(order);

        console.log('\n✅ ORDER POSTED SUCCESSFULLY!');
        console.log('   Result:', JSON.stringify(result, null, 2));

    } catch (error: any) {
        if (error.response?.data) {
            console.error('\n❌ API Error:', JSON.stringify(error.response.data));
        } else if (error.error) {
            console.error('\n❌ Error:', error.error);
        } else {
            console.error('\n❌ Error:', error.message);
        }
    }
}

testDirectOrder().catch(console.error);
