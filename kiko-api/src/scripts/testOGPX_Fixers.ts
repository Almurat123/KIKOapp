import { ogpService } from '../services/ogpService.js';
import redis from '../cache/cacheClient.js';

async function testXComparisons() {
    const tweetUrl = 'https://x.com/VitalikButerin/status/1877640248560000000';
    console.log(`Testing OGP for X (Multiple Fixers): ${tweetUrl}\n`);

    const variants = [
        { name: 'Original', url: tweetUrl },
        { name: 'FxTwitter', url: tweetUrl.replace('x.com', 'fxtwitter.com') },
        { name: 'VxTwitter', url: tweetUrl.replace('x.com', 'vxtwitter.com') }
    ];

    for (const v of variants) {
        console.log(`--- Testing ${v.name} ---`);
        // Bypass cache
        await redis.del(`ogp:${v.url}`);

        try {
            const result = await ogpService.fetchOGP(v.url);
            console.log('Result:', JSON.stringify(result, null, 2));
        } catch (err) {
            console.error('Error:', err);
        }
        console.log('\n');
    }
    process.exit(0);
}

testXComparisons();
