/**
 * Check pools for both ZORA tokens to see if they share a pool
 */

const OFFICIAL_ZORA = '0x1111111111166b7FE7bd91427724B487980aFc69';
const COPYCAT_ZORA = '0xCdB7331a00F119C5B9D64BBE950a9381C63E00A4';

async function checkZoraPools() {
    console.log('=== Checking pools for both ZORA tokens ===\n');

    // Check copycat ZORA pools to see if it's paired with official ZORA
    console.log('1. Checking COPYCAT ZORA (Meg🐎) pools:');
    const copycatUrl = `https://api.dexscreener.com/latest/dex/tokens/${COPYCAT_ZORA}`;
    const res1 = await fetch(copycatUrl);
    const data1 = await res1.json() as { pairs?: any[] };

    if (data1.pairs) {
        for (const pair of data1.pairs) {
            console.log(`   Pool: ${pair.pairAddress}`);
            console.log(`     BaseToken: ${pair.baseToken?.symbol} (${pair.baseToken?.name}) - ${pair.baseToken?.address}`);
            console.log(`     QuoteToken: ${pair.quoteToken?.symbol} (${pair.quoteToken?.name}) - ${pair.quoteToken?.address}`);
            console.log(`     Liquidity: $${parseFloat(pair.liquidity?.usd || '0').toLocaleString()}`);
            console.log('');
        }
    }

    // Check if official ZORA has a pool where quote is copycat
    console.log('\n2. Checking if OFFICIAL ZORA has any pool with the copycat as quote:');
    const officialUrl = `https://api.dexscreener.com/latest/dex/tokens/${OFFICIAL_ZORA}`;
    const res2 = await fetch(officialUrl);
    const data2 = await res2.json() as { pairs?: any[] };

    if (data2.pairs) {
        const pairedWithCopycat = data2.pairs.filter(pair =>
            pair.quoteToken?.address?.toLowerCase() === COPYCAT_ZORA.toLowerCase() ||
            pair.baseToken?.address?.toLowerCase() === COPYCAT_ZORA.toLowerCase()
        );

        if (pairedWithCopycat.length > 0) {
            console.log('   ⚠️ FOUND POOLS PAIRED WITH COPYCAT!');
            for (const pair of pairedWithCopycat) {
                console.log(`   Pool: ${pair.pairAddress}`);
                console.log(`     BaseToken: ${pair.baseToken?.symbol} - ${pair.baseToken?.address}`);
                console.log(`     QuoteToken: ${pair.quoteToken?.symbol} - ${pair.quoteToken?.address}`);
            }
        } else {
            console.log('   ✅ No pools found where official ZORA is paired with copycat');
        }

        // Also check all pools with ZORA as quote
        console.log('\n3. All pools where quote token has symbol ZORA:');
        const zoraAsQuote = data2.pairs.filter(pair =>
            pair.quoteToken?.symbol?.toUpperCase() === 'ZORA'
        );

        if (zoraAsQuote.length > 0) {
            for (const pair of zoraAsQuote) {
                console.log(`   Pool: ${pair.pairAddress}`);
                console.log(`     BaseToken: ${pair.baseToken?.symbol} (${pair.baseToken?.name})`);
                console.log(`     QuoteToken: ${pair.quoteToken?.symbol} (${pair.quoteToken?.name}) - ${pair.quoteToken?.address}`);
                console.log(`     Liquidity: $${parseFloat(pair.liquidity?.usd || '0').toLocaleString()}`);
                console.log('');
            }
        } else {
            console.log('   No pools with ZORA as quote token');
        }
    }
}

checkZoraPools();
