
import prisma from '../src/lib/prisma';
import { handleSwapDetected } from '../src/services/autoTradeService';
import { getChainConfig } from '../src/config/chainConfig';
import { SOLANA_CONFIG } from '../src/config/solanaConfig';

// Mock Config
const SOL_CHAIN_ID = 900;
const TARGET_WALLET = 'SolanaTargetWalletBase58'; // Mock
const MOCK_USER_DID = 'did:privy:mockUserSOL';
const MOCK_USER_WALLET = '0xUserEVM'; // Primary
const MOCK_SOL_WALLET = 'UserSolanaWalletBase58'; // Secondary

async function main() {
    console.log('🚀 Starting Solana Swap Simulation...');

    // 1. Setup Data
    console.log('1. Setting up Mock User & Config...');

    // Upsert User
    const user = await prisma.user.upsert({
        where: { privyDid: MOCK_USER_DID },
        update: {
            solanaWalletAddress: MOCK_SOL_WALLET // Ensuring Sol address exists
        },
        create: {
            privyDid: MOCK_USER_DID,
            walletAddress: MOCK_USER_WALLET,
            solanaWalletAddress: MOCK_SOL_WALLET
        }
    });

    // Check Config
    const config = await prisma.copyTradeConfig.findFirst({
        where: { userId: user.id, chainId: SOL_CHAIN_ID, targetWallet: TARGET_WALLET.toLowerCase() }
    });

    if (!config) {
        await prisma.copyTradeConfig.create({
            data: {
                userId: user.id,
                targetWallet: TARGET_WALLET.toLowerCase(),
                chainId: SOL_CHAIN_ID,
                buyAmountUsd: 10.0,
                maxSlippageBps: 100,
                status: 'active',
                mirrorSell: true
            }
        });
        console.log('✅ Created new Solana Config');
    } else {
        console.log('✅ Found existing Solana Config');
    }

    // 2. Simulate Swap (SOL -> RANDOM_TOKEN)
    // Buy Logic: TokenIn = SOL (Cash), TokenOut = RANDOM
    console.log('2. Simulating SOL -> RANDOM Swap (Buying)...');

    // We need a specialized "DecodedSwap" like object.
    // autoTradeService expects DecodedSwap.
    // For Solana, `solanaWatcher.ts` produces DetectedSwap which matches DecodedSwap structure?
    // Let's check DecodedSwap interface. It has txHash, tokenIn, tokenOut, amountIn, amountOut...

    const swapData = {
        txHash: 'MockSolanaTxHash123',
        tokenIn: SOLANA_CONFIG.TOKENS.SOL,     // SOL (Cash)
        tokenOut: 'RandomTokenMintAddress123', // To Buy
        amountIn: '1000000000',                // 1 SOL
        amountOut: '500000000',                // 500 Tokens
        timestamp: Date.now() / 1000,
        sender: TARGET_WALLET
    };

    try {
        await handleSwapDetected(TARGET_WALLET, swapData as any, SOL_CHAIN_ID);
        console.log('✅ handleSwapDetected execution finished.');
    } catch (error) {
        console.error('❌ Error during simulation:', error);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
