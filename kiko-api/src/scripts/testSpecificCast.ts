/**
 * Test embed author filling for specific cast with castId embed
 */
import { getUserDataByFid } from '../services/snapchainService.js';
import prisma from '../db/prisma.js';

async function test() {
    console.log('=== 直接测试有 castId embed 的帖子 ===\n');

    // Get the specific cast with castId embed
    const cast = await prisma.trendingCast.findFirst({
        where: { hash: { startsWith: '0xd0d38a19b1' } },
        select: { hash: true, embeds: true, authorUsername: true, text: true }
    });

    if (!cast) {
        console.log('Cast not found');
        return;
    }

    console.log(`Cast by @${cast.authorUsername}: "${cast.text.slice(0, 40)}..."`);
    console.log(`Embeds raw:`, JSON.stringify(cast.embeds, null, 2).slice(0, 500));

    const embeds = cast.embeds as any[];
    const castEmbed = embeds.find(e => e.castId);

    if (castEmbed) {
        console.log(`\ncastId.fid: ${castEmbed.castId.fid}`);

        // Test getUserDataByFid for this fid
        console.log('\n测试 getUserDataByFid...');
        const user = await getUserDataByFid(castEmbed.castId.fid);
        if (user) {
            console.log(`✅ 成功获取用户: @${user.username} (${user.displayName})`);
            console.log(`   pfp: ${user.pfp?.slice(0, 60)}...`);

            // Simulate the filling logic
            if (!castEmbed.cast) {
                castEmbed.cast = { text: '', embeds: [], mentions: [] };
            }
            castEmbed.cast.author = {
                fid: user.fid,
                username: user.username,
                displayName: user.displayName,
                avatar: user.pfp,
                verified: false
            };

            console.log(`\n模拟填充后的 embed.cast.author:`);
            console.log(JSON.stringify(castEmbed.cast.author, null, 2));
        } else {
            console.log(`❌ 获取用户失败`);
        }
    }
}

test()
    .catch(e => console.error('Error:', e))
    .finally(() => prisma.$disconnect());
