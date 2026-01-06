
import { zoraService } from '../services/zoraService.js';
import snapchainService from '../services/snapchainService.js';

async function main() {
    const args = process.argv.slice(2);
    const identifier = args[0];

    if (!identifier) {
        console.error('Please provide a username or FID');
        process.exit(1);
    }

    console.log(`Checking Zora coin for: ${identifier}`);

    let addresses: string[] = [];
    let fid: number | null = null;

    // 1. Resolve FID and Addresses
    if (!isNaN(Number(identifier))) {
        fid = Number(identifier);
        const user = await snapchainService.getUserDataByFid(fid);
        if (user) {
            console.log(`Found user: ${user.username} (${user.displayName})`);
            addresses = user.verifications || [];
        }
    } else {
        // Assume username
        // Note: Snapchain doesn't have a direct getByUsername exposed easily in service, 
        // but we can try to find via cached/mock if needed, or just warn.
        console.log('Fetching user by username is not directly supported in this script yet, please use FID.');
        // Try to find if we can resolve it manually or via another tool...
        // For now, let's just ask the user for FID if username fails.
        // Actually, let's try to assume the user meant to pass FID for now.
        process.exit(1);
    }

    if (addresses.length === 0) {
        console.log('No verified addresses found for this user.');
        process.exit(0);
    }

    console.log(`Found ${addresses.length} verification addresses:`, addresses);

    // 2. Check Zora Service for each address
    for (const address of addresses) {
        console.log(`\nChecking address: ${address}`);
        try {
            // Check full profile first
            console.log('  Fetching Zora Profile...');
            const profile = await zoraService.getUserProfile(address);
            if (profile) {
                console.log('  ✅ Found Zora Profile');
                if (profile.creatorCoin) {
                    console.log('  💎 HAS CREATOR COIN (in Profile):');
                    console.log('    Address:', profile.creatorCoin.address);
                    console.log('    Market Cap:', profile.creatorCoin.marketCap);
                } else {
                    console.log('    No creator coin in profile.');
                }
            } else {
                console.log('    No Zora Profile found.');
            }

            // Check coin directly
            console.log('  Checking getUserCreatorCoin...');
            const coin = await zoraService.getUserCreatorCoin(address);
            if (coin) {
                console.log('  💎 FOUND COIN via getUserCreatorCoin:');
                console.log('    Name:', coin.name);
                console.log('    Symbol:', coin.symbol);
                console.log('    Contract:', coin.address);
                console.log('    Is Base App Coin:', coin.isBaseAppCoin);
                console.log('    Type:', coin.coinType);
            } else {
                console.log('    No coin found via getUserCreatorCoin.');
            }

        } catch (error) {
            console.error('  Error checking address:', error);
        }
    }
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
