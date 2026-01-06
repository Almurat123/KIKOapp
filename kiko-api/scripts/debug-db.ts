// Debug script to check watcher state
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('=== DATABASE STATE ===\n');

    // Check TrackedWallet
    const wallets = await prisma.trackedWallet.findMany();
    console.log('TrackedWallet entries:', wallets.length);
    for (const w of wallets) {
        console.log(`  - ${w.address}, activeConfigs: ${w.activeConfigs}`);
    }

    // Check active CopyTradeConfigs
    const configs = await prisma.copyTradeConfig.findMany({
        where: { status: 'active' },
    });
    console.log('\nActive CopyTradeConfigs:', configs.length);
    for (const c of configs) {
        console.log(`  - Target: ${c.targetWallet}, mirrorSell: ${c.mirrorSell}`);
    }

    // Check Positions
    const positions = await prisma.position.findMany();
    console.log('\nPositions:', positions.length);
    for (const p of positions) {
        console.log(`  - Token: ${p.tokenAddress}, status: ${p.status}`);
    }

    await prisma.$disconnect();
}

main().catch(console.error);
