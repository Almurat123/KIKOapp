/**
 * Test embed author filling for @bfg cast specifically
 */
import { getTrendingCastsWithCursor } from '../repositories/socialRepository.js';
import prisma from '../db/prisma.js';

async function test() {
    console.log('=== 测试 @bfg 帖子的 embed author 填充 ===\n');

    // Get all casts (up to 200)
    const result = await getTrendingCastsWithCursor(200, 'trending', undefined, 'trending');

    console.log(`Total casts fetched: ${result.casts.length}\n`);

    // Find @bfg cast
    const bfgCasts = result.casts.filter(c => c.author.username === 'bfg');
    console.log(`Found ${bfgCasts.length} casts by @bfg\n`);

    for (const cast of bfgCasts) {
        console.log(`Cast: ${cast.hash.slice(0, 12)}... - "${cast.text.slice(0, 40)}..."`);

        if (cast.embeds && cast.embeds.length > 0) {
            for (const embed of cast.embeds as any[]) {
                if (embed.castId) {
                    console.log(`  → castId embed (fid=${embed.castId.fid})`);
                    if (embed.cast?.author) {
                        console.log(`    ✅ author: @${embed.cast.author.username} (${embed.cast.author.displayName})`);
                        console.log(`    avatar: ${embed.cast.author.avatar?.slice(0, 50)}...`);
                    } else {
                        console.log(`    ❌ author: MISSING`);
                    }
                }
            }
        }
        console.log('');
    }
}

test()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect());
