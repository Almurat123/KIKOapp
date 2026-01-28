
import prisma from '../db/prisma.js';

async function diagnose() {
    console.log('=== Social Database Diagnosis ===');

    const castCount = await prisma.trendingCast.count();
    console.log(`Total casts in trending_casts: ${castCount}`);

    if (castCount > 0) {
        const sample = await prisma.trendingCast.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { hash: true, authorUsername: true, createdAt: true, updatedAt: true }
        });
        console.log('Latest 5 casts:');
        sample.forEach(c => console.log(`  ${c.hash} | ${c.authorUsername} | ${c.createdAt} | ${c.updatedAt}`));
    }

    const qualityUserCount = await prisma.qualityFarcasterUser.count();
    console.log(`\nTotal quality users: ${qualityUserCount}`);
}

diagnose().catch(console.error);
