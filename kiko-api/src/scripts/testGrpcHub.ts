/**
 * Test gRPC Hub connectivity
 * Compare with HTTP API to verify rate limits
 */
import * as grpcService from '../services/snapchainGrpcService.js';

async function testGrpc() {
    console.log('\n=== gRPC HUB TEST ===\n');

    // Test 1: Get casts for a known FID (dwr = 3)
    console.log('1. Testing getCastsByFidGrpc (fid=3, dwr)...');
    const casts = await grpcService.getCastsByFidGrpc(3, 5);
    console.log(`   Result: ${casts.length} casts`);
    if (casts.length > 0) {
        console.log(`   Latest: ${casts[0].text?.substring(0, 50)}...`);
    }

    // Test 2: Get user data
    console.log('\n2. Testing getUserDataByFidGrpc (fid=3)...');
    const userData = await grpcService.getUserDataByFidGrpc(3);
    if (userData) {
        console.log(`   Username: ${userData.username}`);
        console.log(`   Display: ${userData.displayName}`);
    } else {
        console.log('   No user data found');
    }

    // Test 3: Rate limit test - fetch 10 users quickly
    console.log('\n3. Rate limit test - fetching 10 users quickly...');
    const testFids = [1, 2, 3, 4, 5, 8, 20, 99, 194, 303];
    let successCount = 0;
    let failCount = 0;

    const startTime = Date.now();
    for (const fid of testFids) {
        const result = await grpcService.getCastsByFidGrpc(fid, 3);
        if (result.length > 0) {
            successCount++;
        } else {
            failCount++;
        }
    }
    const elapsed = Date.now() - startTime;

    console.log(`   Success: ${successCount}/${testFids.length}`);
    console.log(`   Failed: ${failCount}/${testFids.length}`);
    console.log(`   Time: ${elapsed}ms`);

    // Cleanup
    grpcService.closeHubClient();

    console.log('\n=== TEST COMPLETE ===\n');
    process.exit(0);
}

testGrpc().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
