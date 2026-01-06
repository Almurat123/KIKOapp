/**
 * Script to query Clanker Factory events and extract PoolKey for a token
 */

import { createPublicClient, http, parseAbiItem, decodeEventLog } from 'viem';
import { base } from 'viem/chains';

const CLANKER_FACTORY = '0xE85A59c628F7d27878ACeB4bf3b35733630083a9';
const TOKEN_ADDRESS = '0x611cbc29d1a19408b3ff414c0cf692ad2bfd9b07';

// TokenCreated event signature
// We need to find the actual event signature from the contract
const TOKEN_CREATED_EVENT = 'event TokenCreated(address indexed token, uint256 indexed tokenId, address indexed deployer, bytes32 salt, address hook, address pairedToken, int24 tickSpacing)';

async function main() {
    console.log('Creating client...');
    const client = createPublicClient({
        chain: base,
        transport: http('https://mainnet.base.org')
    });

    console.log(`\nSearching for TokenCreated event for ${TOKEN_ADDRESS}...`);

    // Get logs with token address as topic
    const paddedAddress = TOKEN_ADDRESS.toLowerCase().replace('0x', '0x000000000000000000000000');

    try {
        const logs = await client.getLogs({
            address: CLANKER_FACTORY as `0x${string}`,
            fromBlock: 0n,
            toBlock: 'latest',
            topics: [
                null, // any event
                paddedAddress as `0x${string}` // token address as topic1
            ]
        });

        console.log(`Found ${logs.length} logs with token as topic1`);

        for (const log of logs) {
            console.log('\n--- Log ---');
            console.log('Block:', log.blockNumber);
            console.log('Tx Hash:', log.transactionHash);
            console.log('Topics:', log.topics);
            console.log('Data length:', log.data?.length);
            console.log('Data (first 200 chars):', log.data?.slice(0, 200));
        }

        // Also try topic2
        console.log('\n\nSearching with token as topic2...');
        const logs2 = await client.getLogs({
            address: CLANKER_FACTORY as `0x${string}`,
            fromBlock: 0n,
            toBlock: 'latest',
            topics: [
                null,
                null,
                paddedAddress as `0x${string}` // token address as topic2
            ]
        });

        console.log(`Found ${logs2.length} logs with token as topic2`);

        for (const log of logs2) {
            console.log('\n--- Log ---');
            console.log('Block:', log.blockNumber);
            console.log('Tx Hash:', log.transactionHash);
            console.log('Topics:', log.topics);
            console.log('Data length:', log.data?.length);
            // Decode data as potential PoolConfig
            const data = log.data;
            if (data && data.length > 2) {
                // First 32 bytes chunks
                console.log('\nDecoding data as 32-byte chunks:');
                for (let i = 2; i < Math.min(data.length, 322); i += 64) {
                    const chunk = data.slice(i, i + 64);
                    console.log(`  [${(i - 2) / 64}]: 0x${chunk}`);
                }
            }
        }

    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

main().catch(console.error);
