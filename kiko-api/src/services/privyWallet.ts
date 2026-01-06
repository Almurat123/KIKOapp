/**
 * Privy Wallet Service
 * Server-side wallet operations using Privy's embedded wallet API
 * Enables instant trading without user popups
 * 
 * Documentation: https://docs.privy.io/guide/server/wallets/
 */

import { PrivyClient } from '@privy-io/server-auth';
import { AppError } from '../middleware/errorHandler.js';

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

        console.log('[PrivyWallet] Authorization Key config:', {
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

    try {
        const user = await client.getUser(userId);

        // Find embedded wallet in linked accounts
        const embeddedWallet = user.linkedAccounts?.find(
            (account: any) => account.type === 'wallet' && account.walletClientType === 'privy'
        );

        if (!embeddedWallet) {
            console.warn(`[PrivyWallet] User ${userId} has no embedded wallet`);
            return null;
        }

        const walletData = embeddedWallet as any;
        // Privy embedded wallets have an 'id' field that is the internal wallet ID
        // and an 'address' field that is the Ethereum address
        return {
            address: walletData.address || '',
            id: walletData.id || walletData.address // Fallback to address if id not present
        };
    } catch (error) {
        console.error('[PrivyWallet] Error getting user wallet:', error);
        throw new AppError(500, 'Failed to get user wallet', 'WALLET_ERROR');
    }
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
            console.warn(`[PrivyWallet] User ${userId} has no Solana embedded wallet`);
            return null;
        }

        return (solanaWallet as any).address || null;
    } catch (error) {
        console.error('[PrivyWallet] Error getting Solana wallet:', error);
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
        const client = getPrivyClient();
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 2000;

        // Get user's wallet info (both address and ID)
        const walletInfo = await getEmbeddedWalletInfo(userId);
        if (!walletInfo) {
            throw new AppError(400, 'User has no embedded wallet', 'NO_WALLET');
        }

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log('[PrivyWallet] Sending transaction:', {
                    attempt,
                    from: walletInfo.address?.slice(0, 10),
                    walletId: walletInfo.id?.slice(0, 15),
                    to: tx.to?.slice(0, 10),
                    chainId: tx.chainId,
                    valueWei: tx.value,
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

                console.log('[PrivyWallet] Transaction sent:', response.hash);

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
                    console.warn(`[PrivyWallet] ${reason} on attempt ${attempt}, retrying in ${RETRY_DELAY_MS}ms...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                    continue;
                }

                console.error('[PrivyWallet] Transaction failed:', error);

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
            console.log('[PrivyWallet] Using existing server Solana wallet:', serverSolanaWallet.address.slice(0, 10) + '...');
            return serverSolanaWallet;
        }

        // Create a new server wallet if none exists
        console.log('[PrivyWallet] Creating new server Solana wallet...');
        const newWallet = await client.walletApi.create({
            chainType: 'solana'
        });

        serverSolanaWallet = {
            id: newWallet.id,
            address: newWallet.address
        };
        console.log('[PrivyWallet] Created new server Solana wallet:', serverSolanaWallet.address.slice(0, 10) + '...');
        return serverSolanaWallet;
    } catch (error: any) {
        console.error('[PrivyWallet] Failed to get/create server wallet:', error);
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
            console.log(`[PrivyWallet] User ${userId.slice(0, 10)}... has no delegated Solana wallet`);
            return null;
        }

        const walletData = delegatedWallet as any;
        console.log(`[PrivyWallet] Found delegated Solana wallet for user:`, {
            address: walletData.address?.slice(0, 10) + '...',
            id: walletData.id?.slice(0, 10) + '...',
        });

        return {
            id: walletData.id,
            address: walletData.address
        };
    } catch (error) {
        console.error('[PrivyWallet] Error getting delegated wallet:', error);
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
            console.log('[PrivyWallet] Using server wallet (user has not delegated)');
        }

        console.log('[PrivyWallet] Sending Solana transaction:', {
            walletSource,
            walletId: wallet.id.slice(0, 10) + '...',
            walletAddress: wallet.address.slice(0, 10) + '...',
            userId: userId.slice(0, 10) + '...',
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

        console.log('[PrivyWallet] Solana transaction sent:', response.hash);
        return response.hash;
    } catch (error: any) {
        console.error('[PrivyWallet] Solana transaction failed:', error);
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

    console.log('[PrivyWallet] Signing EIP-712 typed data:', {
        userId: userId.slice(0, 10) + '...',
        walletId: walletInfo.id.slice(0, 15) + '...',
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

        console.log('[PrivyWallet] EIP-712 signature obtained:', {
            signatureLength: response.signature?.length || 0,
        });

        return response.signature;
    } catch (error: any) {
        console.error('[PrivyWallet] EIP-712 signing failed:', error);

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

