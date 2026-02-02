/**
 * Debug script to investigate WETH/USDC pool discovery issue
 */

import { ethers } from 'ethers';
import { callRpc } from './src/services/rpcManager.js';

const v3FactoryInterface = new ethers.Interface([
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
]);

const v3PoolInterface = new ethers.Interface([
    'function liquidity() view returns (uint128)',
    'function token0() view returns (address)',
    'function token1() view returns (address)'
]);

async function debugPool() {
    const chainId = 8453;
    // Use getAddress to ensure proper checksum
    const WETH = ethers.getAddress('0x4200000000000000000000000000000000000006');
    const USDC = ethers.getAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');  // lowercase then checksum
    const factory = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';

    const fees = [100, 500, 3000, 10000];

    console.log('Debugging WETH/USDC pools on Base...');
    console.log('Factory:', factory);
    console.log('WETH:', WETH);
    console.log('USDC:', USDC);
    console.log('');

    for (const fee of fees) {
        try {
            const poolData = v3FactoryInterface.encodeFunctionData('getPool', [WETH, USDC, fee]);
            const result = await callRpc<string>(chainId, 'eth_call', [{
                to: factory,
                data: poolData
            }, 'latest']);

            console.log(`Fee ${fee} (${fee / 10000}%):`);
            console.log(`  Raw result: ${result?.slice(0, 30)}...`);

            if (result && result !== '0x' + '0'.repeat(64)) {
                const poolAddr = ethers.getAddress('0x' + result.slice(-40));
                console.log(`  Pool address: ${poolAddr}`);

                // Check pool liquidity
                const liquidityData = v3PoolInterface.encodeFunctionData('liquidity');
                const liquidityResult = await callRpc<string>(chainId, 'eth_call', [{
                    to: poolAddr,
                    data: liquidityData
                }, 'latest']);

                if (liquidityResult) {
                    const liquidity = v3PoolInterface.decodeFunctionResult('liquidity', liquidityResult)[0];
                    console.log(`  Liquidity: ${liquidity.toString()}`);
                }
            } else {
                console.log(`  No pool exists`);
            }
        } catch (err: any) {
            console.log(`Fee ${fee}: ERROR - ${err.message?.substring(0, 100)}`);
        }
        console.log('');
    }
}

debugPool().catch(console.error);
