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
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    chainId: number;
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

export async function sendTransaction(
    userId: string,
    accessToken: string,
    tx: TransactionRequest
): Promise<string> {
    // Wrap entire execution in a per-user lock
    return withUserLock(userId, async () => {
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

        // DEBUG: Log the full transaction parameters before sending
        console.log('[sendTransaction] ========== PRIVY TX PARAMS ==========');
        console.log('[sendTransaction] From:', walletInfo.address);
        console.log('[sendTransaction] To:', tx.to);
        console.log('[sendTransaction] Value:', tx.value);
        console.log('[sendTransaction] ValueHex:', tx.value ? `0x${BigInt(tx.value).toString(16)}` : 'undefined');
        console.log('[sendTransaction] Data length:', tx.data?.length);
        console.log('[sendTransaction] Data (full):', tx.data);
        console.log('[sendTransaction] ChainId:', tx.chainId);
        console.log('[sendTransaction] Gas:', tx.gas);
        console.log('[sendTransaction] MaxFeePerGas:', tx.maxFeePerGas);
        console.log('[sendTransaction] MaxPriorityFeePerGas:', tx.maxPriorityFeePerGas);
        console.log('[sendTransaction] Full TX object:', tx);
        console.log('[sendTransaction] ===========================================');

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                logger.debug(LogCode.EXE_TX_BROADCAST, 'Sending Ethereum transaction via Privy', {
                    attempt,
                    from: walletInfo.address?.slice(0, 10),
                    to: tx.to?.slice(0, 10),
                    chainId: tx.chainId,
                });

                // Use Privy's wallet API to send transaction
                // The walletId must be the Privy internal ID, not the Ethereum address
                const response = await client.walletApi.ethereum.sendTransaction({
                    walletId: walletInfo.id,
                    caip2: `eip155:${tx.chainId}`,
                    transaction: {
                        to: tx.to as `0x${string}`,
                        data: tx.data as `0x${string}`,
                        value: tx.value ? `0x${BigInt(tx.value).toString(16)}` : undefined,
                        gasLimit: tx.gas ? `0x${BigInt(tx.gas).toString(16)}` : undefined,
                        maxFeePerGas: tx.maxFeePerGas ? `0x${BigInt(tx.maxFeePerGas).toString(16)}` : undefined,
                        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? `0x${BigInt(tx.maxPriorityFeePerGas).toString(16)}` : undefined,
                    },
                });

                logger.info(LogCode.EXE_TX_BROADCAST, 'Ethereum transaction sent via Privy', { txHash: response.hash, chainId: tx.chainId });

                // Add a small delay after sending to allow nonce propagation/indexing
                // This helps when sending multiple transactions in rapid succession
                await new Promise(resolve => setTimeout(resolve, 1000));

                return response.hash;
            } catch (error: any) {
                const errorMessage = error.message || '';
                const isNonceError = errorMessage.includes('nonce too low') ||
                    errorMessage.includes('nonce has already been used') ||
                    errorMessage.includes('replacement transaction underpriced');

                const isNetworkError = errorMessage.includes('fetch failed') ||
                    errorMessage.includes('ECONNRESET') ||
                    errorMessage.includes('socket disconnected');

                // Retry on nonce errors or transient network failures
                if ((isNonceError || isNetworkError) && attempt < MAX_RETRIES) {
                    const reason = isNonceError ? 'Nonce error' : 'Network failure';
                    logger.warn(LogCode.EXE_TX_BROADCAST, `${reason} on attempt ${attempt}, retrying in ${RETRY_DELAY_MS}ms...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                    continue;
                }

                logger.error(LogCode.EXE_TX_REVERTED, 'Privy Ethereum transaction failed', { error: error.message, chainId: tx.chainId });

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
