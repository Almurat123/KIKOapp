import { ethers } from 'ethers';
import 'dotenv/config';

async function main() {
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

    // Zora Factory on Base
    const address = '0x777777751622c0d3258f214F9DF38E35BF45baF3';

    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);

    // Fetch logs from last 1000 blocks
    const fromBlock = currentBlock - 1000;

    console.log(`Fetching logs from ${fromBlock} to ${currentBlock}...`);

    const logs = await provider.getLogs({
        address,
        fromBlock,
        toBlock: currentBlock,
    });

    console.log(`Found ${logs.length} logs.`);

    if (logs.length > 0) {
        console.log('Last log:', logs[logs.length - 1]);

        // Try to decode if possible, or just show topics
        // Common event for factories is Created(address, ...)
        // Topic[0] is event signature hash.

        logs.slice(-5).forEach((log, i) => {
            console.log(`\n--- Log ${i} ---`);
            console.log('Topics:', log.topics);
            console.log('Data:', log.data);
        });
    }
}

main().catch(console.error);
