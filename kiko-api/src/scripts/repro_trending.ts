
import { getTrendingTokensPremium } from '../services/dexscreener.js';

async function run() {
    console.log('=== Testing BASE (getTrendingTokensPremium - ACTUAL PRODUCTION METHOD) ===');
    const baseTokens = await getTrendingTokensPremium('base', 100);
    console.log(`\nBASE Tokens: ${baseTokens.length}`);

    // Show last 10 tokens to check for ghost tokens
    console.log('\nLast 10 tokens:');
    baseTokens.slice(-10).forEach((t, i) => {
        const idx = baseTokens.length - 10 + i + 1;
        console.log(`  ${idx}. ${t.name} (${t.symbol}) - Liq: $${typeof t.liquidity === 'number' ? t.liquidity.toFixed(0) : t.liquidity}`);
    });

    console.log('\n=== Testing BSC (getTrendingTokensPremium - ACTUAL PRODUCTION METHOD) ===');
    const bscTokens = await getTrendingTokensPremium('bsc', 100);
    console.log(`\nBSC Tokens: ${bscTokens.length}`);

    console.log('\nLast 10 tokens:');
    bscTokens.slice(-10).forEach((t, i) => {
        const idx = bscTokens.length - 10 + i + 1;
        console.log(`  ${idx}. ${t.name} (${t.symbol}) - Liq: $${typeof t.liquidity === 'number' ? t.liquidity.toFixed(0) : t.liquidity}`);
    });
}

run();
