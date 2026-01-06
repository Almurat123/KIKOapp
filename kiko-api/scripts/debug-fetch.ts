import snapchainService from '../src/services/snapchainService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to find the file
function findRealHotUsersFile() {
    const candidates = [
        // 1. From scripts/ relative to kiko-api using ../../test (KiKo/test)
        path.resolve(__dirname, '../../test/Farcaste/real_hot_users.json'),
        // 2. From CWD (kiko-api) using ../test
        path.resolve(process.cwd(), '../test/Farcaste/real_hot_users.json'),
        // 3. Absolute catch-all (debug only, but useful)
        '/Users/almurat/KiKo/test/Farcaste/real_hot_users.json'
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            console.log(`Found file at: ${p}`);
            return p;
        }
        console.log(`Not found at: ${p}`);
    }
    return null;
}

const REAL_HOT_USERS_PATH = findRealHotUsersFile() || '';

async function main() {
    if (!REAL_HOT_USERS_PATH) {
        console.error("Could not find real_hot_users.json in candidate paths.");
        return;
    }

    // Load real hot users
    const fileContent = fs.readFileSync(REAL_HOT_USERS_PATH, 'utf-8');
    const realHotUsers = JSON.parse(fileContent);
    const totalFids = realHotUsers.length;
    console.log(`Total FIDs in file: ${totalFids}`);

    // Test with first 5 to correspond with previous behavior
    const fids = realHotUsers.map((u: any) => u.fid).slice(0, 5);

    console.log(`Testing with ${fids.length} FIDs:`, fids);

    const now = Date.now();
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 days

    let totalCasts = 0;
    let validCasts = 0;

    for (const fid of fids) {
        try {
            const casts = await snapchainService.getCastsByFid(fid, 10);
            console.log(`FID ${fid}: ${casts.length} raw casts`);
            totalCasts += casts.length;

            for (const cast of casts) {
                if (cast.parentCastId) continue; // Skip replies
                if (!cast.text || cast.text.length < 10) continue; // Skip short

                const castTime = snapchainService.farcasterToUnixTimestamp(cast.timestamp);
                const ageMs = now - castTime;

                if (ageMs <= maxAgeMs) {
                    validCasts++;
                    const reactions = await snapchainService.getReactionsByCast(fid, cast.hash);
                    console.log(`  Cast ${cast.hash.slice(0, 10)}: ${reactions.likes} likes, ${reactions.recasts} recasts, age=${Math.round(ageMs / 1000 / 60 / 60)}h`);
                }
            }
        } catch (e: any) {
            console.log(`FID ${fid}: ERROR - ${e.message}`);
        }
    }

    console.log(`\nSummary: ${totalCasts} total casts, ${validCasts} valid casts from ${fids.length} FIDs`);
}

main().catch(console.error);
