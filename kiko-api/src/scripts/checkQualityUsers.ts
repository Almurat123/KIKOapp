
import prisma from '../db/prisma.js';

async function check() {
    const total = await prisma.qualityFarcasterUser.count();
    const mockPfp = await prisma.qualityFarcasterUser.count({
        where: { pfp: { contains: 'vercel.sh' } }
    });
    const nullPfp = await prisma.qualityFarcasterUser.count({
        where: { pfp: null }
    });

    console.log(`--- QualityFarcasterUser Stats ---`);
    console.log(`Total users: ${total}`);
    console.log(`Users with vercel.sh placeholders: ${mockPfp}`);
    console.log(`Users with NULL PFPs: ${nullPfp}`);

    if (mockPfp > 0 || nullPfp > 0) {
        console.log('\nSample records needing fix:');
        const samples = await prisma.qualityFarcasterUser.findMany({
            where: {
                OR: [
                    { pfp: { contains: 'vercel.sh' } },
                    { pfp: null }
                ]
            },
            take: 10,
            select: { fid: true, username: true, pfp: true }
        });
        samples.forEach(s => console.log(`FID ${s.fid} (${s.username}): ${s.pfp}`));
    }
}

check().catch(console.error);
