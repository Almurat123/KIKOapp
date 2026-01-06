/**
 * Test token approval service
 */

import 'dotenv/config';
import prisma from './src/lib/prisma.js';
import {
    checkUsdcApproval,
    checkCtfApproval,
    checkTradingReadiness,
    getRequiredApprovals,
    POLYMARKET_CONTRACTS
} from './src/services/polymarketApprovalService.js';

const REAL_USER_PRIVY_DID = 'did:privy:cmj0a3j3f005fl20c4xkl7195';

async function testApprovalService() {
    console.log('=== Polymarket Token Approval Service Test ===\n');

    console.log('Contract Addresses:');
    console.log(`  USDC: ${POLYMARKET_CONTRACTS.USDC}`);
    console.log(`  CTF Exchange: ${POLYMARKET_CONTRACTS.CTF_EXCHANGE}`);
    console.log(`  CTF Token: ${POLYMARKET_CONTRACTS.CTF}`);

    // Get user's wallet from credentials
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId: REAL_USER_PRIVY_DID }
    });

    if (!creds) {
        console.log('\n❌ No credentials found for test user');
        await prisma.$disconnect();
        return;
    }

    const walletAddress = creds.walletAddress;
    console.log(`\nUser Wallet: ${walletAddress}`);

    // 1. Check USDC approval
    console.log('\n1. Checking USDC Approval...');
    try {
        const usdcStatus = await checkUsdcApproval(walletAddress);
        console.log(`   Approved: ${usdcStatus.approved ? '✅ Yes' : '❌ No'}`);
        console.log(`   Balance: ${usdcStatus.balance} USDC`);
        console.log(`   Allowance: ${usdcStatus.allowance} USDC`);
    } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // 2. Check CTF approval
    console.log('\n2. Checking CTF Token Approval...');
    try {
        const ctfApproved = await checkCtfApproval(walletAddress);
        console.log(`   Approved: ${ctfApproved ? '✅ Yes' : '❌ No'}`);
    } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // 3. Get required approvals
    console.log('\n3. Getting Required Approvals...');
    try {
        const required = await getRequiredApprovals(walletAddress);
        console.log(`   Needs USDC Approval: ${required.needsUsdcApproval ? '⚠️ Yes' : '✅ No'}`);
        console.log(`   Needs CTF Approval: ${required.needsCtfApproval ? '⚠️ Yes' : '✅ No'}`);
        console.log(`   USDC Balance: ${required.usdcBalance}`);
        console.log(`   Transactions needed: ${required.transactions.length}`);
        for (const tx of required.transactions) {
            console.log(`     - ${tx.type}: ${tx.description}`);
        }
    } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // 4. Check trading readiness
    console.log('\n4. Checking Trading Readiness...');
    try {
        const readiness = await checkTradingReadiness(REAL_USER_PRIVY_DID);
        console.log(`   Has Credentials: ${readiness.hasCredentials ? '✅ Yes' : '❌ No'}`);
        console.log(`   Has USDC Approval: ${readiness.hasUsdcApproval ? '✅ Yes' : '❌ No'}`);
        console.log(`   Has CTF Approval: ${readiness.hasCtfApproval ? '✅ Yes' : '❌ No'}`);
        console.log(`   USDC Balance: ${readiness.usdcBalance}`);
        console.log(`   Ready to Trade: ${readiness.isReady ? '✅ YES' : '❌ NO'}`);
        if (readiness.missingSteps.length > 0) {
            console.log('   Missing Steps:');
            for (const step of readiness.missingSteps) {
                console.log(`     - ${step}`);
            }
        }
    } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    console.log('\n=== Test Complete ===');
    await prisma.$disconnect();
}

testApprovalService().catch(async (error) => {
    console.error('Test failed:', error);
    await prisma.$disconnect();
});
