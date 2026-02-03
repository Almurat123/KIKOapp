#!/usr/bin/env node

/**
 * Test script for enhanced Token Risk service
 * Tests sniper analysis, transfer network analysis, and holder distribution
 */

import { CheckTokenRiskTool } from './dist/skills/RiskSkill/tools/tokenRisk.js';

const testTokens = [
    {
        name: 'PEPE (Pepe)',
        address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
        chain: 'eth'
    }
];

async function testTokenRisk() {
    console.log('🧪 Testing Enhanced Token Risk Service\n');
    console.log('='.repeat(60));

    for (const token of testTokens) {
        console.log(`\n📊 Testing: ${token.name}`);
        console.log(`   Address: ${token.address}`);
        console.log(`   Chain: ${token.chain}\n`);

        try {
            const result = await CheckTokenRiskTool.handler({
                address: token.address,
                chain: token.chain
            });

            if (result.error) {
                console.error(`❌ Error: ${result.error}`);
                continue;
            }

            // Display basic risk info
            console.log(`   Status: ${result.status}`);
            console.log(`   Risk Score: ${result.riskScore}/100`);
            console.log(`   Honeypot: ${result.isHoneypot ? 'YES ⚠️' : 'NO ✅'}`);
            console.log(`   Buy Tax: ${result.buyTax}%`);
            console.log(`   Sell Tax: ${result.sellTax}%`);

            // Display new enhanced analysis
            if (result.sniperAnalysis) {
                console.log(`\n   🎯 Sniper Analysis:`);
                console.log(`      - Sniper Count: ${result.sniperAnalysis.sniperCount}`);
                console.log(`      - Sniper %: ${result.sniperAnalysis.sniperPercentage.toFixed(2)}%`);
                console.log(`      - Top Snipers: ${result.sniperAnalysis.topSnipers.length} detected`);
            } else {
                console.log(`\n   🎯 Sniper Analysis: Not available`);
            }

            if (result.networkAnalysis) {
                console.log(`\n   🔄 Network Analysis:`);
                console.log(`      - Circular Transfers: ${result.networkAnalysis.circularTransfers}`);
                console.log(`      - Wash Trading Score: ${result.networkAnalysis.washTradingScore}/100`);
            } else {
                console.log(`\n   🔄 Network Analysis: Not available`);
            }

            if (result.holderAnalysis) {
                console.log(`\n   👥 Holder Analysis:`);
                console.log(`      - Top 10 Concentration: ${result.holderAnalysis.top10Concentration}%`);
                console.log(`      - Top 50 Concentration: ${result.holderAnalysis.top50Concentration}%`);
                console.log(`      - Unique Holders: ${result.holderAnalysis.uniqueHolders}`);
            } else {
                console.log(`\n   👥 Holder Analysis: Not available`);
            }

            // Display warnings
            if (result.warnings && result.warnings.length > 0) {
                console.log(`\n   ⚠️  Warnings (${result.warnings.length}):`);
                result.warnings.slice(0, 5).forEach(w => console.log(`      ${w}`));
                if (result.warnings.length > 5) {
                    console.log(`      ... and ${result.warnings.length - 5} more`);
                }
            }

            console.log(`\n   ✅ Positives (${result.positives?.length || 0}):`);
            result.positives?.slice(0, 3).forEach(p => console.log(`      ${p}`));

        } catch (error) {
            console.error(`❌ Test failed: ${error.message}`);
            console.error(error.stack);
        }

        console.log('\n' + '-'.repeat(60));
    }

    console.log('\n✅ Testing complete!\n');
    process.exit(0);
}

testTokenRisk().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
