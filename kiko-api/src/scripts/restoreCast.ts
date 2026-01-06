
import { getCastByIdWithReactions } from '../services/snapchainService.js';
import { zoraService } from '../services/zoraService.js';
import { saveTrendingCasts } from '../repositories/socialRepository.js';

async function restoreCast() {
    const FID = 99;
    const HASH = '0xcd8828a7ee002974d0975eff6e1c3d4620828827';

    console.log(`Trying to restore cast ${HASH} by FID ${FID}...`);

    try {
        const result = await getCastByIdWithReactions(FID, HASH);
        if (!result) {
            console.error('❌ Cast not found in Hub!');
            process.exit(1);
        }

        const cast = result.cast as any;
        cast.author = result.user;
        cast.stats = result.reactions;

        // Manual overrides
        cast.stats.likes = Math.max(cast.stats.likes, 314); // Restore original like count if missing
        cast.stats.recasts = Math.max(cast.stats.recasts, 70);
        cast.stats.replies = Math.max(cast.stats.replies, 116);

        console.log(`✅ Fetched cast: ${cast.text.substring(0, 50)}...`);

        // Check for Coin
        const coinResult = await zoraService.checkCastForCoin(cast);
        if (coinResult.isPostCoin) {
            console.log('💎 Detected as Post Coin!');
            cast.isBaseAppCoin = true;
            cast.baseAppCoinMetadata = coinResult.metadata;
            cast.coinValue = coinResult.coinValue;
        } else {
            console.log('⚠️ Not detected as Post Coin (Unexpected)');
        }

        // Save to DB
        await saveTrendingCasts([cast]);
        console.log('💾 Saved to database!');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

restoreCast();
