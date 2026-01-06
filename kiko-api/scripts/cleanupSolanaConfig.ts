/**
 * Cleanup script to delete broken Solana copy trade configs
 * (ones with lowercase addresses that were saved incorrectly)
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanup() {
    console.log('Finding broken Solana configs (lowercase addresses)...');

    // Find all configs on chain 900 (Solana) that have lowercase letters where they shouldn't
    const solanaConfigs = await prisma.copyTradeConfig.findMany({
        where: { chainId: 900 }
    });

    console.log(`Found ${solanaConfigs.length} Solana config(s)`);

    for (const config of solanaConfigs) {
        // Check if address is incorrectly lowercase (Solana addresses should have mixed case)
        const hasUppercase = /[A-Z]/.test(config.targetWallet);

        if (!hasUppercase) {
            console.log(`Deleting broken config: ${config.id} -> ${config.targetWallet}`);

            // Also clean up the tracked wallet
            await prisma.trackedWallet.delete({
                where: { address: config.targetWallet }
            }).catch(() => console.log('TrackedWallet already deleted or not found'));

            // Delete the config
            await prisma.copyTradeConfig.delete({
                where: { id: config.id }
            });

            console.log('✅ Deleted');
        } else {
            console.log(`Config OK: ${config.id} -> ${config.targetWallet.slice(0, 10)}...`);
        }
    }

    console.log('Done!');
}

cleanup()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
