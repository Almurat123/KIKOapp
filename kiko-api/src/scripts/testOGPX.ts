import { ogpService } from '../services/ogpService.js';
import redis from '../cache/redis.js';

async function testX() {
    const url = 'https://x.com/VitalikButerin/status/1877640248560000000'; // Mocking a tweet
    console.log(`Testing OGP for X: ${url}`);

    // Bypass cache for testing
    await redis.del(`ogp:${url}`);

    try {
        const result = await ogpService.fetchOGP(url);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

testX();
