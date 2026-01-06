/**
 * Test using Polymarket SDK with proper funder address
 * The SDK needs to be initialized with the actual wallet that will pay
 */

import 'dotenv/config';
import prisma from './src/lib/prisma.js';
import { ClobClient, Chain, ApiKeyCreds, OrderType, Side } from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';
import { signTypedData, getEmbeddedWalletInfo } from './src/services/privyWallet.js';

const REAL_USER_PRIVY_DID = 'did:privy:cmj0a3j3f005fl20c4xkl7195';
const CLOB_API = 'https://clob.polymarket.com';

async function testSdkWithFunder() {
    console.log('=== Testing SDK with Funder Address ===\n');

    // Get user's credentials
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId: REAL_USER_PRIVY_DID }
    });

    if (!creds) {
        console.log('❌ No credentials');
        await prisma.$disconnect();
        return;
    }

    const funderAddress = creds.walletAddress;
    console.log('Funder address:', funderAddress);

    // Create a dummy signer - we'll intercept the signing
    const dummyKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const wallet = new Wallet(dummyKey);

    // Initialize with API creds - this should use funder address
    const apiCreds: ApiKeyCreds = {
        key: creds.apiKey,
        secret: creds.apiSecret,
        passphrase: creds.passphrase
    };

    console.log('\n1. Initializing ClobClient with funder...');

    // Try to see if we can build order differently
    // The SDK might have a buildOrder function that we can use before signing

    // Let's try another approach - using SDK's helper functions
    console.log('\n2. Getting a valid market with orderbook...');

    const simplifiedMarkets = await fetch('https://clob.polymarket.com/sampling-simplified-markets?next_cursor=');
    const marketsData = await simplifiedMarkets.json() as any;

    // Find a market with reasonable spread
    let testToken: any = null;
    for (const market of marketsData.data?.slice(0, 20) || []) {
        if (market.tokens && market.tokens.length > 0) {
            const token = market.tokens[0];
            const price = parseFloat(token.price || '0.5');
            if (price >= 0.05 && price <= 0.95) {
                testToken = {
                    tokenId: token.token_id,
                    price,
                    question: market.question
                };
                break;
            }
        }
    }

    if (!testToken) {
        console.log('❌ No suitable market found');
        await prisma.$disconnect();
        return;
    }

    console.log('   Token:', testToken.tokenId.slice(0, 30) + '...');
    console.log('   Price:', testToken.price);
    console.log('   Question:', testToken.question?.slice(0, 50));

    // Build the order manually using SDK format
    console.log('\n3. Building order in SDK format...');

    // Use the exact same format as SDK
    const size = 0.2; // 0.2 shares
    const price = testToken.price;

    // SDK calculation from observed output:
    // For BUY: makerAmount = size * price * 1e6, takerAmount = size * 1e6
    const makerAmount = Math.round(size * price * 1e6);
    const takerAmount = Math.round(size * 1e6);

    console.log('   Size:', size, 'shares');
    console.log('   Price:', price);
    console.log('   makerAmount:', makerAmount, '(USDC in 6 decimals)');
    console.log('   takerAmount:', takerAmount, '(Shares scaled)');

    // Create the order structure exactly like SDK
    const salt = Date.now().toString();
    const order = {
        salt,
        maker: funderAddress,
        signer: funderAddress,
        taker: '0x0000000000000000000000000000000000000000',
        tokenId: testToken.tokenId,
        makerAmount: makerAmount.toString(),
        takerAmount: takerAmount.toString(),
        expiration: '0',
        nonce: '0',
        feeRateBps: '0',
        side: 0, // Integer for EIP-712 signing
        signatureType: 0 // EOA
    };

    // For API submission, side needs to be string
    const orderForApi = {
        ...order,
        side: 'BUY' // String for API
    };

    console.log('\n4. Order structure:', JSON.stringify(order, null, 2));

    // Now sign with Privy
    console.log('\n5. Signing with Privy...');

    const typedData = {
        domain: {
            name: 'Polymarket CTF Exchange',
            version: '1',
            chainId: 137,
            verifyingContract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'
        },
        types: {
            Order: [
                { name: 'salt', type: 'uint256' },
                { name: 'maker', type: 'address' },
                { name: 'signer', type: 'address' },
                { name: 'taker', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
                { name: 'makerAmount', type: 'uint256' },
                { name: 'takerAmount', type: 'uint256' },
                { name: 'expiration', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'feeRateBps', type: 'uint256' },
                { name: 'side', type: 'uint8' },
                { name: 'signatureType', type: 'uint8' }
            ]
        },
        primaryType: 'Order' as const,
        message: order
    };

    const signature = await signTypedData(REAL_USER_PRIVY_DID, typedData, 137);
    console.log('   Signature:', signature.slice(0, 40) + '...');

    // Post to API
    console.log('\n6. Posting order to CLOB...');

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'POST';
    const requestPath = '/order';

    const orderPayload = {
        order: {
            ...orderForApi,
            signature
        },
        owner: creds.apiKey,
        orderType: OrderType.GTC
    };

    const body = JSON.stringify(orderPayload);

    // Generate HMAC signature for L2 auth
    const crypto = await import('crypto');
    const hmacMessage = timestamp + method + requestPath + body;
    const hmac = crypto.createHmac('sha256', Buffer.from(creds.apiSecret, 'base64'));
    hmac.update(hmacMessage);
    const l2Signature = hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_');

    console.log('   Payload:', JSON.stringify(orderPayload, null, 2).slice(0, 500));

    const response = await fetch(`${CLOB_API}${requestPath}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'POLY_ADDRESS': funderAddress,
            'POLY_API_KEY': creds.apiKey,
            'POLY_PASSPHRASE': creds.passphrase,
            'POLY_TIMESTAMP': timestamp,
            'POLY_SIGNATURE': l2Signature
        },
        body
    });

    const result = await response.json();
    console.log('\n   Response:', JSON.stringify(result, null, 2));

    if ((result as any).orderID || (result as any).success) {
        console.log('\n🎉 ORDER PLACED SUCCESSFULLY!');
    } else {
        console.log('\n❌ Order failed');
    }

    await prisma.$disconnect();
}

testSdkWithFunder().catch(async (error) => {
    console.error('Test failed:', error);
    await prisma.$disconnect();
});
