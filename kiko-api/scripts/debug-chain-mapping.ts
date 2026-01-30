import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Debug script to analyze chain name mapping issues
 */
async function debugChainMapping() {
    try {
        // Step 1: Fetch current chains from database
        const dbChains = await prisma.chainMetric.findMany({
            select: { name: true, tvl: true },
            orderBy: { tvl: 'desc' }
        });

        console.log('\n=== Chains in Database ===');
        console.log(`Total: ${dbChains.length}`);

        const zeroTvlChains = dbChains.filter(c => !c.tvl || Number(c.tvl) === 0);
        console.log(`\nChains with TVL = 0 (${zeroTvlChains.length}):`);
        zeroTvlChains.forEach(c => console.log(`  - ${c.name}`));

        // Step 2: Fetch DeFiLlama chains
        console.log('\n=== Fetching DeFiLlama Data ===');
        const response = await fetch('https://api.llama.fi/v2/chains');
        const defiLlamaData = await response.json();

        // Create lowercase map
        const defiLlamaMap = new Map<string, { name: string; tvl: number }>();
        for (const chain of defiLlamaData) {
            if (chain.tvl && chain.tvl > 0) {
                defiLlamaMap.set(chain.name.toLowerCase(), {
                    name: chain.name,
                    tvl: chain.tvl
                });
            }
        }

        console.log(`Total DeFiLlama chains with TVL > 0: ${defiLlamaMap.size}`);

        // Step 3: Check if our aliases exist in DeFiLlama
        const CHAIN_NAME_ALIASES: Record<string, string> = {
            'avalanche_c': 'avalanche',
            'avalanche c': 'avalanche',
            'optimism': 'op mainnet',
            'zksync': 'zksync era',
            'nova': 'arbitrum nova',
            'zkevm': 'polygon zkevm',
            'worldchain': 'world chain',
            'hyperevm': 'hyperliquid l1',
            'plume': 'plume mainnet',
        };

        console.log('\n=== Alias Mapping Check ===');
        for (const [duneKey, defiLlamaAlias] of Object.entries(CHAIN_NAME_ALIASES)) {
            const exists = defiLlamaMap.get(defiLlamaAlias.toLowerCase());
            if (exists) {
                console.log(`✅ "${duneKey}" -> "${defiLlamaAlias}" -> "${exists.name}" (TVL: $${(exists.tvl / 1e9).toFixed(2)}B)`);
            } else {
                // Try to find it by iterating
                let found = false;
                for (const [key, value] of defiLlamaMap.entries()) {
                    if (value.name.toLowerCase() === defiLlamaAlias.toLowerCase()) {
                        console.log(`⚠️ "${duneKey}" -> "${defiLlamaAlias}" FOUND via iteration at key="${key}" (${value.name}, TVL: $${(value.tvl / 1e9).toFixed(2)}B)`);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    console.log(`❌ "${duneKey}" -> "${defiLlamaAlias}" NOT FOUND in DeFiLlama!`);
                }
            }
        }

        // Step 4: Show sample DeFiLlama keys for reference
        console.log('\n=== Sample DeFiLlama Keys (for reference) ===');
        const sampleKeys = ['op mainnet', 'zksync era', 'arbitrum nova', 'polygon zkevm', 'world chain', 'hyperliquid l1', 'plume mainnet', 'avalanche'];
        for (const key of sampleKeys) {
            const data = defiLlamaMap.get(key);
            if (data) {
                console.log(`  "${key}" -> ${data.name} (TVL: $${(data.tvl / 1e6).toFixed(1)}M)`);
            } else {
                console.log(`  "${key}" -> NOT FOUND`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugChainMapping();
