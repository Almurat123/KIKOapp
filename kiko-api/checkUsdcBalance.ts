/**
 * Check USDC balances on Polygon (both USDC.e and native USDC)
 * and help with approval transactions
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import prisma from './src/lib/prisma.js';

// Polygon USDC addresses
const USDC_ADDRESSES = {
    'USDC.e (Bridged)': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // What we currently use
    'USDC (Native)': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',    // Native USDC on Polygon
};

const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)'
];

const POLYGON_RPC = 'https://polygon-rpc.com';
const REAL_USER_PRIVY_DID = 'did:privy:cmj0a3j3f005fl20c4xkl7195';

async function checkBalances() {
    console.log('=== Checking USDC Balances on Polygon ===\n');

    // Get user wallet
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId: REAL_USER_PRIVY_DID }
    });

    if (!creds) {
        console.log('❌ No credentials found');
        await prisma.$disconnect();
        return;
    }

    const wallet = creds.walletAddress;
    console.log(`User Wallet: ${wallet}\n`);

    const provider = new ethers.JsonRpcProvider(POLYGON_RPC, 137);

    // Check POL balance (for gas)
    const polBalance = await provider.getBalance(wallet);
    console.log(`POL Balance: ${ethers.formatEther(polBalance)} POL`);

    // Check both USDC addresses
    for (const [name, address] of Object.entries(USDC_ADDRESSES)) {
        const usdc = new ethers.Contract(address, ERC20_ABI, provider);
        try {
            const balance = await usdc.balanceOf(wallet);
            const decimals = await usdc.decimals();
            const allowance = await usdc.allowance(wallet, CTF_EXCHANGE);

            console.log(`\n${name} (${address.slice(0, 10)}...):`);
            console.log(`  Balance: ${ethers.formatUnits(balance, decimals)} USDC`);
            console.log(`  Allowance: ${ethers.formatUnits(allowance, decimals)} USDC`);

            if (balance > 0n) {
                console.log(`  ✅ Has balance!`);
            }
        } catch (e: any) {
            console.log(`\n${name}: Error - ${e.message}`);
        }
    }

    // Print approval instructions
    console.log('\n\n=== Approval Process ===');
    console.log('To approve USDC for trading, you need to:');
    console.log('1. Connect wallet to PolygonScan');
    console.log('2. Go to the USDC contract that has your balance');
    console.log('3. Call "approve" with:');
    console.log(`   - spender: ${CTF_EXCHANGE}`);
    console.log('   - amount: 115792089237316195423570985008687907853269984665640564039457584007913129639935 (max uint256)');
    console.log('\nOr use MetaMask to import the wallet and approve via dApp.');

    await prisma.$disconnect();
}

checkBalances().catch(console.error);
