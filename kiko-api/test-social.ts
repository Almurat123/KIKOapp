
import { getTrendingCasts } from './src/services/snapchainService.js';
import { QUALITY_FIDS } from './src/services/snapchainService.js';

async function test() {
    console.log('Testing Snapchain Service...');

    try {
        // Test 1: Info
        console.log('Checking Hub Info...');
        // We can't easily import getHubInfo cleanly without mocking fetch if not exported, 
        // but let's try calling getTrendingCasts directly.

        console.log(`Quality FIDs count: ${QUALITY_FIDS.length}`);

        // Test fetching casts for first quality user
        console.log(`Fetching casts for FID ${QUALITY_FIDS[0]}...`);

        // We need to invoke the internal logic or just use getTrendingCasts
        // But getTrendingCasts iterates 1-100.
        // Let's use getTrendingFromQualityUsers if exported, but it is not default exported in the same way.
        // Actually it IS exported.

        const { getTrendingFromQualityUsers } = await import('./src/services/snapchainService.js');

        const results = await getTrendingFromQualityUsers(14, 1);
        console.log(`Got ${results.length} trending casts from quality users.`);

        if (results.length > 0) {
            console.log('Top cast:', {
                hash: results[0].cast.hash,
                text: results[0].cast.text,
                score: results[0].score,
                timestamp: new Date((results[0].cast.timestamp) * 1000 + 1609459200000).toISOString()
            });
        }

    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
