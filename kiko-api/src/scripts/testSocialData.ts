import { refreshTrendingCasts } from '../jobs/socialDataJob.js';
import { env } from '../config/env.js';

async function testSocialData() {
    console.log('--- Social Data Connectivity Test ---');
    console.log(`Node Env: ${env.nodeEnv}`);

    try {
        console.log('Starting social data refresh...');
        await refreshTrendingCasts(true);
        console.log('Social data refresh completed successfully.');
    } catch (error) {
        console.error('Test failed with error:', error);
        process.exit(1);
    }
}

testSocialData()
    .then(() => {
        console.log('--- Test Finished ---');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Unhandled error:', err);
        process.exit(1);
    });
