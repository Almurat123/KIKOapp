import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';

async function findToken() {
    const client = createPublicClient({
        chain: base,
        transport: http()
    });

    const factoryAddress = '0xE85A59c628F7d27878ACeB4bf3b35733630083a9';

    // Check last 10000 blocks
    const blockNumber = await client.getBlockNumber();
    console.log('Current block:', blockNumber);

    try {
        const logs = await client.getLogs({
            address: factoryAddress,
            fromBlock: blockNumber - 10000n,
            toBlock: blockNumber
        });

        console.log(`Found ${logs.length} logs`);

        if (logs.length > 0) {
            // Log the first log to see structure and identifying topics
            console.log('Sample Log:', JSON.stringify(logs[logs.length - 1], (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
                , 2));

            // Try to extract an address from topics (usually index 1 or 2 is token address)
            // or from data.
        }
    } catch (e) {
        console.error('Error fetching logs:', e);
    }
}

findToken();
