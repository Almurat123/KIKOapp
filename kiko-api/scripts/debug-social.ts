/**
 * Debug script to test social data fetching
 */
import 'dotenv/config';
import snapchainService from '../src/services/snapchainService.js';
import { getQualityFids } from '../src/repositories/qualityUsersRepository.js';

async function debug() {
    try {
        console.log('1. Testing quality FIDs...');
        const fids = await getQualityFids();
        console.log(`   Got ${fids.length} FIDs`);
        console.log(`   Sample FIDs: ${fids.slice(0, 5).join(', ')}`);

        if (fids.length === 0) {
            console.log('   ERROR: No quality FIDs found!');
            process.exit(1);
        }

        console.log('\n2. Testing Snapchain Hub info...');
        const hubUrl = process.env.SNAPCHAIN_HUB_URL || 'https://hub.merv.fun';
        console.log(`   Using Hub URL: ${hubUrl}`);

        // Test raw fetch first
        try {
            console.log('   Attempting raw fetch...');
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${hubUrl}/v1/info`, { signal: controller.signal });
            clearTimeout(id);
            console.log(`   Raw fetch status: ${res.status}`);
        } catch (e) {
            console.log('   Raw fetch failed:', e);
        }

        const info = await snapchainService.getHubInfo();
        console.log(`   Hub version: ${info.version}`);

        console.log('\n3. Testing getCastsByFid for first 3 FIDs...');
        for (const fid of fids.slice(0, 3)) {
            const casts = await snapchainService.getCastsByFid(fid, 5);
            console.log(`   FID ${fid}: ${casts.length} casts`);
        }

        console.log('\n4. Testing full fetch flow...');
        const results = await snapchainService.getTrendingFromQualityUsers(7, 1);
        console.log(`   Got ${results.length} trending casts`);

        if (results.length > 0) {
            console.log(`   Sample: @${results[0].user.username} - "${results[0].cast.text.substring(0, 50)}..."`);
        }

        console.log('\nDone!');
        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e);
        process.exit(1);
    }
}

debug();
