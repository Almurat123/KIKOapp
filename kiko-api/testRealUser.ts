/**
 * Test credential generation with real Privy user
 */

import 'dotenv/config';
import prisma from './src/lib/prisma.js';
import { createOrDeriveCredentials, hasCredentials, getPolymarketWallet } from './src/services/polymarketCredService.js';
import { hasUserApiCreds } from './src/services/polymarketExecutor.js';

const REAL_USER_PRIVY_DID = 'did:privy:cmj0a3j3f005fl20c4xkl7195';

async function testWithRealUser() {
    console.log('=== Testing with Real Privy User ===\n');
    console.log('Privy DID:', REAL_USER_PRIVY_DID);

    // 1. Check existing credentials
    console.log('\n1. Checking existing credentials...');
    const hasCreds = await hasCredentials(REAL_USER_PRIVY_DID);
    console.log(`   Has credentials: ${hasCreds ? '✅ Yes' : '❌ No'}`);

    // 2. Get user's Privy wallet
    console.log('\n2. Getting Privy wallet via API...');
    try {
        const wallet = await getPolymarketWallet(REAL_USER_PRIVY_DID);
        if (wallet) {
            console.log(`   ✅ Privy wallet: ${wallet}`);
        } else {
            console.log('   ❌ Could not get Privy wallet');
        }
    } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // 3. Create credentials if not exists
    if (!hasCreds) {
        console.log('\n3. Creating API credentials...');
        try {
            const result = await createOrDeriveCredentials(REAL_USER_PRIVY_DID);
            if (result.success) {
                console.log('   ✅ Credentials created!');
                console.log(`   API Key: ${result.credentials?.apiKey}`);
            } else {
                console.log(`   ❌ Failed: ${result.error}`);
            }
        } catch (error: any) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    } else {
        console.log('\n3. Credentials already exist, skipping creation');
    }

    // 4. Verify in database
    console.log('\n4. Checking database...');
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId: REAL_USER_PRIVY_DID }
    });
    if (creds) {
        console.log('   ✅ Credentials in DB:');
        console.log(`   Wallet: ${creds.walletAddress}`);
        console.log(`   API Key: ${creds.apiKey.slice(0, 15)}...`);
    } else {
        console.log('   ❌ No credentials in DB');
    }

    // 5. Test executor check
    console.log('\n5. Executor hasUserApiCreds check...');
    const hasExecutorCreds = await hasUserApiCreds(REAL_USER_PRIVY_DID);
    console.log(`   Result: ${hasExecutorCreds ? '✅ Has creds' : '❌ No creds'}`);

    console.log('\n=== Test Complete ===');
    await prisma.$disconnect();
}

testWithRealUser().catch(async (error) => {
    console.error('Test failed:', error);
    await prisma.$disconnect();
});
