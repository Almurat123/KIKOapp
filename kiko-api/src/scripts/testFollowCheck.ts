/**
 * Test script for Farcaster follow check functionality
 * Run with: npx tsx src/scripts/testFollowCheck.ts
 */
import 'dotenv/config';

const NEYNAR_API_BASE = 'https://api.neynar.com/v2';

async function testFollowCheck() {
    const apiKey = process.env.NEYNAR_API_KEY;

    if (!apiKey) {
        console.error('❌ NEYNAR_API_KEY not set');
        return;
    }

    console.log('🔍 Testing Farcaster Follow Check Logic\n');

    // Step 1: Get Kiko's FID
    console.log('1️⃣ Fetching Kiko profile...');
    const profileUrl = new URL(`${NEYNAR_API_BASE}/farcaster/user/by_username`);
    profileUrl.searchParams.set('username', 'kikoapp');

    const profileRes = await fetch(profileUrl.toString(), {
        headers: { 'x-api-key': apiKey }
    });

    if (!profileRes.ok) {
        console.error('❌ Failed to fetch Kiko profile:', await profileRes.text());
        return;
    }

    const profileData = await profileRes.json();
    const kikoFid = profileData.user?.fid;
    console.log(`   ✅ Kiko FID: ${kikoFid}`);
    console.log(`   Username: @${profileData.user?.username}`);
    console.log(`   Followers: ${profileData.user?.follower_count}\n`);

    // Step 2: Test with a known FID (use your own FID for testing)
    // You can find your FID at https://warpcast.com/~/developers
    const testViewerFid = 8152; // Replace with an actual FID for testing

    console.log(`2️⃣ Checking if FID ${testViewerFid} follows Kiko (FID ${kikoFid})...`);

    const checkUrl = new URL(`${NEYNAR_API_BASE}/farcaster/user/bulk`);
    checkUrl.searchParams.set('fids', String(kikoFid));
    checkUrl.searchParams.set('viewer_fid', String(testViewerFid));

    const checkRes = await fetch(checkUrl.toString(), {
        headers: { 'x-api-key': apiKey }
    });

    if (!checkRes.ok) {
        console.error('❌ Failed to check follow status:', await checkRes.text());
        return;
    }

    const checkData = await checkRes.json();
    const user = checkData.users?.[0];

    console.log('\n📦 Raw API Response (viewer_context):');
    console.log(JSON.stringify(user?.viewer_context, null, 2));

    const isFollowing = !!user?.viewer_context?.following;
    console.log(`\n🎯 Result: FID ${testViewerFid} ${isFollowing ? '✅ FOLLOWS' : '❌ DOES NOT FOLLOW'} @kikoapp`);

    // Step 3: Test our API endpoint
    console.log('\n3️⃣ Testing local API endpoint...');
    console.log('   Run the following curl command to test:');
    console.log(`   curl http://localhost:3000/api/social/is-following/${testViewerFid}`);
}

testFollowCheck().catch(console.error);
