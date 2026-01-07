
import snapchainService from '../services/snapchainService.js';
import { saveTrendingCasts } from '../repositories/socialRepository.js';

async function main() {
    const args = process.argv.slice(2);
    const fids = args.length > 0 ? args.map(arg => parseInt(arg)).filter(fid => !isNaN(fid)) : [3, 99]; // Default to dwr, jessepollak if no args

    if (fids.length === 0) {
        console.error('Please provide valid FIDs as arguments.');
        process.exit(1);
    }

    for (const fid of fids) {
        console.log(`Doing force update for FID ${fid}...`);

        try {
            // 1. Fetch user data directly
            const userData = await snapchainService.getUserDataByFid(fid);
            if (!userData) {
                console.log(`User ${fid} not found.`);
                continue;
            }
            console.log(`User ${fid} username: ${userData.username}, twitter: ${(userData as any).twitter}`);

            // 2. Fetch casts
            const hubCasts = await snapchainService.getCastsByFid(fid, 5);
            if (hubCasts.length === 0) {
                console.log(`No casts found for ${fid}`);
                continue;
            }

            // 3. Convert and inject social data manually
            const trendingCasts = hubCasts.map(hubCast => {
                const castWithReactions = {
                    cast: hubCast,
                    user: userData,
                    reactions: { likes: 0, recasts: 0, replies: 0 },
                    score: 999.99
                };

                const converted = snapchainService.snapchainToTrendingCast(castWithReactions as any);
                // MANUALLY INJECT SOCIAL DATA from the fresh fetch
                converted.author.twitter = (userData as any).twitter;
                (converted.author as any).github = (userData as any).github;
                (converted.author as any).url = (userData as any).url;
                return converted;
            });

            // 4. Save
            await saveTrendingCasts(trendingCasts);
            console.log(`Saved ${trendingCasts.length} casts for ${fid} with twitter=${(userData as any).twitter}`);
        } catch (error) {
            console.error(`Error processing FID ${fid}:`, error);
        }
    }

    console.log('Done!');
    process.exit(0);
}

main();
