/**
 * Check specific user's casts for embed issues
 */
import prisma from '../db/prisma.js';

async function checkSpecificEmbeds() {
    // Find casts with castId embeds (quotes/recasts)
    const castsWithCastEmbeds = await prisma.trendingCast.findMany({
        where: {
            OR: [
                { authorUsername: { contains: 'keccers' } },
                { authorUsername: { contains: 'bfg' } },
                { authorUsername: { equals: 'bfg' } },
            ]
        },
        take: 10,
        select: { hash: true, embeds: true, authorUsername: true, updatedAt: true }
    });

    console.log(`=== 检查用户截图中的帖子 ===`);
    console.log(`Found ${castsWithCastEmbeds.length} casts\n`);

    // Also check for ANY casts with castId embeds that are missing author
    const allCastsWithEmbeds = await prisma.trendingCast.findMany({
        where: {
            embeds: { not: { equals: [] } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { hash: true, embeds: true, authorUsername: true, updatedAt: true }
    });

    console.log(`\n=== 最近更新的20个带embeds的帖子 ===`);
    let missingAuthorCount = 0;
    let hasAuthorCount = 0;

    allCastsWithEmbeds.forEach((c, i) => {
        const embeds = c.embeds as any[];
        const castEmbeds = embeds.filter(e => e.castId);

        if (castEmbeds.length > 0) {
            console.log(`\n${i + 1}. @${c.authorUsername} (updated: ${c.updatedAt.toISOString().slice(0, 16)})`);
            castEmbeds.forEach((e, j) => {
                const hasCastAuthor = !!(e.cast && e.cast.author && e.cast.author.username);
                if (hasCastAuthor) {
                    hasAuthorCount++;
                    console.log(`   ✅ castId embed has author: @${e.cast.author.username}`);
                } else {
                    missingAuthorCount++;
                    console.log(`   ❌ castId embed MISSING author! castId.fid=${e.castId?.fid}`);
                    console.log(`      embed.cast = ${JSON.stringify(e.cast || 'undefined').slice(0, 100)}...`);
                }
            });
        }
    });

    console.log(`\n=== 统计 ===`);
    console.log(`有 author: ${hasAuthorCount}, 缺失 author: ${missingAuthorCount}`);
}

checkSpecificEmbeds().finally(() => prisma.$disconnect());
