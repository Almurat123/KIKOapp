/**
 * Wallet Watcher Service
 * Monitors tracked wallets and triggers copy trades when swaps are detected
 */

import prisma from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { parseSwapTransaction, DecodedSwap } from './txDecoder.js';
import { callRpc as rpcCall, getTransactionByHash, getTransactionReceipt } from './rpcManager.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { get as cacheGet, set as cacheSet, acquireLock, releaseLock } from '../cache/cacheClient.js';
import { randomUUID } from 'node:crypto';
import { buildTxIdentityKey, normalizeTxIdentity } from '../utils/txIdentity.js';

const PROFILE = process.env.COPYTRADE_PROFILE ? process.env.COPYTRADE_PROFILE === 'true' : true;

// Alchemy API for Base
const ALCHEMY_BASE_URL = process.env.ALCHEMY_BASE_URL || 'https://base-mainnet.g.alchemy.com/v2';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
// Chains supported by our Alchemy plan: Base (8453), Eth (1), BSC (56)
const ALCHEMY_SUPPORTED_CHAINS = new Set([8453, 1, 56, 42161, 10, 137]);

// Polling interval (ms)
const POLL_INTERVAL = 5000; // 5 seconds

// Track last processed block per wallet
const lastProcessedBlock: Map<string, number> = new Map();

// Track processed transactions to avoid duplicates (in-memory cache for current session)
const processedTxs: Set<string> = new Set();
const PROCESSED_TX_TTL_SECONDS = Number(process.env.COPYTRADE_PROCESSED_TX_TTL_SEC || 24 * 60 * 60);
const TX_INFLIGHT_LOCK_TTL_SECONDS = Number(process.env.COPYTRADE_TX_INFLIGHT_TTL_SEC || 45);

function normalizeTxHash(chainId: number, txHash: string): string {
    return normalizeTxIdentity(chainId, txHash) || '';
}

function txProcessedCacheKey(txHash: string, chainId: number): string {
    return `copytrade:processed:${chainId}:${normalizeTxHash(chainId, txHash)}`;
}

function txInflightLockKey(txHash: string, chainId: number): string {
    return `copytrade:inflight:${chainId}:${normalizeTxHash(chainId, txHash)}`;
}

/**
 * Check if a transaction has already been processed
 */
export function isTxProcessed(txHash: string): boolean {
    return processedTxs.has(txHash.toLowerCase());
}

export async function isTxProcessedDistributed(txHash: string, chainId: number): Promise<boolean> {
    const normalized = normalizeTxHash(chainId, txHash);
    if (processedTxs.has(normalized)) {
        return true;
    }

    const cached = await cacheGet(txProcessedCacheKey(txHash, chainId));
    if (cached) {
        processedTxs.add(normalized);
        return true;
    }
    return false;
}

/**
 * Mark a transaction as processed
 */
export function markTxAsProcessed(txHash: string): void {
    processedTxs.add(txHash.toLowerCase());
}

export async function markTxAsProcessedDistributed(txHash: string, chainId: number): Promise<void> {
    processedTxs.add(normalizeTxHash(chainId, txHash));
    await cacheSet(txProcessedCacheKey(txHash, chainId), '1', PROCESSED_TX_TTL_SECONDS).catch(() => { });
}

export async function claimTxProcessingLockDistributed(txHash: string, chainId: number): Promise<string | null> {
    if (await isTxProcessedDistributed(txHash, chainId)) return null;
    const key = txInflightLockKey(txHash, chainId);
    const lockValue = randomUUID();
    const acquired = await acquireLock(key, TX_INFLIGHT_LOCK_TTL_SECONDS, lockValue).catch(() => false);
    if (!acquired) return null;

    // Double-check after acquiring lock to avoid race with a just-finished processor.
    if (await isTxProcessedDistributed(txHash, chainId)) {
        await releaseLock(key, lockValue).catch(() => { });
        return null;
    }
    return lockValue;
}

export async function releaseTxProcessingLockDistributed(txHash: string, chainId: number, lockValue: string): Promise<void> {
    if (!lockValue) return;
    const key = txInflightLockKey(txHash, chainId);
    await releaseLock(key, lockValue).catch(() => { });
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
    const start = Date.now();
    try {
        const result = await getTransactionByHash(chainId, txHash);
        if (PROFILE) {
            logger.info(LogCode.SYS_INFO, '[Profile] fetchTransaction', {
                chainId,
                tx: txHash.slice(0, 12),
                ms: Date.now() - start
            });
        }
        return result;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching transaction by hash', { txHash, chainId, error: error.message });
        return null;
    }
}

/**
 * Fetch transaction receipt (Standard RPC)
 */
export async function fetchTransactionReceipt(txHash: string, chainId: number): Promise<any | null> {
    const start = Date.now();
    try {
        const result = await getTransactionReceipt(chainId, txHash);
        if (PROFILE) {
            logger.info(LogCode.SYS_INFO, '[Profile] fetchReceipt', {
                chainId,
                tx: txHash.slice(0, 12),
                ms: Date.now() - start
            });
        }
        return result;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching transaction receipt', { txHash, chainId, error: error.message });
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
        // 1. Get latest block number
        const blockHex = await rpcCall<string>(chainId, 'eth_blockNumber', [], { purpose: 'polling_background' });
        if (!blockHex) return [];

        const latestBlock = parseInt(blockHex, 16);
        const lookback = 20; // Increase lookback to avoid missing blocks between polls (20 blocks ~ 60s on BSC)
        // console.log(`[Watcher] Fetching blocks ${latestBlock - lookback} to ${latestBlock} for chain ${chainId}`);
        const transfers: any[] = [];

        // 2. Fetch blocks in parallel
        const promises = [];
        for (let i = 0; i < lookback; i++) {
            const blockNum = '0x' + (latestBlock - i).toString(16);
            promises.push(rpcCall<any>(chainId, 'eth_getBlockByNumber', [blockNum, true], { purpose: 'polling_background' }));
        }

        const results = await Promise.all(promises);

        // 3. Filter for transactions involving our address
        const lowerAddr = address.toLowerCase();
        for (const res of results) {
            const block = res as any;
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
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'RPC Block Scan error', { chainId, error: error.message });
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
    if (ALCHEMY_SUPPORTED_CHAINS.has(chainId) && ALCHEMY_API_KEY) {
        try {
            const { apiUrl } = getChainConfig(chainId);
            // Fallback to hardcoded URL if not in config for some reason, though config should have it
            const baseUrl = apiUrl || ALCHEMY_BASE_URL;
            const url = `${baseUrl}/${ALCHEMY_API_KEY}`;

            // Validation: Check if key is actually present
            if (!ALCHEMY_API_KEY || ALCHEMY_API_KEY.length < 5) {
                logger.warn(LogCode.API_AUTH_FAILED, 'ALCHEMY_API_KEY appears invalid or empty');
                throw new Error('Invalid Alchemy Key');
            }

            // Retry logic for Alchemy API
            let retries = 3;
            let lastError;

            while (retries > 0) {
                try {
                    const data = await fetchJson<{ error?: any; result?: { transfers?: any[] } }>({
                        url,
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
                        })
                    });

                    if (!data.error) {
                        const transfers = data.result?.transfers || [];
                        return transfers;
                    }
                    logger.warn(LogCode.API_FETCH_FAILED, 'Alchemy returned error response', { error: data.error });
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

        } catch (e: any) {
            logger.debug(LogCode.API_FETCH_FAILED, 'Alchemy failed, attempting RPC fallback', { error: e.message });
        }
    }

    const rpcTransfers = await fetchRecentTransactionsRpc(address, chainId);
    logger.debug(LogCode.API_FETCH_SUCCESS, 'RPC fallback returned transfers', { count: rpcTransfers.length, address });
    return rpcTransfers;
}

/**
 * Check a single wallet for new swaps
 */
async function checkWallet(wallet: { address: string; chainId: number }): Promise<void> {
    const { address, chainId } = wallet;
    const timerLabel = `check_wallet_${address.slice(0, 8)}_${chainId}`;
    logger.startTimer(timerLabel);
    logger.debug(LogCode.SYS_STARTUP, 'Checking wallet for updates', { address, chainId });

    const transfers = await fetchRecentTransactions(address, chainId);
    if (transfers.length > 0) {
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Found recent transfers', { count: transfers.length, address: address.slice(0, 10) });
    }

    for (const transfer of transfers) {
        const txHash = transfer.hash;
        // logger.debug(LogCode.SYS_STARTUP, 'Checking transaction', { tx: txHash?.slice(0, 10), processed: processedTxs.has(txHash) });

        // Skip if already processed (in-memory cache)
        if (await isTxProcessedDistributed(txHash, chainId)) {
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
            logger.debug(LogCode.WTC_TX_SKIPPED, 'Skipping old transaction (before startup)', { tx: txHash.slice(0, 10) });
            await markTxAsProcessedDistributed(txHash, chainId);
            continue;
        }

        // Also check database to prevent processing if already has a Position for this tx
        const existingPosition = await prisma.position.findFirst({
            where: {
                chainId,
                OR: [
                    { leaderTxHash: txHash },
                    { entryTxHash: txHash }
                ]
            }
        });
        if (existingPosition) {
            logger.debug(LogCode.WTC_TX_SKIPPED, 'Skipping transaction with existing position', { tx: txHash.slice(0, 10) });
            await markTxAsProcessedDistributed(txHash, chainId);
            continue;
        }

        // Fetch full transaction and receipt
        const [tx, receipt] = await Promise.all([
            fetchTransaction(txHash, chainId),
            fetchTransactionReceipt(txHash, chainId),
        ]);

        if (!tx || !receipt) {
            logger.warn(LogCode.API_FETCH_FAILED, 'Could not fetch tx or receipt for parsing', { tx: txHash.slice(0, 10) });
            continue;
        }

        logger.debug(LogCode.SYS_STARTUP, `Parsing transaction fields`, { tx: txHash.slice(0, 10), from: tx.from.slice(0, 10) });

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
            chainId,
            address
        );

        if (swap) {
            logger.info(LogCode.WTC_SWAP_DETECTED, 'Swap detected in watched wallet', {
                wallet: address,
                tokenIn: swap.tokenIn,
                tokenOut: swap.tokenOut,
                dex: swap.dexName,
                txHash
            });

            // Trigger callback
            if (swapCallback) {
                await swapCallback(address, swap, chainId);
            }
        } else {
            logger.debug(LogCode.WTC_TX_SKIPPED, 'Transaction is not a swap', { tx: txHash.slice(0, 10) });
        }

        // Mark as processed (NOW safe to cache as we finished trying)
        await markTxAsProcessedDistributed(txHash, chainId);
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
        }).catch((e: any) => logger.warn(LogCode.SYS_ERROR, 'Could not update lastCheckedTx in DB', { error: e.message }));
    }
    logger.endTimer(timerLabel, LogCode.WTC_SCAN_STARTED, { address, chainId, transferCount: transfers.length });
}

/**
 * Main polling loop
 */
async function pollWallets(): Promise<void> {
    if (!isRunning) return;

    const timerLabel = 'poll_wallets_cycle';
    logger.startTimer(timerLabel);
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
            logger.throttled(LogCode.SYS_STARTUP, 'Polling active EVM wallets', { count: evmWallets.length });

            // Check each wallet (sequentially to avoid rate limits)
            for (const wallet of evmWallets) {
                await checkWallet(wallet);
                // Small delay between wallets
                await new Promise(r => setTimeout(r, 500));
            }
        }
        logger.endTimer(timerLabel, LogCode.WTC_SCAN_STARTED, { walletCount: evmWallets.length });
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Wallet polling loop error', { error: error.message });
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
        logger.debug(LogCode.SYS_STARTUP, 'Watcher already running');
        return;
    }

    if (!ALCHEMY_API_KEY) {
        logger.warn(LogCode.API_AUTH_FAILED, 'ALCHEMY_API_KEY missing - Watcher service disabled');
        return;
    }

    logger.info(LogCode.SYS_STARTUP, 'Starting wallet watcher service...');

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
            logger.debug(LogCode.SYS_STARTUP, 'Pre-populated cache for wallet', { address: wallet.address.slice(0, 10), count: transfers.length });
        }

        logger.info(LogCode.SYS_STARTUP, 'Cache initialization complete', { totalTxs: processedTxs.size });
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Error during cache pre-population', { error: error.message });
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

    logger.info(LogCode.SYS_STARTUP, 'Stopping wallet watcher service...');
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
