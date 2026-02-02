/**
 * Debug Clanker V4 Pool Configuration
 * Find the actual pool configuration for CLAWNCH token
 */

import { ethers } from 'ethers';
import { callRpc } from './src/services/rpcManager.js';
import { computePoolId, getV4PoolInfo, V4PoolKey } from './src/services/dex/uniswapV4.js';

const CLAWNCH = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

// Clanker Hook addresses (Base)
const CLANKER_HOOKS = [
    { name: 'No Hook', address: '0x0000000000000000000000000000000000000000' },
    { name: 'ClankerHookDynamicFee v4.0.0', address: '0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC' },
    { name: 'ClankerHookStaticFee v4.0.0', address: '0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC' },
    { name: 'ClankerHookDynamicFeeV2 v4.1.0', address: '0xd60D6B218116cFd801E28F78d011a203D2b068Cc' },
    { name: 'ClankerHookStaticFeeV2 v4.1.0', address: '0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC' },
];

// Fee tiers to check (Clanker default is 1% = 10000)
const FEE_CONFIGS = [
    { fee: 100, tickSpacing: 1, name: '0.01%' },
    { fee: 500, tickSpacing: 10, name: '0.05%' },
    { fee: 3000, tickSpacing: 60, name: '0.3%' },
    { fee: 10000, tickSpacing: 200, name: '1%' },
    // Clanker custom fees
    { fee: 10000, tickSpacing: 100, name: '1% (ts=100)' },
    { fee: 10000, tickSpacing: 60, name: '1% (ts=60)' },
];

async function debugClankerPool() {
    console.log('🔍 Debugging Clanker V4 Pool for CLAWNCH\n');
    console.log('CLAWNCH:', CLAWNCH);
    console.log('WETH:', WETH);
    console.log('');

    // Sort tokens
    const [currency0, currency1] = CLAWNCH.toLowerCase() < WETH.toLowerCase()
        ? [CLAWNCH, WETH]
        : [WETH, CLAWNCH];

    console.log('Sorted: currency0 =', currency0);
    console.log('        currency1 =', currency1);
    console.log('');

    let foundCount = 0;

    for (const hook of CLANKER_HOOKS) {
        for (const { fee, tickSpacing, name } of FEE_CONFIGS) {
            const poolKey: V4PoolKey = {
                currency0: ethers.getAddress(currency0),
                currency1: ethers.getAddress(currency1),
                fee,
                tickSpacing,
                hooks: hook.address
            };

            try {
                const poolInfo = await getV4PoolInfo(poolKey, 8453);
                if (poolInfo) {
                    foundCount++;
                    console.log('✅ FOUND POOL!');
                    console.log('   Hook:', hook.name);
                    console.log('   Fee:', name, `(${fee})`);
                    console.log('   TickSpacing:', tickSpacing);
                    console.log('   PoolId:', poolInfo.poolId);
                    console.log('   Liquidity:', poolInfo.liquidity);
                    console.log('   sqrtPriceX96:', poolInfo.sqrtPriceX96.slice(0, 30) + '...');
                    console.log('   Tick:', poolInfo.tick);
                    console.log('   lpFee:', poolInfo.lpFee);
                    console.log('');
                }
            } catch (err) {
                // Skip errors
            }
        }
    }

    console.log(`\nTotal pools found: ${foundCount}`);

    // Also try USDC pairing
    console.log('\n\n--- Checking USDC pairing ---\n');

    const [currency0Usdc, currency1Usdc] = CLAWNCH.toLowerCase() < USDC.toLowerCase()
        ? [CLAWNCH, USDC]
        : [USDC, CLAWNCH];

    for (const hook of CLANKER_HOOKS) {
        for (const { fee, tickSpacing, name } of FEE_CONFIGS) {
            const poolKey: V4PoolKey = {
                currency0: ethers.getAddress(currency0Usdc),
                currency1: ethers.getAddress(currency1Usdc),
                fee,
                tickSpacing,
                hooks: hook.address
            };

            try {
                const poolInfo = await getV4PoolInfo(poolKey, 8453);
                if (poolInfo) {
                    console.log('✅ FOUND USDC POOL!');
                    console.log('   Hook:', hook.name);
                    console.log('   Fee:', name);
                    console.log('   Liquidity:', poolInfo.liquidity);
                    console.log('');
                }
            } catch {
                // Skip
            }
        }
    }
}

debugClankerPool().catch(console.error);
