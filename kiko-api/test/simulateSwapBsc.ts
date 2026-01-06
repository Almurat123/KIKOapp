
import prisma from '../src/lib/prisma.ts';
import { handleSwapDetected } from '../src/services/autoTradeService.ts';
import { getChainConfig } from '../src/config/chainConfig.ts';

// Mock Config
const BSC_CHAIN_ID = 56;
const TARGET_WALLET = '0xTargetWalletAddress123456';
const MOCK_USER_DID = 'did:privy:mockUserBSC';
const MOCK_USER_WALLET = '0xUserWalletAddress123456';

// CAKE Token on BSC
const CAKE_ADDRESS = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82';

async function main() {
    console.log('🚀 Starting BSC Swap Simulation...');

    // 1. Setup Data
    console.log('1. Setting up Mock User & Config...');

    // Upsert User
    const user = await prisma.user.upsert({
        where: { privyDid: MOCK_USER_DID },
        update: {},
        create: {
            privyDid: MOCK_USER_DID,
            walletAddress: MOCK_USER_WALLET,
        }
    });

    // Upsert Config
    await prisma.copyTradeConfig.upsert({
        where: { id: 'mock-config-bsc' }, // Use valid CUID format usually, but string ID works if schema allows or we create fresh. 
        // Schema says @default(cuid()). We can't easily upsert by ID if generated. 
        // Let's delete generic entries for this target/user first.
        update: {},
        create: {
            userId: user.id,
            targetWallet: TARGET_WALLET.toLowerCase(),
            chainId: BSC_CHAIN_ID,
            buyAmountUsd: 10, // $10 swap
            maxSlippageBps: 100,
            status: 'active',
            mirrorSell: true,
            buyAmountUsd: 10.0,
        }
    } as any).catch(async () => {
        // Fallback if upsert fails on ID. Just create new.
        // Actually upsert isn't great for generated IDs.
        // Let's just findFirst or create.
    });

    const config = await prisma.copyTradeConfig.findFirst({
        where: { userId: user.id, chainId: BSC_CHAIN_ID, targetWallet: TARGET_WALLET.toLowerCase() }
    });

    if (!config) {
        await prisma.copyTradeConfig.create({
            data: {
                userId: user.id,
                targetWallet: TARGET_WALLET.toLowerCase(),
                chainId: BSC_CHAIN_ID,
                buyAmountUsd: 10.0,
                maxSlippageBps: 100,
                status: 'active',
                mirrorSell: true
            }
        });
        console.log('✅ Created new BSC Config');
    } else {
        console.log('✅ Found existing BSC Config');
    }

    // 2. Simulate Swap (WBNB -> CAKE)
    console.log('2. Simulating WBNB -> CAKE Swap...');

    const chainConfig = getChainConfig(BSC_CHAIN_ID);

    const swapData = {
        tokenIn: chainConfig.wrappedNativeAddress, // WBNB
        tokenOut: CAKE_ADDRESS,                // CAKE
        amountIn: '100000000000000000',        // 0.1 BNB
        amountOut: '5000000000000000000',      // 5 CAKE (Approx)
        router: '0xPancakeRouter...',
        dexName: 'PancakeSwap'
    };

    try {
        await handleSwapDetected(TARGET_WALLET, swapData, BSC_CHAIN_ID);
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
