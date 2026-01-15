/**
 * Script to close ALL open positions
 * Use this when you want to reset and stop monitoring all positions
 */

import prisma from '../db/prisma.js';

const DRY_RUN = process.argv.includes('--dry-run');

async function closeAllPositions() {
    console.log('=== Closing ALL Open Positions ===\n');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : '⚠️ LIVE MODE (will close all positions)'}\n`);

    // 1. Get all open positions
    const openPositions = await prisma.position.findMany({
        where: { status: 'open' },
        include: { user: true }
    });

    console.log(`Found ${openPositions.length} open positions\n`);

    for (const pos of openPositions) {
        console.log(`- ${pos.tokenSymbol || 'Unknown'} (${pos.tokenAddress.slice(0, 10)}...) - Chain: ${pos.chainId} - Value: $${pos.entryUsdValue.toFixed(2)}`);
    }

    if (!DRY_RUN) {
        const result = await prisma.position.updateMany({
            where: { status: 'open' },
            data: {
                status: 'closed',
                exitReason: 'manual_cleanup',
                closedAt: new Date()
            }
        });

        console.log(`\n✅ Closed ${result.count} positions`);
    } else {
        console.log(`\n[DRY RUN] Would close ${openPositions.length} positions`);
        console.log(`\nRun without --dry-run to actually close them`);
    }

    await prisma.$disconnect();
}

closeAllPositions().catch(console.error);
