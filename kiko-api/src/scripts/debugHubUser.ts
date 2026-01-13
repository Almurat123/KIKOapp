
import { getUserDataByFid } from '../services/snapchainService.js';
import { env } from '../config/env.js';

const targetFids = [5774, 357897];

const HUB_URL = process.env.SNAPCHAIN_HUB_URL || 'https://hub.merv.fun';

async function fetchRaw(fid: number) {
    const url = `${HUB_URL}/v1/userDataByFid?fid=${fid}`;
    console.log(`Fetching RAW from ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
        console.log(`RAW failed: ${res.status}`);
        return;
    }
    const json = await res.json();
    console.log(`RAW Response for ${fid}:`, JSON.stringify(json, null, 2).slice(0, 500) + '...');
}

async function run() {
    console.log('--- Debug Hub User ---');
    for (const fid of targetFids) {
        console.log(`\nTesting FID: ${fid}`);
        await fetchRaw(fid);
        const processed = await getUserDataByFid(fid);
        console.log(`Processed Data for ${fid}:`, processed);
    }
    process.exit(0);
}

run();
