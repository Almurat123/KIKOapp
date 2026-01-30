/**
 * Test fetching embed cast data for @bfg's quote
 */
import { getCastById, getUserDataByFid } from '../services/snapchainService.js';

async function test() {
    const fid = 11244;
    const hash = '0xc4b8ca8b3d3e590683b4239bc006ac5dfea50289';

    console.log(`=== 测试获取 fid=${fid} 的数据 ===\n`);

    // Test getUserDataByFid
    console.log('1. getUserDataByFid...');
    try {
        const user = await getUserDataByFid(fid);
        if (user) {
            console.log(`   ✅ SUCCESS: @${user.username} (${user.displayName})`);
            console.log(`   pfp: ${user.pfp?.slice(0, 60)}...`);
        } else {
            console.log(`   ❌ FAILED: returned null`);
        }
    } catch (e: any) {
        console.log(`   ❌ ERROR: ${e.message}`);
    }

    // Test getCastById
    console.log('\n2. getCastById...');
    try {
        const cast = await getCastById(fid, hash);
        if (cast) {
            console.log(`   ✅ SUCCESS: "${cast.text?.slice(0, 60)}..."`);
        } else {
            console.log(`   ❌ FAILED: returned null`);
        }
    } catch (e: any) {
        console.log(`   ❌ ERROR: ${e.message}`);
    }
}

test().catch(e => console.error('Fatal error:', e.message));
