/**
 * Run heat score recalculation and verify results
 */
import prisma from '../db/prisma.js';
import { recalculateHeatScores } from '../repositories/socialRepository.js';

async function main() {
    console.log('=== 运行热度分数重新计算 ===\n');

    // Before stats
    const beforeSample = await prisma.trendingCast.findFirst({
        where: { likes: { gt: 20 } },
        orderBy: { likes: 'desc' },
        select: { hash: true, likes: true, heatScore: true, timestamp: true }
    });
    console.log('Before recalc (高赞帖子样本):');
    if (beforeSample) {
        console.log(`  hash: ${beforeSample.hash.slice(0, 12)}...`);
        console.log(`  likes: ${beforeSample.likes}`);
        console.log(`  heatScore: ${Number(beforeSample.heatScore).toFixed(4)}`);
    }

    // Run recalculation
    console.log('\n正在重新计算...');
    await recalculateHeatScores();

    // After stats
    const afterSample = await prisma.trendingCast.findFirst({
        where: { hash: beforeSample?.hash },
        select: { hash: true, likes: true, heatScore: true }
    });
    console.log('\nAfter recalc:');
    if (afterSample) {
        console.log(`  likes: ${afterSample.likes}`);
        console.log(`  heatScore: ${Number(afterSample.heatScore).toFixed(4)}`);
        console.log(`  预期最低分(likes*0.1): ${afterSample.likes * 0.1}`);
    }

    // Top 5 by heat score
    console.log('\n=== TOP 5 BY HEAT SCORE ===');
    const top5 = await prisma.trendingCast.findMany({
        orderBy: { heatScore: 'desc' },
        take: 5,
        select: { hash: true, likes: true, recasts: true, heatScore: true, timestamp: true }
    });
    top5.forEach((c, i) => {
        console.log(`${i + 1}. heat=${Number(c.heatScore).toFixed(2)}, likes=${c.likes}, recasts=${c.recasts}, hash=${c.hash.slice(0, 12)}...`);
    });

    // Top 5 by likes (for comparison)
    console.log('\n=== TOP 5 BY LIKES (对比) ===');
    const top5Likes = await prisma.trendingCast.findMany({
        orderBy: { likes: 'desc' },
        take: 5,
        select: { hash: true, likes: true, heatScore: true }
    });
    top5Likes.forEach((c, i) => {
        console.log(`${i + 1}. likes=${c.likes}, heat=${Number(c.heatScore).toFixed(2)}, hash=${c.hash.slice(0, 12)}...`);
    });

    console.log('\n✅ 验证完成!');
}

main()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect());
