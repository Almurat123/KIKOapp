/**
 * Quick script to check open positions and copy trade configs in the database
 * Run with: npx tsx src/scripts/checkOpenPositions.ts
 */
import { prisma } from "../db/prisma.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("\n========== DATABASE STATUS CHECK ==========\n");

    // 1. Check Open Positions
    const openPositions = await prisma.position.findMany({
        where: { status: 'open' },
        include: { user: true },
    });

    console.log(`📊 Open Positions: ${openPositions.length}`);
    if (openPositions.length > 0) {
        console.log("\nOpen Positions Details:");
        for (const pos of openPositions) {
            console.log(`  - Token: ${pos.tokenSymbol} (${pos.tokenAddress.slice(0, 10)}...)`);
            console.log(`    Chain: ${pos.chainId}`);
            console.log(`    Entry Price: $${pos.entryPrice}`);
            console.log(`    Current Price: $${pos.currentPrice || 'N/A'}`);
            console.log(`    P/L%: ${pos.profitLossPct?.toFixed(2) || 'N/A'}%`);
            console.log(`    User: ${pos.userId.slice(0, 20)}...`);
            console.log(`    Config ID: ${pos.configId}`);
            console.log("");
        }
    }

    // 2. Check Active Copy Trade Configs
    const activeConfigs = await prisma.copyTradeConfig.findMany({
        where: { status: 'active' },
        include: { user: true },
    });

    console.log(`\n⚙️  Active Copy Trade Configs: ${activeConfigs.length}`);
    if (activeConfigs.length > 0) {
        console.log("\nConfig Details:");
        for (const cfg of activeConfigs) {
            console.log(`  - Target: ${cfg.targetWallet.slice(0, 10)}...`);
            console.log(`    Chain: ${cfg.chainId}`);
            console.log(`    Buy Amount: $${cfg.buyAmountUsd}`);
            console.log(`    TP%: ${cfg.takeProfitPct || 'Not set'}`);
            console.log(`    SL%: ${cfg.stopLossPct || 'Not set'}`);
            console.log(`    Mirror Sell: ${cfg.mirrorSell ? '✅' : '❌'}`);
            console.log(`    User: ${cfg.user?.walletAddress?.slice(0, 10) || 'N/A'}...`);
            console.log("");
        }
    }

    // 3. Check all positions (open and closed)
    const allPositions = await prisma.position.count();
    const closedPositions = await prisma.position.count({ where: { status: 'closed' } });

    console.log(`\n📈 Total Positions: ${allPositions} (Open: ${openPositions.length}, Closed: ${closedPositions})`);

    // 4. Check if there are any configs with TP/SL set
    const configsWithTPSL = await prisma.copyTradeConfig.findMany({
        where: {
            status: 'active',
            OR: [
                { takeProfitPct: { not: null } },
                { stopLossPct: { not: null } }
            ]
        }
    });

    console.log(`\n🎯 Configs with TP/SL set: ${configsWithTPSL.length}`);

    if (configsWithTPSL.length === 0) {
        console.log("\n⚠️  WARNING: No active configs have TP or SL set!");
        console.log("   TP/SL monitoring won't trigger any sells without these settings.");
    }

    // 5. Show recent position history
    const recentPositions = await prisma.position.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    console.log(`\n📜 Recent Position History (last 5):`);
    if (recentPositions.length > 0) {
        for (const p of recentPositions) {
            console.log(`\n  ID: ${p.id}`);
            console.log(`  Token: ${p.tokenSymbol} (${p.tokenAddress.slice(0, 10)}...)`);
            console.log(`  Status: ${p.status}`);
            console.log(`  Exit Reason: ${p.exitReason || 'N/A'}`);
            console.log(`  Entry Price: $${p.entryPrice}`);
            console.log(`  Entry Tx: ${p.entryTxHash || 'N/A'}`);
            console.log(`  Exit Tx: ${p.exitTxHash || 'N/A'}`);
            console.log(`  Created: ${p.createdAt}`);
            console.log(`  Closed: ${p.closedAt || 'Still open'}`);
        }
    } else {
        console.log("  No positions found.");
    }

    console.log("\n========== END ==========\n");

    await prisma.$disconnect();
}

main().catch(console.error);
