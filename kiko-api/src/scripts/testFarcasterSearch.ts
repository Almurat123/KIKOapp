/**
 * Test Farcaster search with new sortBy parameter
 */
import { searchCastsNeynar } from '../services/neynarService.js';

async function testSearch() {
    console.log('\n=== FARCASTER SEARCH TEST ===\n');

    const query = 'crypto';

    // Test 1: Algorithmic sort (default)
    console.log('1. Testing algorithmic sort (engagement-based)...');
    const algorithmicResults = await searchCastsNeynar(query, 5, 'literal', 'algorithmic');
    console.log(`   Found: ${algorithmicResults.length} casts`);
    if (algorithmicResults.length > 0) {
        console.log(`   Top result: ${algorithmicResults[0].text?.substring(0, 60)}...`);
    }

    // Test 2: Recent sort (chronological)
    console.log('\n2. Testing recent sort (newest first)...');
    const recentResults = await searchCastsNeynar(query, 5, 'literal', 'recent');
    console.log(`   Found: ${recentResults.length} casts`);
    if (recentResults.length > 0) {
        console.log(`   Newest: ${recentResults[0].text?.substring(0, 60)}...`);
    }

    console.log('\n=== SEARCH TEST COMPLETE ===\n');
    process.exit(0);
}

testSearch().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
