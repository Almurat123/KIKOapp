/**
 * Query V4 Pool directly by PoolId from DEX Screener
 */

import { ethers } from 'ethers';
import { callRpc } from './src/services/rpcManager.js';

// StateView contract on Base
const STATE_VIEW = '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71';

// StateView ABI
const STATE_VIEW_ABI = [
    'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
    'function getLiquidity(bytes32 poolId) view returns (uint128)'
];

const stateViewInterface = new ethers.Interface(STATE_VIEW_ABI);

// V4 Pool IDs from DEX Screener for CLAWNCH
const CLAWNCH_POOLS = [
    {
        poolId: '0x03d3c21ea1daf51dd2898ebaf9342a93374877ba6ab34cc7ffe5b5d43ee46e0a',
        pair: 'CLAWNCH/WETH',
        liquidity: '$2.1M'
    },
    {
        poolId: '0x6f9064ea2bbfd7f2619d80fd8d4546314ca288289dcdbf2c2e16517514d82eb3',
        pair: 'CLAWNCH/USDC',
        liquidity: '$31K'
    },
    {
        poolId: '0xa91cfaaa7eec020520f78f128b79517312bc4b5571cdc10b0003f09474bc16aa',
        pair: 'CLAWNCH/USDC',
        liquidity: '$52K'
    }
];

async function queryPoolById(poolId: string, pairName: string) {
    console.log(`\n📊 Querying ${pairName}...`);
    console.log(`   PoolId: ${poolId}`);

    try {
        // Get Slot0
        const slot0Data = stateViewInterface.encodeFunctionData('getSlot0', [poolId]);
        const slot0Result = await callRpc<string>(8453, 'eth_call', [{
            to: STATE_VIEW,
            data: slot0Data
        }, 'latest']);

        if (slot0Result && slot0Result !== '0x') {
            const decoded = stateViewInterface.decodeFunctionResult('getSlot0', slot0Result);
            const sqrtPriceX96 = decoded[0] as bigint;
            const tick = Number(decoded[1]);
            const protocolFee = Number(decoded[2]);
            const lpFee = Number(decoded[3]);

            console.log(`   ✅ sqrtPriceX96: ${sqrtPriceX96.toString().slice(0, 20)}...`);
            console.log(`   ✅ tick: ${tick}`);
            console.log(`   ✅ protocolFee: ${protocolFee}`);
            console.log(`   ✅ lpFee: ${lpFee} (${lpFee / 10000}%)`);
        } else {
            console.log('   ❌ Failed to get Slot0');
        }

        // Get Liquidity
        const liquidityData = stateViewInterface.encodeFunctionData('getLiquidity', [poolId]);
        const liquidityResult = await callRpc<string>(8453, 'eth_call', [{
            to: STATE_VIEW,
            data: liquidityData
        }, 'latest']);

        if (liquidityResult && liquidityResult !== '0x') {
            const liquidity = BigInt(liquidityResult);
            console.log(`   ✅ Liquidity: ${liquidity.toString()}`);
        } else {
            console.log('   ❌ Failed to get Liquidity');
        }

    } catch (err: any) {
        console.log(`   ❌ Error: ${err.message?.substring(0, 100)}`);
    }
}

async function main() {
    console.log('🔍 Querying V4 Pools by PoolId (from DEX Screener)\n');
    console.log('StateView:', STATE_VIEW);

    for (const pool of CLAWNCH_POOLS) {
        await queryPoolById(pool.poolId, pool.pair);
    }
}

main().catch(console.error);
