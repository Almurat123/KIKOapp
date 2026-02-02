/**
 * Enhanced Token Data Comparison Test
 * Uses chain detection and improved V3 TVL calculation
 */

import { ethers } from 'ethers';
import { callRpc } from './src/services/rpcManager.js';
import { findTokenPools } from './src/services/dex/poolInfo.js';
import { detectTokenChains } from './src/services/dex/chainDetector.js';
import { calculateV3TVL, getPriceFromSqrtX96 } from './src/services/dex/v3Math.js';

const ERC20_ABI = [
    'function totalSupply() view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)'
];

const erc20Interface = new ethers.Interface(ERC20_ABI);

// Test tokens - will auto-detect chains
const TEST_TOKENS = [
    { address: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be', name: 'Token 1' },
    { address: '0xB695559b26BB2c9703ef1935c37AeaE9526bab07', name: 'Token 2' },
    { address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', name: 'Token 3' },
    { address: '0x08807049890C6FD3B9075D61eBd6062F64C1ebeE', name: 'Token 4' },
    { address: '0xC0FE7F77ed2f522978b719372282ca89de8cF3e4', name: 'Token 5' },
    { address: '0x595E21b20E78674F8a64C1566A20b2b316Bc3511', name: 'Token 6' },
    { address: '0xc51A9250795c0186a6FB4A7D20A90330651e4444', name: 'Token 7' }
];

// Common quote tokens by chain
const QUOTE_TOKENS: Record<number, { symbol: string; address: string; decimals: number; priceUSD: number }[]> = {
    8453: [
        { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, priceUSD: 2400 },
        { symbol: 'USDC', address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', decimals: 6, priceUSD: 1 }
    ],
    1: [
        { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, priceUSD: 2400 },
        { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, priceUSD: 1 }
    ],
    56: [
        { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, priceUSD: 750 },
        { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, priceUSD: 1 }
    ]
};

interface TokenData {
    address: string;
    symbol?: string;
    decimals?: number;
    totalSupply?: bigint;
    price?: number;
    liquidity?: number;
    marketCap?: number;
}

async function getTokenInfo(tokenAddress: string, chainId: number): Promise<Partial<TokenData>> {
    try {
        const normalizedAddress = ethers.getAddress(tokenAddress.toLowerCase());

        const [symbolData, decimalsData, supplyData] = await Promise.all([
            callRpc<string>(chainId, 'eth_call', [{ to: normalizedAddress, data: erc20Interface.encodeFunctionData('symbol') }, 'latest']).catch(() => null),
            callRpc<string>(chainId, 'eth_call', [{ to: normalizedAddress, data: erc20Interface.encodeFunctionData('decimals') }, 'latest']).catch(() => null),
            callRpc<string>(chainId, 'eth_call', [{ to: normalizedAddress, data: erc20Interface.encodeFunctionData('totalSupply') }, 'latest']).catch(() => null)
        ]);

        const symbol = symbolData ? erc20Interface.decodeFunctionResult('symbol', symbolData)[0] : undefined;
        const decimals = decimalsData ? Number(erc20Interface.decodeFunctionResult('decimals', decimalsData)[0]) : undefined;
        const totalSupply = supplyData ? erc20Interface.decodeFunctionResult('totalSupply', supplyData)[0] as bigint : undefined;

        return { symbol, decimals, totalSupply };
    } catch (err: any) {
        return {};
    }
}

async function calculateTokenMetrics(
    tokenAddress: string,
    chainId: number,
    tokenDecimals: number
): Promise<{ price?: number; liquidity?: number }> {
    const quoteTokens = QUOTE_TOKENS[chainId] || [];

    let bestPrice: number | undefined;
    let totalLiquidity = 0;

    for (const quoteToken of quoteTokens) {
        try {
            const pools = await findTokenPools(tokenAddress, quoteToken.address, chainId);

            for (const pool of pools) {
                const isToken0 = pool.token0.toLowerCase() === tokenAddress.toLowerCase();

                // Calculate TVL using improved V3 math
                if (pool.liquidity && pool.sqrtPriceX96) {
                    const decimals0 = pool.token0Decimals || 18;
                    const decimals1 = pool.token1Decimals || 18;

                    const price0USD = isToken0 ? 0 : quoteToken.priceUSD;
                    const price1USD = isToken0 ? quoteToken.priceUSD : 0;

                    const tvl = calculateV3TVL(
                        BigInt(pool.sqrtPriceX96),
                        BigInt(pool.liquidity),
                        decimals0,
                        decimals1,
                        price0USD,
                        price1USD
                    );

                    totalLiquidity += tvl;

                    // Get price from V3 pool
                    const poolPrice = getPriceFromSqrtX96(
                        BigInt(pool.sqrtPriceX96),
                        decimals0,
                        decimals1
                    );

                    const priceUSD = (isToken0 ? poolPrice : 1 / poolPrice) * quoteToken.priceUSD;
                    if (!bestPrice || priceUSD > 0) {
                        bestPrice = priceUSD;
                    }
                } else if (pool.reserve0 && pool.reserve1) {
                    // V2 pool
                    const reserve0 = BigInt(pool.reserve0);
                    const reserve1 = BigInt(pool.reserve1);

                    const quoteReserve = isToken0 ? reserve1 : reserve0;
                    const quoteReserveFormatted = Number(quoteReserve) / Math.pow(10, quoteToken.decimals);

                    const poolLiquidityUSD = quoteReserveFormatted * quoteToken.priceUSD * 2;
                    totalLiquidity += poolLiquidityUSD;

                    if (pool.price) {
                        const rawPrice = isToken0 ? pool.price : 1 / pool.price;
                        const priceUSD = rawPrice * quoteToken.priceUSD;

                        if (!bestPrice || priceUSD > 0) {
                            bestPrice = priceUSD;
                        }
                    }
                }
            }
        } catch (err: any) {
            console.error(`Error calculating metrics for ${quoteToken.symbol}: ${err.message}`);
        }
    }

    return {
        price: bestPrice,
        liquidity: totalLiquidity > 0 ? totalLiquidity : undefined
    };
}

async function fetchDexScreenerData(tokenAddress: string, chainId: number): Promise<any> {
    try {
        const chainName = chainId === 8453 ? 'base' : chainId === 1 ? 'ethereum' : chainId === 56 ? 'bsc' : 'unknown';
        const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
        const response = await fetch(url);
        const data = await response.json();

        const pair = data.pairs?.find((p: any) => p.chainId === chainName);

        return pair ? {
            price: parseFloat(pair.priceUsd),
            liquidity: parseFloat(pair.liquidity?.usd || 0),
            marketCap: parseFloat(pair.fdv || pair.marketCap || 0)
        } : null;
    } catch (err: any) {
        return null;
    }
}

async function testToken(tokenAddress: string, name: string) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing ${name} (${tokenAddress})`);
    console.log('='.repeat(70));

    // Auto-detect chains
    console.log('\n🔍 Detecting chains...');
    const chainIds = await detectTokenChains(tokenAddress);

    if (chainIds.length === 0) {
        console.log('   ❌ Token not found on any supported chain');
        return;
    }

    console.log(`   ✅ Found on chains: ${chainIds.join(', ')}`);

    // Test on first detected chain
    const chainId = chainIds[0];
    const chainName = chainId === 8453 ? 'Base' : chainId === 1 ? 'Ethereum' : chainId === 56 ? 'BSC' : `Chain ${chainId}`;

    console.log(`\n📊 On-Chain Data (${chainName}):`);
    const tokenInfo = await getTokenInfo(tokenAddress, chainId);
    console.log(`   Symbol: ${tokenInfo.symbol || 'Unknown'}`);
    console.log(`   Decimals: ${tokenInfo.decimals || 'Unknown'}`);
    console.log(`   Total Supply: ${tokenInfo.totalSupply?.toString() || 'Unknown'}`);

    if (tokenInfo.decimals) {
        const metrics = await calculateTokenMetrics(tokenAddress, chainId, tokenInfo.decimals);
        console.log(`   Price: $${metrics.price?.toFixed(6) || 'Unknown'}`);
        console.log(`   Liquidity (TVL): $${metrics.liquidity?.toLocaleString() || 'Unknown'}`);

        if (metrics.price && tokenInfo.totalSupply) {
            const supplyFormatted = Number(tokenInfo.totalSupply) / Math.pow(10, tokenInfo.decimals);
            const marketCap = metrics.price * supplyFormatted;
            console.log(`   Market Cap: $${marketCap.toLocaleString()}`);
        }
    }

    console.log('\n🔍 DEX Screener Data:');
    const dexData = await fetchDexScreenerData(tokenAddress, chainId);
    if (dexData) {
        console.log(`   Price: $${dexData.price?.toFixed(6) || 'N/A'}`);
        console.log(`   Liquidity: $${dexData.liquidity?.toLocaleString() || 'N/A'}`);
        console.log(`   Market Cap: $${dexData.marketCap?.toLocaleString() || 'N/A'}`);
    } else {
        console.log(`   ❌ Not found on DEX Screener`);
    }

    await new Promise(r => setTimeout(r, 1000));
}

async function main() {
    console.log('🚀 Enhanced Token Data Comparison Test');
    console.log('Features: Auto chain detection + Improved V3 TVL calculation\n');

    for (const token of TEST_TOKENS) {
        await testToken(token.address, token.name);
    }

    console.log('\n✅ Test complete!');
}

main().catch(console.error);
