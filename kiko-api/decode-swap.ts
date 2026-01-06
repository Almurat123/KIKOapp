/**
 * Script to get and decode the last successful swap for a token
 */

import { createPublicClient, http, decodeFunctionData, parseAbi, parseAbiItem } from 'viem';
import { base } from 'viem/chains';

const TOKEN_ADDRESS = '0x611cbc29d1a19408b3ff414c0cf692ad2bfd9b07';
const UNIVERSAL_ROUTER = '0x6fF5693b99212Da76ad316178A184AB56D299b43';

const UNIVERSAL_ROUTER_ABI = parseAbi([
    'function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable'
]);

async function main() {
    const client = createPublicClient({
        chain: base,
        transport: http('https://mainnet.base.org')
    });

    console.log(`Fetching logs for token transfers of ${TOKEN_ADDRESS}...`);
    const logs = await client.getLogs({
        address: TOKEN_ADDRESS as `0x${string}`,
        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
        fromBlock: 'latest', // Start from latest in reality would be block range
        toBlock: 'latest'
    });

    // Since I can't easily iterate back blocks with getLogs efficiently without a range,
    // I will try to find a recent transaction using a block range.
    const currentBlock = await client.getBlockNumber();
    const range = 100000n;

    console.log(`Searching range: ${currentBlock - range} to ${currentBlock}`);
    const logsInRange = await client.getLogs({
        address: TOKEN_ADDRESS as `0x${string}`,
        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
        fromBlock: currentBlock - range,
        toBlock: currentBlock
    });

    console.log(`Found ${logsInRange.length} transfers.`);

    for (const log of logsInRange.reverse()) {
        const txHash = log.transactionHash;
        const tx = await client.getTransaction({ hash: txHash as `0x${string}` });

        if (tx.to?.toLowerCase() === UNIVERSAL_ROUTER.toLowerCase()) {
            console.log(`\n✅ Found Universal Router Tx: ${txHash}`);
            console.log(`Value: ${tx.value}`);

            try {
                const decoded = decodeFunctionData({
                    abi: UNIVERSAL_ROUTER_ABI,
                    data: tx.input
                });
                console.log('Commands:', decoded.args[0]);
                console.log('Inputs count:', decoded.args[1].length);

                // Decode each input if possible
                // Command 0x10 is V4_SWAP
                // Command 0x0b is WRAP_ETH
                const commands = tx.input.slice(10); // skip 4 bytes selector + OFFSET encoding? No, decodeFunctionData handles it.

                // Let's just print the hex for now.
                return;
            } catch (e) {
                console.log('Failed to decode:', e.message);
            }
        }
    }
}

main().catch(console.error);
