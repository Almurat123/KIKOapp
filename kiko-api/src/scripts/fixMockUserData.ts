/**
 * Script to fix stale mock user data in trending_casts
 * Updates all entries for FIDs that have correct data in at least one entry
 */
import prisma from '../db/prisma.js';

async function fixMockUserData() {
    console.log('--- Fixing Mock User Data in DB ---');

    // 1. Find all FIDs that have mock data
    const mockEntries = await prisma.trendingCast.findMany({
        where: {
            OR: [
                { authorDisplayName: { startsWith: 'User ' } },
                { authorUsername: { startsWith: 'fid' } },
                { authorAvatar: { startsWith: 'https://placehold.co' } },
            ]
        },
        select: {
            fid: true,
            hash: true,
        }
    });

    const mockFids = [...new Set(mockEntries.map(e => e.fid))];
    console.log(`Found ${mockEntries.length} entries with mock data across ${mockFids.length} unique FIDs`);

    // 2. For each FID, check if we have a "good" entry
    let fixedCount = 0;
    for (const fid of mockFids) {
        // Find a good entry for this FID (has real username, not fid*)
        const goodEntry = await prisma.trendingCast.findFirst({
            where: {
                fid,
                authorUsername: { not: { startsWith: 'fid' } },
                authorDisplayName: { not: { startsWith: 'User ' } },
            },
            select: {
                authorUsername: true,
                authorDisplayName: true,
                authorAvatar: true,
                authorBio: true,
            }
        });

        if (goodEntry) {
            // Update all mock entries for this FID with the good data
            const result = await prisma.trendingCast.updateMany({
                where: {
                    fid,
                    OR: [
                        { authorDisplayName: { startsWith: 'User ' } },
                        { authorUsername: { startsWith: 'fid' } },
                        { authorAvatar: { startsWith: 'https://placehold.co' } },
                    ]
                },
                data: {
                    authorUsername: goodEntry.authorUsername,
                    authorDisplayName: goodEntry.authorDisplayName,
                    authorAvatar: goodEntry.authorAvatar,
                    authorBio: goodEntry.authorBio,
                }
            });

            if (result.count > 0) {
                console.log(`  Fixed ${result.count} entries for FID ${fid} -> @${goodEntry.authorUsername}`);
                fixedCount += result.count;
            }
        }
    }

    console.log(`\n✅ Total fixed: ${fixedCount} entries`);

    // 3. Clear Redis cache to serve fresh data
    try {
        const { del } = await import('../cache/redis.js');
        await del('social:trending:casts:24h');
        console.log('✅ Cleared Redis cache');
    } catch (e) {
        console.warn('Could not clear Redis cache:', e);
    }

    process.exit(0);
}

fixMockUserData().catch(e => {
    console.error(e);
    process.exit(1);
});
