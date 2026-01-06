/**
 * Polymarket Credential Service
 * 
 * Manages per-user API credential generation and storage for Polymarket CLOB.
 * Uses L1 authentication (EIP-712 signature) to create API credentials.
 */

import prisma from '../lib/prisma.js';
import { signTypedData, getEmbeddedWalletInfo } from './privyWallet.js';

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
 * Check if user has Polymarket credentials
 */
export async function hasCredentials(userId: string): Promise<boolean> {
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId }
    });
    return !!creds;
}

/**
 * Get user's stored credentials
 */
export async function getCredentials(userId: string) {
    return prisma.polymarketApiCreds.findUnique({
        where: { userId }
    });
}

/**
 * Generate L1 authentication headers for API key creation
 */
async function generateL1AuthHeaders(userId: string, walletAddress: string, nonce: number = 0): Promise<{
    headers: Record<string, string>;
    timestamp: number;
    nonce: number;
}> {
    const timestamp = Math.floor(Date.now() / 1000);

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

    // Sign with Privy
    const signature = await signTypedData(userId, typedData, 137);

    return {
        headers: {
            'POLY_ADDRESS': walletAddress,
            'POLY_SIGNATURE': signature,
            'POLY_TIMESTAMP': timestamp.toString(),
            'POLY_NONCE': nonce.toString()
        },
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
        // Get user's Privy wallet
        const walletInfo = await getEmbeddedWalletInfo(userId);
        if (!walletInfo) {
            return { success: false, error: 'User has no embedded wallet' };
        }

        const walletAddress = walletInfo.address;
        console.log('[PolymarketCreds] Using wallet:', walletAddress.slice(0, 15) + '...');

        // Check if user already has credentials
        const existing = await prisma.polymarketApiCreds.findUnique({
            where: { userId }
        });

        if (existing) {
            console.log('[PolymarketCreds] User already has credentials');
            return {
                success: true,
                credentials: {
                    apiKey: existing.apiKey,
                    apiSecret: existing.apiSecret,
                    passphrase: existing.passphrase
                }
            };
        }

        // Generate L1 auth headers
        const nonce = 0; // Use 0 for first-time creation
        const { headers } = await generateL1AuthHeaders(userId, walletAddress, nonce);

        console.log('[PolymarketCreds] Calling CLOB API to create API key...');

        // Call CLOB API to create API key
        const response = await fetch(`${CLOB_API}/auth/api-key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        });

        const result = await response.json() as {
            apiKey?: string;
            secret?: string;
            passphrase?: string;
            error?: string;
        };

        if (!response.ok || !result.apiKey) {
            console.error('[PolymarketCreds] API key creation failed:', result);
            return { success: false, error: result.error || 'Failed to create API key' };
        }

        console.log('[PolymarketCreds] API key created successfully');

        // Store credentials in database
        await prisma.polymarketApiCreds.create({
            data: {
                userId,
                walletAddress,
                apiKey: result.apiKey,
                apiSecret: result.secret!,
                passphrase: result.passphrase!,
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
        await prisma.polymarketApiCreds.delete({
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
    const walletInfo = await getEmbeddedWalletInfo(userId);
    return walletInfo?.address || null;
}
