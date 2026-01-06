import { getTrendingMarkets } from './src/services/polymarket.js';
import { getRecentTrades, getTradesByAssetId } from './src/services/polymarketTradeService.js';

async function testGoldsky() {
    console.log('--- 1. Testing Generic Recent Trades ---');
    const recent = await getRecentTrades(5);
    console.log('Recent Trades Sample:', JSON.stringify(recent.slice(0, 2), null, 2));

    console.log('\n--- 2. Fetching a Trending Market for Asset IDs ---');
    const trending = await getTrendingMarkets(1);
    if (trending.markets.length === 0) {
        console.error('No trending markets found to test with.');
        return;
    }

    const market = trending.markets[0];
    // We need the raw market data to get clobTokenIds or asset_ids.
    // The current service might not return them in the simplified interface.
    // Let's fetch the detailed event/market data again or just trust the detailed service if we updated it.
    // Actually, let's just use the 'getEventDetails' which we know has the tokens.
    // Or we can just fetch the market directly from the Gamma API in this script to get IDs.

    // Quick fetch to get token IDs for the first trending market
    const marketId = market.id;
    console.log(`Using Market: ${market.question} (ID: ${marketId})`);

    const resp = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`);
    const marketData = await resp.json();

    // clobTokenIds is usually a JSON string array in the API response
    let tokenIds: string[] = [];
    try {
        tokenIds = JSON.parse(marketData.clobTokenIds);
    } catch (e) {
        console.log('Could not parse clobTokenIds:', marketData.clobTokenIds);
        return;
    }

    if (tokenIds.length > 0) {
        const assetId = tokenIds[0]; // Usually YES or NO token
        console.log(`\n--- 3. Testing Trades for Asset ID: ${assetId} ---`);
        const assetTrades = await getTradesByAssetId(assetId, 5);
        console.log('Asset Trades:', JSON.stringify(assetTrades, null, 2));

        if (assetTrades.length > 0) {
            console.log('\nSuccess! Found trades.');
        } else {
            console.log('\nNo trades found (might be an inactive market or wrong ID type).');
        }
    } else {
        console.log('No token IDs found for market.');
    }
}

testGoldsky().catch(console.error);
