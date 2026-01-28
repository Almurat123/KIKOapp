
import { getUserDataByFid } from '../services/snapchainService.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

async function test() {
    const fids = [1, 2, 3, 194, 12108]; // Founders + Vitalik + Random
    console.log('--- Testing Snapchain Hub User Data ---');

    for (const fid of fids) {
        console.log(`\nFetching FID: ${fid}...`);
        try {
            const data = await getUserDataByFid(fid);
            console.log(`Result for ${fid}:`, JSON.stringify(data, null, 2));

            if (!data?.pfp) {
                console.warn(`[WARNING] No PFP found for FID ${fid}`);
            } else {
                console.log(`[SUCCESS] PFP found: ${data.pfp}`);
            }
        } catch (error: any) {
            console.error(`Error for ${fid}:`, error.message);
        }
    }
}

test().catch(console.error);
