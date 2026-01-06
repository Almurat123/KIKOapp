import { collectTrendingTokens } from './src/services/news/trendingCollector.js';

async function testFilter() {
    console.log('Testing trending token filter...\n');

    try {
        const result = await collectTrendingTokens();

        console.log(`Total tokens collected: ${result.tokens.length}`);
        console.log('Chains:', result.chains.join(', '));
        console.log('\n--- Tokens ---');

        for (const token of result.tokens) {
            console.log(`[${token.chain.toUpperCase()}] ${token.symbol} | ${token.name} | $${token.price} | ${token.priceChange > 0 ? '+' : ''}${token.priceChange.toFixed(2)}%`);
        }

        // Check for problematic tokens
        const problematic = ['USDT', 'USDC', 'DAI', 'WETH', 'WBTC', 'WBNB', 'stETH', 'wstETH'];
        const found = result.tokens.filter(t => problematic.includes(t.symbol.toUpperCase()));

        if (found.length > 0) {
            console.log('\n❌ FILTER FAILED! Found problematic tokens:');
            found.forEach(t => console.log(`  - ${t.symbol} (${t.chain})`));
        } else {
            console.log('\n✅ FILTER PASSED! No stablecoins or wrapped tokens found.');
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testFilter();
