import snapchainService from '../src/services/snapchainService.js';
import { zoraService } from '../src/services/zoraService.js';

async function main() {
    // Jesse's FID
    const fid = 99;

    console.log(`Fetching user data for FID ${fid}...`);
    const userData = await snapchainService.getUserDataByFid(fid);

    console.log('Username:', userData.username);
    console.log('Verifications (Wallet Addresses):', userData.verifications);

    if (userData.verifications && userData.verifications.length > 0) {
        for (const address of userData.verifications) {
            if (!address.startsWith('0x')) {
                console.log(`Skipping non-EVM address: ${address}`);
                continue;
            }

            console.log(`\nChecking Creator Coin for wallet: ${address}`);
            const creatorCoin = await zoraService.getUserCreatorCoin(address);

            if (creatorCoin) {
                console.log('✅ Found Creator Coin!');
                console.log('  Name:', creatorCoin.name);
                console.log('  Symbol:', creatorCoin.symbol);
                console.log('  Type:', creatorCoin.coinType);
                console.log('  Market Cap:', creatorCoin.marketCap);
                break;
            } else {
                console.log('  No Creator Coin found for this address');
            }
        }
    } else {
        console.log('No verified wallet addresses found');
    }
}

main().catch(console.error);
