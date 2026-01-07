import { fetchTransaction, fetchTransactionReceipt } from "../services/watcherService.js";
import { parseSwapTransaction } from "../services/txDecoder.js";
import { getChainConfig } from "../config/chainConfig.js";
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function getRecentTxs() {
    const args = process.argv.slice(2);
    const address = (args[0] || "0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241").toLowerCase();
    const chainId = 8453;
    const config = getChainConfig(chainId);

    console.log(`[Debug] Checking transactions for wallet: ${address} on Base`);

    // Use ethers to find recent transactions via logs
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 10000; // Last ~10k blocks (~5 hours)

    console.log(`[Debug] Fetching logs from block ${fromBlock} to ${currentBlock}...`);

    // Look for Transfer events where target is sender or receiver
    const filter = {
        topics: [
            ethers.id("Transfer(address,address,uint256)"),
            null,
            null
        ],
        fromBlock,
        toBlock: "latest"
    };

    // We actually need two queries to be thorough if topics[1] or topics[2] is the address
    // But for now let's just use eth_getLogs with the address directly in the topics if we can,
    // or just filter after fetching.

    try {
        const res = await fetch(config.rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "eth_getLogs",
                params: [{
                    fromBlock: ethers.toBeHex(fromBlock),
                    toBlock: "latest",
                    topics: [
                        ethers.id("Transfer(address,address,uint256)"),
                        // Match either Sender or Receiver
                        null
                    ]
                }]
            })
        });

        const data = await res.json() as any;
        const allLogs = data.result || [];

        // Filter logs where the address is in either topic[1] or topic[2]
        const paddedAddress = ethers.zeroPadValue(address, 32).toLowerCase();
        const relevantLogs = allLogs.filter((log: any) =>
            (log.topics[1]?.toLowerCase() === paddedAddress) ||
            (log.topics[2]?.toLowerCase() === paddedAddress)
        );

        console.log(`[Debug] Found ${relevantLogs.length} relevant transfer logs.`);

        const hashes = Array.from(new Set(relevantLogs.map((l: any) => l.transactionHash))).slice(0, 10);

        if (hashes.length === 0) {
            console.log("[Debug] No transactions found in the last 10,000 blocks.");
            return;
        }

        for (const hash of hashes) {
            const h = hash as string;
            console.log(`\n[Debug] --- Testing Tx: ${h} ---`);
            const tx = await fetchTransaction(h, chainId);
            const receipt = await fetchTransactionReceipt(h, chainId);

            if (!tx || !receipt) {
                console.log(`[Debug] Failed to fetch tx/receipt for ${h}`);
                continue;
            }

            const swap = await parseSwapTransaction(
                { hash: h, from: address, to: tx.to, input: tx.input, value: tx.value },
                { logs: receipt.logs, status: parseInt(receipt.status, 16) },
                chainId
            );

            if (swap) {
                console.log(`[Debug] ✅ SWAP DETECTED: ${swap.tokenIn.slice(0, 10)} -> ${swap.tokenOut.slice(0, 10)}`);
                console.log(`        Amount In: ${swap.amountIn}`);
                console.log(`        Amount Out: ${swap.amountOut}`);
            } else {
                console.log("[Debug] ❌ Not a swap transaction.");
            }
        }
    } catch (error: any) {
        console.error("[Debug] Error:", error.message);
    }
}

getRecentTxs();
