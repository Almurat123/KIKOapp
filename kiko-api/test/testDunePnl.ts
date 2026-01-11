import { getWalletPnlFromDune, getWalletPnlCombined } from '../src/services/dunePnlService.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
    // Test addresses provided by user
    const evmWallet = '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed';
    const solanaWallet = 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV';

    console.log('\n🚀 Testing Dune PNL Service\n');
    console.log('='.repeat(60));

    // Test EVM wallet
    console.log(`\n📊 EVM Wallet: ${evmWallet.slice(0, 10)}...`);
    console.log('-'.repeat(40));

    try {
        const evmResult = await getWalletPnlFromDune(evmWallet, 'base', 30);
        if (evmResult) {
            console.log(`✅ Chain: ${evmResult.chain}`);
            console.log(`   Total PNL: $${evmResult.totalRealizedPnlUsd.toFixed(2)}`);
            console.log(`   Total Bought: $${evmResult.totalBoughtUsd.toFixed(2)}`);
            console.log(`   Total Sold: $${evmResult.totalSoldUsd.toFixed(2)}`);
            console.log(`   Win Rate: ${evmResult.winRate.toFixed(1)}%`);
            console.log(`   Tokens: ${evmResult.tokens.length}`);
            console.log(`   Query Time: ${evmResult.queryExecutionTimeMs}ms`);

            if (evmResult.tokens.length > 0) {
                console.log(`\n   Top 5 Tokens:`);
                evmResult.tokens.slice(0, 10).forEach((t, i) => {
                    console.log(`   ${i + 1}. ${t.tokenSymbol || t.tokenAddress.slice(0, 10)}: $${t.pnlUsd.toFixed(2)} (${t.profitPct?.toFixed(1) || '?'}%)`);
                });
            }
        } else {
            console.log('❌ No result');
        }
    } catch (e: any) {
        console.error('❌ Error:', e.message);
    }

    console.log('\n' + '='.repeat(60));

    // Test Solana wallet
    console.log(`\n📊 Solana Wallet: ${solanaWallet.slice(0, 10)}...`);
    console.log('-'.repeat(40));

    try {
        const solResult = await getWalletPnlFromDune(solanaWallet, 'solana', 30);
        if (solResult) {
            console.log(`✅ Chain: ${solResult.chain}`);
            console.log(`   Total PNL: $${solResult.totalRealizedPnlUsd.toFixed(2)}`);
            console.log(`   Total Bought: $${solResult.totalBoughtUsd.toFixed(2)}`);
            console.log(`   Total Sold: $${solResult.totalSoldUsd.toFixed(2)}`);
            console.log(`   Win Rate: ${solResult.winRate.toFixed(1)}%`);
            console.log(`   Tokens: ${solResult.tokens.length}`);
            console.log(`   Query Time: ${solResult.queryExecutionTimeMs}ms`);

            if (solResult.tokens.length > 0) {
                console.log(`\n   Top 5 Tokens:`);
                solResult.tokens.slice(0, 10).forEach((t, i) => {
                    console.log(`   ${i + 1}. ${t.tokenSymbol || t.tokenAddress.slice(0, 10)}: $${t.pnlUsd.toFixed(2)} (${t.profitPct?.toFixed(1) || '?'}%)`);
                });
            }
        } else {
            console.log('❌ No result');
        }
    } catch (e: any) {
        console.error('❌ Error:', e.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Test completed!\n');
}

test().catch(console.error);
