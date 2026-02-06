/**
 * Privy Wallet Service
 * Server-side wallet operations using Privy's embedded wallet API
 * Enables instant trading without user popups
 * 
 * Documentation: https://docs.privy.io/guide/server/wallets/
 */

import { PrivyClient } from '@privy-io/server-auth';
import { AppError } from '../middleware/errorHandler.js';
import { redact } from '../utils/sanitizer.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { acquireLock, releaseLock } from '../cache/redis.js';
import { randomUUID } from 'node:crypto';
import { callRpc } from './rpcManager.js';

// Initialize Privy client
const PRIVY_APP_ID = process.env.VITE_PRIVY_APP_ID || process.env.PRIVY_APP_ID || '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';
const PRIVY_AUTHORIZATION_KEY = process.env.PRIVY_AUTHORIZATION_KEY || '';

let privyClient: PrivyClient | null = null;

/**
 * Get or initialize Privy client
 */
function getPrivyClient(): PrivyClient {
    if (privyClient) return privyClient;

    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        throw new AppError(
            503,
            'Privy credentials not configured. Set PRIVY_APP_ID and PRIVY_APP_SECRET.',
            'PRIVY_NOT_CONFIGURED'
        );
    }

    // Initialize with Authorization Key if available (required for server-side signing)
    const config: any = {};
    if (PRIVY_AUTHORIZATION_KEY) {
        // wallet-auth: prefixed keys don't need newline handling
        const formattedKey = PRIVY_AUTHORIZATION_KEY.startsWith('wallet-auth:')
            ? PRIVY_AUTHORIZATION_KEY
            : PRIVY_AUTHORIZATION_KEY.replace(/\\n/g, '\n');

        const keyId = process.env.PRIVY_AUTHORIZATION_KEY_ID;

        config.walletApi = {
            authorizationPrivateKey: formattedKey,
            authorizationKeyId: keyId
        };

        logger.info(LogCode.SYS_INFO, 'PrivyWallet Authorization Key config', {
            keyFormat: PRIVY_AUTHORIZATION_KEY.startsWith('wallet-auth:') ? 'wallet-auth' : 'pem',
            keyLength: formattedKey.length,
            keyIdConfigured: !!keyId,
            keyId: keyId?.slice(0, 10) + '...',
        });
    }

    privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET, config);
    return privyClient;
}

/**
 * Get user's embedded wallet info (address AND internal ID)
 * @param userId - Privy user ID (from JWT sub claim)
 * @returns Wallet info or null if user has no embedded wallet
 */
export async function getEmbeddedWalletInfo(userId: string): Promise<{ address: string; id: string } | null> {
    const client = getPrivyClient();
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const user = await client.getUser(userId);

            // Find embedded wallet in linked accounts
            const embeddedWallet = user.linkedAccounts?.find(
                (account: any) => account.type === 'wallet' && account.walletClientType === 'privy'
            );

            if (!embeddedWallet) {
                logger.warn(LogCode.SYS_INFO, 'User has no embedded wallet', { userId });
                return null;
            }

            const walletData = embeddedWallet as any;
            // Privy embedded wallets have an 'id' field that is the internal wallet ID
            // and an 'address' field that is the Ethereum address
            return {
                address: walletData.address || '',
                id: walletData.id || walletData.address // Fallback to address if id not present
            };
        } catch (error: any) {
            lastError = error;

            if (attempt < maxRetries - 1) {
                const delayMs = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
                logger.warn(LogCode.SYS_INFO, `Privy wallet fetch failed, retrying in ${delayMs}ms`, {
                    userId,
                    attempt: attempt + 1,
                    maxRetries,
                    error: error.message
                });
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    logger.error(LogCode.SYS_ERROR, 'Error getting user wallet from Privy after retries', {
        userId,
        attempts: maxRetries,
        error: lastError?.message
    });
    throw new AppError(500, 'Failed to get user wallet', 'WALLET_ERROR');
}

/**
 * Get user's embedded wallet address (convenience function)
 * @param userId - Privy user ID (from JWT sub claim)
 * @returns Wallet address or null if user has no embedded wallet
 */
export async function getEmbeddedWalletAddress(userId: string): Promise<string | null> {
    const info = await getEmbeddedWalletInfo(userId);
    return info?.address || null;
}

/**
 * Get user's Solana embedded wallet address
 */
export async function getSolanaEmbeddedWalletAddress(userId: string): Promise<string | null> {
    const client = getPrivyClient();

    try {
        const user = await client.getUser(userId);

        // Find Solana embedded wallet
        const solanaWallet = user.linkedAccounts?.find(
            (account: any) => account.type === 'wallet' &&
                account.walletClientType === 'privy' &&
                account.chainType === 'solana'
        );

        if (!solanaWallet) {
            logger.warn(LogCode.SYS_INFO, 'User has no Solana embedded wallet', { userId });
            return null;
        }

        return (solanaWallet as any).address || null;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Error getting Solana wallet from Privy', { userId, error: error.message });
        throw new AppError(500, 'Failed to get Solana wallet', 'WALLET_ERROR');
    }
}

export interface TransactionRequest {
    to: string;
    data: string;
    value?: string;
    gas?: string;
    nonce?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    executionProfile?: 'default' | 'base-sniper' | 'bsc-sniper';
    chainId: number;
}

interface TxExecutionProfile {
    name: string;
    stallMs: number;
    pollMs: number;
    maxReplacements: number;
    replacementBumpBps: number;
    minPriorityFeeWei?: bigint;
}

const CHAIN_EXECUTION_PROFILES: Record<number, TxExecutionProfile> = {
    8453: {
        name: 'base-sniper',
        stallMs: 350,
        pollMs: 120,
        maxReplacements: 1,
        replacementBumpBps: 1200,
        minPriorityFeeWei: 30_000_000n // 0.03 gwei
    },
    56: {
        name: 'bsc-sniper',
        stallMs: 280,
        pollMs: 100,
        maxReplacements: 1,
        replacementBumpBps: 1500
    }
};

const DEFAULT_EXECUTION_PROFILE: TxExecutionProfile = {
    name: 'default',
    stallMs: 1200,
    pollMs: 200,
    maxReplacements: 0,
    replacementBumpBps: 1000
};

function toHexQuantity(value?: string | bigint): `0x${string}` | undefined {
    if (value === undefined || value === null) return undefined;
    const normalized = typeof value === 'bigint' ? value : BigInt(value);
    return `0x${normalized.toString(16)}`;
}

function bumpByBps(value: bigint, bps: number): bigint {
    return (value * BigInt(10000 + Math.max(0, bps))) / 10000n;
}

function getExecutionProfile(chainId: number, requested?: TransactionRequest['executionProfile']): TxExecutionProfile {
    if (requested === 'base-sniper') return CHAIN_EXECUTION_PROFILES[8453];
    if (requested === 'bsc-sniper') return CHAIN_EXECUTION_PROFILES[56];
    return CHAIN_EXECUTION_PROFILES[chainId] || DEFAULT_EXECUTION_PROFILE;
}

async function waitForReceiptFast(
    chainId: number,
    txHash: string,
    timeoutMs: number,
    pollMs: number
): Promise<boolean> {
    const endAt = Date.now() + timeoutMs;
    while (Date.now() < endAt) {
        try {
            const receipt = await callRpc<any>(chainId, 'eth_getTransactionReceipt', [txHash], { strategy: 'fast', importance: 'critical' });
            if (receipt?.blockNumber) return true;
        } catch {
            // ignore and keep polling in short window
        }
        await new Promise(resolve => setTimeout(resolve, pollMs));
    }
    return false;
}

function summarizeTxError(error: any): string {
    const msg = String(error?.message || error || '').toLowerCase();
    if (msg.includes('nonce too low') || msg.includes('already been used')) return 'nonce_conflict';
    if (msg.includes('replacement transaction underpriced')) return 'replacement_underpriced';
    if (msg.includes('insufficient funds')) return 'insufficient_funds';
    if (msg.includes('429') || msg.includes('too many requests')) return 'rate_limited';
    if (msg.includes('timeout') || msg.includes('fetch failed') || msg.includes('socket')) return 'network_timeout';
    return 'unknown';
}

async function getPendingNonce(chainId: number, address: string): Promise<bigint | null> {
    try {
        const nonceHex = await callRpc<string>(chainId, 'eth_getTransactionCount', [address, 'pending'], { strategy: 'fast', importance: 'critical' });
        return nonceHex ? BigInt(nonceHex) : null;
    } catch {
        return null;
    }
}

async function buildDynamicFees(
    tx: TransactionRequest,
    profile: TxExecutionProfile
): Promise<{ gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }> {
    let gasPrice = tx.gasPrice ? BigInt(tx.gasPrice) : undefined;
    let maxFeePerGas = tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined;
    let maxPriorityFeePerGas = tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined;
    if (gasPrice || (maxFeePerGas && maxPriorityFeePerGas)) {
        return { gasPrice, maxFeePerGas, maxPriorityFeePerGas };
    }

    try {
        const [latestBlock, priorityHex, gasPriceHex] = await Promise.all([
            callRpc<any>(tx.chainId, 'eth_getBlockByNumber', ['latest', false], { strategy: 'fast', importance: 'critical' }).catch(() => null),
            callRpc<string>(tx.chainId, 'eth_maxPriorityFeePerGas', [], { strategy: 'fast', importance: 'critical' }).catch(() => '0x0'),
            callRpc<string>(tx.chainId, 'eth_gasPrice', [], { strategy: 'fast', importance: 'critical' }).catch(() => '0x0')
        ]);

        const priority = priorityHex ? BigInt(priorityHex) : 0n;
        const baseFee = latestBlock?.baseFeePerGas ? BigInt(latestBlock.baseFeePerGas) : null;
        const networkGasPrice = gasPriceHex ? BigInt(gasPriceHex) : 0n;
        const minPriority = profile.minPriorityFeeWei || 0n;

        if (baseFee !== null) {
            const tip = priority > minPriority ? priority : minPriority;
            if (!maxPriorityFeePerGas || maxPriorityFeePerGas <= 0n) maxPriorityFeePerGas = tip;
            if (!maxFeePerGas || maxFeePerGas <= 0n) maxFeePerGas = baseFee * 2n + (maxPriorityFeePerGas || tip);
        } else if (!gasPrice || gasPrice <= 0n) {
            gasPrice = networkGasPrice > 0n ? networkGasPrice : undefined;
        }
    } catch {
        // fallback to caller-provided values
    }

    return { gasPrice, maxFeePerGas, maxPriorityFeePerGas };
}

/**
 * Send a transaction using user's embedded wallet (server-side signing)
 * @param userId - Privy user ID
 * @param accessToken - User's Privy access token (for authorization context)
 * @param tx - Transaction to send
 * @returns Transaction hash
 */
// Queue to manage concurrent transactions per user to prevent nonce collisions
const userTransactionLocks: Map<string, Promise<any>> = new Map();
const DISTRIBUTED_TX_LOCK_TTL_SECONDS = 180;
const DISTRIBUTED_TX_LOCK_WAIT_MS = 15_000;
const DISTRIBUTED_TX_LOCK_RETRY_MS = 150;

/**
 * Execute a function sequentially for a given user
 */
async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const currentLock = userTransactionLocks.get(userId) || Promise.resolve();

    // Create a new promise that chains onto the current lock
    // We catch errors in the previous lock to ensure the chain continues even if one fails
    const nextLock = currentLock
        .catch(() => { })
        .then(() => fn());

    // Update the lock for this user
    userTransactionLocks.set(userId, nextLock);

    return nextLock;
}

async function withDistributedUserLock<T>(
    userId: string,
    chainId: number,
    fn: () => Promise<T>
): Promise<T> {
    const lockKey = `lock:privy:tx:${userId}:${chainId}`;
    const lockValue = randomUUID();
    const startedAt = Date.now();

    while (Date.now() - startedAt < DISTRIBUTED_TX_LOCK_WAIT_MS) {
        const acquired = await acquireLock(lockKey, DISTRIBUTED_TX_LOCK_TTL_SECONDS, lockValue);
        if (acquired) {
            try {
                return await fn();
            } finally {
                await releaseLock(lockKey, lockValue);
            }
        }
        await new Promise(resolve => setTimeout(resolve, DISTRIBUTED_TX_LOCK_RETRY_MS));
    }

    throw new AppError(429, 'Transaction is already in progress for this wallet', 'TX_LOCK_BUSY');
}

export async function sendTransaction(
    userId: string,
    accessToken: string,
    tx: TransactionRequest
): Promise<string> {
    // Wrap entire execution in a per-user lock
    return withUserLock(userId, async () => {
        return withDistributedUserLock(userId, tx.chainId, async () => {
        // === SIMULATION MODE ===
        if (process.env.SIMULATION_MODE === 'true') {
            logger.info(LogCode.EXE_TX_BROADCAST, 'SIMULATION MODE: Skipping actual Privy send', {
                userId,
                to: tx.to,
                value: tx.value,
                chainId: tx.chainId
            });
            return `0xSIMULATION_PRIVY_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        }

        const client = getPrivyClient();
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 2000;
        const profile = getExecutionProfile(tx.chainId, tx.executionProfile);
        const execId = randomUUID().slice(0, 8);

        // Get user's wallet info (both address and ID)
        const walletInfo = await getEmbeddedWalletInfo(userId);
        if (!walletInfo) {
            throw new AppError(400, 'User has no embedded wallet', 'NO_WALLET');
        }

        const pendingNonce = tx.nonce ? BigInt(tx.nonce) : await getPendingNonce(tx.chainId, walletInfo.address);
        let nonce = pendingNonce ?? undefined;
        let { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = await buildDynamicFees(tx, profile);

        logger.info(LogCode.EXE_TX_BROADCAST, '[PrivyTx] Prepared transaction', {
            execId,
            userId: userId.slice(0, 18),
            chainId: tx.chainId,
            profile: profile.name,
            from: walletInfo.address.slice(0, 12),
            to: tx.to.slice(0, 12),
            nonce: nonce?.toString(),
            gasLimit: tx.gas,
            gasPrice: gasPrice?.toString(),
            maxFeePerGas: maxFeePerGas?.toString(),
            maxPriorityFeePerGas: maxPriorityFeePerGas?.toString()
        });

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const sendStart = Date.now();
                logger.debug(LogCode.EXE_TX_BROADCAST, 'Sending Ethereum transaction via Privy', {
                    execId,
                    attempt,
                    from: walletInfo.address?.slice(0, 10),
                    to: tx.to?.slice(0, 10),
                    chainId: tx.chainId,
                    nonce: nonce?.toString()
                });

                // Use Privy's wallet API to send transaction
                // The walletId must be the Privy internal ID, not the Ethereum address
                const response = await client.walletApi.ethereum.sendTransaction({
                    walletId: walletInfo.id,
                    caip2: `eip155:${tx.chainId}`,
                    transaction: {
                        to: tx.to as `0x${string}`,
                        data: tx.data as `0x${string}`,
                        value: toHexQuantity(tx.value),
                        gasLimit: toHexQuantity(tx.gas),
                        nonce: nonce !== undefined ? toHexQuantity(nonce) : undefined,
                        gasPrice: gasPrice !== undefined ? toHexQuantity(gasPrice) : undefined,
                        maxFeePerGas: maxFeePerGas !== undefined ? toHexQuantity(maxFeePerGas) : undefined,
                        maxPriorityFeePerGas: maxPriorityFeePerGas !== undefined ? toHexQuantity(maxPriorityFeePerGas) : undefined,
                    },
                });

                logger.info(LogCode.EXE_TX_BROADCAST, '[PrivyTx] Ethereum tx broadcast', {
                    execId,
                    txHash: response.hash,
                    chainId: tx.chainId,
                    profile: profile.name,
                    nonce: nonce?.toString(),
                    sendMs: Date.now() - sendStart
                });

                if (profile.maxReplacements > 0 && nonce !== undefined) {
                    let included = await waitForReceiptFast(tx.chainId, response.hash, profile.stallMs, profile.pollMs);
                    if (included) {
                        logger.info(LogCode.EXE_TX_BROADCAST, '[PrivyTx] Included in fast window', {
                            execId,
                            txHash: response.hash,
                            chainId: tx.chainId,
                            nonce: nonce.toString(),
                            fastWindowMs: profile.stallMs
                        });
                        return response.hash;
                    }

                    for (let replacement = 1; replacement <= profile.maxReplacements; replacement++) {
                        if (maxFeePerGas && maxPriorityFeePerGas) {
                            maxFeePerGas = bumpByBps(maxFeePerGas, profile.replacementBumpBps);
                            maxPriorityFeePerGas = bumpByBps(maxPriorityFeePerGas, profile.replacementBumpBps);
                        } else if (gasPrice) {
                            gasPrice = bumpByBps(gasPrice, profile.replacementBumpBps);
                        }

                        logger.warn(LogCode.EXE_TX_BROADCAST, '[PrivyTx] Replacing stalled tx', {
                            execId,
                            chainId: tx.chainId,
                            nonce: nonce.toString(),
                            replacement,
                            gasPrice: gasPrice?.toString(),
                            maxFeePerGas: maxFeePerGas?.toString(),
                            maxPriorityFeePerGas: maxPriorityFeePerGas?.toString()
                        });

                        let replacementResp: { hash: string };
                        try {
                            replacementResp = await client.walletApi.ethereum.sendTransaction({
                                walletId: walletInfo.id,
                                caip2: `eip155:${tx.chainId}`,
                                transaction: {
                                    to: tx.to as `0x${string}`,
                                    data: tx.data as `0x${string}`,
                                    value: toHexQuantity(tx.value),
                                    gasLimit: toHexQuantity(tx.gas),
                                    nonce: toHexQuantity(nonce),
                                    gasPrice: gasPrice !== undefined ? toHexQuantity(gasPrice) : undefined,
                                    maxFeePerGas: maxFeePerGas !== undefined ? toHexQuantity(maxFeePerGas) : undefined,
                                    maxPriorityFeePerGas: maxPriorityFeePerGas !== undefined ? toHexQuantity(maxPriorityFeePerGas) : undefined,
                                },
                            });
                        } catch (replacementError: any) {
                            logger.warn(LogCode.EXE_TX_BROADCAST, '[PrivyTx] Replacement send failed', {
                                execId,
                                chainId: tx.chainId,
                                nonce: nonce.toString(),
                                replacement,
                                category: summarizeTxError(replacementError),
                                error: String(replacementError?.message || replacementError).slice(0, 180)
                            });
                            continue;
                        }

                        included = await waitForReceiptFast(tx.chainId, replacementResp.hash, profile.stallMs, profile.pollMs);
                        if (included) {
                            logger.info(LogCode.EXE_TX_BROADCAST, '[PrivyTx] Replacement included', {
                                execId,
                                txHash: replacementResp.hash,
                                chainId: tx.chainId,
                                nonce: nonce.toString(),
                                replacement
                            });
                            return replacementResp.hash;
                        }
                    }
                    logger.warn(LogCode.EXE_TX_BROADCAST, '[PrivyTx] Fast window exceeded, returning last hash', {
                        execId,
                        chainId: tx.chainId,
                        nonce: nonce.toString(),
                        profile: profile.name,
                        maxReplacements: profile.maxReplacements
                    });
                }

                return response.hash;
            } catch (error: any) {
                const errorMessage = error.message || '';
                const errorCategory = summarizeTxError(error);
                const isNonceError = errorMessage.includes('nonce too low') ||
                    errorMessage.includes('nonce has already been used') ||
                    errorMessage.includes('replacement transaction underpriced');

                const isNetworkError = errorMessage.includes('fetch failed') ||
                    errorMessage.includes('ECONNRESET') ||
                    errorMessage.includes('socket disconnected');

                // Retry on nonce errors or transient network failures
                if ((isNonceError || isNetworkError) && attempt < MAX_RETRIES) {
                    const reason = isNonceError ? 'Nonce error' : 'Network failure';
                    logger.warn(LogCode.EXE_TX_BROADCAST, `${reason} on attempt ${attempt}, retrying in ${RETRY_DELAY_MS}ms...`, {
                        execId,
                        chainId: tx.chainId,
                        nonce: nonce?.toString(),
                        category: errorCategory
                    });
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                    continue;
                }

                logger.error(LogCode.EXE_TX_REVERTED, 'Privy Ethereum transaction failed', {
                    execId,
                    error: error.message,
                    chainId: tx.chainId,
                    nonce: nonce?.toString(),
                    category: errorCategory,
                    profile: profile.name
                });

                // Handle specific Privy errors
                if (error.code === 'insufficient_funds') {
                    throw new AppError(400, 'Insufficient funds for transaction', 'INSUFFICIENT_FUNDS');
                }
                if (error.code === 'user_denied') {
                    throw new AppError(403, 'User denied transaction', 'USER_DENIED');
                }

                throw new AppError(
                    500,
                    `Failed to send transaction: ${error.message || 'Unknown error'}`,
                    'TRANSACTION_FAILED'
                );
            }
        }

        // Should never reach here, but just in case
        throw new AppError(500, 'Transaction failed after max retries', 'TRANSACTION_FAILED');
        });
    });
}

/**
 * Send a Solana transaction using user's embedded wallet
 */
import { VersionedTransaction } from '@solana/web3.js';

// Cache for server wallet to avoid repeated lookups
let serverSolanaWallet: { id: string; address: string } | null = null;

/**
 * Get or create a dedicated server-owned Solana wallet for copy trading
 * Server wallets don't require Origin headers and can be signed purely with Authorization Key
 */
export async function getOrCreateServerSolanaWallet(): Promise<{ id: string; address: string }> {
    // Return cached wallet if available
    if (serverSolanaWallet) {
        return serverSolanaWallet;
    }

    const client = getPrivyClient();

    try {
        // First, try to find an existing server wallet
        const wallets = await client.walletApi.getWallets({ chainType: 'solana' });
        const existingServerWallet = wallets.data.find(w => w.chainType === 'solana');

        if (existingServerWallet) {
            serverSolanaWallet = {
                id: existingServerWallet.id,
                address: existingServerWallet.address
            };
            logger.info(LogCode.SYS_INFO, 'Using existing server Solana wallet', { address: serverSolanaWallet.address });
            return serverSolanaWallet;
        }

        // Create a new server wallet if none exists
        logger.info(LogCode.SYS_INFO, 'Creating new server Solana wallet...');
        const newWallet = await client.walletApi.create({
            chainType: 'solana'
        });

        serverSolanaWallet = {
            id: newWallet.id,
            address: newWallet.address
        };
        logger.info(LogCode.SYS_INFO, 'Created new server Solana wallet', { address: serverSolanaWallet.address });
        return serverSolanaWallet;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Failed to get/create server wallet', { error: error.message });
        throw new AppError(500, `Failed to get/create server wallet: ${error.message}`, 'SERVER_WALLET_ERROR');
    }
}

/**
 * Get the server Solana wallet address (for balance checks, funding, etc.)
 */
export async function getServerSolanaWalletAddress(): Promise<string> {
    const wallet = await getOrCreateServerSolanaWallet();
    return wallet.address;
}

/**
 * Get user's delegated Solana wallet (if they have authorized server-side signing)
 * Returns null if user hasn't granted delegation
 */
export async function getDelegatedSolanaWallet(userId: string): Promise<{ id: string; address: string } | null> {
    const client = getPrivyClient();

    try {
        const user = await client.getUser(userId);

        // Find Solana embedded wallet with delegated: true
        const delegatedWallet = user.linkedAccounts?.find(
            (account: any) =>
                account.type === 'wallet' &&
                account.walletClientType === 'privy' &&
                account.chainType === 'solana' &&
                account.delegated === true
        );

        if (!delegatedWallet) {
            logger.debug(LogCode.SYS_INFO, 'User has no delegated Solana wallet', { userId });
            return null;
        }

        const walletData = delegatedWallet as any;
        logger.debug(LogCode.SYS_INFO, 'Found delegated Solana wallet for user', { address: walletData.address, userId });

        return {
            id: walletData.id,
            address: walletData.address
        };
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Error getting delegated wallet from Privy', { userId, error: error.message });
        return null;
    }
}

/**
 * Send a Solana transaction using user's delegated wallet or fallback to server wallet
 * Prefers user's delegated wallet for better fund isolation
 */
export async function sendSolanaTransaction(
    userId: string,
    transactionBase64: string // Base64 encoded transaction from Jupiter
): Promise<string> {
    const client = getPrivyClient();

    try {
        // Try to get user's delegated wallet first (preferred for fund isolation)
        let wallet = await getDelegatedSolanaWallet(userId);
        let walletSource = 'delegated';

        // Fallback to server wallet if user hasn't granted delegation
        if (!wallet) {
            wallet = await getOrCreateServerSolanaWallet();
            walletSource = 'server';
            logger.info(LogCode.SYS_INFO, 'Using server wallet (user has not delegated)', { userId });
        }

        logger.debug(LogCode.EXE_TX_BROADCAST, 'Sending Solana transaction via Privy', {
            walletSource,
            address: wallet.address,
            userId,
        });

        // Deserialize transaction
        const transactionBuffer = Buffer.from(transactionBase64, 'base64');
        const transaction = VersionedTransaction.deserialize(transactionBuffer);

        // Sign and send with Privy using walletId
        const response = await client.walletApi.solana.signAndSendTransaction({
            walletId: wallet.id,
            caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana Mainnet-Beta
            transaction: transaction,
        });

        logger.info(LogCode.EXE_TX_BROADCAST, 'Solana transaction sent via Privy', { txHash: response.hash });
        return response.hash;
    } catch (error: any) {
        logger.error(LogCode.EXE_TX_REVERTED, 'Solana transaction failed via Privy', { error: error.message, userId });
        throw new AppError(
            500,
            `Failed to send Solana transaction: ${error.message || 'Unknown error'}`,
            'SOLANA_TRANSACTION_FAILED'
        );
    }
}

/**
 * Sign EIP-712 typed data using user's embedded wallet (server-side)
 * Used for Polymarket CLOB order signing
 * 
 * @param userId - Privy user ID
 * @param typedData - EIP-712 typed data object
 * @returns Signature hex string
 */
export interface EIP712TypedData {
    domain: {
        name?: string;
        version?: string;
        chainId?: number;
        verifyingContract?: string;
        salt?: string;
    };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, any>;
}

export async function signTypedData(
    userId: string,
    typedData: EIP712TypedData,
    chainId: number = 137 // Default to Polygon for Polymarket
): Promise<string> {
    const client = getPrivyClient();

    // Get user's wallet info
    const walletInfo = await getEmbeddedWalletInfo(userId);
    if (!walletInfo) {
        throw new AppError(400, 'User has no embedded wallet', 'NO_WALLET');
    }

    logger.debug(LogCode.SYS_INFO, 'Signing EIP-712 typed data via Privy', {
        userId,
        primaryType: typedData.primaryType,
        chainId,
    });

    try {
        // Use Privy's walletApi to sign typed data
        // The SDK expects the typed data in EIP-712 format
        const response = await (client.walletApi.ethereum as any).signTypedData({
            walletId: walletInfo.id,
            caip2: `eip155:${chainId}`,
            typedData: {
                domain: typedData.domain,
                types: typedData.types,
                primaryType: typedData.primaryType,
                message: typedData.message,
            },
        });

        logger.info(LogCode.SYS_INFO, 'EIP-712 signature obtained via Privy', { userId });

        return response.signature;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'EIP-712 signing failed via Privy', { error: error.message, userId });

        // Handle specific errors
        if (error.message?.includes('not delegated')) {
            throw new AppError(
                403,
                'User has not enabled server-side signing. Please enable delegation in wallet settings.',
                'DELEGATION_REQUIRED'
            );
        }

        throw new AppError(
            500,
            `Failed to sign typed data: ${error.message || 'Unknown error'}`,
            'SIGNING_FAILED'
        );
    }
}

/**
 * Check if Privy server-side signing is configured
 */
export function isPrivyConfigured(): boolean {
    return !!(PRIVY_APP_ID && PRIVY_APP_SECRET);
}
