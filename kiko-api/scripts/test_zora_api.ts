/**
 * Test script to verify Zora API integration
 */
import { zoraService } from '../src/services/zoraService';
import 'dotenv/config';

async function main() {
    console.log('Testing Zora API...\n');

    // Test 1: Get trending post coins
    console.log('1. Fetching trending post coins...');
    const trendingCoins = await zoraService.getTrendingPostCoins(10);
    console.log(`   Found ${trendingCoins.length} trending coins:`);
    trendingCoins.slice(0, 5).forEach((coin, i) => {
        console.log(`   ${i + 1}. ${coin.name} (${coin.symbol})`);
        console.log(`      Address: ${coin.address}`);
        console.log(`      Market Cap: ${zoraService.formatMarketCap(coin.marketCap)}`);
        console.log(`      Creator: ${coin.creatorProfile?.handle || coin.creatorAddress || 'Unknown'}`);
        if (coin.creatorProfile?.socialAccounts?.farcaster?.username) {
            console.log(`      Farcaster: @${coin.creatorProfile.socialAccounts.farcaster.username}`);
        }
        console.log('');
    });

    // Test 2: Check if a specific user has coins
    if (trendingCoins.length > 0 && trendingCoins[0].creatorProfile?.handle) {
        const testUser = trendingCoins[0].creatorProfile.handle;
        console.log(`2. Checking coins for user: ${testUser}...`);
        const userCoinCheck = await zoraService.checkUserHasCoin(testUser);
        console.log(`   Has coin: ${userCoinCheck.isPostCoin}`);
        if (userCoinCheck.isPostCoin) {
            console.log(`   Coin Value: ${userCoinCheck.coinValue}`);
            console.log(`   Coin Address: ${userCoinCheck.coinAddress}`);
        }
    }

    console.log('\nZora API test complete!');
}

main().catch(console.error);
