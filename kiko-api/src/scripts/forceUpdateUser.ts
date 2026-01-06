
import snapchainService from '../services/snapchainService.js';
import { saveTrendingCasts } from '../repositories/socialRepository.js';

async function main() {
    const fids = [3, 99]; // dwr, jessepollak

    for (const fid of fids) {
        console.log(`Doing force update for FID ${fid}...`);

        // 1. Fetch user data directly
        const userData = await snapchainService.getUserDataByFid(fid);
        console.log(`User ${fid} twitter: ${(userData as any).twitter}`);

        // 2. Fetch casts
        // Note: calling internal method or simulating job logic
        // We'll fetch 5 casts
        const hubCasts = await snapchainService.getCastsByFid(fid, 5);
        if (hubCasts.length === 0) {
            console.log(`No casts found for ${fid}`);
            continue;
        }

        // 3. Convert and inject social data manually to be sure
        const trendingCasts = hubCasts.map(hubCast => {
            // Mock the complex object expected by snapchainToTrendingCast
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
    }

    console.log('Done!');
    process.exit(0);
}

main();
