/**
 * Debug script to find all ZORA-related tokens and identify which is the official one
 * Run with: npx tsx src/scripts/debug_zora_tokens.ts
 */

async function debugZoraTokens() {
    console.log('=== Searching for all ZORA tokens on Base ===\n');

    const searchUrl = 'https://api.dexscreener.com/latest/dex/search?q=zora';
    const res = await fetch(searchUrl);
    const data = await res.json() as { pairs?: any[] };

    const basePairs = (data.pairs || []).filter((p: any) => p.chainId?.toLowerCase() === 'base');

    console.log(`Found ${basePairs.length} ZORA-related pairs on Base:\n`);

    // Group by token address to see unique tokens
    const tokenMap = new Map<string, any>();

    for (const pair of basePairs) {
        const addr = pair.baseToken?.address?.toLowerCase();
        if (!addr) continue;

        const existing = tokenMap.get(addr);
        const liq = parseFloat(pair.liquidity?.usd || '0');

        if (!existing || liq > existing.liquidity) {
            tokenMap.set(addr, {
                address: pair.baseToken?.address,
                symbol: pair.baseToken?.symbol,
                name: pair.baseToken?.name,
                liquidity: liq,
                volume24h: parseFloat(pair.volume?.h24 || '0'),
                fdv: parseFloat(pair.fdv || '0'),
                poolAddress: pair.pairAddress,
                hasInfo: !!pair.info?.imageUrl,
                socials: pair.info?.socials?.length || 0,
            });
        }
    }

    // Sort by liquidity to show most liquid first
    const sortedTokens = Array.from(tokenMap.values()).sort((a, b) => b.liquidity - a.liquidity);

    console.log('Unique ZORA tokens (sorted by liquidity):');
    console.log('==========================================\n');

    sortedTokens.forEach((t, i) => {
        const isLikelyOfficial = t.liquidity > 1000000 || t.fdv > 10000000 || t.socials > 0;
        const marker = isLikelyOfficial ? '⭐ LIKELY OFFICIAL' : '❓ POSSIBLY COPYCAT';
        console.log(`${i + 1}. ${t.name} (${t.symbol})`);
        console.log(`   Address: ${t.address}`);
        console.log(`   Liquidity: $${t.liquidity.toLocaleString()}`);
        console.log(`   FDV: $${t.fdv.toLocaleString()}`);
        console.log(`   Volume 24h: $${t.volume24h.toLocaleString()}`);
        console.log(`   Has Logo: ${t.hasInfo}, Socials: ${t.socials}`);
        console.log(`   ${marker}`);
        console.log('');
    });
}

debugZoraTokens().catch(console.error);
