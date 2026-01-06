
import snapchainService from '../src/services/snapchainService.js';
import { zoraService } from '../src/services/zoraService.js';

async function testSingleUser(fid: number) {
    try {
        console.log(`Fetching data for FID: ${fid}...`);
        const userData = await snapchainService.getUserDataByFid(fid);

        console.log('User Data:', {
            username: userData.username,
            displayName: userData.displayName,
            verificationsCount: userData.verifications?.length || 0
        });

        if (userData.verifications && userData.verifications.length > 0) {
            console.log('Verifications:', userData.verifications);

            for (const address of userData.verifications) {
                if (!address.startsWith('0x')) {
                    console.log(`Skipping non-EVM address: ${address}`);
                    continue;
                }

                console.log(`Checking Zora Creator Coin for address: ${address}...`);
                const coin = await zoraService.getUserCreatorCoin(address);

                if (coin) {
                    console.log('✅ Found Creator Coin!');
                    console.log(JSON.stringify(coin, null, 2));
                    break;
                } else {
                    console.log('❌ No Creator Coin found for this address.');
                }
            }
        } else {
            console.log('❌ User has no verified addresses.');
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        process.exit(0);
    }
}

// Test with dwr.eth (FID 3) or Vitalik (FID 5650 or verify logic)
testSingleUser(3); 
