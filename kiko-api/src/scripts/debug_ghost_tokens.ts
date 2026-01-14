/**
 * Debug script to trace where "ghost" tokens are coming from
 * Run with: npx tsx src/scripts/debug_ghost_tokens.ts
 */

import { fetchTrendingAddresses } from '../services/dexscreenerWS.js';

const CHAIN = 'base';

async function debugWebSocket() {
    console.log('=== STEP 1: WebSocket Addresses ===');
    const addresses = await fetchTrendingAddresses({
        chain: CHAIN,
        timeFrame: 'm5',
        rankBy: 'trendingScoreM5'
    });

    console.log(`WebSocket returned ${addresses.length} addresses for ${CHAIN}`);

    // Check for any "zora" related addresses by fetching their details
    if (addresses.length > 0) {
        console.log('\n=== STEP 2: Enriching last 10 addresses ===');
        const last10 = addresses.slice(-10);

        for (const addr of last10) {
            try {
                const url = `https://api.dexscreener.com/tokens/v1/${CHAIN}/${addr}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json() as any[];
                    if (data && data.length > 0) {
                        const pair = data[0];
                        const name = pair.baseToken?.name || 'Unknown';
                        const symbol = pair.baseToken?.symbol || 'UNK';
                        const liq = parseFloat(pair.liquidity?.usd || '0');
                        console.log(`  ${symbol} (${name}) - Addr: ${addr.slice(0, 10)}... - Liq: $${liq.toFixed(0)}`);
                    }
                }
            } catch (e) {
                console.log(`  Error fetching ${addr.slice(0, 10)}...`);
            }
        }
    }

    console.log('\n=== STEP 3: Checking if "zora" search term finds suspicious tokens ===');
    const searchUrl = `https://api.dexscreener.com/latest/dex/search?q=zora`;
    const searchRes = await fetch(searchUrl);
    if (searchRes.ok) {
        const searchData = await searchRes.json() as { pairs?: any[] };
        const basePairs = (searchData.pairs || []).filter((p: any) => p.chainId?.toLowerCase() === CHAIN);
        console.log(`Found ${basePairs.length} pairs matching "zora" on ${CHAIN}:`);

        basePairs.slice(0, 10).forEach((p: any, i: number) => {
            const name = p.baseToken?.name || 'Unknown';
            const symbol = p.baseToken?.symbol || 'UNK';
            const liq = parseFloat(p.liquidity?.usd || '0');
            console.log(`  ${i + 1}. ${symbol} (${name}) - Liq: $${liq.toFixed(0)}`);
        });
    }
}

debugWebSocket().catch(console.error);
