
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import * as zeroEx from '../services/zeroEx.js';
import * as alchemy from '../services/alchemy.js';
import * as polymarket from '../services/polymarket.js';
import * as coinbaseCdp from '../services/coinbaseCdp.js';
import * as solscan from '../services/solscan.js';
import * as searchService from '../services/searchService.js';

// Test Constants
const VITALIK_ETH = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ETH_BASE = '0x4200000000000000000000000000000000000006'; // WETH
const SOL_FOUNDATION = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'; // Known Solana address

async function runVerification() {
    logger.info(LogCode.SYS_STARTUP, 'Starting Tier 4 Migration Verification...');

    const summary = {
        total: 0,
        passed: 0,
        failed: 0,
        failures: [] as string[]
    };

    const runTest = async (name: string, testFn: () => Promise<any>) => {
        summary.total++;
        try {
            logger.info(LogCode.SYS_INFO, `Testing ${name}...`);
            const result = await testFn();
            logger.info(LogCode.SYS_INFO, `✅ ${name} Passed`, { result: result ? 'Data Received' : 'No Data (but success)' });
            summary.passed++;
        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, `❌ ${name} Failed`, { error: error.message });
            summary.failed++;
            summary.failures.push(`${name}: ${error.message}`);
        }
    };

    // 1. ZeroEx Verification
    await runTest('ZeroEx Price (Base WETH->USDC)', async () => {
        // Base Chain ID = 8453
        return await zeroEx.getZeroExPrice(ETH_BASE, USDC_BASE, '100000000000000000', 8453);
    });

    // 2. Alchemy Verification
    await runTest('Alchemy Token Metadata (USDC on Base)', async () => {
        // Checking getUrl internally works via unified
        // Note: getTokenMetadata might fail if alchemy key invalid, but we check transport layer logic
        return await alchemy.getTokenMetadata('base', USDC_BASE);
    });

    // 3. Polymarket Verification
    await runTest('Polymarket Trending Events', async () => {
        const data = await polymarket.getTrendingEvents(2);
        if (!data.events || !Array.isArray(data.events)) throw new Error('Invalid structure');
        return data.events.length;
    });

    // 4. Coinbase CDP Verification
    await runTest('Coinbase CDP Wallet Balance (Vitalik)', async () => {
        // Chain 1 = Eth Mainnet
        return await coinbaseCdp.getEvmWalletBalance(VITALIK_ETH, 1);
    });

    // 5. Solscan Verification
    await runTest('Solscan Address Txs', async () => {
        return await solscan.getAddressTransactions(SOL_FOUNDATION, 5);
    });

    // 6. Search Service Verification
    await runTest('Search Service (DuckDuckGo/Tavily)', async () => {
        const res = await searchService.searchWeb('Vitalik Buterin', 2);
        if (!res.results || res.results.length === 0) throw new Error('No search results');
        return res.results.length;
    });

    console.log('\n=============================================');
    console.log(`Verification Complete: ${summary.passed}/${summary.total} Passed`);
    if (summary.failed > 0) {
        console.log('Failures:');
        summary.failures.forEach(f => console.log(`- ${f}`));
        process.exit(1);
    } else {
        console.log('All checks passed! Migration successful.');
        process.exit(0);
    }
}

// Execute
runVerification().catch(e => {
    console.error('Fatal Script Error:', e);
    process.exit(1);
});
