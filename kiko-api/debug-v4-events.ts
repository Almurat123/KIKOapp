/**
 * Query V4 PoolManager Initialize events to find CLAWNCH pool
 */

import { ethers } from 'ethers';
import { callRpc } from './src/services/rpcManager.js';

const CLAWNCH = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const POOL_MANAGER = '0x498581ff718922c3f8e6a244956af099b2652b2b';

// Initialize event signature
// event Initialize(PoolId indexed id, Currency indexed currency0, Currency indexed currency1, uint24 fee, int24 tickSpacing, IHooks hooks, uint160 sqrtPriceX96, int24 tick)
const INITIALIZE_TOPIC = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');

async function findPoolEvents() {
    console.log('🔍 Searching for CLAWNCH V4 pool initialization events...\n');
    console.log('CLAWNCH:', CLAWNCH);
    console.log('PoolManager:', POOL_MANAGER);
    console.log('');

    // CLAWNCH as topic (padded to 32 bytes)
    const clawnchTopic = '0x000000000000000000000000' + CLAWNCH.slice(2).toLowerCase();

    try {
        // Query logs where CLAWNCH is currency0 or currency1
        const logsRequest = {
            fromBlock: '0x0',
            toBlock: 'latest',
            address: POOL_MANAGER,
            topics: [
                INITIALIZE_TOPIC,
                null,  // poolId (any)
                null,  // currency0 (any - we'll filter)
                null   // currency1 (any)
            ]
        };

        console.log('Querying logs...');
        const logs = await callRpc<any[]>(8453, 'eth_getLogs', [logsRequest]);

        console.log(`Found ${logs?.length || 0} Initialize events total\n`);

        if (!logs || logs.length === 0) {
            // Try with specific topic for CLAWNCH as currency0
            console.log('Trying filtered query for CLAWNCH...');
            const filteredRequest = {
                fromBlock: '0x0',
                toBlock: 'latest',
                address: POOL_MANAGER,
                topics: [
                    INITIALIZE_TOPIC,
                    null,
                    clawnchTopic
                ]
            };
            const filteredLogs = await callRpc<any[]>(8453, 'eth_getLogs', [filteredRequest]);
            console.log(`Found ${filteredLogs?.length || 0} events with CLAWNCH as currency0`);

            // Also try as currency1
            const filteredRequest2 = {
                fromBlock: '0x0',
                toBlock: 'latest',
                address: POOL_MANAGER,
                topics: [
                    INITIALIZE_TOPIC,
                    null,
                    null,
                    clawnchTopic
                ]
            };
            const filteredLogs2 = await callRpc<any[]>(8453, 'eth_getLogs', [filteredRequest2]);
            console.log(`Found ${filteredLogs2?.length || 0} events with CLAWNCH as currency1`);

            if (filteredLogs2 && filteredLogs2.length > 0) {
                console.log('\nDecoding events...');
                for (const log of filteredLogs2) {
                    decodeInitializeEvent(log);
                }
            }
        } else {
            // Filter and decode
            for (const log of logs) {
                const currency0 = '0x' + log.topics[2].slice(26);
                const currency1 = '0x' + log.topics[3].slice(26);

                if (currency0.toLowerCase() === CLAWNCH.toLowerCase() ||
                    currency1.toLowerCase() === CLAWNCH.toLowerCase()) {
                    decodeInitializeEvent(log);
                }
            }
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

function decodeInitializeEvent(log: any) {
    console.log('\n✅ Found CLAWNCH Pool:');
    console.log('   TxHash:', log.transactionHash);
    console.log('   Block:', parseInt(log.blockNumber, 16));
    console.log('   PoolId:', log.topics[1]);
    console.log('   currency0:', '0x' + log.topics[2].slice(26));
    console.log('   currency1:', '0x' + log.topics[3].slice(26));

    // Decode non-indexed data
    if (log.data && log.data.length > 2) {
        const data = log.data.slice(2);
        // fee (uint24) + tickSpacing (int24) + hooks (address) + sqrtPriceX96 (uint160) + tick (int24)
        // Packed as: fee(32) + tickSpacing(32) + hooks(32) + sqrtPriceX96(32) + tick(32)
        const fee = parseInt(data.slice(0, 64), 16);
        const tickSpacing = parseInt(data.slice(64, 128), 16);
        const hooks = '0x' + data.slice(128, 192).slice(24);

        console.log('   Fee:', fee);
        console.log('   TickSpacing:', tickSpacing);
        console.log('   Hooks:', hooks);
    }
}

findPoolEvents().catch(console.error);
