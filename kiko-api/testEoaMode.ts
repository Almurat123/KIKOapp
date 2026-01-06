/**
 * Test EOA Mode Polymarket Integration
 * Tests credential generation for a real Privy user
 */

import 'dotenv/config';
import prisma from './src/lib/prisma.js';
import { createOrDeriveCredentials, hasCredentials, getPolymarketWallet } from './src/services/polymarketCredService.js';
import { placeBuyOrder, hasUserApiCreds } from './src/services/polymarketExecutor.js';
import { fetchUserPositions } from './src/services/polymarketDataService.js';

async function testEoaMode() {
    console.log('=== Polymarket EOA Mode Integration Test ===\n');

    // 1. Find a test user with Privy wallet
    console.log('1. Finding test user with Privy wallet...');
    const testUser = await prisma.user.findFirst({
        where: {
            privyDid: { not: '' }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (!testUser) {
        console.log('   ❌ No test user found');
        return;
    }

    console.log(`   ✅ Found user: ${testUser.id.slice(0, 15)}...`);
    console.log(`   Privy DID: ${testUser.privyDid.slice(0, 20)}...`);
    console.log(`   Wallet: ${testUser.walletAddress.slice(0, 15)}...`);

    // 2. Check if user already has credentials
    console.log('\n2. Checking existing credentials...');
    const hasCreds = await hasCredentials(testUser.privyDid);
    console.log(`   Has credentials: ${hasCreds ? '✅ Yes' : '❌ No'}`);

    // 3. Get user's Privy wallet
    console.log('\n3. Getting Privy wallet via API...');
    try {
        const wallet = await getPolymarketWallet(testUser.privyDid);
        if (wallet) {
            console.log(`   ✅ Privy wallet: ${wallet.slice(0, 15)}...`);
        } else {
            console.log('   ❌ Could not get Privy wallet');
        }
    } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // 4. Try to create credentials (if not exists)
    if (!hasCreds) {
        console.log('\n4. Creating API credentials...');
        try {
            const result = await createOrDeriveCredentials(testUser.privyDid);
            if (result.success) {
                console.log('   ✅ Credentials created!');
                console.log(`   API Key: ${result.credentials?.apiKey.slice(0, 20)}...`);
            } else {
                console.log(`   ❌ Failed: ${result.error}`);
            }
        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    } else {
        console.log('\n4. Skipping credential creation (already exists)');
    }

    // 5. Verify credentials in database
    console.log('\n5. Checking database for credentials...');
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId: testUser.privyDid }
    });
    if (creds) {
        console.log('   ✅ Credentials stored in DB');
        console.log(`   Wallet: ${creds.walletAddress.slice(0, 15)}...`);
        console.log(`   API Key: ${creds.apiKey.slice(0, 15)}...`);
    } else {
        console.log('   ❌ No credentials in DB');
    }

    // 6. Test hasUserApiCreds from executor
    console.log('\n6. Testing executor hasUserApiCreds...');
    const hasExecutorCreds = await hasUserApiCreds(testUser.privyDid);
    console.log(`   Executor check: ${hasExecutorCreds ? '✅ Has creds' : '❌ No creds'}`);

    console.log('\n=== Test Complete ===');

    await prisma.$disconnect();
}

testEoaMode().catch(async (error) => {
    console.error('Test failed:', error);
    await prisma.$disconnect();
});
