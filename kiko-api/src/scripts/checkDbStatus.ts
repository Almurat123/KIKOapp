import { prisma } from '../db/prisma.js';

async function main() {
    const args = process.argv.slice(2);
    const fid = args[0] ? parseInt(args[0]) : 8;

    console.log(`Checking Database for FID: ${fid}...`);

    try {
        // 1. Check Quality Users Table
        const user = await prisma.qualityFarcasterUser.findUnique({
            where: { fid }
        });

        if (user) {
            console.log('\n[quality_farcaster_users]');
            console.table(user);
        } else {
            console.log('\n[quality_farcaster_users] User not found.');
        }

        // 2. Check Trending Casts Table (Recent casts by this user)
        const casts = await prisma.trendingCast.findMany({
            where: { fid },
            orderBy: { timestamp: 'desc' },
            take: 3
        });

        if (casts.length > 0) {
            console.log(`\n[trending_casts] Found ${casts.length} recent casts:`);
            casts.forEach((row, i) => {
                console.log(`\n--- Cast ${i + 1} (${row.hash.substring(0, 10)}...) ---`);
                console.log(`isBaseAppCoin: ${row.isBaseAppCoin}`);
                console.log(`coinValue: ${row.coinValue}`);
                console.log('authorCreatorCoin:', row.authorCreatorCoin ? JSON.stringify(row.authorCreatorCoin, null, 2) : 'NULL');
            });
        } else {
            console.log('\n[trending_casts] No casts found for this user.');
        }

    } catch (error) {
        console.error('Database Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
