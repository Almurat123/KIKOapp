/**
 * Debug BULLA liquidity issue
 */

import { findTokenPools } from './src/services/dex/poolInfo.js';

const BULLA = '0x595E21b20E78674F8a64C1566A20b2b316Bc3511';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const USDT = '0x55d398326f99059fF775485246999027B3197955';

async function debugBulla() {
    console.log('🔍 Debugging BULLA Liquidity\n');

    // Check WBNB pools
    console.log('Checking BULLA/WBNB pools...');
    const wbnbPools = await findTokenPools(BULLA, WBNB, 56);
    console.log(`Found ${wbnbPools.length} pools`);

    for (const pool of wbnbPools) {
        console.log('\nPool:', pool.poolAddress);
        console.log('  Type:', pool.reserve0 ? 'V2' : 'V3');
        console.log('  Token0:', pool.token0Symbol);
        console.log('  Token1:', pool.token1Symbol);
        if (pool.reserve0) {
            console.log('  Reserve0:', pool.reserve0);
            console.log('  Reserve1:', pool.reserve1);
        }
        if (pool.liquidity) {
            console.log('  Liquidity:', pool.liquidity);
            console.log('  sqrtPriceX96:', pool.sqrtPriceX96?.slice(0, 20) + '...');
        }
        console.log('  Price:', pool.price);
    }

    // Check USDT pools
    console.log('\n\nChecking BULLA/USDT pools...');
    const usdtPools = await findTokenPools(BULLA, USDT, 56);
    console.log(`Found ${usdtPools.length} pools`);

    for (const pool of usdtPools) {
        console.log('\nPool:', pool.poolAddress);
        console.log('  Type:', pool.reserve0 ? 'V2' : 'V3');
        console.log('  Token0:', pool.token0Symbol);
        console.log('  Token1:', pool.token1Symbol);
        if (pool.reserve0) {
            console.log('  Reserve0:', pool.reserve0);
            console.log('  Reserve1:', pool.reserve1);
        }
        if (pool.liquidity) {
            console.log('  Liquidity:', pool.liquidity);
        }
        console.log('  Price:', pool.price);
    }
}

debugBulla().catch(console.error);
