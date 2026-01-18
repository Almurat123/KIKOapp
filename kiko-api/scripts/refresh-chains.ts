/**
 * Manual Chain Data Refresh Script
 * Usage: npx tsx scripts/refresh-chains.ts
 */

import { refreshChainsData } from '../src/jobs/marketDataJob.js';

async function main() {
    console.log('🔄 Starting manual chain data refresh...\n');

    try {
        await refreshChainsData(true); // Force refresh
        console.log('\n✅ Chain data refresh completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Chain data refresh failed:', error);
        process.exit(1);
    }
}

main();
