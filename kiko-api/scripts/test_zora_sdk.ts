import { zoraService } from '../src/services/zoraService.js';

async function main() {
    console.log('🔍 Testing Zora SDK with getProfile...');

    // Test 1: Get User Profile
    const userWallet = '0x2211d1d0020daea8039e46cf1367962070d77da9';
    console.log(`\n--- Test 1: Get User Profile for ${userWallet} ---`);
    const profile = await zoraService.getUserProfile(userWallet);

    if (profile) {
        console.log('✅ Profile Found:');
        console.log('  Handle:', profile.handle);
        console.log('  Display Name:', profile.displayName);
        console.log('  Bio:', profile.bio?.substring(0, 50) + '...');
        if (profile.socialAccounts?.twitter) {
            console.log('  Twitter:', profile.socialAccounts.twitter.username);
        }
        if (profile.socialAccounts?.farcaster) {
            console.log('  Farcaster:', profile.socialAccounts.farcaster.username);
        }
        if (profile.creatorCoin) {
            console.log('  Creator Coin:', profile.creatorCoin.address);
            console.log('  Market Cap:', profile.creatorCoin.marketCap);
        }
    } else {
        console.error('❌ No profile found');
    }

    // Test 2: Get Creator Coin Details
    if (profile?.creatorCoin?.address) {
        console.log(`\n--- Test 2: Get Creator Coin Details ---`);
        const coin = await zoraService.getCoinByAddress(profile.creatorCoin.address);
        if (coin) {
            console.log('✅ Coin Details:');
            console.log('  Name:', coin.name);
            console.log('  Symbol:', coin.symbol);
            console.log('  Type:', coin.coinType);
            console.log('  Is Base App Coin:', coin.isBaseAppCoin);
        } else {
            console.error('❌ Failed to get coin details');
        }
    }
}

main().catch(console.error);
