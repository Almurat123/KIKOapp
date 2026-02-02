/**
 * DEX Pool Liquidity Test Script
 * Tests on-chain liquidity reading for various token pairs
 */

import { findTokenPools, getV3PoolInfo, getV2PoolInfo } from './src/services/dex/poolInfo.js';

// Test token pairs by chain
const TEST_PAIRS: Record<number, Array<{ name: string; tokenA: string; tokenB: string }>> = {
    // Base
    8453: [
        {
            name: 'WETH/USDC',
            tokenA: '0x4200000000000000000000000000000000000006',  // WETH
            tokenB: '0x833589fCD6eDb6E08f4c7C32D4f71b54bDa02913'   // USDC
        },
        {
            name: 'WETH/cbETH',
            tokenA: '0x4200000000000000000000000000000000000006',  // WETH
            tokenB: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22'   // cbETH
        },
        {
            name: 'WETH/AERO',
            tokenA: '0x4200000000000000000000000000000000000006',  // WETH
            tokenB: '0x940181a94A35A4569E4529A3CDfB74e38FD98631'   // AERO
        }
    ],
    // ETH Mainnet
    1: [
        {
            name: 'WETH/USDC',
            tokenA: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',  // WETH
            tokenB: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'   // USDC
        },
        {
            name: 'WETH/USDT',
            tokenA: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',  // WETH
            tokenB: '0xdAC17F958D2ee523a2206206994597C13D831ec7'   // USDT
        },
        {
            name: 'WETH/WBTC',
            tokenA: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',  // WETH
            tokenB: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'   // WBTC
        }
    ],
    // BSC
    56: [
        {
            name: 'WBNB/USDT',
            tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',  // WBNB
            tokenB: '0x55d398326f99059fF775485246999027B3197955'   // USDT
        },
        {
            name: 'WBNB/BUSD',
            tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',  // WBNB
            tokenB: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'   // BUSD
        }
    ]
};

function formatNumber(num: bigint | string, decimals: number = 18): string {
    const value = BigInt(num);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = value / divisor;
    const fraction = value % divisor;
    return `${whole}.${fraction.toString().padStart(decimals, '0').slice(0, 6)}`;
}

async function testChainPools(chainId: number, chainName: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${chainName} (chainId: ${chainId})`);
    console.log('='.repeat(60));

    const pairs = TEST_PAIRS[chainId] || [];

    for (const pair of pairs) {
        console.log(`\n📊 ${pair.name}`);
        console.log(`   Token A: ${pair.tokenA}`);
        console.log(`   Token B: ${pair.tokenB}`);

        try {
            const pools = await findTokenPools(pair.tokenA, pair.tokenB, chainId);

            if (pools.length === 0) {
                console.log(`   ❌ No pools found`);
                continue;
            }

            console.log(`   ✅ Found ${pools.length} pool(s):\n`);

            for (let i = 0; i < pools.length; i++) {
                const pool = pools[i];
                console.log(`   Pool ${i + 1}:`);
                console.log(`   ├─ Address: ${pool.poolAddress}`);
                console.log(`   ├─ Tokens: ${pool.token0Symbol || 'Unknown'} / ${pool.token1Symbol || 'Unknown'}`);

                if (pool.reserve0 && pool.reserve1) {
                    // V2 Pool
                    const reserve0Formatted = formatNumber(pool.reserve0, pool.token0Decimals || 18);
                    const reserve1Formatted = formatNumber(pool.reserve1, pool.token1Decimals || 18);
                    console.log(`   ├─ Type: V2`);
                    console.log(`   ├─ Reserve0: ${reserve0Formatted} ${pool.token0Symbol}`);
                    console.log(`   ├─ Reserve1: ${reserve1Formatted} ${pool.token1Symbol}`);
                } else if (pool.liquidity) {
                    // V3 Pool
                    console.log(`   ├─ Type: V3`);
                    console.log(`   ├─ Liquidity: ${pool.liquidity}`);
                    console.log(`   ├─ Fee: ${pool.fee ? pool.fee / 10000 : 0}%`);
                    console.log(`   ├─ sqrtPriceX96: ${pool.sqrtPriceX96?.slice(0, 20)}...`);
                }

                if (pool.price) {
                    console.log(`   ├─ Price: 1 ${pool.token0Symbol} = ${pool.price.toFixed(6)} ${pool.token1Symbol}`);
                }
                console.log(`   └─`);
            }
        } catch (err: any) {
            console.log(`   ❌ Error: ${err.message?.substring(0, 100)}`);
        }

        await new Promise(r => setTimeout(r, 500));
    }
}

async function main() {
    console.log('🚀 DEX Pool Liquidity Test');
    console.log('Testing on-chain liquidity reading...\n');

    // Test Base
    await testChainPools(8453, 'Base');

    // Test Ethereum
    await testChainPools(1, 'Ethereum');

    // Test BSC
    await testChainPools(56, 'BSC');

    console.log('\n✅ Test complete!');
}

main().catch(console.error);
