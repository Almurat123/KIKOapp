import prisma from '../db/prisma.js';
import 'dotenv/config';

async function main() {
    console.log('[Check] Solana DB State Checklist:');

    const configs = await prisma.copyTradeConfig.findMany({
        where: { chainId: 900 }
    });
    console.log(`[Check] Found ${configs.length} Solana CopyTradeConfigs`);
    configs.forEach(c => {
        console.log(`  - Target: ${c.targetWallet} (User: ${c.userId})`);
    });

    const tracked = await prisma.trackedWallet.findMany({
        where: { chainId: 900 }
    });
    console.log(`[Check] Found ${tracked.length} Solana TrackedWallets`);
    tracked.forEach(t => {
        console.log(`  - Address: ${t.address}`);
    });

    // Check for potential cross-table missing entries
    for (const config of configs) {
        const isTracked = tracked.some(t => t.address === config.targetWallet);
        if (!isTracked) {
            console.error(`[Check] ❌ TrackedWallet MISSING for target: ${config.targetWallet}`);
        } else {
            console.log(`[Check] ✅ TrackedWallet exists for: ${config.targetWallet}`);
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
