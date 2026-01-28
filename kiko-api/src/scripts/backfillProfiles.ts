
import prisma from '../db/prisma.js';
import { getUserDataByFid } from '../services/snapchainService.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

async function backfill() {
    console.log('--- Starting Social User Profile Cache Hydration ---');

    // 1. Identify FIDs in QualityFarcasterUser with NULL PFPs
    const nullProfiles = await prisma.qualityFarcasterUser.findMany({
        where: {
            OR: [
                { pfp: null },
                { pfp: '' },
                { pfp: { contains: 'vercel.sh' } }
            ]
        },
        select: { fid: true, username: true },
        orderBy: { followers: 'desc' },
        take: 200 // Process in batches to avoid overwhelming Hub
    });

    console.log(`Found ${nullProfiles.length} users in quality_users table needing profile hydration.`);

    if (nullProfiles.length === 0) {
        console.log('No users need hydration.');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const user of nullProfiles) {
        try {
            console.log(`Hydrating FID ${user.fid} (${user.username || 'unknown'})...`);
            // getUserDataByFid will automatically sync to DB if it gets a result from Hub
            const userData = await getUserDataByFid(user.fid);

            if (userData && userData.pfp) {
                console.log(`[SUCCESS] Hydrated profile for ${userData.username || user.fid}: ${userData.pfp}`);
                successCount++;
            } else {
                console.warn(`[SKIP] Could not hydrate FID ${user.fid}`);
                failCount++;
            }
        } catch (error: any) {
            console.error(`[ERROR] Failed to process FID ${user.fid}:`, error.message);
            failCount++;
        }

        // Brief pause to avoid hammering the hub
        await new Promise(r => setTimeout(r, 100));
    }

    console.log('\n--- Hydration Summary ---');
    console.log(`Total processed: ${nullProfiles.length}`);
    console.log(`Successfully hydrated: ${successCount}`);
    console.log(`Failed/No data: ${failCount}`);
}

backfill().catch(err => {
    console.error('Fatal error during backfill:', err);
    process.exit(1);
});
