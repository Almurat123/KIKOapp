/**
 * Polymarket Credential Service
 * 
 * Manages per-user API credential generation and storage for Polymarket CLOB.
 * Uses L1 authentication (EIP-712 signature) to create API credentials.
 */

import prisma from '../db/prisma.js';
import { signTypedData, getEmbeddedWalletInfo } from './privyWallet.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const CLOB_API = 'https://clob.polymarket.com';

// EIP-712 domain for L1 auth
const L1_AUTH_DOMAIN = {
    name: 'ClobAuthDomain',
    version: '1',
    chainId: 137
};

// EIP-712 types for L1 auth
const L1_AUTH_TYPES = {
    ClobAuth: [
        { name: 'address', type: 'address' },
        { name: 'timestamp', type: 'string' },
        { name: 'nonce', type: 'uint256' },
        { name: 'message', type: 'string' }
    ]
};

/**
 * Get server timestamp from Polymarket CLOB API
 * This is critical - using local time can cause signature validation failures
 */
async function getServerTime(): Promise<number> {
    try {
        const serverTime = await fetchJson({ url: `${CLOB_API}/time` }) as number;
        console.log('[PolymarketCreds] Server timestamp:', serverTime);
        return serverTime;
    } catch (error) {
        console.warn('[PolymarketCreds] Error fetching server time, falling back to local time:', error);
        return Math.floor(Date.now() / 1000);
    }
}

/**
 * Check if user has Polymarket credentials
 */
export async function hasCredentials(userId: string): Promise<boolean> {
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId }
    });
    return !!creds;
}

/**
 * Get user's stored credentials (decrypted)
 */
export async function getCredentials(userId: string) {
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId }
    });

    if (!creds) return null;

    // Decrypt sensitive fields
    return {
        ...creds,
        apiKey: decrypt(creds.apiKey),
        apiSecret: decrypt(creds.apiSecret),
        passphrase: decrypt(creds.passphrase)
    };
}

/**
 * Generate L1 authentication headers for API key creation
 */
async function generateL1AuthHeaders(userId: string, walletAddress: string, nonce: number = 0): Promise<{
    headers: Record<string, string>;
    timestamp: number;
    nonce: number;
}> {
    // Use server timestamp to avoid time sync issues
    const timestamp = await getServerTime();

    // Build L1 auth message
    const typedData = {
        domain: L1_AUTH_DOMAIN,
        types: L1_AUTH_TYPES,
        primaryType: 'ClobAuth' as const,
        message: {
            address: walletAddress,
            timestamp: timestamp.toString(),
            nonce: nonce,
            message: 'This message attests that I control the given wallet'
        }
    };

    console.log('[PolymarketCreds] L1 auth typedData:', JSON.stringify(typedData, null, 2));

    // Sign with Privy
    const signature = await signTypedData(userId, typedData, 137);

    const headers = {
        'POLY_ADDRESS': walletAddress,
        'POLY_SIGNATURE': signature,
        'POLY_TIMESTAMP': timestamp.toString(),
        'POLY_NONCE': nonce.toString()
    };

    console.log('[PolymarketCreds] L1 auth headers:', {
        POLY_ADDRESS: headers.POLY_ADDRESS,
        POLY_SIGNATURE: signature.slice(0, 20) + '...',
        POLY_TIMESTAMP: headers.POLY_TIMESTAMP,
        POLY_NONCE: headers.POLY_NONCE,
        signatureLength: signature.length
    });

    return {
        headers,
        timestamp,
        nonce
    };
}

/**
 * Create or derive API credentials for a user
 * This creates new CLOB API credentials using L1 authentication
 */
export async function createOrDeriveCredentials(userId: string): Promise<{
    success: boolean;
    credentials?: {
        apiKey: string;
        apiSecret: string;
        passphrase: string;
    };
    error?: string;
}> {
    console.log('[PolymarketCreds] Creating credentials for user:', userId.slice(0, 15) + '...');

    try {
        // Check if user already has credentials
        const existing = await prisma.polymarketApiCreds.findUnique({
            where: { userId }
        });

        if (existing) {
            console.log('[PolymarketCreds] User already has credentials');
            // Decrypt stored credentials before returning
            return {
                success: true,
                credentials: {
                    apiKey: decrypt(existing.apiKey),
                    apiSecret: decrypt(existing.apiSecret),
                    passphrase: decrypt(existing.passphrase)
                }
            };
        }

        // No cached credentials yet - now resolve the user's embedded EVM wallet.
        const walletInfo = await getEmbeddedWalletInfo(userId, { chainType: 'ethereum' });
        if (!walletInfo) {
            return { success: false, error: 'User has no EVM embedded wallet' };
        }

        const walletAddress = walletInfo.address;
        console.log('[PolymarketCreds] Using wallet:', walletAddress.slice(0, 15) + '...');

        // Generate L1 auth headers
        const nonce = 0; // Use 0 for first-time creation
        const { headers } = await generateL1AuthHeaders(userId, walletAddress, nonce);

        // First, try to derive existing credentials (in case nonce was already used)
        console.log('[PolymarketCreds] Trying to derive existing API key...');
        try {
            const deriveResult = await fetchJson({
                url: `${CLOB_API}/auth/derive-api-key`,
                method: 'GET',
                headers: {
                    ...headers
                }
            }) as {
                apiKey?: string;
                secret?: string;
                passphrase?: string;
                error?: string;
            };

            if (deriveResult.apiKey) {
                console.log('[PolymarketCreds] Derived existing API key successfully');

                // Store credentials in database (encrypted)
                await prisma.polymarketApiCreds.create({
                    data: {
                        userId,
                        walletAddress,
                        apiKey: encrypt(deriveResult.apiKey),
                        apiSecret: encrypt(deriveResult.secret!),
                        passphrase: encrypt(deriveResult.passphrase!),
                        nonce
                    }
                });

                return {
                    success: true,
                    credentials: {
                        apiKey: deriveResult.apiKey,
                        apiSecret: deriveResult.secret!,
                        passphrase: deriveResult.passphrase!
                    }
                };
            }
        } catch (error) {
            console.log('[PolymarketCreds] Derive failed, trying to create new API key...');
        }

        // Fallback: Call CLOB API to create API key
        const result = await fetchJson({
            url: `${CLOB_API}/auth/api-key`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        }) as {
            apiKey?: string;
            secret?: string;
            passphrase?: string;
            error?: string;
        };

        if (!result.apiKey) {
            console.error('[PolymarketCreds] API key creation failed:', result);
            return { success: false, error: result.error || 'Failed to create API key' };
        }

        console.log('[PolymarketCreds] API key created successfully');

        // Store credentials in database (encrypted)
        await prisma.polymarketApiCreds.create({
            data: {
                userId,
                walletAddress,
                apiKey: encrypt(result.apiKey),
                apiSecret: encrypt(result.secret!),
                passphrase: encrypt(result.passphrase!),
                nonce
            }
        });

        console.log('[PolymarketCreds] Credentials stored in database');

        return {
            success: true,
            credentials: {
                apiKey: result.apiKey,
                apiSecret: result.secret!,
                passphrase: result.passphrase!
            }
        };

    } catch (error: any) {
        console.error('[PolymarketCreds] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete user's credentials (for re-generation)
 */
export async function deleteCredentials(userId: string): Promise<boolean> {
    try {
        await prisma.polymarketApiCreds.deleteMany({
            where: { userId }
        });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get user's Polymarket wallet address (their Privy wallet)
 */
export async function getPolymarketWallet(userId: string): Promise<string | null> {
    const dbUser = await prisma.user.findUnique({
        where: { privyDid: userId },
        select: { walletAddress: true }
    });

    if (dbUser?.walletAddress) {
        return dbUser.walletAddress;
    }

    try {
        const walletInfo = await getEmbeddedWalletInfo(userId, { chainType: 'ethereum' });
        return walletInfo?.address || null;
    } catch (error: any) {
        console.warn('[PolymarketCreds] Failed to resolve wallet from Privy for read-only request:', {
            userId: userId.slice(0, 20) + '...',
            error: error?.message || String(error)
        });
        return null;
    }
}
