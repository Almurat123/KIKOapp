import { prisma } from "../db/prisma.js";
import { checkPositionsForExits, getTokenInfo } from "../services/autoTradeService.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * SIMULATION: TP/SL Execution Test
 * 
 * Objectives:
 * 1. Verify price fetching from 4 APIs (DexScreener, GeckoTerminal, ZORA, Moralis)
 * 2. Simulate TP/SL trigger and verify on-chain execution flow
 */

async function testPriceApis(tokenAddress: string, chainId: number) {
    console.log(`\n--- Testing Price Fetching for ${tokenAddress} on Chain ${chainId} ---`);

    // We expect this to try DS, then GT, then Zora (if Base), then Moralis
    const info = await getTokenInfo(tokenAddress, chainId, { verbose: true });

    if (info) {
        console.log(`\n✅ Successfully fetched price via ${info.provider.toUpperCase()}`);
        console.log(`Price: $${info.price}`);
        console.log(`Symbol: ${info.symbol}`);
    } else {
        console.log(`\n❌ Failed to fetch price from any of the 4 providers.`);
    }
}

async function simulateTPSLExecution() {
    console.log(`\n--- Simulating TP/SL Execution Flow ---`);

    // 1. Find or Create a Mock User & Config
    let user = await prisma.user.findFirst();
    if (!user) {
        console.log("Creating mock user...");
        user = await prisma.user.create({
            data: {
                id: "sim-user-123",
                walletAddress: "0x1234567890123456789012345678901234567890",
                email: "sim@example.com",
                privyDid: "did:privy:sim-123"
            }
        });
    }

    let config = await prisma.copyTradeConfig.findFirst({
        where: { userId: user.id }
    });

    if (!config) {
        console.log("Creating mock config...");
        config = await prisma.copyTradeConfig.create({
            data: {
                userId: user.id,
                targetWallet: "0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241",
                chainId: 8453,
                buyAmountUsd: 10,
                takeProfitPct: 20, // 20% TP
                stopLossPct: 10,   // 10% SL
                status: 'active'
            }
        });
    }

    // 2. Mock a Position that is profitable (TP Case)
    const tokenAddress = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; // USDC on Base
    const currentPriceInfo = await getTokenInfo(tokenAddress, 8453);

    if (!currentPriceInfo) {
        console.error("Could not fetch current price for mock token. Please use a valid token for live test.");
        return;
    }

    const entryPrice = currentPriceInfo.price * 0.8; // Set entry 20% lower to trigger TP

    console.log(`Creating mock position for TP test:`);
    console.log(`Token: ${tokenAddress}`);
    console.log(`Entry Price: $${entryPrice}`);
    console.log(`Current Price: $${currentPriceInfo.price} (+25%)`);

    const position = await prisma.position.create({
        data: {
            userId: user.id,
            configId: config.id,
            tokenAddress,
            tokenSymbol: currentPriceInfo.symbol,
            chainId: 8453,
            entryPrice,
            entryAmount: "1000",
            entryTxHash: "0xmock_entry_hash",
            entryUsdValue: 10,
            status: 'open',
            createdAt: new Date()
        }
    });

    try {
        console.log(`\n--- Running checkPositionsForExits() ---`);
        await checkPositionsForExits();

        // 3. Verify Position Status
        const updatedPos = await prisma.position.findUnique({
            where: { id: position.id }
        });

        if (updatedPos?.status === 'closed') {
            console.log(`\n✅ Position successfully CLOSED!`);
            console.log(`Reason: ${updatedPos.exitReason}`);
            console.log(`Exit Tx: ${updatedPos.exitTxHash || 'MOCK_TX'}`);
        } else {
            console.log(`\n❌ Position remains OPEN. Logic check failed.`);
        }

    } finally {
        // Cleanup if needed
        // await prisma.position.delete({ where: { id: position.id } });
    }
}

async function main() {
    // Test for different chains/types
    // 1. Base Token (should try Zora)
    await testPriceApis("0x4ed4E28C2F330049007b7D266ad268d826274Ab7", 8453); // DEGEN on Base

    // 2. Solana Token (should try DS/GT)
    // await testPriceApis("EKpQGSJtjMFqKZ9KQanAtY7YXNoAsFfWTSRf89fhpump", 900); // WIF on Solana

    // 3. Simulation
    await simulateTPSLExecution();
}

main().catch(console.error);
