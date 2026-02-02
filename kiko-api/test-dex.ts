/**
 * DEX Module Test Script
 * Tests getBestQuote with top tokens from each chain
 */

import { getBestQuote, getAllQuotes } from './src/services/dex/index.js';

// Top tokens by chain (hardcoded for testing)
const TOP_TOKENS: Record<number, { symbol: string; address: string }[]> = {
    // Base (8453)
    8453: [
        { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913' },
        { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006' },
        { symbol: 'cbETH', address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22' },
        { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
        { symbol: 'AERO', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631' },
    ],
    // ETH Mainnet (1)
    1: [
        { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
        { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
        { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
        { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
    ],
    // BSC (56)
    56: [
        { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955' },
        { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' },
        { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' },
        { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
        { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' },
    ],
};

// Wrapped native tokens
const WRAPPED_NATIVE: Record<number, string> = {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',     // WETH
    8453: '0x4200000000000000000000000000000000000006',  // WETH
    56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',    // WBNB
};

async function testChain(chainId: number, chainName: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${chainName} (chainId: ${chainId})`);
    console.log('='.repeat(60));

    const tokens = TOP_TOKENS[chainId] || [];
    const wrappedNative = WRAPPED_NATIVE[chainId];

    if (!wrappedNative) {
        console.log(`⚠️ No wrapped native configured for chain ${chainId}`);
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const token of tokens) {
        // Skip native wrapped token
        if (token.address.toLowerCase() === wrappedNative.toLowerCase()) {
            continue;
        }

        try {
            console.log(`\n📊 Testing ${token.symbol} (${token.address.slice(0, 10)}...)`);

            // Test: 0.01 native -> token
            const amountIn = BigInt('10000000000000000'); // 0.01 ETH/BNB

            const quote = await getBestQuote({
                tokenIn: wrappedNative,
                tokenOut: token.address,
                amountIn,
                recipient: '0x0000000000000000000000000000000000000001',
                slippageBps: 50
            }, chainId);

            if (quote) {
                console.log(`✅ Quote received: ${quote.dex}`);
                console.log(`   AmountOut: ${quote.amountOut.toString()}`);
                console.log(`   Gas: ${quote.gasEstimate.toString()}`);
                successCount++;
            } else {
                console.log(`❌ No quote available`);
                failCount++;
            }
        } catch (err: any) {
            console.log(`❌ Error: ${err.message?.substring(0, 50)}`);
            failCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n📈 ${chainName} Results: ${successCount} success, ${failCount} failed`);
}

async function main() {
    console.log('🚀 DEX Module Test');
    console.log('Testing getBestQuote with top tokens...\n');

    // Test Base first (most likely to have RPC access)
    await testChain(8453, 'Base');

    // Test ETH mainnet
    await testChain(1, 'Ethereum');

    // Test BSC
    await testChain(56, 'BSC');

    console.log('\n✅ Test complete!');
}

main().catch(console.error);
