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
import { callRpc as rpcCall } from './rpcManager.js';

// Initialize Privy client
const PRIVY_APP_ID = process.env.VITE_PRIVY_APP_ID || process.env.PRIVY_APP_ID || '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';
const PRIVY_AUTHORIZATION_KEY = process.env.PRIVY_AUTHORIZATION_KEY || '';
const PRIVY_SEND_TX_CHAIN_IDS = new Set(
    String(process.env.PRIVY_SEND_TX_CHAIN_IDS || '1')
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
);

let privyClient: PrivyClient | null = null;

/** In-memory cache for embedded wallet info (address + id). 5min TTL to avoid Privy API call on every TX. */
const walletInfoCache = new Map<string, { data: { address: string; id: string }; ts: number }>();
const WALLET_INFO_CACHE_TTL_MS = Number(process.env.PRIVY_WALLET_CACHE_TTL_MS || '300000'); // 5 minutes

const toHexQuantity = (value?: string) =>
    value !== undefined && value !== null && value !== ''
        ? (`0x${BigInt(value).toString(16)}` as `0x${string}`)
        : undefined;

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
 * Cached 5min in-memory to avoid Privy API call on every transaction (buy path optimization).
 * @param userId - Privy user ID (from JWT sub claim)
 * @returns Wallet info or null if user has no embedded wallet
 */
export async function getEmbeddedWalletInfo(userId: string): Promise<{ address: string; id: string } | null> {
    const cached = walletInfoCache.get(userId);
    if (cached && Date.now() - cached.ts < WALLET_INFO_CACHE_TTL_MS) {
        return cached.data;
    }

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
            const result = {
                address: walletData.address || '',
                id: walletData.id || walletData.address // Fallback to address if id not present
            };
            walletInfoCache.set(userId, { data: result, ts: Date.now() });
            return result;
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
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: string;
    executionProfile?: string;
    txPurpose?: 'trade' | 'approval' | 'preheat' | 'speedup' | 'fee' | 'other';
    txPriority?: number;
    chainId: number;
}

interface PrivyTxValidationResult {
    ok: boolean;
    errors: string[];
}

function isHexLike(value?: string): boolean {
    return typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value);
}

function isAddressLike(value?: string): boolean {
    return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isIntegerLike(value?: string): boolean {
    if (value === undefined || value === null || value === '') return true;
    try {
        return BigInt(value) >= 0n;
    } catch {
        return false;
    }
}

function summarizeTxForLog(tx: TransactionRequest): Record<string, any> {
    return {
        chainId: tx.chainId,
        to: tx.to,
        value: tx.value,
        gas: tx.gas,
        gasPrice: tx.gasPrice,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
        nonce: tx.nonce,
        dataLength: tx.data?.length || 0,
        dataPrefix: tx.data?.slice(0, 18) || null,
        has0xDataPrefix: typeof tx.data === 'string' ? tx.data.startsWith('0x') : false
    };
}

function validatePrivyTransactionShape(tx: TransactionRequest): PrivyTxValidationResult {
    const errors: string[] = [];
    if (!Number.isInteger(tx.chainId) || tx.chainId <= 0) errors.push('invalid_chain_id');
    if (!isAddressLike(tx.to)) errors.push('invalid_to_address');
    if (!isHexLike(tx.data)) errors.push('invalid_data_hex');
    if (!isIntegerLike(tx.value)) errors.push('invalid_value');
    if (!isIntegerLike(tx.gas)) errors.push('invalid_gas');
    if (!isIntegerLike(tx.gasPrice)) errors.push('invalid_gas_price');
    if (!isIntegerLike(tx.maxFeePerGas)) errors.push('invalid_max_fee_per_gas');
    if (!isIntegerLike(tx.maxPriorityFeePerGas)) errors.push('invalid_max_priority_fee_per_gas');
    if (!isIntegerLike(tx.nonce)) errors.push('invalid_nonce');
    return { ok: errors.length === 0, errors };
}

/** Fetches pending nonce for a wallet (used by sendTransaction and by copy-trade pre-warm). */
export async function getPendingNonce(chainId: number, walletAddress: string): Promise<string | undefined> {
    const countHex = await rpcCall<string>(chainId, 'eth_getTransactionCount', [
        walletAddress,
        'pending'
    ], { strategy: 'fast', importance: 'critical' });
    return countHex ? BigInt(countHex).toString() : undefined;
}

async function fetchPendingNonce(chainId: number, walletAddress: string): Promise<string | undefined> {
    return getPendingNonce(chainId, walletAddress);
}

async function bumpRetryGasPrice(
    chainId: number,
    previousGasPrice: string | undefined,
    attempt: number
): Promise<string | undefined> {
    try {
        const networkGasHex = await rpcCall<string>(chainId, 'eth_gasPrice', [], {
            strategy: 'fast',
            importance: 'critical'
        });
        const networkGasPrice = networkGasHex ? BigInt(networkGasHex) : 0n;
        const baseGasPrice = previousGasPrice ? BigInt(previousGasPrice) : networkGasPrice;
        if (baseGasPrice <= 0n) return previousGasPrice;
        const bumpBps = 1200n + BigInt(Math.max(0, attempt - 1)) * 600n; // +12%, +18%, +24%
        const bumped = baseGasPrice * (10000n + bumpBps) / 10000n;
        return bumped.toString();
    } catch {
        return previousGasPrice;
    }
}

/**
 * Send a transaction using user's embedded wallet (server-side signing)
 * @param userId - Privy user ID
 * @param accessToken - User's Privy access token (for authorization context)
 * @param tx - Transaction to send
 * @returns Transaction hash
 */
interface QueuedTxTask<T> {
    priority: number;
    sequence: number;
    purpose: string;
    run: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
}

const walletTxQueues = new Map<string, QueuedTxTask<any>[]>();
const walletTxQueueRunning = new Set<string>();
let walletTxSequence = 0;

function buildWalletQueueKey(userId: string, chainId: number): string {
    return `${userId}:${chainId}`;
}

function resolveTxPriority(tx: TransactionRequest): number {
    if (Number.isFinite(tx.txPriority)) return Number(tx.txPriority);
    if (tx.txPurpose === 'preheat') return 200;
    if (tx.txPurpose === 'speedup') return 20;
    if (tx.txPurpose === 'trade') return 30;
    if (tx.txPurpose === 'approval') return 70;
    if (tx.txPurpose === 'fee') return 90;
    if ((tx.executionProfile || '').includes('sniper')) return 40;
    if ((tx.data || '').startsWith('0x095ea7b3')) return 80;
    return 60;
}

function pumpWalletQueue(queueKey: string): void {
    if (walletTxQueueRunning.has(queueKey)) return;
    const queue = walletTxQueues.get(queueKey);
    if (!queue || queue.length === 0) return;

    walletTxQueueRunning.add(queueKey);
    const [nextTask] = queue.splice(0, 1);

    nextTask.run()
        .then((value) => nextTask.resolve(value))
        .catch((error) => nextTask.reject(error))
        .finally(() => {
            walletTxQueueRunning.delete(queueKey);
            const current = walletTxQueues.get(queueKey);
            if (!current || current.length === 0) {
                walletTxQueues.delete(queueKey);
                return;
            }
            pumpWalletQueue(queueKey);
        });
}

async function enqueueWalletTx<T>(
    userId: string,
    chainId: number,
    priority: number,
    purpose: string,
    run: () => Promise<T>
): Promise<T> {
    const queueKey = buildWalletQueueKey(userId, chainId);
    const queue = walletTxQueues.get(queueKey) || [];
    walletTxQueues.set(queueKey, queue);

    return await new Promise<T>((resolve, reject) => {
        queue.push({
            priority,
            sequence: ++walletTxSequence,
            purpose,
            run,
            resolve,
            reject
        });
        queue.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.sequence - b.sequence;
        });
        pumpWalletQueue(queueKey);
    });
}

export function isTransactionQueueBusy(userId: string, chainId: number): boolean {
    const key = buildWalletQueueKey(userId, chainId);
    const queue = walletTxQueues.get(key);
    return walletTxQueueRunning.has(key) || !!(queue && queue.length > 0);
}

async function signAndBroadcastRawTransaction(
    client: PrivyClient,
    walletId: string,
    tx: TransactionRequest,
    context: { userId: string; attempt: number; reason: string }
): Promise<string> {
    logger.warn(LogCode.EXE_TX_BROADCAST, 'Sending transaction via Privy sign+broadcast path', {
        chainId: tx.chainId,
        userId: context.userId.slice(0, 10),
        attempt: context.attempt,
        reason: context.reason
    });

    const signed = await client.walletApi.ethereum.signTransaction({
        walletId,
        transaction: {
            to: tx.to as `0x${string}`,
            data: tx.data as `0x${string}`,
            value: toHexQuantity(tx.value),
            gasLimit: toHexQuantity(tx.gas),
            gasPrice: toHexQuantity(tx.gasPrice),
            maxFeePerGas: toHexQuantity(tx.maxFeePerGas),
            maxPriorityFeePerGas: toHexQuantity(tx.maxPriorityFeePerGas),
            nonce: toHexQuantity(tx.nonce),
            chainId: `0x${BigInt(tx.chainId).toString(16)}`,
        },
    });

    const rawTxHash = await rpcCall<string>(
        tx.chainId,
        'eth_sendRawTransaction',
        [signed.signedTransaction],
        { strategy: 'fast', importance: 'critical' }
    );
    if (!rawTxHash) {
        throw new Error('eth_sendRawTransaction returned empty hash');
    }
    logger.info(LogCode.EXE_TX_BROADCAST, 'Ethereum transaction broadcast via signed raw path', {
        txHash: rawTxHash,
        chainId: tx.chainId
    });
    return rawTxHash;
}

export async function sendTransaction(
    userId: string,
    accessToken: string,
    tx: TransactionRequest
): Promise<string> {
    const txPriority = resolveTxPriority(tx);
    const txPurpose = tx.txPurpose || 'other';
    return await enqueueWalletTx(userId, tx.chainId, txPriority, txPurpose, async () => {
        logger.debug(LogCode.EXE_TX_BROADCAST, 'Wallet tx dequeued for send', {
            userId: userId.slice(0, 10),
            chainId: tx.chainId,
            txPurpose,
            txPriority
        });
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

        // Get user's wallet info (both address and ID)
        const walletInfo = await getEmbeddedWalletInfo(userId);
        if (!walletInfo) {
            throw new AppError(400, 'User has no embedded wallet', 'NO_WALLET');
        }

        // Resolve nonce from chain when not provided (prevents "nonce too low" - next nonce N, tx nonce 0)
        // Use rpcManager with fast + critical so Alchemy/premium is preferred (same as eth_sendRawTransaction)
        let resolvedNonce = tx.nonce;
        if (resolvedNonce === undefined || resolvedNonce === null || resolvedNonce === '') {
            try {
                resolvedNonce = await fetchPendingNonce(tx.chainId, walletInfo.address);
                if (resolvedNonce !== undefined) {
                    logger.debug(LogCode.EXE_TX_BROADCAST, 'Fetched chain nonce for wallet', {
                        chainId: tx.chainId,
                        nonce: resolvedNonce,
                        address: walletInfo.address?.slice(0, 10)
                    });
                }
            } catch (nonceErr: any) {
                logger.warn(LogCode.API_FETCH_FAILED, 'Failed to fetch nonce for sendTransaction', {
                    chainId: tx.chainId,
                    error: nonceErr?.message?.slice(0, 80)
                });
            }
        }
        let txWithNonce: TransactionRequest = { ...tx, nonce: resolvedNonce };
        const txValidation = validatePrivyTransactionShape(txWithNonce);
        if (!txValidation.ok) {
            logger.error(LogCode.EXE_TX_REVERTED, 'Privy tx payload validation failed before send', {
                userId: userId.slice(0, 10),
                errors: txValidation.errors,
                tx: summarizeTxForLog(txWithNonce)
            });
            throw new AppError(400, `Invalid transaction payload: ${txValidation.errors.join(',')}`, 'INVALID_TX_PAYLOAD');
        }

        const verboseTxLog = (process.env.PRIVY_TX_DEBUG || 'false') === 'true';
        if (verboseTxLog) {
            console.log('[sendTransaction] ========== PRIVY TX PARAMS ==========');
            console.log('[sendTransaction] From:', walletInfo.address);
            console.log('[sendTransaction] To:', txWithNonce.to);
            console.log('[sendTransaction] Value:', txWithNonce.value);
            console.log('[sendTransaction] ValueHex:', txWithNonce.value ? `0x${BigInt(txWithNonce.value).toString(16)}` : 'undefined');
            console.log('[sendTransaction] Data length:', txWithNonce.data?.length);
            console.log('[sendTransaction] Data prefix:', txWithNonce.data?.slice?.(0, 82));
            console.log('[sendTransaction] ChainId:', txWithNonce.chainId);
            console.log('[sendTransaction] Gas:', txWithNonce.gas);
            console.log('[sendTransaction] MaxFeePerGas:', txWithNonce.maxFeePerGas);
            console.log('[sendTransaction] MaxPriorityFeePerGas:', txWithNonce.maxPriorityFeePerGas);
            console.log('[sendTransaction] Nonce:', txWithNonce.nonce);
            console.log('[sendTransaction] Profile:', txWithNonce.executionProfile);
            console.log('[sendTransaction] ===========================================');
        } else {
            logger.debug(LogCode.EXE_TX_BROADCAST, 'Privy tx prepared', {
                chainId: txWithNonce.chainId,
                to: txWithNonce.to?.slice(0, 10),
                value: txWithNonce.value,
                gas: txWithNonce.gas,
                nonce: txWithNonce.nonce,
                profile: txWithNonce.executionProfile,
                dataLength: txWithNonce.data?.length || 0,
                sendTxAllowlist: Array.from(PRIVY_SEND_TX_CHAIN_IDS.values())
            });
        }

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                logger.debug(LogCode.EXE_TX_BROADCAST, 'Sending Ethereum transaction via Privy', {
                    attempt,
                    from: walletInfo.address?.slice(0, 10),
                    to: txWithNonce.to?.slice(0, 10),
                    chainId: txWithNonce.chainId,
                });

                const preferPrivySendTx = PRIVY_SEND_TX_CHAIN_IDS.has(txWithNonce.chainId);
                if (!preferPrivySendTx) {
                    return await signAndBroadcastRawTransaction(client, walletInfo.id, txWithNonce, {
                        userId,
                        attempt,
                        reason: 'chain_not_in_privy_sendtx_allowlist'
                    });
                }

                const privyTx = {
                    to: txWithNonce.to as `0x${string}`,
                    data: txWithNonce.data as `0x${string}`,
                    value: toHexQuantity(txWithNonce.value),
                    gasLimit: toHexQuantity(txWithNonce.gas),
                    gasPrice: toHexQuantity(txWithNonce.gasPrice),
                    maxFeePerGas: toHexQuantity(txWithNonce.maxFeePerGas),
                    maxPriorityFeePerGas: toHexQuantity(txWithNonce.maxPriorityFeePerGas),
                    nonce: toHexQuantity(txWithNonce.nonce),
                };

                // Use Privy's wallet API to send transaction
                // The walletId must be the Privy internal ID, not the Ethereum address
                const response = await client.walletApi.ethereum.sendTransaction({
                    walletId: walletInfo.id,
                    caip2: `eip155:${txWithNonce.chainId}`,
                    transaction: privyTx,
                });

                logger.info(LogCode.EXE_TX_BROADCAST, 'Ethereum transaction sent via Privy', { txHash: response.hash, chainId: txWithNonce.chainId });

                const postSendDelayMs = Math.max(0, Number(process.env.PRIVY_POST_SEND_DELAY_MS || '0'));
                if (postSendDelayMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, postSendDelayMs));
                }

                return response.hash;
            } catch (error: any) {
                let effectiveError: any = error;
                let errorMessage = effectiveError?.message || '';
                const unsupportedSendOnNonEth =
                    txWithNonce.chainId !== 1 && errorMessage.includes('eth_sendTransaction is only supported for Ethereum');
                if (unsupportedSendOnNonEth) {
                    try {
                        return await signAndBroadcastRawTransaction(client, walletInfo.id, txWithNonce, {
                            userId,
                            attempt,
                            reason: 'privy_sendtx_unsupported_for_chain'
                        });
                    } catch (fallbackError: any) {
                        logger.error(LogCode.EXE_TX_REVERTED, 'Privy sign+broadcast fallback failed', {
                            chainId: tx.chainId,
                            error: fallbackError?.message || String(fallbackError)
                        });
                        effectiveError = fallbackError;
                        errorMessage = effectiveError?.message || String(effectiveError);
                    }
                }

                const isNonceError = errorMessage.includes('nonce too low') ||
                    errorMessage.includes('nonce has already been used') ||
                    errorMessage.includes('replacement transaction underpriced');

                const isNetworkError = errorMessage.includes('fetch failed') ||
                    errorMessage.includes('ECONNRESET') ||
                    errorMessage.includes('socket disconnected');

                // Retry on nonce errors or transient network failures
                if ((isNonceError || isNetworkError) && attempt < MAX_RETRIES) {
                    const reason = isNonceError ? 'Nonce error' : 'Network failure';
                    if (isNonceError) {
                        try {
                            const refreshedNonce = await fetchPendingNonce(txWithNonce.chainId, walletInfo.address);
                            if (refreshedNonce !== undefined) {
                                txWithNonce = { ...txWithNonce, nonce: refreshedNonce };
                            }
                        } catch {
                            // keep current nonce
                        }

                        const bumpedGasPrice = await bumpRetryGasPrice(txWithNonce.chainId, txWithNonce.gasPrice, attempt);
                        if (bumpedGasPrice) {
                            txWithNonce = { ...txWithNonce, gasPrice: bumpedGasPrice };
                        }

                        logger.warn(LogCode.EXE_TX_BROADCAST, 'Nonce retry context refreshed', {
                            chainId: txWithNonce.chainId,
                            attempt,
                            nonce: txWithNonce.nonce,
                            gasPrice: txWithNonce.gasPrice
                        });
                    }
                    logger.warn(LogCode.EXE_TX_BROADCAST, `${reason} on attempt ${attempt}, retrying in ${RETRY_DELAY_MS}ms...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                    continue;
                }

                logger.error(LogCode.EXE_TX_REVERTED, 'Privy Ethereum transaction failed', { error: effectiveError?.message || String(effectiveError), chainId: txWithNonce.chainId });
                logger.error(LogCode.EXE_TX_REVERTED, 'Privy tx context on failure', {
                    attempt,
                    chainId: txWithNonce.chainId,
                    tx: summarizeTxForLog(txWithNonce)
                });

                // Handle specific Privy errors
                if (effectiveError?.code === 'insufficient_funds') {
                    throw new AppError(400, 'Insufficient funds for transaction', 'INSUFFICIENT_FUNDS');
                }
                if (effectiveError?.code === 'user_denied') {
                    throw new AppError(403, 'User denied transaction', 'USER_DENIED');
                }

                throw new AppError(
                    500,
                    `Failed to send transaction: ${effectiveError?.message || 'Unknown error'}`,
                    'TRANSACTION_FAILED'
                );
            }
        }

        // Should never reach here, but just in case
        throw new AppError(500, 'Transaction failed after max retries', 'TRANSACTION_FAILED');
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
