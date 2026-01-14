/**
 * Test DexScreener API response for both ZORA addresses
 */

const OFFICIAL_ZORA = '0x1111111111166b7FE7bd91427724B487980aFc69';
const COPYCAT_ZORA = '0xCdB7331a00F119C5B9D64BBE950a9381C63E00A4';

async function testApiResponse() {
    console.log('=== Testing DexScreener API responses ===\n');

    // Test OFFICIAL ZORA
    console.log('1. OFFICIAL ZORA Address:', OFFICIAL_ZORA);
    const officialUrl = `https://api.dexscreener.com/latest/dex/tokens/${OFFICIAL_ZORA}`;
    console.log('   URL:', officialUrl);

    try {
        const res1 = await fetch(officialUrl);
        const data1 = await res1.json() as { pairs?: any[] };

        if (data1.pairs && data1.pairs.length > 0) {
            // Get the most liquid pair (same logic as getTokenDetails)
            const pair = data1.pairs.sort((a: any, b: any) =>
                parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
            )[0];

            console.log('   Found', data1.pairs.length, 'pairs');
            console.log('   Most Liquid Pair:');
            console.log('     Name:', pair.baseToken?.name);
            console.log('     Symbol:', pair.baseToken?.symbol);
            console.log('     Liquidity: $', parseFloat(pair.liquidity?.usd || '0').toLocaleString());
            console.log('     BaseToken Address:', pair.baseToken?.address);
        } else {
            console.log('   NO PAIRS FOUND!');
        }
    } catch (e: any) {
        console.log('   Error:', e.message);
    }

    console.log('\n2. COPYCAT ZORA (Meg🐎) Address:', COPYCAT_ZORA);
    const copycatUrl = `https://api.dexscreener.com/latest/dex/tokens/${COPYCAT_ZORA}`;
    console.log('   URL:', copycatUrl);

    try {
        const res2 = await fetch(copycatUrl);
        const data2 = await res2.json() as { pairs?: any[] };

        if (data2.pairs && data2.pairs.length > 0) {
            const pair = data2.pairs.sort((a: any, b: any) =>
                parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
            )[0];

            console.log('   Found', data2.pairs.length, 'pairs');
            console.log('   Most Liquid Pair:');
            console.log('     Name:', pair.baseToken?.name);
            console.log('     Symbol:', pair.baseToken?.symbol);
            console.log('     Liquidity: $', parseFloat(pair.liquidity?.usd || '0').toLocaleString());
            console.log('     BaseToken Address:', pair.baseToken?.address);
        } else {
            console.log('   NO PAIRS FOUND!');
        }
    } catch (e: any) {
        console.log('   Error:', e.message);
    }
}

testApiResponse();
