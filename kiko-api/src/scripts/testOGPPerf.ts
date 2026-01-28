
import { ogpService } from '../services/ogpService.js';

async function runBenchmark() {
    console.log('🚀 Starting OGP Performance Benchmark...');

    const testUrl = 'https://warpcast.com/dwr/0x123'; // Example URL that might need scraping
    // Using a real URL that is likely to trigger fallback or at least http fetch
    const realUrl = 'https://www.coinbase.com/price/ethereum';

    console.log(`\nTesting URL: ${realUrl}`);

    // Test 1: Cold Cache (First Load)
    const start1 = performance.now();
    const result1 = await ogpService.fetchOGP(realUrl);
    const end1 = performance.now();
    console.log(`\n[Load 1 - Cold Cache]: ${(end1 - start1).toFixed(2)}ms`);
    console.log('Result:', result1?.title ? '✅ Found Title' : '❌ No Title');

    // Test 2: Warm Cache (Second Load)
    const start2 = performance.now();
    const result2 = await ogpService.fetchOGP(realUrl);
    const end2 = performance.now();
    console.log(`\n[Load 2 - Warm Cache]: ${(end2 - start2).toFixed(2)}ms`);

    if ((end2 - start2) < 10) {
        console.log('✅ Generic Cache Speed Achieved (<10ms)');
    } else {
        console.log('⚠️ Cache might not be working as expected');
    }

    console.log('\nDone.');
    process.exit(0);
}

runBenchmark();
