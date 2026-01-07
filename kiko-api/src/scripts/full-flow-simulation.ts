import { fetchTransaction, fetchTransactionReceipt } from "../services/watcherService.js";
import { parseSwapTransaction } from "../services/txDecoder.js";
import { getTokenInfo } from "../services/ai/tokenDetector.js";
import { getChainConfig } from "../config/chainConfig.js";
import { prisma } from "../db/prisma.js";
import { detectLaunchpadToken } from "../services/ai/launchpadDetector.js";
import dotenv from "dotenv";
dotenv.config();

/**
 * Full simulation of handleSwapDetected
 */
async function simulateAutoTradeFlow(targetWallet: string, swap: any, chainId: number) {
    console.log(`[Flow] 🔍 Matching configurations for ${targetWallet.slice(0, 10)}...`);

    const configs = await prisma.copyTradeConfig.findMany({
        where: { targetWallet: targetWallet.toLowerCase(), status: 'active' },
        include: { user: true }
    });

    if (configs.length === 0) {
        console.log(`[Flow] ⏭️ No active configs.`);
        return;
    }

    const chainConfig = getChainConfig(chainId);
    const CASH_TOKENS = [
        '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        chainConfig.wrappedNativeAddress,
        ...chainConfig.stablecoins
    ].map(s => s.toLowerCase());

    const isTokenInCash = CASH_TOKENS.includes(swap.tokenIn.toLowerCase());
    const isTokenOutCash = CASH_TOKENS.includes(swap.tokenOut.toLowerCase());

    const isBuy = isTokenInCash && !isTokenOutCash;
    const isSell = !isTokenInCash && isTokenOutCash;
    const isTokenToToken = !isTokenInCash && !isTokenOutCash;

    console.log(`[Flow] Type: ${isBuy ? 'BUY' : isSell ? 'SELL' : isTokenToToken ? 'Token-to-Token' : 'Unknown'}`);

    if (isBuy) {
        await handleBuyFlow(targetWallet, swap, chainId, configs);
    } else if (isSell) {
        await handleSellFlow(targetWallet, swap, chainId, configs);
    } else if (isTokenToToken) {
        const ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69'.toLowerCase();
        if (swap.tokenIn.toLowerCase() === ZORA_TOKEN) {
            console.log(`[Flow] 🟡 ZORA-to-Token -> Treating as BUY`);
            await handleBuyFlow(targetWallet, swap, chainId, configs);
        } else if (swap.tokenOut.toLowerCase() === ZORA_TOKEN) {
            console.log(`[Flow] 🟡 Token-to-ZORA -> Treating as SELL`);
            await handleSellFlow(targetWallet, swap, chainId, configs);
        } else {
            console.log(`[Flow] ⚡ Parallel lightning trigger: SELL and BUY`);
            await Promise.all([
                handleSellFlow(targetWallet, swap, chainId, configs),
                handleBuyFlow(targetWallet, swap, chainId, configs)
            ]);
        }
    }
}

async function handleBuyFlow(targetWallet: string, swap: any, chainId: number, configs: any[]) {
    const tokenToBuy = swap.tokenOut;
    const [tokenInfo, launchpad] = await Promise.all([
        getTokenInfo(tokenToBuy, chainId),
        detectLaunchpadToken(tokenToBuy, chainId)
    ]);
    if (!tokenInfo) return;

    for (const config of configs) {
        if (launchpad?.provider === 'zora') {
            console.log(`\n[SIMULATION] ➔ 🚀 TRIGGERED ZoraFastSwap for ${config.user.walletAddress.slice(0, 10)}`);
            console.log(`[SIMULATION]    Buying ${tokenInfo.symbol} on ZORA Platform`);
        } else {
            console.log(`\n[SIMULATION] ➔ 🚀 TRIGGERED executeSwapInstant for ${config.user.walletAddress.slice(0, 10)}`);
            console.log(`[SIMULATION]    Buying ${tokenInfo.symbol} via 0x/DEX`);
        }
    }
}

async function handleSellFlow(targetWallet: string, swap: any, chainId: number, configs: any[]) {
    const tokenToSell = swap.tokenIn;
    for (const config of configs) {
        const hasPos = await prisma.position.findFirst({
            where: { userId: config.userId, tokenAddress: tokenToSell, status: 'OPEN' }
        });
        if (hasPos) {
            console.log(`\n[SIMULATION] ➔ 🚀 TRIGGERED MirrorSell for ${config.user.walletAddress.slice(0, 10)}`);
            console.log(`[SIMULATION]    Selling ${tokenToSell.slice(0, 10)}...`);
        } else {
            console.log(`[Flow] ⏭️ No open position for user ${config.userId.slice(0, 10)}, skipping sell.`);
        }
    }
}

async function runTest(label: string, swap: any) {
    console.log(`\n\n================================================`);
    console.log(`🚀 ${label}`);
    console.log(`================================================`);
    await simulateAutoTradeFlow("0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241", swap, 8453);
}

async function run() {
    // 1. Pure Buy (ETH -> ZORA)
    await runTest("PURE SIMULATION: ETH -> ZORA (BUY)", {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: '0x1111111111166b7fe7bd91427724b487980afc69',
        amountIn: '100000000000000000',
        amountOut: '1000000'
    });

    // 2. Pure Sell (ZORA -> ETH)
    await runTest("PURE SIMULATION: ZORA -> ETH (SELL)", {
        tokenIn: '0x1111111111166b7fe7bd91427724b487980afc69',
        tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        amountIn: '1000000',
        amountOut: '100000000000000000'
    });

    // 3. Real Tx (USDC -> ZORA)
    const realBuyHash = "0xd223b8b30f462b3c2c136f80f63f441bce133cfe996e35f9c6e373d73fc1391a";
    const tx = await fetchTransaction(realBuyHash, 8453);
    const receipt = await fetchTransactionReceipt(realBuyHash, 8453);
    if (tx && receipt) {
        const swap = await parseSwapTransaction(
            { hash: realBuyHash, from: "0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241", to: tx.to, input: tx.input, value: tx.value },
            { logs: receipt.logs, status: parseInt(receipt.status, 16) },
            8453
        );
        if (swap) await runTest("REAL TX SIMULATION: BUY", swap);
    }
}

run().catch(console.error);
