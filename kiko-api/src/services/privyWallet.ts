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
import {
    callRpc as rpcCall,
    broadcastRawWithQuorum,
    probeTxVisibility,
    waitForReceiptStateMachine
} from './rpcManager.js';
import type { TxLifecycleResult } from './txLifecycle.js';
import {
    isTxLifecycleSendAccepted,
    toTxLifecycleFailureMessage
} from './txLifecycle.js';

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
// Keep visibility probing enabled for observability.
// For raw-path trade/speedup we also run a short synchronous visibility probe before returning success.
const PRIVY_TX_VISIBILITY_CHECK_ENABLED = true;
const PRIVY_TX_REQUIRE_VISIBILITY = false;
const PRIVY_TX_VISIBILITY_RETRIES = 6;
const PRIVY_TX_VISIBILITY_DELAY_MS = 500;
const PRIVY_TX_SYNC_VISIBILITY_RETRIES = 8;
const PRIVY_TX_SYNC_VISIBILITY_DELAY_MS = 400;
const PRIVY_FAST_TRADE_SYNC_VISIBILITY_RETRIES = 1;
const PRIVY_FAST_TRADE_SYNC_VISIBILITY_DELAY_MS = 120;
const PRIVY_FAST_TRADE_BASE_GAS_BUMP_BPS = BigInt(Math.max(10000, Number(process.env.PRIVY_FAST_TRADE_BASE_GAS_BUMP_BPS || '22000')));
const PRIVY_FAST_TRADE_BSC_GAS_BUMP_BPS = BigInt(Math.max(10000, Number(process.env.PRIVY_FAST_TRADE_BSC_GAS_BUMP_BPS || '17000')));
const PRIVY_FAST_TRADE_DEFAULT_GAS_BUMP_BPS = BigInt(Math.max(10000, Number(process.env.PRIVY_FAST_TRADE_DEFAULT_GAS_BUMP_BPS || '14000')));
const PRIVY_FAST_TRADE_BASE_MIN_GAS_PRICE_WEI = BigInt(Math.max(1, Number(process.env.PRIVY_FAST_TRADE_BASE_MIN_GAS_PRICE_WEI || '25000000')));
const PRIVY_FAST_TRADE_BSC_MIN_GAS_PRICE_WEI = BigInt(Math.max(1, Number(process.env.PRIVY_FAST_TRADE_BSC_MIN_GAS_PRICE_WEI || '1200000000')));

let privyClient: PrivyClient | null = null;

const toHexQuantity = (value?: string) =>
    value !== undefined && value !== null && value !== ''
        ? (`0x${BigInt(value).toString(16)}` as `0x${string}`)
        : undefined;

function isLikelyEvmAddress(value: unknown): boolean {
    const address = String(value || '');
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isFastTradeExecutionProfile(tx: Pick<TransactionRequest, 'txPurpose' | 'executionProfile'>): boolean {
    const purpose = tx.txPurpose || 'other';
    if (purpose !== 'trade' && purpose !== 'speedup') return false;
    const profile = String(tx.executionProfile || '').toLowerCase();
    return profile === 'base-sniper' || profile === 'bsc-sniper';
}

function resolveTradeGasPolicy(tx: Pick<TransactionRequest, 'chainId' | 'txPurpose' | 'executionProfile'>): {
    bumpBps: bigint;
    minGasPriceWei: bigint;
    policy: 'base-sniper' | 'bsc-sniper' | 'trade-default' | 'other';
} {
    const purpose = tx.txPurpose || 'other';
    if (purpose !== 'trade' && purpose !== 'speedup') {
        return { bumpBps: 11500n, minGasPriceWei: 1n, policy: 'other' };
    }
    const profile = String(tx.executionProfile || '').toLowerCase();
    if (profile === 'base-sniper' || tx.chainId === 8453) {
        return {
            bumpBps: PRIVY_FAST_TRADE_BASE_GAS_BUMP_BPS,
            minGasPriceWei: PRIVY_FAST_TRADE_BASE_MIN_GAS_PRICE_WEI,
            policy: 'base-sniper'
        };
    }
    if (profile === 'bsc-sniper' || tx.chainId === 56) {
        return {
            bumpBps: PRIVY_FAST_TRADE_BSC_GAS_BUMP_BPS,
            minGasPriceWei: PRIVY_FAST_TRADE_BSC_MIN_GAS_PRICE_WEI,
            policy: 'bsc-sniper'
        };
    }
    return {
        bumpBps: PRIVY_FAST_TRADE_DEFAULT_GAS_BUMP_BPS,
        minGasPriceWei: 1n,
        policy: 'trade-default'
    };
}

type EmbeddedWalletChainType = 'ethereum' | 'solana' | 'auto';

async function verifyTxVisibility(
    chainId: number,
    txHash: string,
    expectedFrom?: string,
    options?: {
        retries?: number;
        delayMs?: number;
    }
): Promise<{
    visible: boolean;
    checks: number;
    from?: string;
    nonce?: string;
    blockNumber?: string;
    lastError?: string;
}> {
    return await probeTxVisibility({
        chainId,
        txHash,
        expectedFrom,
        retries: Math.max(1, options?.retries || PRIVY_TX_VISIBILITY_RETRIES),
        delayMs: Math.max(0, options?.delayMs ?? PRIVY_TX_VISIBILITY_DELAY_MS)
    });
}

function scheduleTxVisibilityCheck(params: {
    path: 'raw_sign_broadcast' | 'privy_sendtx';
    chainId: number;
    txHash: string;
    expectedFrom?: string;
}): void {
    if (!PRIVY_TX_VISIBILITY_CHECK_ENABLED) return;
    void (async () => {
        try {
            const visibility = await verifyTxVisibility(params.chainId, params.txHash, params.expectedFrom);
            logger.info(LogCode.SYS_INFO, 'Privy tx visibility check', {
                path: params.path,
                txHash: params.txHash,
                chainId: params.chainId,
                visible: visibility.visible,
                checks: visibility.checks,
                seenFrom: visibility.from,
                seenNonce: visibility.nonce,
                expectedFrom: params.expectedFrom,
                lastError: visibility.lastError
            });
            if (!visibility.visible) {
                logger.warn(LogCode.SYS_INFO, 'Privy tx visibility miss (non-blocking)', {
                    path: params.path,
                    txHash: params.txHash,
                    chainId: params.chainId,
                    expectedFrom: params.expectedFrom,
                    lastError: visibility.lastError
                });
                if (PRIVY_TX_REQUIRE_VISIBILITY) {
                    logger.error(LogCode.EXE_TX_REVERTED, 'Privy tx visibility required but not found', {
                        path: params.path,
                        txHash: params.txHash,
                        chainId: params.chainId,
                        expectedFrom: params.expectedFrom,
                        lastError: visibility.lastError
                    });
                }
            }
        } catch (err: any) {
            logger.warn(LogCode.SYS_INFO, 'Privy tx visibility probe failed (non-blocking)', {
                path: params.path,
                txHash: params.txHash,
                chainId: params.chainId,
                error: err?.message || String(err)
            });
        }
    })();
}

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
export async function getEmbeddedWalletInfo(
    userId: string,
    options?: { chainType?: EmbeddedWalletChainType }
): Promise<{ address: string; id: string } | null> {
    const client = getPrivyClient();
    const maxRetries = 3;
    let lastError: any = null;
    const chainType = options?.chainType || 'auto';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const user = await client.getUser(userId);

            const linkedWallets = (user.linkedAccounts || []).filter(
                (account: any) => account?.type === 'wallet' && account?.walletClientType === 'privy'
            );
            const evmWallet =
                linkedWallets.find((account: any) =>
                    String(account?.chainType || '').toLowerCase() === 'ethereum'
                    && isLikelyEvmAddress(account?.address)
                )
                || linkedWallets.find((account: any) => isLikelyEvmAddress(account?.address))
                || null;
            const solanaWallet =
                linkedWallets.find((account: any) =>
                    String(account?.chainType || '').toLowerCase() === 'solana'
                )
                || null;

            const embeddedWallet =
                chainType === 'ethereum'
                    ? evmWallet
                    : chainType === 'solana'
                        ? solanaWallet
                        : (evmWallet || solanaWallet || linkedWallets[0] || null);

            if (!embeddedWallet) {
                logger.warn(LogCode.SYS_INFO, 'User has no embedded wallet for requested chain', {
                    userId,
                    chainType,
                    linkedWalletCount: linkedWallets.length,
                    linkedChains: linkedWallets.map((account: any) => String(account?.chainType || 'unknown'))
                });
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
export async function getEmbeddedWalletAddress(
    userId: string,
    chainType: Exclude<EmbeddedWalletChainType, 'auto'> = 'ethereum'
): Promise<string | null> {
    const info = await getEmbeddedWalletInfo(userId, { chainType });
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
    chainId: number;
    txPurpose?: 'trade' | 'approval' | 'preheat' | 'speedup' | 'fee' | 'other';
    txPriority?: number;
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
const userChainInflightTx = new Map<string, number>();
const pendingNonceInflight = new Map<string, Promise<string | undefined>>();
const pendingNonceCache = new Map<string, { nonce: string; timestamp: number }>();
const PENDING_NONCE_CACHE_TTL_MS = Math.max(250, Number(process.env.PENDING_NONCE_CACHE_TTL_MS || '1500'));
const CHAIN_SEND_CONCURRENCY_LIMIT = Math.max(1, Number(process.env.PRIVY_CHAIN_SEND_CONCURRENCY || '8'));
const chainSendLimiter = new Map<number, { inFlight: number; queue: Array<() => void> }>();

function buildUserChainKey(userId: string, chainId: number): string {
    return `${userId}:${chainId}`;
}

function bumpInflightUserChainTx(key: string, delta: 1 | -1): void {
    const current = userChainInflightTx.get(key) || 0;
    const next = current + delta;
    if (next <= 0) {
        userChainInflightTx.delete(key);
        return;
    }
    userChainInflightTx.set(key, next);
}

function buildPendingNonceKey(chainId: number, walletAddress: string): string {
    return `${chainId}:${walletAddress.toLowerCase()}`;
}

function invalidatePendingNonce(chainId: number, walletAddress: string): void {
    const key = buildPendingNonceKey(chainId, walletAddress);
    pendingNonceCache.delete(key);
    pendingNonceInflight.delete(key);
}

export function isTransactionQueueBusy(userId: string, chainId: number): boolean {
    const chainKey = buildUserChainKey(userId, chainId);
    return (userChainInflightTx.get(chainKey) || 0) > 0 || userTransactionLocks.has(userId);
}

export async function getPendingNonce(chainId: number, walletAddress: string): Promise<string | undefined> {
    if (!walletAddress || chainId <= 0) return undefined;
    const key = buildPendingNonceKey(chainId, walletAddress);
    const cached = pendingNonceCache.get(key);
    if (cached && Date.now() - cached.timestamp <= PENDING_NONCE_CACHE_TTL_MS) {
        return cached.nonce;
    }

    const inflight = pendingNonceInflight.get(key);
    if (inflight) return await inflight;

    const task = (async () => {
        try {
            const nonce = await rpcCall<string>(
                chainId,
                'eth_getTransactionCount',
                [walletAddress, 'pending'],
                { strategy: 'fast', importance: 'critical' }
            );
            if (!nonce || typeof nonce !== 'string') return undefined;
            pendingNonceCache.set(key, { nonce, timestamp: Date.now() });
            return nonce;
        } catch {
            return undefined;
        } finally {
            pendingNonceInflight.delete(key);
        }
    })();

    pendingNonceInflight.set(key, task);
    return await task;
}

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

function getChainLimiter(chainId: number): { inFlight: number; queue: Array<() => void> } {
    let state = chainSendLimiter.get(chainId);
    if (!state) {
        state = { inFlight: 0, queue: [] };
        chainSendLimiter.set(chainId, state);
    }
    return state;
}

async function withChainSendLimiter<T>(chainId: number, fn: () => Promise<T>): Promise<T> {
    const state = getChainLimiter(chainId);
    if (state.inFlight >= CHAIN_SEND_CONCURRENCY_LIMIT) {
        await new Promise<void>((resolve) => state.queue.push(resolve));
    }
    state.inFlight += 1;
    try {
        return await fn();
    } finally {
        state.inFlight = Math.max(0, state.inFlight - 1);
        const next = state.queue.shift();
        if (next) next();
    }
}

async function signAndBroadcastRawTransaction(
    client: PrivyClient,
    walletId: string,
    tx: TransactionRequest,
    context: { userId: string; attempt: number; reason: string; expectedFrom?: string; txPurpose?: TransactionRequest['txPurpose'] }
): Promise<TxLifecycleResult> {
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

    const fastTradePath = isFastTradeExecutionProfile(tx);
    const lifecycle = await broadcastRawWithQuorum({
        chainId: tx.chainId,
        signedRawTransaction: signed.signedTransaction,
        expectedFrom: context.expectedFrom,
        syncVisibilityRetries: fastTradePath ? PRIVY_FAST_TRADE_SYNC_VISIBILITY_RETRIES : PRIVY_TX_SYNC_VISIBILITY_RETRIES,
        syncVisibilityDelayMs: fastTradePath ? PRIVY_FAST_TRADE_SYNC_VISIBILITY_DELAY_MS : PRIVY_TX_SYNC_VISIBILITY_DELAY_MS,
        bypassRawTxCache: true
    });
    const rawTxHash = lifecycle.txHash;
    if (!rawTxHash) return lifecycle;
    logger.info(LogCode.EXE_TX_BROADCAST, 'Ethereum transaction broadcast via signed raw path', {
        txHash: rawTxHash,
        chainId: tx.chainId
    });

    if (lifecycle.status === 'broadcasted_unseen') {
        logger.warn(LogCode.EXE_TX_REVERTED, 'Privy raw tx broadcasted but not visible in sync probe', {
            txHash: rawTxHash,
            chainId: tx.chainId,
            txPurpose: context.txPurpose,
            checks: lifecycle.attempts,
            lastError: lifecycle.lastRpcError
        });
    }

    scheduleTxVisibilityCheck({
        path: 'raw_sign_broadcast',
        chainId: tx.chainId,
        txHash: rawTxHash,
        expectedFrom: context.expectedFrom
    });

    if (fastTradePath) {
        logger.info(LogCode.SYS_INFO, 'Privy fast trade lifecycle early return', {
            chainId: tx.chainId,
            txHash: rawTxHash,
            status: lifecycle.status,
            checks: lifecycle.attempts
        });
        return lifecycle;
    }

    if (context.txPurpose === 'trade' || context.txPurpose === 'speedup') {
        const finalState = await waitForReceiptStateMachine({
            chainId: tx.chainId,
            txHash: rawTxHash,
            expectedFrom: context.expectedFrom,
            maxWaitMs: 900,
            pollMs: 300
        }).catch(() => lifecycle);
        if (finalState.status === 'dropped_timeout' && lifecycle.status === 'broadcasted_unseen') {
            return lifecycle;
        }
        return finalState;
    }
    return lifecycle;
}

export async function sendTransactionLifecycle(
    userId: string,
    accessToken: string,
    tx: TransactionRequest
): Promise<TxLifecycleResult> {
    // Wrap entire execution in a per-user lock
    return withUserLock(userId, async () => withChainSendLimiter(tx.chainId, async () => {
        const chainKey = buildUserChainKey(userId, tx.chainId);
        bumpInflightUserChainTx(chainKey, 1);
        // === SIMULATION MODE ===
        try {
            if (process.env.SIMULATION_MODE === 'true') {
                logger.info(LogCode.EXE_TX_BROADCAST, 'SIMULATION MODE: Skipping actual Privy send', {
                    userId,
                    to: tx.to,
                    value: tx.value,
                    chainId: tx.chainId
                });
                return {
                    status: 'confirmed_success',
                    txHash: `0xSIMULATION_PRIVY_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                    firstSeenAt: Date.now(),
                    confirmedAt: Date.now(),
                    attempts: 1,
                    chainId: tx.chainId
                };
            }

            const client = getPrivyClient();
            const MAX_RETRIES = 3;
            const NETWORK_RETRY_DELAY_MS = 900;
            const NONCE_RETRY_DELAY_MS = 250;

            // Get user's wallet info (both address and ID)
            const walletInfo = await getEmbeddedWalletInfo(userId, { chainType: 'ethereum' });
            if (!walletInfo) {
                throw new AppError(400, 'User has no EVM embedded wallet', 'NO_EVM_WALLET');
            }
            if (!isLikelyEvmAddress(walletInfo.address)) {
                throw new AppError(400, 'User has no EVM embedded wallet', 'NO_EVM_WALLET');
            }

            let txWithNonce = { ...tx };
            if (!txWithNonce.nonce) {
                txWithNonce.nonce = await getPendingNonce(txWithNonce.chainId, walletInfo.address);
            }

            const hasExplicitFee =
                !!txWithNonce.gasPrice
                || !!txWithNonce.maxFeePerGas
                || !!txWithNonce.maxPriorityFeePerGas;
            if (!hasExplicitFee) {
                try {
                    const gasPriceHex = await rpcCall<string>(
                        txWithNonce.chainId,
                        'eth_gasPrice',
                        [],
                        { strategy: 'fast', importance: 'critical' }
                    );
                    const baseGasPrice = BigInt(gasPriceHex);
                    const gasPolicy = resolveTradeGasPolicy(txWithNonce);
                    const bumpedGasPrice = (baseGasPrice * gasPolicy.bumpBps + 9999n) / 10000n;
                    const finalGasPrice = bumpedGasPrice > gasPolicy.minGasPriceWei
                        ? bumpedGasPrice
                        : gasPolicy.minGasPriceWei;
                    txWithNonce = {
                        ...txWithNonce,
                        gasPrice: finalGasPrice.toString()
                    };
                    logger.info(LogCode.SYS_INFO, 'Privy gas policy applied', {
                        chainId: txWithNonce.chainId,
                        txPurpose: txWithNonce.txPurpose || 'other',
                        executionProfile: txWithNonce.executionProfile || 'default',
                        policy: gasPolicy.policy,
                        baseGasPriceWei: baseGasPrice.toString(),
                        bumpBps: gasPolicy.bumpBps.toString(),
                        minGasPriceWei: gasPolicy.minGasPriceWei.toString(),
                        finalGasPriceWei: finalGasPrice.toString()
                    });
                } catch (gasErr: any) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Failed to derive gasPrice for Privy tx; continuing without explicit gas price', {
                        chainId: txWithNonce.chainId,
                        txPurpose: txWithNonce.txPurpose || 'other',
                        error: gasErr?.message || String(gasErr)
                    });
                }
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
                console.log('[sendTransaction] GasPrice:', txWithNonce.gasPrice);
                console.log('[sendTransaction] MaxFeePerGas:', txWithNonce.maxFeePerGas);
                console.log('[sendTransaction] MaxPriorityFeePerGas:', txWithNonce.maxPriorityFeePerGas);
                console.log('[sendTransaction] Profile:', txWithNonce.executionProfile);
                console.log('[sendTransaction] ===========================================');
            } else {
                logger.debug(LogCode.EXE_TX_BROADCAST, 'Privy tx prepared', {
                    chainId: txWithNonce.chainId,
                    to: txWithNonce.to?.slice(0, 10),
                    value: txWithNonce.value,
                    gas: txWithNonce.gas,
                    nonce: txWithNonce.nonce,
                    purpose: txWithNonce.txPurpose || 'other',
                    profile: txWithNonce.executionProfile,
                    gasPrice: txWithNonce.gasPrice,
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
                    const fastTradePath = isFastTradeExecutionProfile(txWithNonce);
                    if (!preferPrivySendTx) {
                        return await signAndBroadcastRawTransaction(client, walletInfo.id, txWithNonce, {
                            userId,
                            attempt,
                            reason: 'chain_not_in_privy_sendtx_allowlist',
                            expectedFrom: walletInfo.address,
                            txPurpose: txWithNonce.txPurpose
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

                    logger.info(LogCode.EXE_TX_BROADCAST, 'Ethereum transaction sent via Privy', {
                        txHash: response.hash,
                        chainId: txWithNonce.chainId,
                        walletId: walletInfo.id?.slice?.(0, 12),
                        expectedFrom: walletInfo.address
                    });
                    scheduleTxVisibilityCheck({
                        path: 'privy_sendtx',
                        chainId: txWithNonce.chainId,
                        txHash: response.hash,
                        expectedFrom: walletInfo.address
                    });
                    const visibility = await verifyTxVisibility(
                        txWithNonce.chainId,
                        response.hash,
                        walletInfo.address,
                        {
                            retries: fastTradePath ? PRIVY_FAST_TRADE_SYNC_VISIBILITY_RETRIES : PRIVY_TX_SYNC_VISIBILITY_RETRIES,
                            delayMs: fastTradePath ? PRIVY_FAST_TRADE_SYNC_VISIBILITY_DELAY_MS : PRIVY_TX_SYNC_VISIBILITY_DELAY_MS
                        }
                    );

                    const lifecycleBase: TxLifecycleResult = visibility.visible
                        ? {
                            status: 'visible_pending',
                            txHash: response.hash,
                            firstSeenAt: Date.now(),
                            attempts: visibility.checks,
                            chainId: txWithNonce.chainId
                        }
                        : {
                            status: 'broadcasted_unseen',
                            txHash: response.hash,
                            lastRpcError: visibility.lastError || 'not_found_by_rpc',
                            attempts: visibility.checks,
                            chainId: txWithNonce.chainId
                        };

                    const postSendDelayMs = Math.max(0, Number(process.env.PRIVY_POST_SEND_DELAY_MS || '0'));
                    if (postSendDelayMs > 0) {
                        await new Promise(resolve => setTimeout(resolve, postSendDelayMs));
                    }

                    if (fastTradePath) {
                        logger.info(LogCode.SYS_INFO, 'Privy fast trade lifecycle early return', {
                            chainId: txWithNonce.chainId,
                            txHash: response.hash,
                            status: lifecycleBase.status,
                            checks: lifecycleBase.attempts
                        });
                        return lifecycleBase;
                    }

                    if (txWithNonce.txPurpose === 'trade' || txWithNonce.txPurpose === 'speedup') {
                        const finalState = await waitForReceiptStateMachine({
                            chainId: txWithNonce.chainId,
                            txHash: response.hash,
                            expectedFrom: walletInfo.address,
                            maxWaitMs: 900,
                            pollMs: 300
                        }).catch(() => lifecycleBase);
                        if (finalState.status === 'dropped_timeout' && lifecycleBase.status === 'broadcasted_unseen') {
                            return lifecycleBase;
                        }
                        return finalState;
                    }
                    return lifecycleBase;
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
                                reason: 'privy_sendtx_unsupported_for_chain',
                                expectedFrom: walletInfo.address,
                                txPurpose: txWithNonce.txPurpose
                            });
                        } catch (fallbackError: any) {
                            logger.error(LogCode.EXE_TX_REVERTED, 'Privy sign+broadcast fallback failed', {
                                chainId: txWithNonce.chainId,
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
                            invalidatePendingNonce(txWithNonce.chainId, walletInfo.address);
                            const currentNonce = txWithNonce.nonce ? BigInt(txWithNonce.nonce) : null;
                            const refreshedNonceHex = await getPendingNonce(txWithNonce.chainId, walletInfo.address);
                            const refreshedNonce = refreshedNonceHex ? BigInt(refreshedNonceHex) : null;
                            const nextNonce = refreshedNonce !== null
                                ? (currentNonce !== null && refreshedNonce <= currentNonce ? currentNonce + 1n : refreshedNonce)
                                : (currentNonce !== null ? currentNonce + 1n : null);
                            txWithNonce = {
                                ...txWithNonce,
                                nonce: nextNonce !== null ? nextNonce.toString() : txWithNonce.nonce
                            };
                        }
                        const retryDelayMs = isNonceError ? NONCE_RETRY_DELAY_MS : NETWORK_RETRY_DELAY_MS;
                        logger.warn(LogCode.EXE_TX_BROADCAST, `${reason} on attempt ${attempt}, retrying in ${retryDelayMs}ms...`, {
                            chainId: txWithNonce.chainId,
                            nextNonce: txWithNonce.nonce
                        });
                        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                        continue;
                    }

                    logger.error(LogCode.EXE_TX_REVERTED, 'Privy Ethereum transaction failed', { error: effectiveError?.message || String(effectiveError), chainId: txWithNonce.chainId });

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
            return {
                status: 'dropped_timeout',
                attempts: MAX_RETRIES,
                chainId: tx.chainId,
                lastRpcError: 'transaction_failed_after_max_retries'
            };
        } finally {
            bumpInflightUserChainTx(chainKey, -1);
        }
    }));
}

export async function sendTransaction(
    userId: string,
    accessToken: string,
    tx: TransactionRequest
): Promise<string> {
    const lifecycle = await sendTransactionLifecycle(userId, accessToken, tx);
    if (isTxLifecycleSendAccepted(lifecycle) && lifecycle.txHash) {
        return lifecycle.txHash;
    }
    throw new AppError(
        500,
        `Failed to send transaction: ${toTxLifecycleFailureMessage(lifecycle)}`,
        'TRANSACTION_FAILED'
    );
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
    const walletInfo = await getEmbeddedWalletInfo(userId, { chainType: 'ethereum' });
    if (!walletInfo) {
        throw new AppError(400, 'User has no EVM embedded wallet', 'NO_EVM_WALLET');
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
