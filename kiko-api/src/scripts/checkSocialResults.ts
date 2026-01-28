
import prisma from '../db/prisma.js';

async function checkResults() {
    const updatedCount = await prisma.trendingCast.count({
        where: {
            statsLastUpdatedAt: { gt: new Date(Date.now() - 10 * 60 * 1000) }
        }
    });

    const recalcCount = await prisma.trendingCast.count({
        where: {
            heatScore: { not: null }
        }
    });

    console.log(`✅ Casts with refreshed stats in last 10m: ${updatedCount}`);
    console.log(`✅ Casts with heat score calculated: ${recalcCount}`);

    // Show a sample
    const sample = await prisma.trendingCast.findFirst({
        where: { statsLastUpdatedAt: { not: null } },
        select: { hash: true, statsLastUpdatedAt: true, likes: true, heatScore: true }
    });
    console.log('Sample updated cast:', sample);
}

checkResults().finally(() => prisma.$disconnect());
