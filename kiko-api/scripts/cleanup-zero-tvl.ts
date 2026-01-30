import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupZeroTVLChains() {
    try {
        const result = await prisma.chainMetric.deleteMany({
            where: {
                tvl: 0
            }
        });

        console.log(`✅ Deleted ${result.count} chains with TVL = 0`);
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupZeroTVLChains();
