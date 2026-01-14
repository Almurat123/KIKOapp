/**
 * Check if official ZORA is in the trending list
 */

import { getTrendingTokensPremium } from '../services/dexscreener.js';

const OFFICIAL_ZORA_ADDRESS = '0x1111111111166b7FE7bd91427724B487980aFc69'.toLowerCase();
const COPYCAT_ZORA_ADDRESS = '0xCdB7331a00F119C5B9D64BBE950a9381C63E00A4'.toLowerCase();

async function checkZoraInResults() {
    console.log('=== Checking ZORA tokens in Base trending results ===\n');

    const tokens = await getTrendingTokensPremium('base', 100);

    console.log(`Total tokens returned: ${tokens.length}\n`);

    // Find both ZORA tokens
    const officialZora = tokens.find(t => t.address?.toLowerCase() === OFFICIAL_ZORA_ADDRESS);
    const copycatZora = tokens.find(t => t.address?.toLowerCase() === COPYCAT_ZORA_ADDRESS);

    if (officialZora) {
        const idx = tokens.findIndex(t => t.address?.toLowerCase() === OFFICIAL_ZORA_ADDRESS);
        console.log(`✅ OFFICIAL ZORA found at position ${idx + 1}:`);
        console.log(`   Name: ${officialZora.name} (${officialZora.symbol})`);
        console.log(`   Liquidity: $${officialZora.liquidity?.toLocaleString()}`);
    } else {
        console.log(`❌ OFFICIAL ZORA NOT FOUND in top ${tokens.length} tokens!`);
        console.log(`   Expected address: ${OFFICIAL_ZORA_ADDRESS}`);
    }

    console.log('');

    if (copycatZora) {
        const idx = tokens.findIndex(t => t.address?.toLowerCase() === COPYCAT_ZORA_ADDRESS);
        console.log(`⚠️  COPYCAT ZORA (Meg🐎) found at position ${idx + 1}:`);
        console.log(`   Name: ${copycatZora.name} (${copycatZora.symbol})`);
        console.log(`   Liquidity: $${copycatZora.liquidity?.toLocaleString()}`);
    } else {
        console.log(`✅ COPYCAT ZORA (Meg🐎) NOT in the list (good!)`);
    }

    // Show all tokens with "ZORA" in name/symbol
    console.log('\n=== All tokens with ZORA in name/symbol: ===');
    tokens.forEach((t, i) => {
        const name = t.name?.toLowerCase() || '';
        const symbol = t.symbol?.toLowerCase() || '';
        if (name.includes('zora') || symbol.includes('zora')) {
            console.log(`${i + 1}. ${t.name} (${t.symbol}) - ${t.address} - Liq: $${t.liquidity?.toLocaleString()}`);
        }
    });
}

checkZoraInResults().catch(console.error);
