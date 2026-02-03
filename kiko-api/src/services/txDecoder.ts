/**
 * Transaction Decoder Service
 * Parses DEX swap transactions to extract token information
 */

import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getChainConfig } from '../config/chainConfig.js';

// Common DEX Router method signatures
const DEX_SIGNATURES = {
    // Uniswap V2 / Sushiswap / etc
    swapExactTokensForTokens: '0x38ed1739',
    swapTokensForExactTokens: '0x8803dbee',
    swapExactETHForTokens: '0x7ff36ab5',
    swapTokensForExactETH: '0x4a25d94a',
    swapExactTokensForETH: '0x18cbafe5',
    swapETHForExactTokens: '0xfb3bdb41',

    // Uniswap V3
    exactInputSingle: '0x414bf389',
    exactOutputSingle: '0xdb3e2198',
    exactInput: '0xc04b8d59',
    exactOutput: '0xf28c0498',
    multicall: '0xac9650d8',

    // 0x Protocol
    transformERC20: '0x415565b0',
    sellToUniswap: '0xd9627aa4',
    sellToPancakeSwap: '0xd9627aa4',

    // KyberSwap
    swap: '0x12aa3caf',
    swapGeneric: '0xe21fd0e9',

    // Aerodrome / V2 Forks
    swapExactInput: '0xb80c2f09', // Often used by Aerodrome/Velodrome router proxies
};



// ERC20 Transfer event signature
const TRANSFER_EVENT = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface DecodedSwap {
    txHash?: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    router: string;
    dexName: string;
}

/**
 * Check if a transaction is a swap
 */
export function isSwapTransaction(txData: string): boolean {
    if (!txData || txData.length < 10) return false;

    const selector = txData.slice(0, 10).toLowerCase();
    return Object.values(DEX_SIGNATURES).some(sig => sig.toLowerCase() === selector);
}

/**
 * Get DEX name from router address
 */
export function getDexName(routerAddress: string, chainId: number): string {
    const address = routerAddress.toLowerCase();

    // Base chain routers
    if (chainId === 8453) {
        const baseRouters: Record<string, string> = {
            '0x2626664c2603336e57b271c5c0b26f421741e481': 'Uniswap V3',
            '0x6ff5693b99212da76ad316178a184ab56d299b43': 'Uniswap Universal Router (v4)',
            '0x498581ff718922c3f8e6a244956af099b2652b2b': 'Uniswap v4 PoolManager',
            '0x6131b5fae19ea4f9d964eac0408e4408b66337b5': 'KyberSwap',
            '0x0000000000001ff3684f28c67538d4d072c22734': '0x Protocol',
            '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae': 'LiFi',
        };
        return baseRouters[address] || 'Unknown DEX';
    }

    // BSC Routers
    if (chainId === 56) {
        const bscRouters: Record<string, string> = {
            '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'PancakeSwap V2',
            '0xdef1c0ded9bec7f1a1670819833240faca6db2a2': '0x Protocol',
        };
        return bscRouters[address] || 'Unknown DEX';
    }

    // Ethereum Routers (Common ones)
    if (chainId === 1) {
        const ethRouters: Record<string, string> = {
            '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2',
            '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
            '0xdef1c0ded9bec7f1a1670819833240faca6db2a2': '0x Protocol',
        };
        return ethRouters[address] || 'Unknown DEX';
    }

    return 'Unknown DEX';
}

/**
 * Decode swap from transaction receipt logs
 * Uses Transfer events to determine tokens and amounts
 */
export function decodeSwapFromLogs(
    logs: Array<{ address: string; topics: string[]; data: string }>,
    from: string,
    nativeValue: string = '0'
): DecodedSwap | null {
    logger.debug(LogCode.DEC_SWAP_DETECTION, 'Decoding swap from transaction logs', {
        logCount: logs.length,
        from,
        nativeValue
    });

    const transfers: Array<{
        token: string;
        from: string;
        to: string;
        amount: bigint;
    }> = [];

    // Parse Transfer events
    for (const log of logs) {
        if (log.topics[0]?.toLowerCase() === TRANSFER_EVENT.toLowerCase() && log.topics.length >= 3) {
            const fromAddress = '0x' + log.topics[1].slice(26);
            const toAddress = '0x' + log.topics[2].slice(26);
            const amount = BigInt(log.data || '0');

            transfers.push({
                token: log.address.toLowerCase(),
                from: fromAddress.toLowerCase(),
                to: toAddress.toLowerCase(),
                amount,
            });
        }
    }

    logger.debug(LogCode.DEC_SWAP_DETECTION, `Found ${transfers.length} Transfer events in logs`);
    for (const t of transfers) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'Log transfer detail', {
            token: t.token,
            from: t.from,
            to: t.to,
            amount: t.amount.toString()
        });
    }

    if (transfers.length < 1) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'No transfer events found in logs');
        return null;
    }

    // Find token in (sent TO user's wallet) - what they BOUGHT
    // Logic: 
    // 1. Filter out transfers that are likely internal router operations (e.g. 1inch aggregator itself)
    // 2. Taking the LAST transfer usually represents the final output of the swap chain
    // 3. Filter out zero value transfers

    const incomingTransfers = transfers.filter(t => t.to.toLowerCase() === from.toLowerCase());
    logger.debug(LogCode.DEC_SWAP_DETECTION, 'Incoming transfers detected', { count: incomingTransfers.length, wallet: from });

    // Known router/system addresses to ignore as "tokens"
    const IGNORED_ADDRESSES = [
        '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x V4
        '0x0000000000000000000000000000000000000000', // Null
    ];

    // Identify what user RECEIVED (Result of Swap -> tokenOut)
    const tokenReceived = incomingTransfers
        .reverse() // check from end (most likely final swap output)
        .find(t => !IGNORED_ADDRESSES.includes(t.token.toLowerCase()) && t.amount > 0n);

    // Identify what user SENT (Source of Swap -> tokenIn)
    // Note: If user sent ETH, there is no Transfer event from user. Logic handles this below.
    let tokenSent = transfers.find(t => t.from.toLowerCase() === from.toLowerCase());
    let amountSent = tokenSent?.amount.toString();
    let tokenSentAddress = tokenSent?.token;

    logger.debug(LogCode.DEC_SWAP_DETECTION, 'Transaction logic analysis', {
        received: tokenReceived?.token,
        sent: tokenSentAddress
    });

    // Handle Native ETH Sent case (User sent ETH, so no outgoing Transfer event)
    if (!tokenSent && BigInt(nativeValue) > 0) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'No outgoing token transfer found but native value present; assuming native asset input');
        tokenSentAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'; // Native ETH placeholder
        amountSent = nativeValue;
    }

    // FALLBACK: If we found a valid tokenSent (SELL) but no tokenReceived
    // This happens when the tokenSent goes to a proxy, and the ETH/Result comes back via internal tx (often not logged as Transfer if Native ETH)
    // If we detected a SELL (Token Out from Wallet) but no Token In:
    if (tokenSentAddress && !tokenReceived) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'Found source token but no incoming transfer; assuming native asset output');
        return {
            tokenIn: tokenSentAddress, // What user sent
            tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Result is ETH
            amountIn: amountSent || '0',
            amountOut: '0', // Unknown
            router: '',
            dexName: '',
        };
    }

    if (!tokenReceived || !tokenSentAddress || !amountSent) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'Decoding failed: missing required swap fields', {
            hasReceived: !!tokenReceived,
            hasSent: !!tokenSentAddress,
            hasAmount: !!amountSent
        });
        return null;
    }

    // Standard Case: User Sent A, Received B
    // tokenIn = What Sent (Source)
    // tokenOut = What Received (Result)
    // Standard Case: User Sent A, Received B
    // tokenIn = What Sent (Source)
    // tokenOut = What Received (Result)
    logger.info(LogCode.DEC_SUCCESS, 'Swap successfully decoded from logs', {
        tokenIn: tokenSentAddress,
        tokenOut: tokenReceived.token
    });
    logger.debug(LogCode.DEC_SUCCESS, 'Decoded swap values', {
        amountIn: amountSent,
        amountOut: tokenReceived.amount.toString()
    });

    return {
        tokenIn: tokenSentAddress,
        tokenOut: tokenReceived.token,
        amountIn: amountSent,
        amountOut: tokenReceived.amount.toString(),
        router: '',
        dexName: '',
    };
}

/**
 * Parse a transaction to extract swap details
 */
export async function parseSwapTransaction(
    tx: {
        hash: string;
        from: string;
        to: string;
        input: string;
        value: string;
    },
    receipt: {
        logs: Array<{ address: string; topics: string[]; data: string }>;
        status: number;
    },
    chainId: number
): Promise<DecodedSwap | null> {
    // Only process successful transactions
    if (receipt.status !== 1) return null;

    // OLD: Check if it's a swap transaction based on method signature
    // This was too strict - many DEXes use custom methods
    // if (!isSwapTransaction(tx.input)) return null;

    // NEW: Just try to decode from logs - if there are valid transfers, it's a swap
    // This approach works with ANY DEX, aggregator, or custom router

    // Decode from logs, PASSING tx.value
    const swap = decodeSwapFromLogs(receipt.logs, tx.from, tx.value);
    if (!swap) return null;

    // Add router info
    swap.router = tx.to;
    swap.dexName = getDexName(tx.to, chainId);
    swap.txHash = tx.hash;

    // Handle native ETH
    const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const chainConfig = getChainConfig(chainId);
    const WRAPPED_NATIVE = chainConfig.wrappedNativeAddress;

    // If value > 0, user sent Native Token (e.g. Buying something with BNB)
    // We do NOT override tokenOut here. tokenOut is determined by what was RECEIVED (Logs).
    // tokenIn is already handled in decodeSwapFromLogs or by assuming Native input if no outgoing transfer.

    // Logic was:
    // if (BigInt(tx.value) > 0) {
    //    swap.tokenOut = NATIVE_ADDRESS;
    //    swap.amountOut = tx.value;
    // }
    // This was WRONG for BUYs. Removing it.

    // However, if we detected it was a swap where we couldn't find tokenOut from logs,
    // AND it was a simple send, it wouldn't be here.
    // We already handled "Native Sent" in decodeSwapFromLogs:
    // "No tokenSent found but nativeValue > 0, assuming User SENT ETH/BNB" -> tokenIn = Native.


    // Normalize Wrapped Native to Native for display
    if (swap.tokenIn.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
        swap.tokenIn = NATIVE_ADDRESS;
    }
    if (swap.tokenOut.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
        swap.tokenOut = NATIVE_ADDRESS;
    }

    return swap;
}
