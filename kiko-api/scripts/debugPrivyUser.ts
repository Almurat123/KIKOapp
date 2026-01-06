/**
 * Debug script to inspect Privy user's linked accounts
 * and find the correct way to get Solana wallet
 */
import 'dotenv/config';
import { PrivyClient } from '@privy-io/server-auth';

const PRIVY_APP_ID = process.env.VITE_PRIVY_APP_ID || process.env.PRIVY_APP_ID || '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';

// The user ID to inspect (from the logs)
const USER_ID = 'did:privy:cmj0a3j3f005fl20c4xkl7195';

async function debugPrivyUser() {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        console.error('Missing PRIVY_APP_ID or PRIVY_APP_SECRET');
        return;
    }

    const client = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

    try {
        console.log('Fetching user:', USER_ID);
        const user = await client.getUser(USER_ID);

        console.log('\n========== USER DATA ==========');
        console.log('User ID:', user.id);
        console.log('Created at:', user.createdAt);

        console.log('\n========== LINKED ACCOUNTS ==========');
        user.linkedAccounts?.forEach((account: any, i: number) => {
            console.log(`\n--- Account ${i + 1} ---`);
            console.log('Type:', account.type);
            console.log('Wallet Client Type:', account.walletClientType);
            console.log('Chain Type:', account.chainType);
            console.log('Address:', account.address);
            console.log('ID:', account.id);
            console.log('Full account:', JSON.stringify(account, null, 2));
        });

        // Try different filters to find Solana wallet
        console.log('\n========== WALLET SEARCH TESTS ==========');

        // Test 1: Current backend approach
        const test1 = user.linkedAccounts?.find(
            (a: any) => a.type === 'wallet' && a.walletClientType === 'privy' && a.chainType === 'solana'
        );
        console.log('Test 1 (type=wallet, walletClientType=privy, chainType=solana):', test1?.address || 'NOT FOUND');

        // Test 2: Frontend approach
        const test2 = user.linkedAccounts?.find(
            (a: any) => a.walletClientType === 'solana'
        );
        console.log('Test 2 (walletClientType=solana):', test2?.address || 'NOT FOUND');

        // Test 3: Just type=wallet and chainType=solana
        const test3 = user.linkedAccounts?.find(
            (a: any) => a.type === 'wallet' && a.chainType === 'solana'
        );
        console.log('Test 3 (type=wallet, chainType=solana):', test3?.address || 'NOT FOUND');

        // Test 4: Any account with Solana address pattern
        const test4 = user.linkedAccounts?.find(
            (a: any) => a.address && !a.address.startsWith('0x') && a.address.length > 30
        );
        console.log('Test 4 (address looks like Solana):', test4?.address || 'NOT FOUND');

    } catch (error) {
        console.error('Error fetching user:', error);
    }
}

debugPrivyUser();
