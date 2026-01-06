/**
 * Wallet Watcher Service
 * Monitors tracked wallets and triggers copy trades when swaps are detected
 */

import prisma from '../lib/prisma.js';
import { parseSwapTransaction, DecodedSwap } from './txDecoder.js';

// Alchemy API for Base
const ALCHEMY_BASE_URL = process.env.ALCHEMY_BASE_URL || 'https://base-mainnet.g.alchemy.com/v2';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';

// Polling interval (ms)
const POLL_INTERVAL = 5000; // 5 seconds

// Track last processed block per wallet
const lastProcessedBlock: Map<string, number> = new Map();

// Track processed transactions to avoid duplicates (in-memory cache for current session)
const processedTxs: Set<string> = new Set();

/**
 * Check if a transaction has already been processed
 */
export function isTxProcessed(txHash: string): boolean {
    return processedTxs.has(txHash);
}

/**
 * Mark a transaction as processed
 */
export function markTxAsProcessed(txHash: string): void {
    processedTxs.add(txHash);
}

// Track startup time - only process transactions after this
const STARTUP_TIME = Date.now();

// Callback for when a swap is detected
type SwapCallback = (
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number
) => Promise<void>;

let swapCallback: SwapCallback | null = null;
let isRunning = false;
let pollTimer: NodeJS.Timeout | null = null;

/**
 * Set the callback for swap detection
 */
export function onSwapDetected(callback: SwapCallback): void {
    swapCallback = callback;
}

import { getChainConfig } from '../config/chainConfig.js';

/**
 * Fetch transaction by hash (Standard RPC)
 */
export async function fetchTransaction(txHash: string, chainId: number): Promise<any | null> {
    try {
        const { rpcUrl } = getChainConfig(chainId);
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_getTransactionByHash',
                params: [txHash],
            }),
        });
        const data = await response.json() as { result?: any };
        return data.result;
    } catch (error) {
        console.error(`[Watcher] Error fetching tx ${txHash} on chain ${chainId}:`, error);
        return null;
    }
}

/**
 * Fetch transaction receipt (Standard RPC)
 */
export async function fetchTransactionReceipt(txHash: string, chainId: number): Promise<any | null> {
    try {
        const { rpcUrl } = getChainConfig(chainId);
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_getTransactionReceipt',
                params: [txHash],
            }),
        });
        const data = await response.json() as { result?: any };
        return data.result;
    } catch (error) {
        console.error(`[Watcher] Error fetching receipt ${txHash} on chain ${chainId}:`, error);
        return null;
    }
}

/**
 * Fetch recent transactions using generic RPC (eth_getBlockByNumber)
 * Scanning full blocks is inefficient, but for standard RPC without indexer it's reliable for "latest".
 * We scan the last 5 blocks.
 */
async function fetchRecentTransactionsRpc(address: string, chainId: number): Promise<any[]> {
    try {
        const { rpcUrl } = getChainConfig(chainId);

        // 1. Get latest block number
        const blockRes = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] })
        });
        const blockData = await blockRes.json() as { result?: string };
        if (!blockData.result) return [];

        const latestBlock = parseInt(blockData.result, 16);
        const lookback = 20; // Increase lookback to avoid missing blocks between polls (20 blocks ~ 60s on BSC)
        // console.log(`[Watcher] Fetching blocks ${latestBlock - lookback} to ${latestBlock} for chain ${chainId}`);
        const transfers: any[] = [];

        // 2. Fetch blocks in parallel
        const promises = [];
        for (let i = 0; i < lookback; i++) {
            const blockNum = '0x' + (latestBlock - i).toString(16);
            promises.push(fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: [blockNum, true]
                })
            }).then(r => r.json()));
        }

        const results = await Promise.all(promises);

        // 3. Filter for transactions involving our address
        const lowerAddr = address.toLowerCase();
        for (const res of results) {
            const block = (res as any).result;
            if (!block || !block.transactions) continue;

            for (const tx of block.transactions) {
                if (tx.from?.toLowerCase() === lowerAddr || tx.to?.toLowerCase() === lowerAddr) {
                    const blockTimestamp = parseInt(block.timestamp, 16) * 1000; // hex seconds to ms
                    transfers.push({
                        hash: tx.hash,
                        metadata: { blockTimestamp },
                        // Alchemy-like shape for compatibility
                        from: tx.from,
                        to: tx.to,
                        value: parseInt(tx.value, 16) / 1e18
                    });
                }
            }
        }

        return transfers;
    } catch (error) {
        console.error(`[Watcher] RPC Scan error on chain ${chainId}:`, error);
        return [];
    }
}

/**
 * Fetch recent transactions for a wallet (Alchemy or RPC Fallback)
 */
async function fetchRecentTransactions(
    address: string,
    chainId: number,
    fromBlock?: number
): Promise<any[]> {
    // Stick to Alchemy for Base/Eth/BNB if configured, as it's deeper/better
    if ((chainId === 8453 || chainId === 1 || chainId === 56) && ALCHEMY_API_KEY) {
        try {
            const { apiUrl } = getChainConfig(chainId);
            // Fallback to hardcoded URL if not in config for some reason, though config should have it
            const baseUrl = apiUrl || ALCHEMY_BASE_URL;
            const url = `${baseUrl}/${ALCHEMY_API_KEY}`;

            // Validation: Check if key is actually present
            if (!ALCHEMY_API_KEY || ALCHEMY_API_KEY.length < 5) {
                console.warn('[Watcher] ALCHEMY_API_KEY appears invalid or empty');
                throw new Error('Invalid Alchemy Key');
            }

            // Retry logic for Alchemy API
            let retries = 3;
            let lastError;

            while (retries > 0) {
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Connection': 'close' // Prevent keep-alive issues (ECONNRESET)
                        },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'alchemy_getAssetTransfers',
                            params: [{
                                fromAddress: address,
                                category: ['external', 'erc20'],
                                order: 'desc',
                                maxCount: '0x14', // Last 20 txs
                                withMetadata: true,
                            }],
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`Alchemy responded with ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json() as { error?: any; result?: { transfers?: any[] } };
                    if (!data.error) {
                        const transfers = data.result?.transfers || [];
                        // console.log(`[Watcher] Alchemy returned ${transfers.length} transfers (Key: ...${ALCHEMY_API_KEY.slice(-4)})`);
                        return transfers;
                    }
                    console.warn('[Watcher] Alchemy returned error:', data.error);
                    // If logic error (e.g. bad params), don't retry
                    break;
                } catch (e: any) {
                    lastError = e;
                    retries--;
                    if (retries > 0) {
                        // console.log(`[Watcher] Alchemy fetch failed, retrying... (${3 - retries}/3)`);
                        await new Promise(r => setTimeout(r, 1000)); // Wait 1s
                    }
                }
            }

            throw lastError || new Error('Alchemy failed after retries');

        } catch (e) {
            console.warn('[Watcher] Alchemy failed, attempting RPC fallback', e);
        }
    }

    // Fallback or Standard for other chains (like BNB)
    const rpcTransfers = await fetchRecentTransactionsRpc(address, chainId);
    console.log(`[Watcher] RPC returned ${rpcTransfers.length} transfers, first metadata:`, rpcTransfers[0]?.metadata);
    return rpcTransfers;
}

/**
 * Check a single wallet for new swaps
 */
async function checkWallet(wallet: { address: string; chainId: number }): Promise<void> {
    const { address, chainId } = wallet;
    console.log(`[Watcher] Checking wallet: ${address}`);

    const transfers = await fetchRecentTransactions(address, chainId);
    console.log(`[Watcher] Found ${transfers.length} recent transfers for ${address.slice(0, 10)}`);

    for (const transfer of transfers) {
        const txHash = transfer.hash;
        console.log(`[Watcher] Checking tx ${txHash?.slice(0, 10)} - Processed: ${processedTxs.has(txHash)}`);

        // Skip if already processed (in-memory cache)
        if (processedTxs.has(txHash)) {
            continue;
        }

        // Alchemy returns blockTimestamp as ISO string, RPC fallback stores it as number (ms)
        // NOTE: Alchemy BSC returns metadata: null, so we can't rely on timestamp there
        let txTimestamp = 0;
        const rawTimestamp = transfer.metadata?.blockTimestamp;
        if (rawTimestamp) {
            if (typeof rawTimestamp === 'number') {
                txTimestamp = rawTimestamp; // Already in ms
            } else if (typeof rawTimestamp === 'string') {
                txTimestamp = new Date(rawTimestamp).getTime(); // Parse ISO string
            }
        }

        // Only apply timestamp filter if we have a valid timestamp
        // If timestamp is unavailable, we rely on processedTxs cache and DB check to prevent duplicates
        if (txTimestamp > 0 && txTimestamp < STARTUP_TIME - 60000) { // 1 minute grace period
            console.log(`[Watcher] Skipping old tx (before startup): ${txHash.slice(0, 10)}`);
            processedTxs.add(txHash);
            continue;
        }

        // Also check database to prevent processing if already has a Position for this tx
        const existingPosition = await prisma.position.findFirst({
            where: { entryTxHash: txHash }
        });
        if (existingPosition) {
            console.log(`[Watcher] Skipping tx with existing Position: ${txHash.slice(0, 10)}`);
            processedTxs.add(txHash);
            continue;
        }

        // Fetch full transaction and receipt
        const [tx, receipt] = await Promise.all([
            fetchTransaction(txHash, chainId),
            fetchTransactionReceipt(txHash, chainId),
        ]);

        if (!tx || !receipt) {
            console.log(`[Watcher] Could not fetch tx/receipt for ${txHash.slice(0, 10)}`);
            continue;
        }

        console.log(`[Watcher] Parsing tx ${txHash.slice(0, 10)}, from: ${tx.from.slice(0, 10)}, to: ${tx.to?.slice(0, 10)}`);

        // Try to decode as swap
        const swap = await parseSwapTransaction(
            {
                hash: txHash,
                from: tx.from,
                to: tx.to,
                input: tx.input,
                value: tx.value,
            },
            {
                logs: receipt.logs,
                status: parseInt(receipt.status, 16),
            },
            chainId
        );

        if (swap) {
            console.log('[Watcher] ✅ Swap detected:', {
                wallet: address,
                tokenIn: swap.tokenIn,
                tokenOut: swap.tokenOut,
                dex: swap.dexName,
            });

            // Trigger callback
            if (swapCallback) {
                await swapCallback(address, swap, chainId);
            }
        } else {
            console.log(`[Watcher] Not a swap tx: ${txHash.slice(0, 10)}`);
        }

        // Mark as processed (NOW safe to cache as we finished trying)
        processedTxs.add(txHash);
    }

    // Update last checked timestamp (composite key)
    if (transfers.length > 0) {
        await prisma.trackedWallet.update({
            where: {
                address_chainId: {
                    address: address.toLowerCase(),
                    chainId: chainId
                }
            },
            data: { lastCheckedTx: transfers[0]?.hash },
        }).catch(e => console.warn('[Watcher] Could not update lastCheckedTx:', e.message));
    }
}

/**
 * Main polling loop
 */
async function pollWallets(): Promise<void> {
    if (!isRunning) return;

    try {
        // Get all active tracked wallets
        const wallets = await prisma.trackedWallet.findMany({
            where: { activeConfigs: { gt: 0 } },
        });

        // Filter for EVM addresses only (must start with 0x)
        const evmWallets = wallets.filter((w: any) => w.address && w.address.startsWith('0x'));

        if (evmWallets.length === 0) {
            // No wallets to track
        } else {
            console.log(`[Watcher] Checking ${evmWallets.length} wallet(s)...`);

            // Check each wallet (sequentially to avoid rate limits)
            for (const wallet of evmWallets) {
                await checkWallet(wallet);
                // Small delay between wallets
                await new Promise(r => setTimeout(r, 500));
            }
        }
    } catch (error) {
        console.error('[Watcher] Poll error:', error);
    }

    // Schedule next poll
    if (isRunning) {
        pollTimer = setTimeout(pollWallets, POLL_INTERVAL);
    }
}

/**
 * Start the watcher service
 */
export async function startWatcher(): Promise<void> {
    if (isRunning) {
        console.log('[Watcher] Already running');
        return;
    }

    if (!ALCHEMY_API_KEY) {
        console.warn('[Watcher] No ALCHEMY_API_KEY - Watcher disabled');
        return;
    }

    console.log('[Watcher] Starting wallet watcher service...');

    // Pre-populate cache with existing transactions to avoid processing old txs on restart
    try {
        const wallets = await prisma.trackedWallet.findMany({
            where: { activeConfigs: { gt: 0 } },
        });

        const evmWallets = wallets.filter((w: any) => w.address && w.address.startsWith('0x'));
        console.log(`[Watcher] Pre-populating cache for ${evmWallets.length} wallet(s)...`);

        for (const wallet of evmWallets) {
            const transfers = await fetchRecentTransactions(wallet.address, wallet.chainId);
            for (const transfer of transfers) {
                if (transfer.hash) {
                    processedTxs.add(transfer.hash);
                }
            }
            console.log(`[Watcher] Cached ${transfers.length} existing txs for ${wallet.address.slice(0, 10)}`);
        }

        console.log(`[Watcher] Cache initialized with ${processedTxs.size} transactions`);
    } catch (error) {
        console.error('[Watcher] Error pre-populating cache:', error);
    }

    isRunning = true;

    // Start polling
    pollWallets();
}

/**
 * Stop the watcher service
 */
export function stopWatcher(): void {
    if (!isRunning) return;

    console.log('[Watcher] Stopping wallet watcher service...');
    isRunning = false;

    if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
    }
}

/**
 * Check if watcher is running
 */
export function isWatcherRunning(): boolean {
    return isRunning;
}

/**
 * Manually trigger a check for a specific wallet
 */
export async function checkWalletNow(address: string, chainId: number = 8453): Promise<void> {
    await checkWallet({ address: address.toLowerCase(), chainId });
}
