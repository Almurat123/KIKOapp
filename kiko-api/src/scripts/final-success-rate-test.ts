import { fetchTransaction, fetchTransactionReceipt } from "../services/watcherService.js";
import { parseSwapTransaction, decodeSwapFromLogs } from "../services/txDecoder.js";
import { getChainConfig } from "../config/chainConfig.js";
import dotenv from "dotenv";
dotenv.config();

const NATIVE_ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'.toLowerCase();
const ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69'.toLowerCase();

async function testDirection(hash: string, trackedAddress: string, expected: string) {
    const chainId = 8453;
    const tx = await fetchTransaction(hash, chainId);
    const receipt = await fetchTransactionReceipt(hash, chainId);

    if (!tx || !receipt) return "FETCH_FAILED";

    // CORE LOGIC: We decode for the TRACKED address (just like our webhook does)
    const swap = await parseSwapTransaction(
        { hash, from: trackedAddress.toLowerCase(), to: tx.to, input: tx.input, value: tx.value },
        { logs: receipt.logs, status: parseInt(receipt.status, 16) },
        chainId
    );

    if (!swap) return "NOT_A_SWAP";

    const chainConfig = getChainConfig(chainId);
    const CASH_TOKENS = [NATIVE_ETH, chainConfig.wrappedNativeAddress, ...chainConfig.stablecoins].map(s => s.toLowerCase());

    const isTokenInCash = CASH_TOKENS.includes(swap.tokenIn.toLowerCase());
    const isTokenOutCash = CASH_TOKENS.includes(swap.tokenOut.toLowerCase());

    let detected: string = 'T2T';
    if (isTokenInCash && !isTokenOutCash) detected = 'BUY';
    else if (!isTokenInCash && isTokenOutCash) detected = 'SELL';

    if (detected === 'T2T') {
        if (swap.tokenIn.toLowerCase() === ZORA_TOKEN) detected = 'BUY';
        else if (swap.tokenOut.toLowerCase() === ZORA_TOKEN) detected = 'SELL';
    }

    return detected === expected ? "PASS" : `FAIL(Detected:${detected})`;
}

async function run() {
    const cases = [
        // 1. Zora BUY
        { hash: "0xd223b8b30f462b3c2c136f80f63f441bce133cfe996e35f9c6e373d73fc1391a", wallet: "0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241", expected: "BUY" },
        // 2. Zora SELL
        { hash: "0x3c56f2447beedddbf8df96f3d85709d64ffe738b432b8fd73aed8823b2835f29", wallet: "0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241", expected: "SELL" },
        // 3. Uniswap V3 BUY
        { hash: "0xf6892f33c0bd73f9829cd03429369de64f89fb5fd8d5b5fd17b62e0e8d57fce", wallet: "0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241", expected: "BUY" },
        // 4. Aggregator SELL (0x)
        { hash: "0x073ca144342911b151d7e268f63f441bace133cfe996e35f9c6e373d73fc1391a", wallet: "0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241", expected: "SELL" },
        // 5. Smart Wallet / Proxy Execute (T2T)
        { hash: "0x9e156b5abb508127bc0169f6180b6d894a04d289d5b5fd17b62e0e8d57fce59a", wallet: "0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241", expected: "BUY" }
    ];

    console.log("=========================================");
    console.log("🎯 FINAL SUCCESS RATE BENCHMARK");
    console.log("=========================================\n");

    let count = 0;
    for (const c of cases) {
        const result = await testDirection(c.hash, c.wallet, c.expected);
        console.log(`Case ${++count}: ${result}`);
    }
}

run().catch(console.error);
