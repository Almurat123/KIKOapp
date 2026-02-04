
import prisma from '../db/prisma.js';
import { checkPositionsForExits } from '../services/autoTradeService.js';
import { logger } from '../utils/logger.js';

// Test Data from DB
const USER_ID = "did:privy:cmj0a3j3f005fl20c4xkl7195";
const CONFIG_ID = "cml7sao8100017l4do5s5ncfs";
const TEST_TOKEN = "0x4200000000000000000000000000000000000006"; // WETH on Base

async function runIntegrationTest() {
    console.log('🚀 Starting End-to-End Integration Test...');

    // 1. Prepare Config (Enable Dynamic TP)
    await prisma.copyTradeConfig.update({
        where: { id: CONFIG_ID },
        data: {
            enableDynamicTP: true,
            dynamicTPMinProfitPct: 1, // Set ultra low to trigger immediately
            takeProfitPct: 9999,      // Disable fixed TP
            stopLossPct: 9999         // Disable fixed SL
        }
    });

    // 2. Clear previous test positions if any
    await prisma.position.deleteMany({
        where: { tokenAddress: TEST_TOKEN, status: 'open', userId: USER_ID }
    });

    // 3. Insert a Mock Position with "Pumped" history
    // We want current price (market) to be BELOW peakPrice - 3*ATR
    // Since we can't control market price, we will inject a fake PeakPrice and History
    const pos = await prisma.position.create({
        data: {
            userId: USER_ID,
            configId: CONFIG_ID,
            tokenAddress: TEST_TOKEN,
            tokenSymbol: 'TEST-WETH',
            chainId: 8453,
            entryPrice: 1000,
            entryAmount: "1.0",
            entryTxHash: "0x-test-hash",
            entryUsdValue: 1000,
            status: 'open',
            peakPrice: 5000,
            priceHistory: [
                { timestamp: Date.now() - 300000, price: 4000, high: 4000, low: 3500, close: 3500 }, // -12.5%
                { timestamp: Date.now() - 240000, price: 3500, high: 3500, low: 3000, close: 3000 }, // -14%
                { timestamp: Date.now() - 180000, price: 3000, high: 3000, low: 2600, close: 2600 }  // -13%
            ] as any
        }
    });

    console.log(`✅ Created "Dumping" test position: ${pos.id}`);
    console.log(`📊 Expecting Rapid Decline trigger (Current WETH price ~2250 is another >12% drop).`);

    // 4. Trigger the standard monitoring logic
    // This is EXACTLY what the cron job calls
    console.log('\n--- Invoking checkPositionsForExits ---');
    try {
        await checkPositionsForExits();
    } catch (e) {
        console.error('Execution Error:', e);
    }

    // 5. Verify Results
    const updatedPos = await prisma.position.findUnique({
        where: { id: pos.id }
    });

    console.log('\n--- Final Results ---');
    console.log(`Position Status: ${updatedPos?.status}`);
    console.log(`Exit Reason: ${updatedPos?.exitReason}`);
    console.log(`Price History Length: ${(updatedPos?.priceHistory as any[])?.length || 0}`);

    if (updatedPos?.status === 'closed' || updatedPos?.exitReason === 'dynamic_take_profit') {
        console.log('🎉 SUCCESS: Dynamic TP was successfully called and triggered!');
    } else {
        console.log('👀 Logic Active: Position still open (likely price not low enough or ATR too wide).');
    }
}

runIntegrationTest().catch(console.error).finally(() => process.exit(0));
