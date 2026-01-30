
import { ogpService } from '../services/ogpService.js';
import redis from '../cache/redis.js';

async function testVideo() {
    const url = 'https://media.firefly.land/post_m3u8/60aed4cc-eb6b-4f82-853d-2aba545e9a70/60aed4cc-eb6b-4f82-853d-2aba545e9a70.m3u8';
    console.log(`Testing OGP for Video Stream: ${url}\n`);

    // Bypass cache
    await redis.del(`ogp:${url}`);

    try {
        const result = await ogpService.fetchOGP(url);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}

testVideo();
