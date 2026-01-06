/**
 * Test EIP-712 Signing with Privy
 * This script tests the signTypedData function for Polymarket CLOB orders
 */

import { signTypedData, getEmbeddedWalletInfo, EIP712TypedData } from './src/services/privyWallet.js';

// Sample EIP-712 typed data that mimics Polymarket CLOB order structure
const SAMPLE_TYPED_DATA: EIP712TypedData = {
    domain: {
        name: 'Polymarket CTF Exchange',
        version: '1',
        chainId: 137, // Polygon
        verifyingContract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' // CTF Exchange
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
    primaryType: 'Order',
    message: {
        salt: '123456789',
        maker: '0x0000000000000000000000000000000000000000',
        signer: '0x0000000000000000000000000000000000000000',
        taker: '0x0000000000000000000000000000000000000000',
        tokenId: '1234567890',
        makerAmount: '1000000', // 1 USDC (6 decimals)
        takerAmount: '1500000', // 1.5 shares
        expiration: '1893456000', // Far future
        nonce: '1',
        feeRateBps: '0',
        side: 0, // 0 = BUY, 1 = SELL
        signatureType: 0
    }
};

async function testEIP712Signing() {
    // You need to replace this with an actual Privy user ID
    const TEST_USER_ID = process.env.TEST_PRIVY_USER_ID || '';

    if (!TEST_USER_ID) {
        console.log('❌ No TEST_PRIVY_USER_ID provided.');
        console.log('To test, set TEST_PRIVY_USER_ID environment variable to a valid Privy DID.');
        console.log('Example: TEST_PRIVY_USER_ID="did:privy:xxxxx" npx tsx testEIP712.ts');
        return;
    }

    console.log('=== Testing EIP-712 Signing ===\n');

    // Step 1: Get wallet info
    console.log('1. Getting wallet info for user:', TEST_USER_ID.slice(0, 20) + '...');
    try {
        const walletInfo = await getEmbeddedWalletInfo(TEST_USER_ID);
        if (!walletInfo) {
            console.log('❌ User has no embedded wallet');
            return;
        }
        console.log('✅ Wallet found:', {
            address: walletInfo.address.slice(0, 15) + '...',
            id: walletInfo.id.slice(0, 15) + '...'
        });
    } catch (e: any) {
        console.log('❌ Failed to get wallet:', e.message);
        return;
    }

    // Step 2: Test signing
    console.log('\n2. Signing sample EIP-712 order...');
    console.log('   Domain:', JSON.stringify(SAMPLE_TYPED_DATA.domain, null, 2));
    console.log('   Primary Type:', SAMPLE_TYPED_DATA.primaryType);

    try {
        const signature = await signTypedData(TEST_USER_ID, SAMPLE_TYPED_DATA, 137);
        console.log('✅ Signature obtained!');
        console.log('   Signature:', signature.slice(0, 40) + '...');
        console.log('   Length:', signature.length);
    } catch (e: any) {
        console.log('❌ Signing failed:', e.message);
        if (e.message?.includes('DELEGATION_REQUIRED')) {
            console.log('\n⚠️  User needs to enable wallet delegation in their settings.');
            console.log('   This is required for server-side signing.');
        }
    }
}

testEIP712Signing().catch(console.error);
