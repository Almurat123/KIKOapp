/**
 * Test script to verify chain data filtering
 */

import 'dotenv/config';
import '../config/env.js';
import { getChainsData } from '../repositories/chainRepository.js';

async function main() {
    console.log('Testing chain data filtering...\n');

    try {
        const chains = await getChainsData();

        console.log(`Total chains returned: ${chains.length}`);

        // Check how many have local data
        const chainsWithLocalData = chains.filter(c =>
            c.volume24h !== undefined ||
            c.txns24h !== undefined ||
            c.activeWallets !== undefined ||
            c.gasPrice !== undefined
        );

        console.log(`Chains with local data: ${chainsWithLocalData.length}`);

        // Check how many have ONLY TVL (should be 0 with our new logic)
        const chainsWithOnlyTVL = chains.filter(c =>
            c.volume24h === undefined &&
            c.txns24h === undefined &&
            c.activeWallets === undefined &&
            c.gasPrice === undefined
        );

        console.log(`Chains with ONLY TVL (should be 0): ${chainsWithOnlyTVL.length}`);

        if (chainsWithOnlyTVL.length > 0) {
            console.log('\n⚠️  WARNING: Found chains with only TVL:');
            chainsWithOnlyTVL.slice(0, 5).forEach(c => {
                console.log(`  - ${c.name}: TVL=$${(c.tvl / 1e9).toFixed(2)}B`);
            });
        }

        console.log('\n✅ Top 10 chains with local data:');
        chainsWithLocalData.slice(0, 10).forEach((c, i) => {
            console.log(`${i + 1}. ${c.name}:`);
            console.log(`   TVL: $${(c.tvl / 1e9).toFixed(2)}B`);
            console.log(`   Volume: $${c.volume24h ? (c.volume24h / 1e9).toFixed(2) + 'B' : 'N/A'}`);
            console.log(`   Txns: ${c.txns24h?.toLocaleString() || 'N/A'}`);
            console.log(`   Wallets: ${c.activeWallets?.toLocaleString() || 'N/A'}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
