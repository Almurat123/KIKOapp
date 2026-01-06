
import { JsonRpcProvider } from 'ethers';

const BSC_RPC = 'https://bsc-dataseed.binance.org';
const TX_HASH = '0x68b414d57c0e86208579fc9c0f91a6730aa8290bd67a718c54c330f81d11ff8c'; // Attempting to guess full hash or just use what I have.
// Wait, user logs only gave prefix `0x68b414d5`. I can't fetch by prefix.
// I need the full hash.
// Alchemy `transfers` provides full hash. The logs truncated it.
// I cannot debug it without the full hash.
// I will ask the user for the full hash OR look closely at the logs.
// The logs ONLY have `txHash.slice(0, 10)`.
// I am blocked on debugging the specific tx without the full hash.

// BUT, I can fix the `processedTxs.add` location bug immediately.
// And I can ask the user to clear the cache (restart server) to retry.
// The user has the hash in their Alchemy response (internal to the code running).
// I will proceed with fixing `watcherService.ts` logic first.

async function main() {
    const provider = new JsonRpcProvider(BSC_RPC);
    const tx = await provider.getTransaction(TX_HASH);
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!tx || !receipt) {
        console.log('Tx or Receipt not found');
        return;
    }

    console.log('Tx Input:', tx.data);
    console.log('Value:', tx.value.toString());

    // Import dynamically to avoid top-level await issues if any, or just standard import
    const { parseSwapTransaction } = require('../src/services/txDecoder');

    const swap = await parseSwapTransaction(
        {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            input: tx.data,
            value: tx.value.toString(),
        },
        {
            logs: receipt.logs,
            status: receipt.status,
        },
        56 // BSC Chain ID
    );

    console.log('Decoded Swap:', JSON.stringify(swap, null, 2));
}

main().catch(console.error);
