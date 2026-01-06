/**
 * Test script for getTrendingTokensPremium
 * Run with: npx tsx scripts/test-trending-premium.ts
 */

import { getTrendingTokensPremium } from '../src/services/dexscreener.js';

async function testTrendingPremium() {
    console.log('='.repeat(60));
    console.log('Testing getTrendingTokensPremium for BASE chain (expecting fallback)...');
    console.log('='.repeat(60));

    try {
        const startTime = Date.now();
        // Use 'base' to verify fallback logic works when boost data is low (Base has only ~1 boost)
        const tokens = await getTrendingTokensPremium('base', 30);
        const duration = Date.now() - startTime;

        console.log(`\n✅ Fetched ${tokens.length} tokens in ${duration}ms\n`);

        if (tokens.length > 0) {
            console.log('Top 3 tokens:');
            for (let i = 0; i < Math.min(3, tokens.length); i++) {
                const token = tokens[i];
                console.log(`\n${i + 1}. ${token.symbol} (${token.name})`);
                console.log(`   Address: ${token.address?.slice(0, 20)}...`);
                console.log(`   Price: $${token.price?.toFixed(6)}`);
                console.log(`   24h Volume: $${token.volume24h?.toLocaleString()}`);
                console.log(`   Liquidity: $${token.liquidity?.toLocaleString()}`);
                console.log(`   24h Change: ${token.priceChange24h?.toFixed(2)}%`);
                console.log(`   Pool Address: ${token.poolAddress}`);
                if (token.imageUrl) {
                    console.log(`   Has Image: ✓`);
                }
            }
        } else {
            console.log('⚠️ No tokens returned');
        }

        console.log('\n' + '='.repeat(60));
        console.log('Test completed successfully!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Test failed:', (error as Error).message);
        process.exit(1);
    }
}

testTrendingPremium();
