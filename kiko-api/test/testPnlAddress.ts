import { calculateWalletPnlManual } from '../src/services/pnlCalculationService.js';
import { getWalletProfitabilitySummary } from '../src/services/moralisService.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
    const wallet = '0x7884784f99b507ff4fbd7345eeb5c3ed8d606dec';

    console.log(`\n🚀 Testing PNL for wallet: ${wallet}\n`);

    // Test on multiple chains
    const chains = [
        { name: 'Ethereum', id: 1, short: 'eth' },
        { name: 'Base', id: 8453, short: 'base' },
        { name: 'BSC', id: 56, short: 'bsc' },
    ];

    for (const chain of chains) {
        console.log(`\n======= ${chain.name} (${chain.id}) =======`);
        try {
            const startTime = Date.now();
            const summary = await getWalletProfitabilitySummary(wallet, chain.id, 'all');
            const duration = (Date.now() - startTime) / 1000;

            if (summary) {
                console.log(`✅ Completed in ${duration.toFixed(1)}s`);
                console.log(`  Realized PNL: $${summary.totalRealizedProfitUsd.toFixed(2)}`);
                console.log(`  Profit %: ${summary.totalRealizedProfitPercentage.toFixed(2)}%`);
                console.log(`  Trades: ${summary.totalCountOfTrades} (${summary.totalBuys} buys, ${summary.totalSells} sells)`);
                console.log(`  Trade Value: $${summary.totalTradeValue.toFixed(2)}`);
            } else {
                console.log('❌ No data returned');
            }
        } catch (e: any) {
            console.error('❌ Error:', e.message);
        }
    }
}

test();
