/**
 * Reset corrupted social data in production database
 * Run with: DATABASE_URL="postgresql://..." npx tsx src/scripts/resetSocialData.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('=== Social Data Health Check ===\n');

    // 1. Count total casts
    const totalCasts = await prisma.trendingCast.count();
    console.log(`Total casts: ${totalCasts}`);

    // 2. Count corrupted casts (username null or starts with 'fid')
    const corruptedCasts = await prisma.trendingCast.count({
        where: {
            OR: [
                { username: null },
                { username: '' },
                { username: { startsWith: 'fid' } },
                { username: { startsWith: 'User ' } }
            ]
        }
    });
    console.log(`Corrupted casts (bad username): ${corruptedCasts}`);

    // 3. Count casts with missing avatar
    const noAvatarCasts = await prisma.trendingCast.count({
        where: {
            OR: [
                { avatar: null },
                { avatar: '' },
                { avatar: { contains: 'placeholder' } },
                { avatar: { contains: 'placehold.co' } }
            ]
        }
    });
    console.log(`Casts with missing/placeholder avatar: ${noAvatarCasts}`);

    // 4. Show sample of recent casts
    console.log('\n=== Recent Casts Sample ===');
    const recentCasts = await prisma.trendingCast.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        select: {
            hash: true,
            username: true,
            displayName: true,
            avatar: true,
            timestamp: true,
            text: true
        }
    });

    recentCasts.forEach((cast, i) => {
        console.log(`${i + 1}. @${cast.username || 'NULL'} (${cast.displayName || 'NULL'})`);
        console.log(`   Avatar: ${cast.avatar ? cast.avatar.substring(0, 50) + '...' : 'NULL'}`);
        console.log(`   Time: ${cast.timestamp}`);
        console.log(`   Text: ${cast.text?.substring(0, 50) || 'N/A'}...`);
        console.log('');
    });

    // 5. Ask for confirmation before deleting
    const args = process.argv.slice(2);
    if (args.includes('--reset')) {
        console.log('\n=== RESETTING CORRUPTED DATA ===');

        // Delete all corrupted casts
        const deleted = await prisma.trendingCast.deleteMany({
            where: {
                OR: [
                    { username: null },
                    { username: '' },
                    { username: { startsWith: 'fid' } },
                    { username: { startsWith: 'User ' } }
                ]
            }
        });
        console.log(`Deleted ${deleted.count} corrupted casts`);

        // Optionally clear all and let job refresh
        if (args.includes('--all')) {
            const deletedAll = await prisma.trendingCast.deleteMany({});
            console.log(`Deleted ALL ${deletedAll.count} casts - fresh start`);
        }
    } else {
        console.log('\nTo reset corrupted data, run with --reset flag');
        console.log('To clear ALL data, run with --reset --all flag');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
