/**
 * Debug Polymarket API Response Structure
 */

import 'dotenv/config';

const TARGET_WALLET = '0x6a72f61820b26b1fe4d956e17b6dc2a1ea3033ee';

async function debug() {
    console.log('=== Debug Polymarket Positions API Response ===\n');

    const url = `https://data-api.polymarket.com/positions?user=${TARGET_WALLET.toLowerCase()}`;
    console.log('Fetching:', url);

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    const data = await response.json() as any[];

    console.log('\nTotal positions:', data.length);

    if (data.length > 0) {
        console.log('\n=== First Position (Full Structure) ===');
        console.log(JSON.stringify(data[0], null, 2));

        console.log('\n=== All Keys in First Position ===');
        console.log(Object.keys(data[0]));
    }
}

debug().catch(console.error);
