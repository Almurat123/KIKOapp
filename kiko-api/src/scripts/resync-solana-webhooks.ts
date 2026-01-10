import prisma from '../db/prisma.js';
import { addAddressToWebhook } from '../services/alchemyWebhookService.js';
import 'dotenv/config';

async function main() {
    console.log('[Script] Resyncing Solana webhooks...');

    // Find all Solana configs
    const configs = await prisma.copyTradeConfig.findMany({
        where: { chainId: 900 }
    });

    console.log(`[Script] Found ${configs.length} Solana configurations`);

    for (const config of configs) {
        console.log(`[Script] Resyncing target: ${config.targetWallet}`);
        const success = await addAddressToWebhook(config.targetWallet, config.chainId);
        if (success) {
            console.log(`[Script] ✅ Successfully synced ${config.targetWallet}`);
        } else {
            console.warn(`[Script] ❌ Failed to sync ${config.targetWallet}`);
        }
    }

    console.log('[Script] Resync complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
