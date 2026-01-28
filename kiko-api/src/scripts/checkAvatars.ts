
import prisma from '../db/prisma.js';

async function check() {
    const sample = await prisma.trendingCast.findMany({
        take: 50,
        select: { authorAvatar: true, authorUsername: true }
    });
    console.log('Sample Avatars from trending_casts:');
    sample.forEach(s => console.log(`${s.authorUsername}: ${s.authorAvatar}`));

    const vercelCount = await prisma.trendingCast.count({
        where: { authorAvatar: { contains: 'vercel.sh' } }
    });
    console.log(`\nCasts with vercel.sh avatars: ${vercelCount}`);

    const nullCount = await prisma.trendingCast.count({
        where: { authorAvatar: null }
    });
    console.log(`Casts with NULL avatars: ${nullCount}`);
}

check().catch(console.error);
