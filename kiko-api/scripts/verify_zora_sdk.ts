
import { zoraService } from '../src/services/zoraService.js';

async function main() {
    console.log('🔍 Starting Zora SDK Verification...');

    // Test 1: Content Coin (Post Coin)
    // Using Jesse's coin address as a mock "Post Coin" in an embed
    const mockCast = {
        hash: '0xmock',
        embeds: [
            { url: 'https://zora.co/collect/base:0x14349fa76e50d7861589884532e22e61754cc1fd' }
        ]
    };

    console.log('\n--- Test 1: Check Cast For Coin (Post Coin) ---');
    const postCoinResult = await zoraService.checkCastForCoin(mockCast);
    console.log('Result:', JSON.stringify(postCoinResult, null, 2));

    if (postCoinResult.isPostCoin && postCoinResult.metadata?.coinType) {
        console.log(`✅ Identified Coin Type: ${postCoinResult.metadata.coinType}`);
        console.log(`✅ Hook Address: ${postCoinResult.metadata.metadata?.uniswapV4PoolKey?.hookAddress}`); // SDK returns this nested in metadata usually? Wait, my interface has it flattened?
        // Ah, in my ZoraService I mapped the SDK response to my ZoraCoin interface.
        // I didn't expose hookAddress in ZoraCoin interface, but I used it for classification.
    } else {
        console.error('❌ Failed to identify Post Coin');
    }

    // Test 2: Creator Coin
    // Jesse's Wallet Address: 0x2211d1d0020daea8039e46cf1367962070d77da9
    console.log('\n--- Test 2: Get User Creator Coin ---');
    const userWallet = '0x2211d1d0020daea8039e46cf1367962070d77da9';
    const creatorCoin = await zoraService.getUserCreatorCoin(userWallet);

    if (creatorCoin) {
        console.log('✅ Found Creator Coin:', creatorCoin.name, `(${creatorCoin.symbol})`);
        console.log('Coin Type:', creatorCoin.coinType);

        if (creatorCoin.creatorProfile?.socialAccounts) {
            console.log('✅ Social Accounts Found:', JSON.stringify(creatorCoin.creatorProfile.socialAccounts, null, 2));
        } else {
            console.warn('⚠️ No social accounts found in Creator Coin profile');
        }
    } else {
        console.error('❌ Failed to find Creator Coin for user');
    }
}

main().catch(console.error);
