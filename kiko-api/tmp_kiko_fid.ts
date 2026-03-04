import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const cache = await prisma.cache.findUnique({
        where: { key: 'fc:profile:kikoapp' }
    });
    if (cache) {
        console.log('Cache found:', cache.value);
    } else {
        console.log('Cache not found.');
        // Try to find any cast by kikoapp
        const cast = await prisma.trendingCast.findFirst({
            where: { authorUsername: 'kikoapp' }
        });
        if (cast) {
            console.log('Found cast by kikoapp, FID:', cast.fid);
        } else {
            console.log('No casts found for kikoapp');
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
