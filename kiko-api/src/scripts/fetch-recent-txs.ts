import { getChainConfig } from "../config/chainConfig.js";
import dotenv from "dotenv";
dotenv.config();

async function getRecentTxs() {
    const args = process.argv.slice(2);
    const address = (args[0] || "0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241").toLowerCase();
    const chainId = 8453;
    const config = getChainConfig(chainId);

    // Alchemy URL usually contains the key if it's from env. 
    // If not, we might need ALCHEMY_API_KEY.
    const url = process.env.BASE_RPC_URL || config.rpcUrl;

    console.log(`[Fetch] Fetching recent txs for ${address} via Alchemy...`);

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getAssetTransfers",
            params: [{
                fromAddress: address,
                category: ["external", "internal", "erc20", "erc721", "erc1155"],
                order: "desc",
                maxCount: "0x5" // 5 txs
            }]
        })
    });

    const data = await res.json() as any;
    if (data.error) {
        console.error("[Fetch] Alchemy Error:", data.error);
        return;
    }

    const transfers = data.result?.transfers || [];
    console.log(`[Fetch] Found ${transfers.length} recent transfers.`);

    const hashes = Array.from(new Set(transfers.map((t: any) => t.hash)));
    console.log(`[Fetch] Unique hashes:`, hashes);
}

getRecentTxs().catch(console.error);
