/**
 * Privy Wallet Service
 * Server-side wallet operations using Privy's embedded wallet API
 * Enables instant trading without user popups
 * 
 * Documentation: https://docs.privy.io/guide/server/wallets/
 */

import { PrivyClient } from '@privy-io/server-auth';
import { ethers } from 'ethers';
import { AppError } from '../middleware/errorHandler.js';
import { redact } from '../utils/sanitizer.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { resolvePrivyServerConfig } from '../config/privy.js';
import {
    callRpc as rpcCall,
    broadcastRawWithQuorum,
    recordTxLifecycleState,
    getEthersProvider,
    probeTxVisibility,
    waitForReceiptStateMachine
} from './rpcManager.js';
import { sendViaFlashbots } from './dex/flashbots.js';
import type { TxLifecycleResult } from './txLifecycle.js';
import {
    isTxLifecycleSendAccepted,
    toTxLifecycleFailureMessage
} from './txLifecycle.js';
import type { OrderRuntimeContext } from './order-runtime/types.js';
import type { OrderReasonCode } from './order-runtime/types.js';
import {
    addOrderAttempt,
    attachOrderTxHash,
    markOrderFailure,
    markOrderHashAccepted,
    markOrderPrepared,
    markOrderSendStarted,
    recordLifecycleOnOrder,
    setOrderMetadata,
    updateOrderAttempt
} from './order-runtime/context.js';
import { inferOrderReasonCode } from './order-runtime/reasonCodes.js';
import { bindOrderToTxHash, reportRpcUncertain, reportSendAccepted } from './order-runtime/adjudicator/service.js';
import { shouldRetryAfterBroadcastUnseen } from './rpc/visibilityPolicy.js';
import { EXECUTION_FEE_PROFILE, TX_NONCE_PROFILE } from './rpc/profile.js';
import { withWalletChainLock } from './nonce/walletNonceLane.js';
import { resolveNonceFloor } from './nonce/nonceFloorPolicy.js';
import { resolvePendingNonce } from './nonce/pendingNonceResolution.js';
import { resolveSolanaWalletRecord } from './solana/solanaWalletResolver.js';
import { sendSolanaTransactionWithContextDeps } from './solana/solanaPrivySender.js';
import { resolveSolanaSigningContext, type ResolvedSolanaSigningContext } from './solana/solanaSigningContext.js';
import { fetchPrivyEmbeddedWalletInfo, type EmbeddedWalletChainType } from './privyEmbeddedWalletResolver.js';
import {
    markPendingAttributedPositionAccepted,
    markPendingAttributedPositionSendStarted,
} from './copytrade-v2/positions/pendingAttributedPositionLedger.js';
import {
    __resetUserTransactionSchedulerForTests,
    __runUserTransactionTaskForTests,
    isTransactionQueueBusy,
    markUserChainInflight,
    withUserTransactionLock,
} from './privyWalletQueue.js';
import { withChainSendLimiter } from './privyChainSendLimiter.js';
export {
    __resetUserTransactionSchedulerForTests,
    __runUserTransactionTaskForTests,
    isTransactionQueueBusy,
} from './privyWalletQueue.js';

// Initialize Privy client
const { appId: PRIVY_APP_ID, appSecret: PRIVY_APP_SECRET, frontendAppId: PRIVY_FRONTEND_APP_ID, appIdMismatch: PRIVY_APP_ID_MISMATCH } = resolvePrivyServerConfig();
const PRIVY_AUTHORIZATION_KEY = process.env.PRIVY_AUTHORIZATION_KEY || '';
const PRIVY_SEND_TX_CHAIN_IDS = new Set(
    String(process.env.PRIVY_SEND_TX_CHAIN_IDS || '1,8453,56')
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
);
// Keep visibility probing enabled for observability (deployment marker).
// For raw-path trade/speedup we also run a short synchronous visibility probe before returning success.
const PRIVY_TX_VISIBILITY_CHECK_ENABLED = true;
const PRIVY_TX_REQUIRE_VISIBILITY = false;
const PRIVY_TX_VISIBILITY_RETRIES = 6;
const PRIVY_TX_VISIBILITY_DELAY_MS = 500;
const PRIVY_TX_SYNC_VISIBILITY_RETRIES = 8;
const PRIVY_TX_SYNC_VISIBILITY_DELAY_MS = 400;
const PRIVY_FAST_TRADE_SYNC_VISIBILITY_RETRIES = 1;
const PRIVY_FAST_TRADE_SYNC_VISIBILITY_DELAY_MS = 0;
const PRIVY_FAST_TRADE_SKIP_SYNC_VISIBILITY = (process.env.PRIVY_FAST_TRADE_SKIP_SYNC_VISIBILITY || 'true').toLowerCase() === 'true';
const PRIVY_FAST_TRADE_FORCE_RAW_PATH = (process.env.PRIVY_FAST_TRADE_FORCE_RAW_PATH || 'false').toLowerCase() === 'true';
const PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_RETRIES = Math.max(1, Number(process.env.PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_RETRIES || '4'));
const PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_DELAY_MS = Math.max(0, Number(process.env.PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_DELAY_MS || '180'));
const PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_CHAIN_IDS = new Set(
    String(process.env.PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_CHAIN_IDS || '8453,56')
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
);
const PRIVY_FAST_TRADE_BASE_GAS_BUMP_BPS = BigInt(Math.max(10000, Number(process.env.PRIVY_FAST_TRADE_BASE_GAS_BUMP_BPS || '22000')));
const PRIVY_FAST_TRADE_BSC_GAS_BUMP_BPS = BigInt(Math.max(10000, Number(process.env.PRIVY_FAST_TRADE_BSC_GAS_BUMP_BPS || '17000')));
const PRIVY_FAST_TRADE_DEFAULT_GAS_BUMP_BPS = BigInt(Math.max(10000, Number(process.env.PRIVY_FAST_TRADE_DEFAULT_GAS_BUMP_BPS || '15000')));
const PRIVY_FAST_TRADE_BASE_MIN_GAS_PRICE_WEI = BigInt(Math.max(1, Number(process.env.PRIVY_FAST_TRADE_BASE_MIN_GAS_PRICE_WEI || '120000000')));
const PRIVY_FAST_TRADE_BSC_MIN_GAS_PRICE_WEI = BigInt(Math.max(1, Number(process.env.PRIVY_FAST_TRADE_BSC_MIN_GAS_PRICE_WEI || '1200000000')));
const LOCAL_SIGNER_ENABLED = (process.env.LOCAL_SIGNER_ENABLED || 'false').toLowerCase() === 'true';

let privyClient: PrivyClient | null = null;
let privyConfigWarningLogged = false;

function shouldReturnAcceptedLifecycleImmediately(tx: TransactionRequest): boolean {
    return tx.txPurpose === 'approval' || isFastTradeExecutionProfile(tx);
}

async function syncAcceptedCopytradePendingPosition(params: {
    runtimeContext?: OrderRuntimeContext;
    txHash?: string | null;
    lifecycleStatus?: string | null;
}): Promise<void> {
    const pendingPositionId = String(params.runtimeContext?.metadata?.copytradePendingPositionId || '').trim();
    const txHash = String(params.txHash || '').trim().toLowerCase();
    if (!pendingPositionId || !/^0x[a-f0-9]{64}$/.test(txHash)) return;
    const status = String(params.lifecycleStatus || '').trim().toLowerCase() === 'visible_pending'
        ? 'broadcasted_unseen'
        : 'pending_broadcast';
    await markPendingAttributedPositionAccepted({
        positionId: pendingPositionId,
        entryTxHash: txHash,
        reasonCode: 'buy_tx_accepted',
        positionStatus: status,
    }).catch(() => 0);
}

async function syncSendStartedCopytradePendingPosition(params: {
    runtimeContext?: OrderRuntimeContext;
}): Promise<void> {
    const pendingPositionId = String(params.runtimeContext?.metadata?.copytradePendingPositionId || '').trim();
    if (!pendingPositionId) return;
    await markPendingAttributedPositionSendStarted({
        positionId: pendingPositionId,
        reasonCode: 'buy_send_started',
        positionStatus: 'pending_broadcast',
    }).catch(() => 0);
}

function getLocalSignerPrivateKey(chainId: number): string {
    const perChainKey = process.env[`LOCAL_SIGNER_PRIVATE_KEY_${chainId}` as keyof NodeJS.ProcessEnv];
    const genericKey = process.env.LOCAL_SIGNER_PRIVATE_KEY;
    return String(perChainKey || genericKey || '').trim();
}

async function sendWithLocalSigner(tx: TransactionRequest): Promise<TxLifecycleResult> {
    const privateKey = getLocalSignerPrivateKey(tx.chainId);
    if (!privateKey) {
        throw new AppError(500, 'LOCAL_SIGNER_PRIVATE_KEY not configured', 'LOCAL_SIGNER_NOT_CONFIGURED');
    }

    const localRpcUrl =
        String(
            process.env[`LOCAL_SIGNER_RPC_URL_${tx.chainId}` as keyof NodeJS.ProcessEnv]
            || process.env.LOCAL_SIGNER_RPC_URL
            || ''
        ).trim();
    const provider = localRpcUrl
        ? new ethers.JsonRpcProvider(localRpcUrl, tx.chainId, { staticNetwork: true })
        : getEthersProvider(tx.chainId, 'trade_execution');
    const wallet = new ethers.Wallet(privateKey, provider);

    const txReq: ethers.TransactionRequest = {
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: tx.value ? BigInt(tx.value) : 0n,
        chainId: tx.chainId
    };

    if (tx.gas) txReq.gasLimit = BigInt(tx.gas);
    if (tx.gasPrice) txReq.gasPrice = BigInt(tx.gasPrice);
    if (tx.maxFeePerGas) txReq.maxFeePerGas = BigInt(tx.maxFeePerGas);
    if (tx.maxPriorityFeePerGas) txReq.maxPriorityFeePerGas = BigInt(tx.maxPriorityFeePerGas);
    if (!txReq.gasPrice && !txReq.maxFeePerGas) {
        const fee = await provider.getFeeData();
        const latestBlock = await provider.getBlock('latest').catch(() => null);
        const base = latestBlock?.baseFeePerGas || 0n;
        const priority = fee.maxPriorityFeePerGas || 1_000_000n;
        const suggestedMax = fee.maxFeePerGas || (base * 2n + priority);
        txReq.maxPriorityFeePerGas = priority;
        txReq.maxFeePerGas = suggestedMax > priority ? suggestedMax : (priority + 1n);
    }
    if (tx.nonce) txReq.nonce = Number(BigInt(tx.nonce));
    else txReq.nonce = await provider.getTransactionCount(wallet.address, 'pending');

    const signedRawTransaction = await wallet.signTransaction(txReq);
    const sent = await provider.broadcastTransaction(signedRawTransaction);
    const txHash = sent.hash;
    const firstSeenAt = Date.now();

    const startedAt = Date.now();
    const maxWaitMs = 2_500;
    while (Date.now() - startedAt < maxWaitMs) {
        const receipt = await provider.getTransactionReceipt(txHash).catch(() => null);
        if (receipt) {
            const ok = Number(receipt.status || 0) === 1;
            return {
                status: ok ? 'confirmed_success' : 'confirmed_failed',
                txHash,
                firstSeenAt,
                confirmedAt: Date.now(),
                attempts: 1,
                chainId: tx.chainId,
                lastRpcError: ok ? undefined : 'receipt_status_0'
            };
        }
        await new Promise((resolve) => setTimeout(resolve, 220));
    }

    const visible = await provider.getTransaction(txHash).catch(() => null);
    return {
        status: visible ? 'visible_pending' : 'broadcasted_unseen',
        txHash,
        firstSeenAt: visible ? firstSeenAt : undefined,
        attempts: 1,
        chainId: tx.chainId,
        lastRpcError: visible ? undefined : 'not_found_by_local_rpc'
    };
}

function syncLifecycleIntoRuntimeContext(tx: TransactionRequest, lifecycle: TxLifecycleResult, reasonCode?: OrderReasonCode): void {
    if (!tx.runtimeContext) return;
    recordLifecycleOnOrder(tx.runtimeContext, lifecycle, { reasonCode });
}

function isFallbackOwnedRuntimeState(runtimeContext?: OrderRuntimeContext | null): boolean {
    const runtimeState = String(runtimeContext?.state || '').trim().toLowerCase();
    return runtimeState === 'fallback_started'
        || runtimeState === 'fallback_succeeded'
        || runtimeState === 'fallback_failed';
}

function shouldSuppressSendForFallbackOwnership(params: {
    runtimeContext?: OrderRuntimeContext | null;
    executionBranch?: TransactionRequest['executionBranch'];
}): boolean {
    if (!isFallbackOwnedRuntimeState(params.runtimeContext)) return false;
    return params.executionBranch !== 'fallback';
}

function reportAcceptedEvidence(tx: TransactionRequest, txHash: string, source: 'privy_sendtx' | 'raw_broadcast'): void {
    const orderId = tx.runtimeContext?.orderId;
    if (orderId) bindOrderToTxHash(orderId, tx.chainId, txHash);
    reportSendAccepted({
        chainId: tx.chainId,
        txHash,
        orderId,
        source
    });
}

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

async function tryResolveFastTradeUnresolvedVisibility(params: {
    lifecycle: TxLifecycleResult;
    chainId: number;
    txHash?: string;
    expectedFrom?: string;
    path: 'raw_sign_broadcast' | 'privy_sendtx';
}): Promise<TxLifecycleResult> {
    const { lifecycle, chainId, txHash, expectedFrom, path } = params;
    if (lifecycle.status !== 'broadcasted_unseen' || !txHash) return lifecycle;
    if (!PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_CHAIN_IDS.has(chainId)) return lifecycle;

    try {
        const visibility = await verifyTxVisibility(chainId, txHash, expectedFrom, {
            retries: PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_RETRIES,
            delayMs: PRIVY_FAST_TRADE_UNRESOLVED_VISIBILITY_DELAY_MS
        });
        if (visibility.visible) {
            logger.info(LogCode.SYS_INFO, 'Fast trade visibility resolved via short sync probe', {
                chainId,
                txHash,
                path,
                checks: visibility.checks,
                seenFrom: visibility.from,
                seenNonce: visibility.nonce
            });
            return {
                ...lifecycle,
                status: 'visible_pending',
                firstSeenAt: lifecycle.firstSeenAt || Date.now(),
                attempts: Math.max(lifecycle.attempts || 1, visibility.checks || 1),
                lastRpcError: undefined
            };
        }

        logger.warn(LogCode.SYS_INFO, 'Fast trade visibility still pending after short sync probe', {
            chainId,
            txHash,
            path,
            checks: visibility.checks,
            lastError: visibility.lastError || null
        });
        return {
            ...lifecycle,
            attempts: Math.max(lifecycle.attempts || 1, visibility.checks || 1),
            lastRpcError: lifecycle.lastRpcError || visibility.lastError || 'not_found_by_rpc'
        };
    } catch (error: any) {
        logger.warn(LogCode.SYS_INFO, 'Fast trade visibility short sync probe failed', {
            chainId,
            txHash,
            path,
            error: error?.message || String(error)
        });
        return lifecycle;
    }
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

    if (PRIVY_APP_ID_MISMATCH && !privyConfigWarningLogged) {
        privyConfigWarningLogged = true;
        logger.warn(LogCode.SYS_INFO, 'Privy frontend/server app id mismatch detected on API server', {
            serverAppIdConfigured: true,
            frontendAppIdConfigured: Boolean(PRIVY_FRONTEND_APP_ID),
        });
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
 * Pre-warm the Privy client at startup to avoid cold-start constructor overhead
 * on the first trade. Call this during server initialization.
 */
export function preWarmPrivyClient(): void {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) return;
    try {
        getPrivyClient();
        logger.info(LogCode.SYS_INFO, '[Privy] Client pre-warmed at startup');
    } catch {
        // Ignore – credentials may not be available at startup in some envs
    }
}

// Eagerly initialize the Privy client when this module is first imported
// so the constructor cost (and any internal SDK setup) is paid at boot time,
// not at the moment of the first trade request.
if (PRIVY_APP_ID && PRIVY_APP_SECRET) {
    try { getPrivyClient(); } catch { /* ignore */ }
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
    return fetchPrivyEmbeddedWalletInfo(userId, {
        chainType: options?.chainType,
        getUser: (targetUserId) => client.getUser(targetUserId)
    });
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
    mevProtection?: boolean;
    gasPolicyTier?: string;
    replacementPolicyTier?: string;
    privateRelayEligible?: boolean;
    executionBranch?: 'primary' | 'fallback';
    runtimeContext?: OrderRuntimeContext;
}

/**
 * Send a transaction using user's embedded wallet (server-side signing)
 * @param userId - Privy user ID
 * @param accessToken - User's Privy access token (for authorization context)
 * @param tx - Transaction to send
 * @returns Transaction hash
 */
const pendingNonceInflight = new Map<string, Promise<string | undefined>>();
const pendingNonceCache = new Map<string, { nonce: string; timestamp: number }>();
const PENDING_NONCE_CACHE_TTL_MS = Math.max(250, Number(process.env.PENDING_NONCE_CACHE_TTL_MS || '1500'));
const PENDING_NONCE_FLOOR_RETENTION_MS = Math.max(
    PENDING_NONCE_CACHE_TTL_MS,
    Number(process.env.PENDING_NONCE_FLOOR_RETENTION_MS || '30000')
);

function buildPendingNonceKey(chainId: number, walletAddress: string): string {
    return `${chainId}:${walletAddress.toLowerCase()}`;
}

function invalidatePendingNonce(chainId: number, walletAddress: string): void {
    const key = buildPendingNonceKey(chainId, walletAddress);
    pendingNonceCache.delete(key);
    pendingNonceInflight.delete(key);
}

function seedNextPendingNonce(chainId: number, walletAddress: string, nonce?: string): void {
    if (!walletAddress || !nonce) return;
    try {
        const nextNonce = (BigInt(nonce) + 1n).toString();
        const key = buildPendingNonceKey(chainId, walletAddress);
        pendingNonceCache.set(key, {
            nonce: nextNonce,
            timestamp: Date.now()
        });
        pendingNonceInflight.delete(key);
    } catch {
        invalidatePendingNonce(chainId, walletAddress);
    }
}

export async function getPendingNonce(chainId: number, walletAddress: string): Promise<string | undefined> {
    if (!walletAddress || chainId <= 0) return undefined;
    const key = buildPendingNonceKey(chainId, walletAddress);
    const cached = pendingNonceCache.get(key);
    const cachedAgeMs = cached ? Date.now() - cached.timestamp : null;
    if (cached && cachedAgeMs !== null && cachedAgeMs <= PENDING_NONCE_CACHE_TTL_MS) {
        return cached.nonce;
    }

    const inflight = pendingNonceInflight.get(key);
    if (inflight) return await inflight;

    const task = (async () => {
        try {
            const rpcNonce = await rpcCall<string>(
                chainId,
                'eth_getTransactionCount',
                [walletAddress, 'pending'],
                {
                    strategy: TX_NONCE_PROFILE.strategy,
                    purpose: TX_NONCE_PROFILE.purpose,
                    importance: TX_NONCE_PROFILE.importance,
                }
            );
            const resolved = resolvePendingNonce({
                cachedNonce: cached?.nonce,
                rpcNonce: typeof rpcNonce === 'string' ? rpcNonce : undefined
            });
            if (!resolved.nonce) return undefined;
            pendingNonceCache.set(key, { nonce: resolved.nonce, timestamp: Date.now() });
            return resolved.nonce;
        } catch {
            if (cached && cachedAgeMs !== null && cachedAgeMs <= PENDING_NONCE_FLOOR_RETENTION_MS) {
                return cached.nonce;
            }
            return undefined;
        } finally {
            pendingNonceInflight.delete(key);
        }
    })();

    pendingNonceInflight.set(key, task);
    return await task;
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
    if (typeof signed?.signedTransaction !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signed.signedTransaction)) {
        logger.error(LogCode.EXE_TX_REVERTED, 'Privy signTransaction returned invalid signed payload', {
            chainId: tx.chainId,
            userId: context.userId.slice(0, 10),
            hasSignedTransaction: typeof signed?.signedTransaction === 'string',
            signedLength: typeof signed?.signedTransaction === 'string' ? signed.signedTransaction.length : 0,
            encoding: (signed as any)?.encoding
        });
        throw new Error('privy_invalid_signed_transaction_payload');
    }

    const shouldUseFlashbots = tx.mevProtection === true
        && tx.chainId === 1
        && (tx.txPurpose === 'trade' || tx.txPurpose === 'speedup');

    if (shouldUseFlashbots) {
        const flashbotsResult = await sendViaFlashbots(
            signed.signedTransaction,
            tx.chainId,
            { useFlashbots: true, preferFast: false, maxBlocksToWait: 25 }
        );

        if (flashbotsResult.success && flashbotsResult.txHash) {
            if (tx.runtimeContext) {
                setOrderMetadata(tx.runtimeContext, {
                    submissionPath: 'flashbots',
                    privateRelayUsed: true,
                    fallbackToPublic: false,
                    privateRelayRejected: false
                });
            }
            const visibility = await verifyTxVisibility(
                tx.chainId,
                flashbotsResult.txHash,
                context.expectedFrom,
                {
                    retries: 4,
                    delayMs: 220
                }
            );

            if (visibility.visible) {
                return {
                    status: 'visible_pending',
                    txHash: flashbotsResult.txHash,
                    firstSeenAt: Date.now(),
                    attempts: visibility.checks,
                    chainId: tx.chainId
                };
            }

            return {
                status: 'broadcasted_unseen',
                txHash: flashbotsResult.txHash,
                lastRpcError: visibility.lastError || 'flashbots_not_found_by_rpc',
                attempts: visibility.checks,
                chainId: tx.chainId
            };
        }

        if (tx.runtimeContext) {
            setOrderMetadata(tx.runtimeContext, {
                submissionPath: 'fallback_public',
                privateRelayUsed: false,
                fallbackToPublic: true,
                privateRelayRejected: true
            });
        }
        logger.warn(LogCode.EXE_TX_BROADCAST, 'Flashbots broadcast unavailable, falling back to quorum raw broadcast', {
            chainId: tx.chainId,
            userId: context.userId.slice(0, 10),
            reason: flashbotsResult.error || 'unknown'
        });
    }

    if (tx.runtimeContext && !shouldUseFlashbots) {
        setOrderMetadata(tx.runtimeContext, {
            submissionPath: 'public',
            privateRelayUsed: false,
            fallbackToPublic: false,
            privateRelayRejected: false
        });
    }

    const fastTradePath = isFastTradeExecutionProfile(tx);
    const sendStartedAtMs = Date.now();
    const lifecycle = await broadcastRawWithQuorum({
        chainId: tx.chainId,
        signedRawTransaction: signed.signedTransaction,
        expectedFrom: context.expectedFrom,
        syncVisibilityRetries: fastTradePath ? PRIVY_FAST_TRADE_SYNC_VISIBILITY_RETRIES : PRIVY_TX_SYNC_VISIBILITY_RETRIES,
        syncVisibilityDelayMs: fastTradePath ? PRIVY_FAST_TRADE_SYNC_VISIBILITY_DELAY_MS : PRIVY_TX_SYNC_VISIBILITY_DELAY_MS,
        bypassRawTxCache: true,
        skipSyncVisibility: fastTradePath && PRIVY_FAST_TRADE_SKIP_SYNC_VISIBILITY
    });
    const rawTxHash = lifecycle.txHash;
    const sendHashAtMs = rawTxHash ? Date.now() : null;
    logger.info(LogCode.SYS_INFO, '[PrivySendTiming] send completed', {
        chainId: tx.chainId,
        txPurpose: context.txPurpose,
        executionProfile: tx.executionProfile || 'default',
        send_started_at: sendStartedAtMs,
        send_hash_at: sendHashAtMs,
        send_ms: sendHashAtMs ? Math.max(0, sendHashAtMs - sendStartedAtMs) : null,
        txHash: rawTxHash || undefined,
        status: lifecycle.status,
        attempts: lifecycle.attempts || 0,
        lastRpcError: lifecycle.lastRpcError || null
    });
    if (!rawTxHash) return lifecycle;
    logger.info(LogCode.EXE_TX_BROADCAST, 'Ethereum transaction broadcast via signed raw path', {
        txHash: rawTxHash,
        chainId: tx.chainId
    });
    logger.info(LogCode.EXE_TX_BROADCAST, `Ethereum transaction broadcast via signed raw path txHash=${rawTxHash}`, {
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
        if (lifecycle.status === 'broadcasted_unseen' && rawTxHash) {
            logger.warn(LogCode.SYS_INFO, 'Privy fast trade visibility guard skipped (non-blocking)', {
                chainId: tx.chainId,
                txHash: rawTxHash,
                status: lifecycle.status,
                checks: lifecycle.attempts,
                lastRpcError: lifecycle.lastRpcError || null
            });
        }
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
    return withUserTransactionLock({
        userId,
        chainId: tx.chainId,
        tx,
        fn: async () => withChainSendLimiter(tx.chainId, async () => {
        markUserChainInflight(userId, tx.chainId, 1);
        // === SIMULATION MODE ===
        try {
            const runtimeContext = tx.runtimeContext;
            if (shouldSuppressSendForFallbackOwnership({
                runtimeContext,
                executionBranch: tx.executionBranch,
            })) {
                const disownedLifecycle: TxLifecycleResult = {
                    status: 'dropped_timeout',
                    attempts: 1,
                    chainId: tx.chainId,
                    lastRpcError: 'copytrade_send_disowned_by_fallback',
                };
                // This branch is a loser send after fallback ownership has already been established.
                // Do not let it overwrite the canonical runtime state for the winning fallback path.
                return disownedLifecycle;
            }
            if (runtimeContext) {
                markOrderPrepared(runtimeContext);
                markOrderSendStarted(runtimeContext);
                await syncSendStartedCopytradePendingPosition({ runtimeContext });
                setOrderMetadata(runtimeContext, {
                    txPurpose: tx.txPurpose || 'other',
                    executionProfile: tx.executionProfile || 'default',
                    executionBranch: tx.executionBranch || 'primary',
                    mevProtection: tx.mevProtection === true,
                    gasPolicyTier: tx.gasPolicyTier || null,
                    replacementPolicyTier: tx.replacementPolicyTier || null,
                    privateRelayEligible: tx.privateRelayEligible === true
                });
            }
            if (process.env.SIMULATION_MODE === 'true') {
                logger.info(LogCode.EXE_TX_BROADCAST, 'SIMULATION MODE: Skipping actual Privy send', {
                    userId,
                    to: tx.to,
                    value: tx.value,
                    chainId: tx.chainId
                });
                const simulatedLifecycle: TxLifecycleResult = {
                    status: 'confirmed_success',
                    txHash: `0xSIMULATION_PRIVY_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                    firstSeenAt: Date.now(),
                    confirmedAt: Date.now(),
                    attempts: 1,
                    chainId: tx.chainId
                };
                syncLifecycleIntoRuntimeContext(tx, simulatedLifecycle);
                return simulatedLifecycle;
            }

            if (LOCAL_SIGNER_ENABLED) {
                logger.warn(LogCode.EXE_TX_BROADCAST, 'LOCAL_SIGNER mode enabled: bypassing Privy and sending via local key', {
                    chainId: tx.chainId,
                    txPurpose: tx.txPurpose || 'other'
                });
                const localSignerLifecycle = await sendWithLocalSigner(tx);
                syncLifecycleIntoRuntimeContext(tx, localSignerLifecycle);
                return localSignerLifecycle;
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
            return await withWalletChainLock(tx.chainId, walletInfo.address, async () => {
                let txWithNonce = { ...tx };
                const hasExplicitFee =
                    !!txWithNonce.gasPrice
                    || !!txWithNonce.maxFeePerGas
                    || !!txWithNonce.maxPriorityFeePerGas;

                const needsNonce = !txWithNonce.nonce;
                const shouldLoadNonceFloor = !!txWithNonce.nonce && txWithNonce.txPurpose !== 'speedup';
                const needsGas = !hasExplicitFee;
                if (needsNonce || needsGas || shouldLoadNonceFloor) {
                    const [nonceResult, gasPriceResult] = await Promise.all([
                        (needsNonce || shouldLoadNonceFloor)
                            ? getPendingNonce(txWithNonce.chainId, walletInfo.address).catch(() => undefined)
                            : Promise.resolve(txWithNonce.nonce),
                        needsGas
                            ? rpcCall<string>(txWithNonce.chainId, 'eth_gasPrice', [], {
                                strategy: EXECUTION_FEE_PROFILE.strategy,
                                purpose: EXECUTION_FEE_PROFILE.purpose,
                                importance: EXECUTION_FEE_PROFILE.importance,
                            }).catch(() => null)
                            : Promise.resolve(null)
                    ]);
                    if (needsNonce && nonceResult) {
                        txWithNonce.nonce = nonceResult;
                    }
                    if (!needsNonce && shouldLoadNonceFloor) {
                        const resolvedNonce = resolveNonceFloor({
                            requestedNonce: txWithNonce.nonce,
                            cachedFloorNonce: nonceResult,
                            txPurpose: txWithNonce.txPurpose,
                            hasPriorAcceptedLifecycle: false
                        });
                        if (resolvedNonce.upgraded && resolvedNonce.nonce) {
                            logger.warn(LogCode.EXE_TX_BROADCAST, 'Raised explicit nonce to cached wallet floor before send', {
                                chainId: txWithNonce.chainId,
                                txPurpose: txWithNonce.txPurpose || 'other',
                                requestedNonce: txWithNonce.nonce,
                                cachedFloorNonce: nonceResult,
                                nextNonce: resolvedNonce.nonce
                            });
                            txWithNonce.nonce = resolvedNonce.nonce;
                        }
                    }
                    if (needsGas && gasPriceResult) {
                        try {
                            const baseGasPrice = BigInt(gasPriceResult);
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
                }
                const needsDeterministicNonce =
                    txWithNonce.txPurpose === 'trade' || txWithNonce.txPurpose === 'speedup';
                if (needsDeterministicNonce && !txWithNonce.nonce) {
                    try {
                        const provider = getEthersProvider(txWithNonce.chainId, 'tx_visibility');
                        const fallbackNonce = await provider.getTransactionCount(walletInfo.address, 'pending');
                        txWithNonce.nonce = BigInt(fallbackNonce).toString();
                        logger.warn(LogCode.SYS_INFO, 'Trade nonce fallback applied from ethers provider', {
                            chainId: txWithNonce.chainId,
                            txPurpose: txWithNonce.txPurpose,
                            nonce: txWithNonce.nonce
                        });
                    } catch (fallbackErr: any) {
                        logger.error(LogCode.SYS_ERROR, 'Failed to resolve deterministic nonce for trade tx', {
                            chainId: txWithNonce.chainId,
                            txPurpose: txWithNonce.txPurpose,
                            error: fallbackErr?.message || String(fallbackErr)
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

                let priorAcceptedLifecycle: TxLifecycleResult | null = null;
                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                const attemptState = runtimeContext
                    ? addOrderAttempt(runtimeContext, {
                        attempt,
                        channel: 'unknown',
                        state: 'sending',
                        nonce: txWithNonce.nonce,
                        gasPrice: txWithNonce.gasPrice,
                        maxFeePerGas: txWithNonce.maxFeePerGas,
                        maxPriorityFeePerGas: txWithNonce.maxPriorityFeePerGas,
                        startedAt: Date.now()
                    })
                    : null;
                try {
                    const bumpGasForVisibilityRetry = (reason: string) => {
                        const nextTx = { ...txWithNonce };
                        const bumpBps = 12500n; // +25%
                        if (nextTx.gasPrice) {
                            const current = BigInt(nextTx.gasPrice);
                            const bumped = (current * bumpBps + 9999n) / 10000n;
                            nextTx.gasPrice = (bumped > current ? bumped : (current + 1n)).toString();
                        } else {
                            if (nextTx.maxFeePerGas) {
                                const current = BigInt(nextTx.maxFeePerGas);
                                const bumped = (current * bumpBps + 9999n) / 10000n;
                                nextTx.maxFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                            }
                            if (nextTx.maxPriorityFeePerGas) {
                                const current = BigInt(nextTx.maxPriorityFeePerGas);
                                const bumped = (current * bumpBps + 9999n) / 10000n;
                                nextTx.maxPriorityFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                            }
                        }
                        txWithNonce = nextTx;
                        logger.warn(LogCode.EXE_TX_BROADCAST, 'Privy tx unseen after broadcast; bumping gas and retrying with same nonce', {
                            chainId: txWithNonce.chainId,
                            attempt,
                            maxAttempts: MAX_RETRIES,
                            reason,
                            nonce: txWithNonce.nonce,
                            gasPrice: txWithNonce.gasPrice,
                            maxFeePerGas: txWithNonce.maxFeePerGas,
                            maxPriorityFeePerGas: txWithNonce.maxPriorityFeePerGas
                        });
                    };

                    logger.debug(LogCode.EXE_TX_BROADCAST, 'Sending Ethereum transaction via Privy', {
                        attempt,
                        from: walletInfo.address?.slice(0, 10),
                        to: txWithNonce.to?.slice(0, 10),
                        chainId: txWithNonce.chainId,
                    });

                    const preferPrivySendTx = PRIVY_SEND_TX_CHAIN_IDS.has(txWithNonce.chainId);
                    const fastTradePath = isFastTradeExecutionProfile(txWithNonce);
                    // ⚡ Fast-trade optimization: use sign+broadcast instead of Privy sendTransaction.
                    // Privy sendTx is a single HTTP call (~600-800ms) that signs + broadcasts + waits internally.
                    // sign+broadcast splits into: Privy signTransaction (~200ms) + our RPC fanout (~50ms),
                    // saving ~350-550ms on every turbo/sniper trade.
                    const useRawPathForSpeed = fastTradePath && preferPrivySendTx && PRIVY_FAST_TRADE_FORCE_RAW_PATH;
                    if (!preferPrivySendTx || useRawPathForSpeed) {
                        if (attemptState) {
                            updateOrderAttempt(runtimeContext!, attemptState.id, {
                                channel: 'raw_broadcast',
                                nonce: txWithNonce.nonce,
                                gasPrice: txWithNonce.gasPrice,
                                maxFeePerGas: txWithNonce.maxFeePerGas,
                                maxPriorityFeePerGas: txWithNonce.maxPriorityFeePerGas
                            });
                        }
                        const rawLifecycle = await signAndBroadcastRawTransaction(client, walletInfo.id, txWithNonce, {
                            userId,
                            attempt,
                            reason: useRawPathForSpeed ? 'fast_trade_sign_broadcast' : 'chain_not_in_privy_sendtx_allowlist',
                            expectedFrom: walletInfo.address,
                            txPurpose: txWithNonce.txPurpose
                        });
                        if (rawLifecycle.txHash && isTxLifecycleSendAccepted(rawLifecycle)) {
                            priorAcceptedLifecycle = { ...rawLifecycle };
                            seedNextPendingNonce(txWithNonce.chainId, walletInfo.address, txWithNonce.nonce);
                            reportAcceptedEvidence(tx, rawLifecycle.txHash, 'raw_broadcast');
                            await syncAcceptedCopytradePendingPosition({
                                runtimeContext,
                                txHash: rawLifecycle.txHash,
                                lifecycleStatus: rawLifecycle.status,
                            });
                        }
                        if (runtimeContext) {
                            if (rawLifecycle.txHash) {
                                attachOrderTxHash(runtimeContext, rawLifecycle.txHash, { canonical: true });
                            }
                            if (rawLifecycle.txHash && isTxLifecycleSendAccepted(rawLifecycle)) {
                                markOrderHashAccepted(runtimeContext, rawLifecycle.txHash);
                            }
                            recordLifecycleOnOrder(runtimeContext, rawLifecycle, {
                                reasonCode: inferOrderReasonCode(rawLifecycle.lastRpcError || rawLifecycle.status)
                            });
                        }
                        if (attemptState) {
                            updateOrderAttempt(runtimeContext!, attemptState.id, {
                                state: rawLifecycle.status === 'confirmed_success'
                                    ? 'confirmed_success'
                                    : rawLifecycle.status === 'confirmed_failed'
                                        ? 'confirmed_failed'
                                        : rawLifecycle.status === 'visible_pending'
                                            ? 'visible'
                                            : rawLifecycle.status === 'broadcasted_unseen'
                                                ? 'uncertain'
                                                : 'accepted',
                                txHash: rawLifecycle.txHash,
                                reasonCode: inferOrderReasonCode(rawLifecycle.lastRpcError || rawLifecycle.status),
                                error: rawLifecycle.lastRpcError
                            });
                        }
                        if (rawLifecycle.status === 'broadcasted_unseen') {
                            const retryDecision = shouldRetryAfterBroadcastUnseen({
                                chainId: txWithNonce.chainId,
                                txHash: rawLifecycle.txHash,
                                runtimeContext,
                                lifecycle: rawLifecycle,
                                attempt,
                                maxRetries: MAX_RETRIES,
                                hasNonce: !!txWithNonce.nonce,
                                txPurpose: txWithNonce.txPurpose,
                                fastTradePath
                            });
                            if (retryDecision.retry) {
                                if (retryDecision.bumpGas) {
                                    bumpGasForVisibilityRetry(fastTradePath
                                        ? 'raw_path_broadcasted_unseen_fast_trade'
                                        : 'raw_path_broadcasted_unseen');
                                }
                                logger.warn(LogCode.SYS_INFO, 'Raw path broadcasted_unseen retry scheduled', {
                                    chainId: txWithNonce.chainId,
                                    txHash: rawLifecycle.txHash,
                                    status: rawLifecycle.status,
                                    attempt,
                                    reason: retryDecision.reason
                                });
                                await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS));
                                continue;
                            }
                        }
                        if (
                            fastTradePath
                            && rawLifecycle.status === 'broadcasted_unseen'
                            && !!txWithNonce.nonce
                        ) {
                            const upgradedLifecycle = await tryResolveFastTradeUnresolvedVisibility({
                                lifecycle: rawLifecycle,
                                chainId: txWithNonce.chainId,
                                txHash: rawLifecycle.txHash,
                                expectedFrom: walletInfo.address,
                                path: 'raw_sign_broadcast'
                            });
                            if (upgradedLifecycle.status !== 'broadcasted_unseen') {
                                return upgradedLifecycle;
                            }
                            logger.warn(LogCode.SYS_INFO, 'Fast trade raw path unresolved visibility; returning uncertain lifecycle', {
                                chainId: txWithNonce.chainId,
                                txHash: rawLifecycle.txHash,
                                attempts: attempt
                            });
                            return upgradedLifecycle;
                        }
                        return rawLifecycle;
                    }

                    if (attemptState) {
                        updateOrderAttempt(runtimeContext!, attemptState.id, {
                            channel: 'privy_sendtx',
                            nonce: txWithNonce.nonce,
                            gasPrice: txWithNonce.gasPrice,
                            maxFeePerGas: txWithNonce.maxFeePerGas,
                            maxPriorityFeePerGas: txWithNonce.maxPriorityFeePerGas
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
                    logger.info(LogCode.EXE_TX_BROADCAST, `Ethereum transaction sent via Privy txHash=${response.hash}`, {
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
                    const lifecycleBase: TxLifecycleResult = {
                        status: 'broadcasted_unseen',
                        txHash: response.hash,
                        attempts: 1,
                        chainId: txWithNonce.chainId
                    };
                    priorAcceptedLifecycle = { ...lifecycleBase };
                    seedNextPendingNonce(txWithNonce.chainId, walletInfo.address, txWithNonce.nonce);
                    reportAcceptedEvidence(tx, response.hash, 'privy_sendtx');
                    await syncAcceptedCopytradePendingPosition({
                        runtimeContext,
                        txHash: response.hash,
                        lifecycleStatus: lifecycleBase.status,
                    });
                    if (runtimeContext) {
                        attachOrderTxHash(runtimeContext, response.hash, { canonical: true });
                        markOrderHashAccepted(runtimeContext, response.hash);
                    }
                    if (attemptState) {
                        updateOrderAttempt(runtimeContext!, attemptState.id, {
                            state: 'accepted',
                            txHash: response.hash
                        });
                    }
                    if (shouldReturnAcceptedLifecycleImmediately(txWithNonce)) {
                        logger.info(
                            LogCode.SYS_INFO,
                            txWithNonce.txPurpose === 'approval'
                                ? 'Privy lifecycle early return for approval send'
                                : 'Privy lifecycle early return for fast trade send',
                            {
                            chainId: txWithNonce.chainId,
                            txHash: response.hash,
                            txPurpose: txWithNonce.txPurpose,
                            executionProfile: txWithNonce.executionProfile || 'default',
                            }
                        );
                        if (runtimeContext) {
                            recordLifecycleOnOrder(runtimeContext, lifecycleBase, {
                                reasonCode: inferOrderReasonCode(lifecycleBase.lastRpcError || lifecycleBase.status)
                            });
                        }
                        if (attemptState) {
                            updateOrderAttempt(runtimeContext!, attemptState.id, {
                                state: 'accepted',
                                reasonCode: inferOrderReasonCode(lifecycleBase.status),
                            });
                        }
                        return lifecycleBase;
                    }
                    if (!fastTradePath) {
                        const visibility = await verifyTxVisibility(
                            txWithNonce.chainId,
                            response.hash,
                            walletInfo.address,
                            {
                                retries: PRIVY_TX_SYNC_VISIBILITY_RETRIES,
                                delayMs: PRIVY_TX_SYNC_VISIBILITY_DELAY_MS
                            }
                        );
                        lifecycleBase.status = visibility.visible ? 'visible_pending' : 'broadcasted_unseen';
                        lifecycleBase.firstSeenAt = visibility.visible ? Date.now() : undefined;
                        lifecycleBase.lastRpcError = visibility.visible ? undefined : (visibility.lastError || 'not_found_by_rpc');
                        lifecycleBase.attempts = visibility.checks;
                        priorAcceptedLifecycle = { ...lifecycleBase };
                    }
                    if (runtimeContext) {
                        recordLifecycleOnOrder(runtimeContext, lifecycleBase, {
                            reasonCode: inferOrderReasonCode(lifecycleBase.lastRpcError || lifecycleBase.status)
                        });
                    }
                    if (attemptState) {
                        updateOrderAttempt(runtimeContext!, attemptState.id, {
                            state: lifecycleBase.status === 'confirmed_success'
                                ? 'confirmed_success'
                                : lifecycleBase.status === 'confirmed_failed'
                                    ? 'confirmed_failed'
                                    : lifecycleBase.status === 'visible_pending'
                                        ? 'visible'
                                        : lifecycleBase.status === 'broadcasted_unseen'
                                            ? 'uncertain'
                                            : 'accepted',
                            reasonCode: inferOrderReasonCode(lifecycleBase.lastRpcError || lifecycleBase.status),
                            error: lifecycleBase.lastRpcError
                        });
                    }

                    const postSendDelayMs = Math.max(0, Number(process.env.PRIVY_POST_SEND_DELAY_MS || '0'));
                    if (postSendDelayMs > 0) {
                        await new Promise(resolve => setTimeout(resolve, postSendDelayMs));
                    }

                    if (lifecycleBase.status === 'broadcasted_unseen') {
                        const retryDecision = shouldRetryAfterBroadcastUnseen({
                            chainId: txWithNonce.chainId,
                            txHash: response.hash,
                            runtimeContext,
                            lifecycle: lifecycleBase,
                            attempt,
                            maxRetries: MAX_RETRIES,
                            hasNonce: !!txWithNonce.nonce,
                            txPurpose: txWithNonce.txPurpose,
                            fastTradePath
                        });
                        if (retryDecision.retry) {
                            if (retryDecision.bumpGas) {
                                bumpGasForVisibilityRetry(fastTradePath
                                    ? 'privy_sendtx_broadcasted_unseen_fast_trade'
                                    : 'privy_sendtx_broadcasted_unseen');
                            }
                            logger.warn(LogCode.SYS_INFO, 'Privy send broadcasted_unseen retry scheduled', {
                                chainId: txWithNonce.chainId,
                                txHash: response.hash,
                                status: lifecycleBase.status,
                                checks: lifecycleBase.attempts,
                                attempt,
                                reason: retryDecision.reason
                            });
                            await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS));
                            continue;
                        }
                    }

                    if (
                        fastTradePath
                        && lifecycleBase.status === 'broadcasted_unseen'
                        && !!txWithNonce.nonce
                    ) {
                        const upgradedLifecycle = await tryResolveFastTradeUnresolvedVisibility({
                            lifecycle: lifecycleBase,
                            chainId: txWithNonce.chainId,
                            txHash: response.hash,
                            expectedFrom: walletInfo.address,
                            path: 'privy_sendtx'
                        });
                        if (upgradedLifecycle.status !== 'broadcasted_unseen') {
                            return upgradedLifecycle;
                        }
                        logger.warn(LogCode.SYS_INFO, 'Privy fast trade send pending visibility after short sync probe', {
                            chainId: txWithNonce.chainId,
                            txHash: response.hash,
                            attempts: attempt
                        });
                        return upgradedLifecycle;
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
                        if (runtimeContext) {
                            recordLifecycleOnOrder(runtimeContext, finalState, {
                                reasonCode: inferOrderReasonCode(finalState.lastRpcError || finalState.status)
                            });
                        }
                        if (finalState.status === 'dropped_timeout' && lifecycleBase.status === 'broadcasted_unseen') {
                            return lifecycleBase;
                        }
                        return finalState;
                    }
                    return lifecycleBase;
                } catch (error: any) {
                    let effectiveError: any = error;
                    let errorMessage = effectiveError?.message || '';
                    const lowerErrorMessage = String(errorMessage || '').toLowerCase();
                    const preferPrivySendTx = PRIVY_SEND_TX_CHAIN_IDS.has(txWithNonce.chainId);
                    const unsupportedSendOnNonEth =
                        txWithNonce.chainId !== 1 && errorMessage.includes('eth_sendTransaction is only supported for Ethereum');
                    if (unsupportedSendOnNonEth) {
                        try {
                            if (attemptState) {
                                updateOrderAttempt(runtimeContext!, attemptState.id, { channel: 'raw_broadcast' });
                            }
                            const fallbackLifecycle = await signAndBroadcastRawTransaction(client, walletInfo.id, txWithNonce, {
                                userId,
                                attempt,
                                reason: 'privy_sendtx_unsupported_for_chain',
                                expectedFrom: walletInfo.address,
                                txPurpose: txWithNonce.txPurpose
                            });
                            if (fallbackLifecycle.txHash && isTxLifecycleSendAccepted(fallbackLifecycle)) {
                                seedNextPendingNonce(txWithNonce.chainId, walletInfo.address, txWithNonce.nonce);
                            }
                            if (runtimeContext) {
                                recordLifecycleOnOrder(runtimeContext, fallbackLifecycle, {
                                    reasonCode: inferOrderReasonCode(fallbackLifecycle.lastRpcError || fallbackLifecycle.status)
                                });
                            }
                            if (
                                fallbackLifecycle.status === 'broadcasted_unseen'
                                && attempt < MAX_RETRIES
                                && !!txWithNonce.nonce
                                && (isFastTradeExecutionProfile(txWithNonce) || txWithNonce.txPurpose === 'trade' || txWithNonce.txPurpose === 'speedup')
                            ) {
                                // ⚡ FAST TRADE: tx was broadcast via fanout. Don't block for gas-bump retry.
                                if (isFastTradeExecutionProfile(txWithNonce)) {
                                    return fallbackLifecycle;
                                }
                                const bumpBps = 12500n;
                                if (txWithNonce.gasPrice) {
                                    const current = BigInt(txWithNonce.gasPrice);
                                    const bumped = (current * bumpBps + 9999n) / 10000n;
                                    txWithNonce = { ...txWithNonce, gasPrice: (bumped > current ? bumped : (current + 1n)).toString() };
                                }
                                await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS));
                                continue;
                            }
                            return fallbackLifecycle;
                        } catch (fallbackError: any) {
                            logger.error(LogCode.EXE_TX_REVERTED, 'Privy sign+broadcast fallback failed', {
                                chainId: txWithNonce.chainId,
                                error: fallbackError?.message || String(fallbackError)
                            });
                            effectiveError = fallbackError;
                            errorMessage = effectiveError?.message || String(effectiveError);
                        }
                    }

                    const isPrivyTransportTransient =
                        lowerErrorMessage.includes('api failed after')
                        || lowerErrorMessage.includes('fetch failed')
                        || lowerErrorMessage.includes('socket disconnected')
                        || lowerErrorMessage.includes('socket hang up')
                        || lowerErrorMessage.includes('econnreset')
                        || lowerErrorMessage.includes('etimedout')
                        || lowerErrorMessage.includes('timeout')
                        || lowerErrorMessage.includes('temporarily unavailable')
                        || lowerErrorMessage.includes('service unavailable')
                        || lowerErrorMessage.includes('http 503')
                        || lowerErrorMessage.includes('http 502')
                        || lowerErrorMessage.includes('http 504')
                        || lowerErrorMessage.includes('rate limit')
                        || lowerErrorMessage.includes('http 429');
                    if (preferPrivySendTx && isPrivyTransportTransient) {
                        try {
                            logger.warn(LogCode.EXE_TX_BROADCAST, 'Privy sendTransaction transient failure, switching to sign+broadcast fallback', {
                                chainId: txWithNonce.chainId,
                                attempt,
                                error: errorMessage.slice(0, 200)
                            });
                            const transientFallback = await signAndBroadcastRawTransaction(client, walletInfo.id, txWithNonce, {
                                userId,
                                attempt,
                                reason: 'privy_sendtx_transient_fallback',
                                expectedFrom: walletInfo.address,
                                txPurpose: txWithNonce.txPurpose
                            });
                            if (transientFallback.txHash && isTxLifecycleSendAccepted(transientFallback)) {
                                seedNextPendingNonce(txWithNonce.chainId, walletInfo.address, txWithNonce.nonce);
                            }
                            if (runtimeContext) {
                                recordLifecycleOnOrder(runtimeContext, transientFallback, {
                                    reasonCode: inferOrderReasonCode(transientFallback.lastRpcError || transientFallback.status)
                                });
                            }
                            if (
                                transientFallback.status === 'broadcasted_unseen'
                                && attempt < MAX_RETRIES
                                && !!txWithNonce.nonce
                                && (isFastTradeExecutionProfile(txWithNonce) || txWithNonce.txPurpose === 'trade' || txWithNonce.txPurpose === 'speedup')
                            ) {
                                // ⚡ FAST TRADE: tx was broadcast via fanout. Don't block for gas-bump retry.
                                if (isFastTradeExecutionProfile(txWithNonce)) {
                                    return transientFallback;
                                }
                                const bumpBps = 12500n;
                                if (txWithNonce.gasPrice) {
                                    const current = BigInt(txWithNonce.gasPrice);
                                    const bumped = (current * bumpBps + 9999n) / 10000n;
                                    txWithNonce = { ...txWithNonce, gasPrice: (bumped > current ? bumped : (current + 1n)).toString() };
                                }
                                await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS));
                                continue;
                            }
                            return transientFallback;
                        } catch (fallbackError: any) {
                            logger.error(LogCode.EXE_TX_REVERTED, 'Privy transient fallback sign+broadcast failed', {
                                chainId: txWithNonce.chainId,
                                error: fallbackError?.message || String(fallbackError)
                            });
                            effectiveError = fallbackError;
                            errorMessage = effectiveError?.message || String(effectiveError);
                        }
                    }

                    const hasUnderpricedHint =
                        lowerErrorMessage.includes('underpriced') ||
                        lowerErrorMessage.includes('intrinsic gas too low') ||
                        lowerErrorMessage.includes('fee too low') ||
                        lowerErrorMessage.includes('max fee per gas less than block base fee');

                    const isNonceTooLowError = lowerErrorMessage.includes('nonce too low')
                        || lowerErrorMessage.includes('nonce has already been used');
                    const isReplacementUnderpricedError = lowerErrorMessage.includes('replacement transaction underpriced');
                    const isNonceError = isNonceTooLowError || isReplacementUnderpricedError;

                    const isNetworkError = lowerErrorMessage.includes('fetch failed') ||
                        lowerErrorMessage.includes('econnreset') ||
                        lowerErrorMessage.includes('socket disconnected') ||
                        lowerErrorMessage.includes('socket hang up') ||
                        lowerErrorMessage.includes('etimedout') ||
                        lowerErrorMessage.includes('timeout') ||
                        lowerErrorMessage.includes('api failed after') ||
                        lowerErrorMessage.includes('all rpc endpoints failed') ||
                        lowerErrorMessage.includes('rpc error') ||
                        lowerErrorMessage.includes('http 502') ||
                        lowerErrorMessage.includes('http 503') ||
                        lowerErrorMessage.includes('http 504');

                    if (isNonceError && priorAcceptedLifecycle?.txHash) {
                        if (runtimeContext) {
                            attachOrderTxHash(runtimeContext, priorAcceptedLifecycle.txHash, { canonical: true });
                            recordLifecycleOnOrder(runtimeContext, priorAcceptedLifecycle, {
                                reasonCode: inferOrderReasonCode(priorAcceptedLifecycle.lastRpcError || 'nonce_too_low_after_prior_send')
                            });
                        }
                        logger.warn(LogCode.EXE_TX_BROADCAST, 'Nonce too low after prior accepted send; adopting prior tx hash', {
                            chainId: txWithNonce.chainId,
                            txHash: priorAcceptedLifecycle.txHash,
                            attempt,
                            nonce: txWithNonce.nonce
                        });
                        return {
                            ...priorAcceptedLifecycle,
                            chainId: txWithNonce.chainId,
                            attempts: Math.max(priorAcceptedLifecycle.attempts || 1, attempt),
                            lastRpcError: priorAcceptedLifecycle.lastRpcError || 'nonce_too_low_after_prior_send'
                        };
                    }

                    // Retry on nonce errors, underpriced signals, or transient network failures.
                    if ((isNonceError || hasUnderpricedHint || isNetworkError) && attempt < MAX_RETRIES) {
                        if (attemptState) {
                            updateOrderAttempt(runtimeContext!, attemptState.id, {
                                state: hasUnderpricedHint || isNetworkError ? 'uncertain' : 'failed',
                                reasonCode: inferOrderReasonCode(errorMessage),
                                error: errorMessage
                            });
                        }
                        const reason = isNonceError
                            ? (isReplacementUnderpricedError ? 'Replacement underpriced' : 'Nonce error')
                            : (hasUnderpricedHint ? 'Underpriced tx' : 'Network failure');
                        if (isNonceError) {
                            const keepSameNonceForSafety =
                                txWithNonce.txPurpose === 'trade' || txWithNonce.txPurpose === 'speedup';
                            if (keepSameNonceForSafety) {
                                if (!txWithNonce.nonce) {
                                    logger.error(LogCode.EXE_TX_REVERTED, 'Nonce retry aborted for trade tx: nonce missing', {
                                        chainId: txWithNonce.chainId,
                                        txPurpose: txWithNonce.txPurpose,
                                        attempt
                                    });
                                    throw new AppError(500, 'Trade nonce missing; aborting retry for safety', 'TRADE_NONCE_MISSING');
                                }
                                if (isReplacementUnderpricedError) {
                                    const bumpBps = 12500n;
                                    if (txWithNonce.gasPrice) {
                                        const current = BigInt(txWithNonce.gasPrice);
                                        const bumped = (current * bumpBps + 9999n) / 10000n;
                                        txWithNonce = {
                                            ...txWithNonce,
                                            gasPrice: (bumped > current ? bumped : (current + 1n)).toString()
                                        };
                                    } else {
                                        const nextTx = { ...txWithNonce };
                                        if (nextTx.maxFeePerGas) {
                                            const current = BigInt(nextTx.maxFeePerGas);
                                            const bumped = (current * bumpBps + 9999n) / 10000n;
                                            nextTx.maxFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                                        }
                                        if (nextTx.maxPriorityFeePerGas) {
                                            const current = BigInt(nextTx.maxPriorityFeePerGas);
                                            const bumped = (current * bumpBps + 9999n) / 10000n;
                                            nextTx.maxPriorityFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                                        }
                                        txWithNonce = nextTx;
                                    }
                                } else {
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
                                    logger.warn(LogCode.EXE_TX_BROADCAST, 'Nonce too low on deterministic trade tx, advanced nonce for retry', {
                                        chainId: txWithNonce.chainId,
                                        attempt,
                                        currentNonce: currentNonce?.toString() || null,
                                        refreshedNonce: refreshedNonce?.toString() || null,
                                        nextNonce: txWithNonce.nonce || null
                                    });
                                }
                            } else {
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
                        } else if (hasUnderpricedHint) {
                            const bumpBps = 13000n; // +30%
                            if (txWithNonce.gasPrice) {
                                const current = BigInt(txWithNonce.gasPrice);
                                const bumped = (current * bumpBps + 9999n) / 10000n;
                                txWithNonce = {
                                    ...txWithNonce,
                                    gasPrice: (bumped > current ? bumped : (current + 1n)).toString()
                                };
                            } else {
                                const nextTx = { ...txWithNonce };
                                if (nextTx.maxFeePerGas) {
                                    const current = BigInt(nextTx.maxFeePerGas);
                                    const bumped = (current * bumpBps + 9999n) / 10000n;
                                    nextTx.maxFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                                }
                                if (nextTx.maxPriorityFeePerGas) {
                                    const current = BigInt(nextTx.maxPriorityFeePerGas);
                                    const bumped = (current * bumpBps + 9999n) / 10000n;
                                    nextTx.maxPriorityFeePerGas = (bumped > current ? bumped : (current + 1n)).toString();
                                }
                                txWithNonce = nextTx;
                            }
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
                    if (attemptState) {
                        updateOrderAttempt(runtimeContext!, attemptState.id, {
                            state: 'failed',
                            reasonCode: inferOrderReasonCode(errorMessage),
                            error: errorMessage
                        });
                    }
                    if (runtimeContext) {
                        markOrderFailure(runtimeContext, errorMessage);
                    }

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
            const terminalLifecycle: TxLifecycleResult = {
                status: 'dropped_timeout',
                attempts: MAX_RETRIES,
                chainId: tx.chainId,
                lastRpcError: 'transaction_failed_after_max_retries'
            };
            if (tx.runtimeContext) {
                recordLifecycleOnOrder(tx.runtimeContext, terminalLifecycle, { reasonCode: 'rpc_uncertain' });
                markOrderFailure(tx.runtimeContext, terminalLifecycle.lastRpcError, 'rpc_uncertain');
            }
            if (terminalLifecycle.txHash) {
                reportRpcUncertain({
                    chainId: tx.chainId,
                    txHash: terminalLifecycle.txHash,
                    orderId: tx.runtimeContext?.orderId,
                    error: terminalLifecycle.lastRpcError || 'transaction_failed_after_max_retries'
                });
            }
            return terminalLifecycle;
            });
        } finally {
            markUserChainInflight(userId, tx.chainId, -1);
        }
    })});
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

export const __privyWalletTest = {
    shouldReturnAcceptedLifecycleImmediately,
    isFallbackOwnedRuntimeState,
    shouldSuppressSendForFallbackOwnership,
};

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

        const resolution = resolveSolanaWalletRecord(delegatedWallet);
        if (!resolution.wallet) {
            logger.warn(LogCode.SYS_ERROR, 'Delegated Solana wallet is invalid, ignoring delegated path', {
                userId,
                reasonCode: resolution.reasonCode
            });
            return null;
        }

        logger.debug(LogCode.SYS_INFO, 'Found delegated Solana wallet for user', {
            address: resolution.wallet.address,
            userId
        });

        return resolution.wallet;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Error getting delegated wallet from Privy', { userId, error: error.message });
        return null;
    }
}

/**
 * Get user's delegated EVM wallet (if they have authorized server-side signing)
 */
export async function getDelegatedEvmWallet(userId: string): Promise<{ id: string; address: string } | null> {
    const client = getPrivyClient();

    try {
        const user = await client.getUser(userId);

        const delegatedWallet = user.linkedAccounts?.find(
            (account: any) =>
                account.type === 'wallet' &&
                account.walletClientType === 'privy' &&
                account.chainType === 'ethereum' &&
                account.delegated === true
        );

        if (!delegatedWallet) {
            logger.debug(LogCode.SYS_INFO, 'User has no delegated EVM wallet', { userId });
            return null;
        }

        const walletData = delegatedWallet as any;
        return {
            id: walletData.id || walletData.address,
            address: walletData.address || ''
        };
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Error checking delegated EVM wallet', { userId, error: error.message });
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
    return sendSolanaTransactionWithContext(userId, transactionBase64, await getSolanaSigningContext(userId));
}

export async function getSolanaSigningContext(userId: string): Promise<ResolvedSolanaSigningContext> {
    return resolveSolanaSigningContext(userId, {
        getDelegatedWallet: (targetUserId) => getDelegatedSolanaWallet(targetUserId),
        getServerWallet: () => getOrCreateServerSolanaWallet(),
    });
}

export async function sendSolanaTransactionWithContext(
    userId: string,
    transactionBase64: string,
    signingContext: ResolvedSolanaSigningContext
): Promise<string> {
    const client = getPrivyClient();
    return sendSolanaTransactionWithContextDeps(userId, transactionBase64, signingContext, {
        deserializeTransaction: VersionedTransaction.deserialize,
        signAndSendTransaction: (params) => client.walletApi.solana.signAndSendTransaction(params),
    });
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

export async function signMessage(
    userId: string,
    message: string,
): Promise<string> {
    const client = getPrivyClient();
    const walletInfo = await getEmbeddedWalletInfo(userId, { chainType: 'ethereum' });
    if (!walletInfo) {
        throw new AppError(400, 'User has no EVM embedded wallet', 'NO_EVM_WALLET');
    }

    const normalizedMessage = String(message || '');
    if (!normalizedMessage.trim()) {
        throw new AppError(400, 'Message must not be empty', 'INVALID_SIGN_MESSAGE');
    }

    logger.debug(LogCode.SYS_INFO, 'Signing plaintext message via Privy', {
        userId,
        messageLength: normalizedMessage.length,
    });

    try {
        const response = await (client.walletApi.ethereum as any).signMessage({
            walletId: walletInfo.id,
            message: normalizedMessage,
        });

        logger.info(LogCode.SYS_INFO, 'Plaintext signature obtained via Privy', { userId });
        return response.signature;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Plaintext signing failed via Privy', {
            error: error.message,
            userId,
        });

        if (error.message?.includes('not delegated')) {
            throw new AppError(
                403,
                'User has not enabled server-side signing. Please enable delegation in wallet settings.',
                'DELEGATION_REQUIRED'
            );
        }

        throw new AppError(
            500,
            `Failed to sign message: ${error.message || 'Unknown error'}`,
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
