/**
 * Test getTrendingCastsWithCursor with embed author filling
 */
import { getTrendingCastsWithCursor } from '../repositories/socialRepository.js';

async function test() {
    console.log('=== 测试 API 返回的 embed author 填充 ===\n');

    const result = await getTrendingCastsWithCursor(30, 'trending', undefined, 'trending');

    console.log(`Total casts: ${result.casts.length}\n`);

    // Find casts with castId embeds
    let embedsWithAuthor = 0;
    let embedsWithoutAuthor = 0;

    for (const cast of result.casts) {
        if (!cast.embeds) continue;

        for (const embed of cast.embeds as any[]) {
            if (embed.castId) {
                if (embed.cast && embed.cast.author && embed.cast.author.username) {
                    embedsWithAuthor++;
                    console.log(`✅ @${cast.author.username} 的引用有 author: @${embed.cast.author.username}`);
                } else {
                    embedsWithoutAuthor++;
                    console.log(`❌ @${cast.author.username} 的引用缺少 author (fid=${embed.castId.fid})`);
                }
            }
        }
    }

    console.log(`\n=== 统计 ===`);
    console.log(`有 author: ${embedsWithAuthor}`);
    console.log(`缺少 author: ${embedsWithoutAuthor}`);
}

test().catch(e => console.error('Error:', e));
