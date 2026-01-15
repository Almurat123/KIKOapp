/**
 * AUTO-TRADE SIMULATION (E2E)
 * Validates the full trading pipeline without spending real funds.
 * Uses SIMULATION_MODE to mock transaction execution.
 */

process.env.SIMULATION_MODE = 'true';
process.env.AI_ANALYSIS_MODE = 'disabled'; // Disable AI for deterministic test

import { handleSwapDetected } from '../services/autoTradeService.js';
import prisma from '../db/prisma.js';
import { DecodedSwap } from '../services/txDecoder.js';

const BASE_CHAIN_ID = 8453;
const BSC_CHAIN_ID = 56;
const SOLANA_CHAIN_ID = 900;

// Test Tokens
const TOKENS = {
    PARAGRAPH: '0x06fc3d5d2369561e28f261148576520f5e49d6ea', // Base
    ZORA: '0x1111111111166b7fe7bd91427724b487980afc69',      // Base (Zora Protocol)
    FOURMEME: '0x99e595136EE912C0aD2717a39BB9fA40f82a4444',   // BSC (Real token with liquidity)
    SOLANA: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'    // Solana (Bonk)
};

const LEADER_WALLET = '0x1000000000000000000000000000000000000001';
const TEST_USER_ID = 'test-user-simulation-123';
const TEST_WALLET = '0x2000000000000000000000000000000000000002';

async function setup() {
    console.log('🛠️ Setting up simulation environment...');

    // 1. Upsert Test User
    const user = await prisma.user.upsert({
        where: { id: TEST_USER_ID },
        update: {},
        create: {
            id: TEST_USER_ID,
            privyDid: `did:privy:${TEST_USER_ID}`,
            walletAddress: TEST_WALLET,
            email: 'test@simulation.com'
        }
    });

    console.log(`✅ Test User Ready: ${user.id}`);

    // 2. Clean up existing configs/positions
    await prisma.copyTradeConfig.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.position.deleteMany({ where: { userId: TEST_USER_ID } });

    // 3. Create CopyTradeConfig (BASE)
    await prisma.copyTradeConfig.create({
        data: {
            userId: TEST_USER_ID,
            targetWallet: LEADER_WALLET,
            chainId: BASE_CHAIN_ID,
            buyAmountUsd: 10,
            status: 'active',
            minLiquidityUsd: 100,
            // Removed non-schema fields: maxOpenPositions, tokenBlacklist, fastExecutionEnabled
            // fastExecutionEnabled defaults to ON in logic if undefined
            stopLossPct: 10,
            takeProfitPct: 20
        }
    });

    console.log('✅ Base CopyTradeConfig Created');
}

async function runSimulation() {
    console.log('\n🚀 Starting AutoTrade Simulation...\n');

    // =========================================================================
    // SCENARIO 1: Standard Base Buy (Paragraph Token)
    // =========================================================================
    console.log('🧪 SCENARIO 1: Standard Base Buy (Paragraph/Uniswap)');
    const swap1: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: TOKENS.PARAGRAPH,
        amountIn: '100000000000000000', // 0.1 ETH in Wei
        amountOut: '1000000000000000000000', // 1000 tokens
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    await handleSwapDetected(LEADER_WALLET, swap1, BASE_CHAIN_ID);
    await verifyPosition(TOKENS.PARAGRAPH, 'Scenario 1');

    // =========================================================================
    // SCENARIO 2: Zora Protocol Buy
    // =========================================================================
    console.log('\n🧪 SCENARIO 2: Zora Protocol Buy');
    const swap2: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: TOKENS.ZORA,
        amountIn: '100000000000000000', // 0.1 ETH in Wei
        amountOut: '100000000000000000000', // 100 tokens
        dexName: 'Uniswap V3',
        router: '0x_mock_router'
    };

    await handleSwapDetected(LEADER_WALLET, swap2, BASE_CHAIN_ID);
    await verifyPosition(TOKENS.ZORA, 'Scenario 2');

    // =========================================================================
    // SCENARIO 3: Four.meme Buy (BSC)
    // =========================================================================
    console.log('\n🧪 SCENARIO 3: Four.meme Buy (BSC)');

    // Create BSC config
    // Ensure user exists (defensive)
    await prisma.user.upsert({
        where: { id: TEST_USER_ID },
        update: {},
        create: {
            id: TEST_USER_ID,
            privyDid: `did:privy:${TEST_USER_ID}`,
            walletAddress: TEST_WALLET,
            email: 'test@simulation.com'
        }
    });

    await prisma.copyTradeConfig.create({
        data: {
            userId: TEST_USER_ID,
            targetWallet: LEADER_WALLET,
            chainId: BSC_CHAIN_ID,
            buyAmountUsd: 10,
            status: 'active',
            // Removed invalid fields
        }
    });

    const swap3: DecodedSwap = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Native BNB
        tokenOut: TOKENS.FOURMEME,
        amountIn: '100000000000000000', // 0.1 BNB in Wei
        amountOut: '10000000000000000000000', // 10000 tokens
        dexName: 'PancakeSwap',
        router: '0x_mock_router'
    };

    await handleSwapDetected(LEADER_WALLET, swap3, BSC_CHAIN_ID);
    await verifyPosition(TOKENS.FOURMEME, 'Scenario 3');

    // =========================================================================
    // SCENARIO 4: Solana Buy
    // =========================================================================
    console.log('\n🧪 SCENARIO 4: Solana Buy');

    // Create Solana config
    // Ensure user exists (defensive)
    await prisma.user.upsert({
        where: { id: TEST_USER_ID },
        update: {},
        create: {
            id: TEST_USER_ID,
            privyDid: `did:privy:${TEST_USER_ID}`,
            walletAddress: TEST_WALLET,
            email: 'test@simulation.com'
        }
    });

    await prisma.copyTradeConfig.create({
        data: {
            userId: TEST_USER_ID,
            targetWallet: LEADER_WALLET,
            chainId: SOLANA_CHAIN_ID,
            buyAmountUsd: 10,
            status: 'active',
        }
    });

    const swap4: DecodedSwap = {
        tokenIn: 'SOL',
        tokenOut: TOKENS.SOLANA,
        amountIn: '1000000000',
        amountOut: '1000000',
        dexName: 'Jupiter',
        router: 'mock_program_id'
    };

    await handleSwapDetected(LEADER_WALLET, swap4, SOLANA_CHAIN_ID);
    await verifyPosition(TOKENS.SOLANA, 'Scenario 4');
}

async function verifyPosition(tokenAddress: string, scenarioName: string) {
    // Wait a bit for async processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    const position = await prisma.position.findFirst({
        where: {
            userId: TEST_USER_ID,
            tokenAddress: tokenAddress,
            status: 'open'
        },
        orderBy: { createdAt: 'desc' }
    });

    if (position) {
        if (position.entryTxHash.includes('SIMULATION') || position.entryTxHash.includes('Simulated')) {
            console.log(`✅ [${scenarioName}] PASSED: Position created with mock TX: ${position.entryTxHash}`);
        } else {
            console.log(`⚠️ [${scenarioName}] WARN: Position created but TX hash unexpected: ${position.entryTxHash}`);
        }
    } else {
        console.error(`❌ [${scenarioName}] FAILED: No position found for ${tokenAddress}`);
    }
}

async function cleanup() {
    console.log('\n🧹 Cleaning up...');
    try {
        await prisma.copyTradeConfig.deleteMany({ where: { userId: TEST_USER_ID } });
        await prisma.position.deleteMany({ where: { userId: TEST_USER_ID } });
        await prisma.user.delete({ where: { id: TEST_USER_ID } });
    } catch (err) {
        console.warn('Cleanup warning:', err);
    }
    console.log('✅ Cleanup complete.');
}

// Run
(async () => {
    try {
        await setup();
        await runSimulation();
    } catch (e) {
        console.error('❌ Simulation Error:', e);
    } finally {
        await cleanup();
        process.exit(0);
    }
})();
