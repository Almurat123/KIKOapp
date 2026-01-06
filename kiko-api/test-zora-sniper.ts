import 'dotenv/config';
import { zoraSniperService } from './src/services/zoraSniperService.js';

async function testZora() {
    console.log("--- 🚀 Zora Sniper & FastSwap Test Runner ---");

    const tokenOut = process.argv[2] || '0x4200000000000000000000000000000000000006'; // Default WETH
    const userId = process.env.TEST_USER_ID;
    const accessToken = process.env.TEST_ACCESS_TOKEN;

    if (!userId || !accessToken) {
        console.log("⚠️  Missing TEST_USER_ID or TEST_ACCESS_TOKEN in environment.");
        console.log("You can run this with:");
        console.log("TEST_USER_ID=xxx TEST_ACCESS_TOKEN=yyy npx tsx test-zora-sniper.ts <TOKEN_ADDRESS>\n");
        console.log("Proceeding with dry-run mode (construction only)...");
    }

    try {
        console.log(`Testing FastSwap construction for: ${tokenOut}`);

        // We call fastSwap. If no credentials, we expect it to fail at the sendTransaction stage
        // but we can see if createTradeCall (Zora SDK) works.
        const result = await zoraSniperService.fastSwap({
            userId: userId || 'dummy-user',
            accessToken: accessToken || 'dummy-token',
            walletAddress: '0x0000000000000000000000000000000000000000',
            tokenOut: tokenOut,
            amountIn: '0.0001',
            slippage: 0.1
        });

        console.log("✅ Success! Transaction Hash:", result);
    } catch (error: any) {
        console.log("\n--- Test Finished ---");
        if (error.message.includes("Quote failed")) {
            console.log("❌ Zora SDK Error: Could not get quote for this token. Is it a Zora coin with liquidity?");
        } else if (error.message.includes("Privy") || error.message.includes("unauthorized")) {
            console.log("❌ Auth Error: Privy credentials invalid or missing.");
        } else {
            console.error("❌ Error during test:", error.message);
        }
    }
}

testZora();
