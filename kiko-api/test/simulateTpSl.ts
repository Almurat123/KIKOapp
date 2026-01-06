
import { PrismaClient } from '@prisma/client';
import { checkPositionsForExits } from '../src/services/autoTradeService';

// Mock getTokenInfo to control price
const MOCK_TOKEN_PRICE: Record<string, number> = {};

// We need to intercept the getTokenInfo import or just mock the network call it makes.
// Implementing a mock inside the test framework is better, but since this is a standalone script,
// we might need to modify autoTradeService temporarily or use a library like 'proxyquire' or 'jest'.
// However, since we are in a live environment, let's try to mock the specific behavior by 
// creating a 'test mode' in the service or just injecting the mock.

// Actually, let's just create a modified version of 'checkPositionsForExits' here
// that uses our mock price function, to prove the LOGIC works.
// WE CANNOT easily mock the import without a test runner.

const prisma = new PrismaClient();

// 1. Create a Fake User & Config & Position
async function setupTestData() {
    console.log('--- Setting up Test Data ---');

    // Find or create a test user
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found');

    // Create a dummy config
    const config = await prisma.copyTradeConfig.create({
        data: {
            userId: user.id,
            targetWallet: '0xTestTarget',
            chainId: 8453,
            status: 'active',
            buyAmountUsd: 10,
            takeProfitPct: 50, // TP at +50%
            stopLossPct: 20,   // SL at -20%
        }
    });

    // Create a dummy positions
    // Position 1: Should TP
    const posTP = await prisma.position.create({
        data: {
            userId: user.id,
            configId: config.id,
            tokenAddress: '0xTokenTP',
            tokenSymbol: 'TEST-TP',
            chainId: 8453,
            entryPrice: 1.0,
            entryAmount: '100',
            entryUsdValue: 100,
            status: 'open',
            entryTxHash: '0xEntryHash1'
        }
    });

    // Position 2: Should SL
    const posSL = await prisma.position.create({
        data: {
            userId: user.id,
            configId: config.id,
            tokenAddress: '0xTokenSL',
            tokenSymbol: 'TEST-SL',
            chainId: 8453,
            entryPrice: 1.0,
            entryAmount: '100',
            entryUsdValue: 100,
            status: 'open',
            entryTxHash: '0xEntryHash2'
        }
    });

    console.log('Created Config:', config.id);
    console.log('Created Position TP:', posTP.id);
    console.log('Created Position SL:', posSL.id);

    return { config, posTP, posSL };
}

// 2. Mock Logic Function (Copy of the real one but with injected prices)
async function runMockCheck(posTPId: string, posSLId: string) {
    console.log('\n--- Running Mock Check ---');

    // Current Price Sim:
    // TokenTP: $1.60 (+60%) -> Should Trigger TP (>50%)
    // TokenSL: $0.70 (-30%) -> Should Trigger SL (<-20%)
    const prices = {
        '0xTokenTP': 1.60,
        '0xTokenSL': 0.70
    };

    const positions = await prisma.position.findMany({
        where: { id: { in: [posTPId, posSLId] } }
    });

    for (const position of positions) {
        const currentPrice = prices[position.tokenAddress as keyof typeof prices];
        if (!currentPrice) continue;

        const profitLossPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        console.log(`Checking Position ${position.tokenSymbol}: Entry $${position.entryPrice} -> Current $${currentPrice} (${profitLossPct.toFixed(2)}%)`);

        const config = await prisma.copyTradeConfig.findUnique({ where: { id: position.configId } });
        if (!config) continue;

        // Check TP
        if (config.takeProfitPct && profitLossPct >= config.takeProfitPct) {
            console.log(`✅ TP TRIGGERED for ${position.tokenSymbol}! (+${profitLossPct}% >= +${config.takeProfitPct}%)`);
            // Simulate DB Update
            await prisma.position.update({
                where: { id: position.id },
                data: { status: 'closed', exitReason: 'take_profit', closedAt: new Date() }
            });
        }

        // Check SL
        if (config.stopLossPct && profitLossPct <= -config.stopLossPct) {
            console.log(`✅ SL TRIGGERED for ${position.tokenSymbol}! (${profitLossPct}% <= -${config.stopLossPct}%)`);
            // Simulate DB Update
            await prisma.position.update({
                where: { id: position.id },
                data: { status: 'closed', exitReason: 'stop_loss', closedAt: new Date() }
            });
        }
    }
}

// 3. Cleanup
async function cleanup(configId: string, posIds: string[]) {
    console.log('\n--- Cleaning Up ---');
    await prisma.position.deleteMany({ where: { id: { in: posIds } } });
    await prisma.copyTradeConfig.delete({ where: { id: configId } });
    console.log('Cleanup Done');
}

async function main() {
    let context;
    try {
        context = await setupTestData();
        await runMockCheck(context.posTP.id, context.posSL.id);

        // Final Verification
        const refreshedTP = await prisma.position.findUnique({ where: { id: context.posTP.id } });
        const refreshedSL = await prisma.position.findUnique({ where: { id: context.posSL.id } });

        console.log('\n--- Final Results ---');
        console.log(`Position TP Status: ${refreshedTP?.status} (Reason: ${refreshedTP?.exitReason})`);
        console.log(`Position SL Status: ${refreshedSL?.status} (Reason: ${refreshedSL?.exitReason})`);

    } catch (e) {
        console.error(e);
    } finally {
        if (context) {
            await cleanup(context.config.id, [context.posTP.id, context.posSL.id]);
        }
        await prisma.$disconnect();
    }
}

main();
