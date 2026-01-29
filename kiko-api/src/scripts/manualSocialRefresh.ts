/**
 * Manual Social Data Refresh Test
 * Triggers runDiscoveryJob to test Hub connectivity
 */
import { runDiscoveryJob } from '../jobs/socialDataJob.js';

async function main() {
    console.log('\n=== MANUAL SOCIAL REFRESH TEST ===\n');
    console.log('Triggering runDiscoveryJob(force=true)...\n');

    try {
        await runDiscoveryJob(true);
        console.log('\n✅ Social refresh completed successfully!');
    } catch (err: any) {
        console.error('\n❌ Social refresh failed:', err.message);
        console.error(err.stack);
    }

    console.log('\n=== TEST COMPLETE ===\n');
    process.exit(0);
}

main();
