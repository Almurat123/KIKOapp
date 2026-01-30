import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Debug script to trace why chain names aren't being matched
 */
async function traceChainMapping() {
    try {
        // Step 1: Fetch DeFiLlama data and build map
        console.log('=== Building DeFiLlama Map ===');
        const response = await fetch('https://api.llama.fi/v2/chains');
        const defiLlamaData = await response.json();

        const defiLlamaChainMap = new Map<string, { name: string; tvl: number }>();
        for (const chain of defiLlamaData) {
            if (chain.tvl && chain.tvl > 0) {
                defiLlamaChainMap.set(chain.name.toLowerCase(), {
                    name: chain.name,
                    tvl: chain.tvl
                });
            }
        }

        // Step 2: Test the problematic keys
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

        function getProperChainName(chainKey: string): string | null {
            const chainKeyLower = chainKey.toLowerCase();

            // Check direct match
            let data = defiLlamaChainMap.get(chainKeyLower);
            if (data) {
                console.log(`  [Direct] "${chainKey}" -> "${data.name}"`);
                return data.name;
            }

            // Check alias
            const aliasKey = CHAIN_NAME_ALIASES[chainKeyLower];
            if (aliasKey) {
                console.log(`  [Alias found] "${chainKey}" -> "${aliasKey}"`);
                data = defiLlamaChainMap.get(aliasKey.toLowerCase());
                if (data) {
                    console.log(`  [Alias matched] "${aliasKey}" -> "${data.name}"`);
                    return data.name;
                }

                // Try iteration
                for (const [key, value] of defiLlamaChainMap.entries()) {
                    if (key === aliasKey.toLowerCase() || value.name.toLowerCase() === aliasKey.toLowerCase()) {
                        console.log(`  [Iteration matched] "${aliasKey}" -> "${value.name}"`);
                        return value.name;
                    }
                }
                console.log(`  [Alias NOT matched] "${aliasKey}" not found!`);
            } else {
                console.log(`  [No alias] for "${chainKey}"`);
            }

            return null;
        }

        // The Dune keys that are causing problems (based on the API output)
        const problemKeys = [
            'Avalanche C',  // Note: this might be how Dune stores it (with capital letters)
            'avalanche_c',
            'avalanche c',
            'Hyperevm',
            'hyperevm',
            'Optimism',
            'optimism',
            'Plume',
            'plume',
            'Zksync',
            'zksync',
            'Worldchain',
            'worldchain',
            'Zkevm',
            'zkevm',
            'Nova',
            'nova'
        ];

        console.log('\n=== Testing Problem Keys ===');
        for (const key of problemKeys) {
            console.log(`\nTesting: "${key}"`);
            const result = getProperChainName(key);
            if (result) {
                console.log(`  ✅ Result: "${result}"`);
            } else {
                console.log(`  ❌ Result: null`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

traceChainMapping();
