import prisma from '../db/prisma.js';

async function queryDB() {
    console.log('--- Checking DB for mock user data ---');

    // Find entries with mock-like data (User XXXX pattern)
    const mockUsers = await prisma.trendingCast.findMany({
        where: {
            OR: [
                { authorDisplayName: { startsWith: 'User ' } },
                { authorUsername: { startsWith: 'fid' } },
            ]
        },
        select: {
            fid: true,
            authorUsername: true,
            authorDisplayName: true,
            authorAvatar: true,
        },
        take: 20,
    });

    console.log(`Found ${mockUsers.length} entries with mock/fallback data:`);
    mockUsers.forEach(u => {
        console.log(`  FID ${u.fid}: @${u.authorUsername} "${u.authorDisplayName}" avatar: ${u.authorAvatar?.substring(0, 50)}...`);
    });

    // Check specific FIDs mentioned
    const specificFids = [5774, 357897];
    for (const fid of specificFids) {
        console.log(`\n--- Checking FID ${fid} in DB ---`);
        const entry = await prisma.trendingCast.findFirst({
            where: { fid },
            select: {
                fid: true,
                authorUsername: true,
                authorDisplayName: true,
                authorAvatar: true,
                text: true,
            }
        });
        if (entry) {
            console.log('Found:', entry);
        } else {
            console.log('Not found in trending_casts');
        }
    }

    // Count total
    const total = await prisma.trendingCast.count();
    console.log(`\nTotal trending casts in DB: ${total}`);

    process.exit(0);
}

queryDB().catch(e => {
    console.error(e);
    process.exit(1);
});
