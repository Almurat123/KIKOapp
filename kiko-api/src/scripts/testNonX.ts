
import { ogpService } from '../services/ogpService.js';
import redis from '../cache/cacheClient.js';

async function testNonX() {
    const url = 'https://qrcoin.fun';
    console.log(`Testing OGP for Non-X: ${url}\n`);

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

testNonX();
