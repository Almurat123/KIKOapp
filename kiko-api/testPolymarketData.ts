import { getWalletPositions, getWalletStats } from './src/services/polymarketDataService.js';

async function test() {
    // Test with a known active trader from leaderboard
    // Example wallet (replace with actual from leaderboard if needed)
    const testWallet = '0x1a9c8182c09f50c8318d769245bea52c32be35bc'; // Example whale

    console.log('--- Testing Polymarket Data API ---');

    console.log('\n1. Fetching positions for wallet:', testWallet);
    const positions = await getWalletPositions(testWallet);
    console.log(`Found ${positions.length} positions`);
    if (positions.length > 0) {
        console.log('Sample position:', JSON.stringify(positions[0], null, 2));
    }

    console.log('\n2. Fetching user stats...');
    const stats = await getWalletStats(testWallet);
    console.log('Stats:', JSON.stringify(stats, null, 2));
}

test().catch(console.error);
