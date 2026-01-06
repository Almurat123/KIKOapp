import { scrapeDexScreenerTrending } from './src/services/dexscreenerScraper.js';

async function main() {
    console.log('=== Testing DexScreener Puppeteer Scraper (All Chains) ===\n');

    // Test Solana
    console.log('\n📊 SOLANA Trending (1h):');
    const solTokens = await scrapeDexScreenerTrending('solana', '1h', 5);
    solTokens.forEach((t, i) => {
        const mcap = t.marketCap >= 1e6 ? `$${(t.marketCap / 1e6).toFixed(1)}M` : `$${(t.marketCap / 1e3).toFixed(1)}K`;
        console.log(`${i + 1}. ${t.symbol} - ${mcap} - ${t.priceChange1h > 0 ? '+' : ''}${t.priceChange1h.toFixed(1)}%`);
    });

    // Test Base
    console.log('\n📊 BASE Trending (1h):');
    const baseTokens = await scrapeDexScreenerTrending('base', '1h', 5);
    baseTokens.forEach((t, i) => {
        const mcap = t.marketCap >= 1e6 ? `$${(t.marketCap / 1e6).toFixed(1)}M` : `$${(t.marketCap / 1e3).toFixed(1)}K`;
        console.log(`${i + 1}. ${t.symbol} - ${mcap} - ${t.priceChange1h > 0 ? '+' : ''}${t.priceChange1h.toFixed(1)}%`);
    });

    // Test BSC
    console.log('\n📊 BSC Trending (1h):');
    const bscTokens = await scrapeDexScreenerTrending('bsc', '1h', 5);
    bscTokens.forEach((t, i) => {
        const mcap = t.marketCap >= 1e6 ? `$${(t.marketCap / 1e6).toFixed(1)}M` : `$${(t.marketCap / 1e3).toFixed(1)}K`;
        console.log(`${i + 1}. ${t.symbol} - ${mcap} - ${t.priceChange1h > 0 ? '+' : ''}${t.priceChange1h.toFixed(1)}%`);
    });

    console.log('\n=== Test Complete ===');
}

main().catch(console.error);
