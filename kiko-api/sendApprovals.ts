/**
 * Send USDC.e and CTF approval transactions for Polymarket
 * Uses Privy server-side wallet API directly
 */

import 'dotenv/config';
import { PrivyClient } from '@privy-io/server-auth';
import prisma from './src/lib/prisma.js';
import { ethers } from 'ethers';

// Contract addresses
const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e (Bridged)
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const CTF_CONTRACT = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';

const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
const CTF_ABI = ['function setApprovalForAll(address operator, bool approved)'];

const REAL_USER_PRIVY_DID = 'did:privy:cmj0a3j3f005fl20c4xkl7195';
const POLYGON_RPC = 'https://polygon-rpc.com';

async function sendApprovalTransactions() {
    console.log('=== Sending Approval Transactions via Privy ===\n');

    const privyClient = new PrivyClient(
        process.env.PRIVY_APP_ID || '',
        process.env.PRIVY_APP_SECRET || '',
        { walletApi: { authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY } }
    );

    // Get user info from Privy
    console.log('1. Getting user wallet info from Privy...');
    const user = await privyClient.getUserById(REAL_USER_PRIVY_DID) as any;

    console.log('   User data keys:', Object.keys(user || {}));

    // Try different possible locations for linked accounts
    const linkedAccounts = user?.linked_accounts || user?.linkedAccounts || [];

    console.log(`   Found ${linkedAccounts.length} linked accounts`);

    const embeddedWallet = linkedAccounts.find(
        (a: any) => a.type === 'wallet' && (a.wallet_client_type === 'privy' || a.walletClientType === 'privy')
    ) as any;

    if (!embeddedWallet) {
        console.log('   Linked accounts:', JSON.stringify(linkedAccounts, null, 2));
        // Try using our stored credentials' wallet address
        const creds = await prisma.polymarketApiCreds.findUnique({
            where: { userId: REAL_USER_PRIVY_DID }
        });

        if (!creds) {
            console.log('❌ No embedded wallet or stored credentials found');
            await prisma.$disconnect();
            return;
        }

        // Use getEmbeddedWalletInfo from our privyWallet service instead
        console.log('   Using stored wallet info...');
        const { getEmbeddedWalletInfo } = await import('./src/services/privyWallet.js');
        const walletInfo = await getEmbeddedWalletInfo(REAL_USER_PRIVY_DID);

        if (!walletInfo) {
            console.log('❌ Could not get wallet info');
            await prisma.$disconnect();
            return;
        }

        await sendApprovalsWithWallet(privyClient, walletInfo.id, walletInfo.address);
        return;
    }

    const walletId = embeddedWallet.id || embeddedWallet.wallet_id;
    const walletAddress = embeddedWallet.address;

    await sendApprovalsWithWallet(privyClient, walletId, walletAddress);
}

async function sendApprovalsWithWallet(privyClient: PrivyClient, walletId: string, walletAddress: string) {
    console.log(`   Wallet ID: ${walletId}`);
    console.log(`   Wallet Address: ${walletAddress}`);

    // Check USDC.e balance first
    console.log('\n2. Checking USDC.e balance...');
    const provider = new ethers.JsonRpcProvider(POLYGON_RPC, 137);
    const usdcContract = new ethers.Contract(USDC_E, ['function balanceOf(address) view returns (uint256)'], provider);
    const balance = await usdcContract.balanceOf(walletAddress);
    console.log(`   USDC.e balance: ${ethers.formatUnits(balance, 6)} USDC`);

    if (balance === 0n) {
        console.log('   ❌ No USDC.e balance! Please swap native USDC to USDC.e first.');
        await prisma.$disconnect();
        return;
    }

    // Prepare approve transaction data
    const erc20Interface = new ethers.Interface(ERC20_ABI);
    const approveData = erc20Interface.encodeFunctionData('approve', [
        CTF_EXCHANGE,
        ethers.MaxUint256
    ]);

    // Send USDC approval
    console.log('\n3. Sending USDC.e approval transaction...');
    try {
        const usdcResult = await privyClient.walletApi.ethereum.sendTransaction({
            walletId: walletId,
            caip2: 'eip155:137',
            transaction: {
                to: USDC_E as `0x${string}`,
                data: approveData as `0x${string}`,
            }
        });
        console.log(`   ✅ USDC.e approved! Tx hash: ${usdcResult.hash}`);
    } catch (error: any) {
        console.log(`   ❌ USDC approval failed: ${error.message}`);
        if (error.message.includes('insufficient')) {
            console.log('   Make sure you have enough POL for gas');
        }
    }

    // Wait for transaction to be mined
    console.log('   Waiting 5s for transaction to be mined...');
    await new Promise(r => setTimeout(r, 5000));

    // Prepare CTF approval
    const ctfInterface = new ethers.Interface(CTF_ABI);
    const ctfApproveData = ctfInterface.encodeFunctionData('setApprovalForAll', [
        CTF_EXCHANGE,
        true
    ]);

    // Send CTF approval
    console.log('\n4. Sending CTF approval transaction...');
    try {
        const ctfResult = await privyClient.walletApi.ethereum.sendTransaction({
            walletId: walletId,
            caip2: 'eip155:137',
            transaction: {
                to: CTF_CONTRACT as `0x${string}`,
                data: ctfApproveData as `0x${string}`,
            }
        });
        console.log(`   ✅ CTF approved! Tx hash: ${ctfResult.hash}`);
    } catch (error: any) {
        console.log(`   ❌ CTF approval failed: ${error.message}`);
    }

    console.log('\n=== Done! ===');
    console.log('Now run testApprovalService.ts to verify the approvals.');

    await prisma.$disconnect();
}

sendApprovalTransactions().catch(async (error) => {
    console.error('Error:', error);
    await prisma.$disconnect();
});
