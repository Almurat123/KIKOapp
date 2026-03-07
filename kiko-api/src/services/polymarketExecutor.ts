/**
 * Polymarket Order Executor (EOA Mode)
 * 
 * Executes buy/sell orders on Polymarket CLOB using:
 * - Per-user API credentials stored in database
 * - Privy server-side EIP-712 signing
 * - signatureType=0 (EOA) - user's wallet is both maker and signer
 */

import { ClobClient } from '@polymarket/clob-client';
import prisma from '../db/prisma.js';
import { createLimitOrderData, buildSignedOrder, SignedOrder } from './polymarketOrderBuilder.js';
import { getCredentials } from './polymarketCredService.js';
import { fetchJson } from '../config/unifiedApiService.js';
import crypto from 'crypto';
import { notificationService } from './notifications/farcaster/index.js';
import { VoidSigner } from 'ethers';

// CLOB API endpoints
const CLOB_API = 'https://clob.polymarket.com';

// ClobClient for unauthenticated calls (markets info, etc.)
let clobClient: ClobClient | null = null;

function getClobClient(): ClobClient {
    if (clobClient) return clobClient;
    clobClient = new ClobClient(CLOB_API, 137);
    return clobClient;
}

function getAuthenticatedClobClient(creds: { apiKey: string; apiSecret: string; passphrase: string; walletAddress: string }): ClobClient {
    return new ClobClient(
        CLOB_API,
        137,
        new VoidSigner(creds.walletAddress) as any,
        {
            key: creds.apiKey,
            secret: creds.apiSecret,
            passphrase: creds.passphrase
        } as any,
        0
    );
}

/**
 * Get user's API credentials from database, with decryption.
 * [Fix]: Credentials are stored encrypted; must use getCredentials() which calls decrypt().
 * Using raw prisma fields directly was producing encrypted strings as apiKey/secret/passphrase,
 * causing 401 errors on all CLOB requests (wrong HMAC, wrong headers).
 */
async function getUserApiCreds(userId: string): Promise<{
    apiKey: string;
    apiSecret: string;
    passphrase: string;
    walletAddress: string;
} | null> {
    // getCredentials() already handles decryption via decrypt()
    return getCredentials(userId);
}

/**
 * Generate HMAC signature for L2 authentication
 */
function generateHmacSignature(
    secret: string,
    timestamp: string,
    method: string,
    requestPath: string,
    body: string = ''
): string {
    const message = timestamp + method + requestPath + body;
    const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'base64'));
    hmac.update(message);
    const signature = hmac.digest('base64');
    return signature.replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Post a signed order to the CLOB API using per-user credentials
 */
async function postSignedOrder(
    signedOrder: SignedOrder,
    creds: { apiKey: string; apiSecret: string; passphrase: string; walletAddress: string }
): Promise<{ success: boolean; orderId?: string; error?: string }> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'POST';
    const requestPath = '/order';

    const orderPayload = {
        deferExec: false,
        order: {
            salt: signedOrder.salt, // Keep as string (Polymarket API handles string for uint256)
            maker: signedOrder.maker,
            signer: signedOrder.signer,
            taker: signedOrder.taker,
            tokenId: signedOrder.tokenId,
            makerAmount: signedOrder.makerAmount,
            takerAmount: signedOrder.takerAmount,
            side: signedOrder.side === 0 ? 'BUY' : 'SELL',
            expiration: signedOrder.expiration,
            nonce: signedOrder.nonce,
            feeRateBps: signedOrder.feeRateBps,
            signatureType: signedOrder.signatureType,
            signature: signedOrder.signature
        },
        owner: creds.apiKey,
        orderType: 'GTC'
    };

    const body = JSON.stringify(orderPayload);
    console.log('[PolymarketExecutor] Order payload:', JSON.stringify(orderPayload, null, 2));
    const hmacSignature = generateHmacSignature(creds.apiSecret, timestamp, method, requestPath, body);

    try {
        const result = await fetchJson({
            url: `${CLOB_API}${requestPath}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'POLY_ADDRESS': creds.walletAddress,
                'POLY_API_KEY': creds.apiKey,
                'POLY_PASSPHRASE': creds.passphrase,
                'POLY_TIMESTAMP': timestamp,
                'POLY_SIGNATURE': hmacSignature
            },
            body
        }) as { error?: string; message?: string; orderID?: string; id?: string };

        console.log('[PolymarketExecutor] Order posted successfully:', result);
        return { success: true, orderId: result.orderID || result.id };

    } catch (error: any) {
        console.error('[PolymarketExecutor] POST error:', error);
        return { success: false, error: error.message };
    }
}

export interface BuyOrderParams {
    userId: string;
    configId: string;
    tokenId: string;
    price: number;
    amountUsd: number;
    question: string;
    outcome: string;
    marketSlug: string;
    conditionId: string;
}

export interface SellOrderParams {
    userId: string;
    positionId?: string; // DB ID
    assetId?: string;    // Direct asset token ID
    shares: number;
    minPrice: number;
}

/**
 * Check if user has Polymarket API credentials set up
 */
export async function hasUserApiCreds(userId: string): Promise<boolean> {
    const creds = await prisma.polymarketApiCreds.findUnique({
        where: { userId }
    });
    return !!creds;
}

/**
 * Check if global CLOB is configured (fallback for testing)
 */
export function isClobConfigured(): boolean {
    return !!(process.env.POLYMARKET_API_KEY && process.env.POLYMARKET_API_SECRET && process.env.POLYMARKET_PASSPHRASE);
}

/**
 * Place a buy order on Polymarket
 */
export async function placeBuyOrder(params: BuyOrderParams): Promise<{ success: boolean; orderId?: string; error?: string }> {
    console.log('[PolymarketExecutor] Placing BUY order:', {
        tokenId: params.tokenId.slice(0, 20) + '...',
        price: params.price,
        amount: params.amountUsd
    });

    try {
        // Get user's API credentials
        const creds = await getUserApiCreds(params.userId);
        if (!creds) {
            return { success: false, error: 'User has no Polymarket API credentials. Please set up your account first.' };
        }

        // Validate price
        if (params.price <= 0 || params.price >= 1) {
            params.price = 0.5;
        }

        // Calculate shares
        const shares = params.amountUsd / params.price;

        // Get user from DB
        const user = await prisma.user.findFirst({
            where: { privyDid: params.userId }
        });

        if (!user) {
            return { success: false, error: 'User not found in database' };
        }

        console.log(`[PolymarketExecutor] Building order: ${shares.toFixed(2)} shares @ $${params.price}`);

        // Build order data (EOA mode: maker = signer = user's wallet)
        const orderData = createLimitOrderData({
            makerAddress: creds.walletAddress,
            signerAddress: creds.walletAddress,
            tokenId: params.tokenId,
            side: 'BUY',
            price: params.price,
            size: shares
        });

        console.log('[PolymarketExecutor] Signing order with Privy...');

        // Sign with Privy server-side EIP-712
        const signedOrder = await buildSignedOrder(params.userId, orderData, false);

        console.log('[PolymarketExecutor] Posting signed order to CLOB...');

        // Post to CLOB
        const result = await postSignedOrder(signedOrder, creds);

        // Record action in DB
        await logPolymarketAction({
            userId: user.privyDid,
            type: 'BUY',
            status: result.success ? 'pending' : 'failed',
            marketTitle: params.question,
            marketSlug: params.marketSlug,
            outcome: params.outcome,
            assetId: params.tokenId,
            orderId: result.orderId,
            size: shares,
            price: params.price,
            amount: params.amountUsd,
            error: result.error
        });

        const config = await prisma.polymarketCopyConfig.findUnique({
            where: { id: params.configId }
        });
        const isDirectTrade = config?.targetWallet === '0x0000000000000000000000000000000000000000' || params.marketSlug === 'direct-trade';

        if (!isDirectTrade || !result.success) {
            await prisma.polymarketPosition.create({
                data: {
                    userId: user.privyDid,
                    configId: params.configId,
                    marketSlug: params.marketSlug,
                    conditionId: params.conditionId,
                    assetId: params.tokenId,
                    question: params.question,
                    outcome: params.outcome,
                    entryPrice: params.price,
                    shares: shares,
                    costBasis: params.amountUsd,
                    status: result.success ? 'open' : 'failed'
                }
            });
        }

        return result;

    } catch (error: any) {
        console.error('[PolymarketExecutor] Buy order failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Place a sell order on Polymarket
 */
export async function placeSellOrder(params: SellOrderParams): Promise<{ success: boolean; orderId?: string; error?: string }> {
    console.log('[PolymarketExecutor] Placing SELL order:', {
        positionId: params.positionId,
        assetId: params.assetId,
        shares: params.shares
    });

    try {
        // Get user's API credentials
        const creds = await getUserApiCreds(params.userId);
        if (!creds) {
            return { success: false, error: 'User has no Polymarket API credentials' };
        }

        let assetId = params.assetId;

        // If positionId provided, try to find assetId in DB
        if (params.positionId && !assetId) {
            // Check if positionId itself looks like an assetId
            if (params.positionId.length > 50) {
                assetId = params.positionId;
            } else {
                const position = await prisma.polymarketPosition.findUnique({
                    where: { id: params.positionId }
                });
                if (position) {
                    assetId = position.assetId;
                }
            }
        }

        if (!assetId) {
            return { success: false, error: 'Asset ID or Position ID required' };
        }

        // Build sell order
        const orderData = createLimitOrderData({
            makerAddress: creds.walletAddress,
            signerAddress: creds.walletAddress,
            tokenId: assetId,
            side: 'SELL',
            price: params.minPrice > 0 ? params.minPrice : 0.01,
            size: params.shares
        });

        // Sign with Privy
        const signedOrder = await buildSignedOrder(params.userId, orderData, false);

        // Post to CLOB
        const result = await postSignedOrder(signedOrder, creds);
        console.log('[PolymarketExecutor] SELL order result:', result);

        // Record action in DB
        try {
            const user = await prisma.user.findFirst({ where: { privyDid: params.userId } });
            if (user) {
                // Try to get market info for title
                let marketTitle = 'Polymarket Position';
                let marketSlug = '';
                if (params.positionId && params.positionId.length < 50) {
                    const pos = await (prisma as any).polymarketPosition.findUnique({ where: { id: params.positionId } });
                    if (pos) {
                        marketTitle = pos.question;
                        marketSlug = pos.marketSlug;
                    }
                }

                await logPolymarketAction({
                    userId: user.privyDid,
                    type: 'SELL',
                    status: result.success ? 'pending' : 'failed',
                    marketTitle,
                    marketSlug,
                    outcome: '',
                    assetId: assetId,
                    orderId: result.orderId,
                    size: params.shares,
                    price: params.minPrice,
                    amount: params.shares * params.minPrice,
                    error: result.error
                });
            }
        } catch (e) {
            console.warn('[PolymarketExecutor] Failed to log action:', e);
        }

        // Update position in DB if it exists
        if (params.positionId) {
            try {
                // Try finding by internal ID or assetId
                const where = params.positionId.length < 50
                    ? { id: params.positionId }
                    : { userId_assetId: { userId: params.userId, assetId: params.positionId } };

                // Note: userId_assetId might need specialized handling if not unique in schema
                // For now, let's keep it simple: try update by ID if it's short
                if (params.positionId.length < 50) {
                    await prisma.polymarketPosition.update({
                        where: { id: params.positionId },
                        data: {
                            status: result.success ? 'closed' : 'open',
                            exitReason: result.success ? 'manual_sell' : `sell_failed: ${result.error?.slice(0, 100)}`,
                            closedAt: result.success ? new Date() : null
                        }
                    });
                }
            } catch (e) {
                // Ignore update errors
            }
        }

        return result;

    } catch (error: any) {
        console.error('[PolymarketExecutor] Sell order failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get market info from CLOB
 */
export async function getMarketInfo(conditionId: string) {
    try {
        const client = getClobClient();
        const market = await client.getMarket(conditionId);
        return market;
    } catch (error) {
        console.error('[PolymarketExecutor] Failed to get market info:', error);
        return null;
    }
}

/**
 * Get orderbook for a token
 */
export async function getOrderBook(tokenId: string) {
    try {
        const client = getClobClient();
        const orderbook = await client.getOrderBook(tokenId);
        return orderbook;
    } catch (error) {
        console.error('[PolymarketExecutor] Failed to get orderbook:', error);
        return null;
    }
}

/**
 * Handle position change from watcher service
 * Called when a target wallet opens, closes, increases, or decreases a position
 */
export async function handlePositionChange(
    type: 'OPENED' | 'CLOSED' | 'INCREASED' | 'DECREASED',
    targetWallet: string,
    position: any,
    configIds: string[]
): Promise<void> {
    console.log(`[PolymarketExecutor] Handling ${type} for ${position.title?.slice(0, 30)}...`);

    try {
        // Get all configs that are watching this wallet
        const configs = await prisma.polymarketCopyConfig.findMany({
            where: {
                id: { in: configIds },
                status: 'active'
            },
            include: { user: true }
        });

        for (const config of configs) {
            const userId = config.user.privyDid;

            // Check if user has credentials set up
            const hasCreds = await hasUserApiCreds(userId);
            if (!hasCreds) {
                console.log(`[PolymarketExecutor] User ${userId.slice(0, 15)}... has no credentials, skipping`);
                continue;
            }

            if (type === 'OPENED') {
                // Copy the new position
                console.log(`[PolymarketExecutor] Copying new position for user ${userId.slice(0, 15)}...`);

                const result = await placeBuyOrder({
                    userId,
                    configId: config.id,
                    tokenId: position.assetId || '',
                    price: position.avgPrice || 0.5,
                    amountUsd: config.betSizeUsd,
                    question: position.title || '',
                    outcome: position.outcome || '',
                    marketSlug: position.market || '',
                    conditionId: position.conditionId || ''
                });

                if (result.success) {
                    console.log(`[PolymarketExecutor] ✅ Position copied for user ${userId.slice(0, 15)}...`);
                    await notificationService.sendNotification({
                        userId,
                        farcasterFid: config.user?.farcasterFid,
                        type: 'TRADE_SUCCESS_BUY',
                        data: {
                            tokenSymbol: position.outcome || 'POLY',
                            usdValue: config.betSizeUsd.toFixed(2),
                            chainId: 137,
                            targetWallet: targetWallet
                        }
                    });
                } else {
                    console.log(`[PolymarketExecutor] ❌ Copy failed: ${result.error}`);
                    await notificationService.sendNotification({
                        userId,
                        farcasterFid: config.user?.farcasterFid,
                        type: 'TRADE_FAILURE',
                        data: {
                            tokenSymbol: position.outcome || 'POLY',
                            usdValue: config.betSizeUsd.toFixed(2),
                            chainId: 137,
                            targetWallet: targetWallet,
                            error: result.error
                        }
                    });
                }
            } else if (type === 'CLOSED' && config.mirrorSell) {
                // Mirror the sell - find user's position for this market
                const userPosition = await prisma.polymarketPosition.findFirst({
                    where: {
                        userId: config.user.privyDid,
                        assetId: position.assetId,
                        status: 'open'
                    }
                });

                if (userPosition) {
                    console.log(`[PolymarketExecutor] Mirroring sell for user ${userId.slice(0, 15)}...`);

                    const result = await placeSellOrder({
                        userId,
                        positionId: userPosition.id,
                        shares: userPosition.shares,
                        minPrice: 0.01
                    });

                    if (result.success) {
                        console.log(`[PolymarketExecutor] ✅ Sell executed for user ${userId.slice(0, 15)}...`);
                        const sellValue = userPosition.costBasis || (userPosition.shares * userPosition.entryPrice);
                        const sellValueStr = (sellValue ?? 0).toFixed(2);
                        await notificationService.sendNotification({
                            userId,
                            farcasterFid: config.user?.farcasterFid,
                            type: 'TRADE_SUCCESS_SELL',
                            data: {
                                tokenSymbol: userPosition.outcome || 'POLY',
                                usdValue: sellValueStr,
                                chainId: 137,
                                targetWallet: targetWallet
                            }
                        });
                    } else {
                        console.log(`[PolymarketExecutor] ❌ Sell failed: ${result.error}`);
                        const sellValue = userPosition.costBasis || (userPosition.shares * userPosition.entryPrice);
                        const sellValueStr = (sellValue ?? 0).toFixed(2);
                        await notificationService.sendNotification({
                            userId,
                            farcasterFid: config.user?.farcasterFid,
                            type: 'TRADE_FAILURE',
                            data: {
                                tokenSymbol: userPosition.outcome || 'POLY',
                                usdValue: sellValueStr,
                                chainId: 137,
                                targetWallet: targetWallet,
                                error: result.error
                            }
                        });
                    }
                }
            }
            // INCREASED and DECREASED can be handled similarly if needed
        }
    } catch (error: any) {
        console.error('[PolymarketExecutor] Error handling position change:', error);
    }
}

/**
 * Close Position Parameters
 */
export interface ClosePositionParams {
    userId: string;
    positionId: string;    // Could be DB ID or assetId
    shares?: number;       // Optional, if not provided will fetch or use DB
    currentPrice?: number; // Optional, for calculating exit value
}

/**
 * Cancel Order Parameters
 */
export interface CancelOrderParams {
    userId: string;
    orderId: string;
}

/**
 * Close a Polymarket position by selling all shares
 */
export async function closePosition(params: ClosePositionParams): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
}> {
    console.log('[PolymarketExecutor] Closing position request:', params.positionId);

    try {
        let assetId = '';
        let shares = params.shares || 0;
        let dbPosition: any = null;

        // 1. Try to find as a DB UUID (length is 36 for standard UUIDs)
        if (params.positionId.length === 36 || params.positionId.includes('-')) {
            dbPosition = await prisma.polymarketPosition.findUnique({
                where: { id: params.positionId },
                include: { user: true }
            });

            if (dbPosition) {
                assetId = dbPosition.assetId;
                if (shares <= 0) shares = dbPosition.shares;
            }
        }

        // 2. If not found in DB or positionId IS the assetId (very long string)
        if (!assetId) {
            // Assume positionId is actually the assetId
            assetId = params.positionId;

            // If shares not provided, we need to fetch them from the API if possible,
            // or return an error requiring shares.
            if (shares <= 0) {
                console.log('[PolymarketExecutor] Shares not provided for assetId, fetching current balance...');
                const creds = await getUserApiCreds(params.userId);
                if (creds) {
                    const { getWalletPositions } = await import('./polymarketDataService.js');
                    const positions = await getWalletPositions(creds.walletAddress);
                    const pos = positions.find(p => p.assetId === assetId);
                    if (pos) {
                        shares = pos.size;
                        console.log(`[PolymarketExecutor] Found ${shares} shares for ${assetId}`);
                    }
                }
            }
        }

        if (!assetId || shares <= 0) {
            return {
                success: false,
                error: !assetId ? 'Position/Asset not found' : 'No shares to sell (shares parameter required if not in DB)'
            };
        }

        // 3. Try to get Best Bid to ensure immediate execution (Market Sell)
        let sellPrice = params.currentPrice || 0.01;
        try {
            const { getBestBid } = await import('./polymarketDataService.js');
            const bestBid = await getBestBid(assetId);
            if (bestBid && bestBid > 0) {
                console.log(`[PolymarketExecutor] Found best bid: ${bestBid} (currentPrice: ${params.currentPrice})`);
                sellPrice = bestBid;
            }
        } catch (e) {
            console.error('[PolymarketExecutor] Failed to fetch best bid, falling back to currentPrice');
        }

        // 4. Place sell order
        const result = await placeSellOrder({
            userId: params.userId,
            positionId: dbPosition ? dbPosition.id : undefined,
            assetId: assetId,
            shares: shares,
            minPrice: sellPrice
        });

        return result;

    } catch (error: any) {
        console.error('[PolymarketExecutor] Close position failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cancel a pending Polymarket order
 */
export async function cancelOrder(params: CancelOrderParams): Promise<{
    success: boolean;
    error?: string;
}> {
    console.log('[PolymarketExecutor] Cancelling order:', params.orderId);

    try {
        // Get user's API credentials
        const creds = await getUserApiCreds(params.userId);
        if (!creds) {
            return { success: false, error: 'User has no Polymarket API credentials' };
        }

        const client = getAuthenticatedClobClient(creds);
        await client.cancelOrder({ orderID: params.orderId });

        console.log('[PolymarketExecutor] Order cancelled successfully');

        // Record action in DB
        try {
            const user = await prisma.user.findFirst({ where: { privyDid: params.userId } });
            if (user) {
                await logPolymarketAction({
                    userId: user.privyDid,
                    type: 'CANCEL',
                    status: 'cancelled',
                    marketTitle: 'Order Cancellation',
                    marketSlug: '',
                    outcome: '',
                    orderId: params.orderId,
                });
            }
        } catch (e) {
            console.warn('[PolymarketExecutor] Failed to log cancel action:', e);
        }

        return { success: true };

    } catch (error: any) {
        console.error('[PolymarketExecutor] Cancel order failed:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Log a Polymarket action to the database
 */
async function logPolymarketAction(data: {
    userId: string;
    type: string;
    status: string;
    marketTitle: string;
    marketSlug: string;
    outcome: string;
    assetId?: string;
    orderId?: string;
    txHash?: string;
    size?: number;
    price?: number;
    amount?: number;
    error?: string;
}) {
    try {
        await (prisma as any).polymarketAction.create({
            data: {
                userId: data.userId,
                type: data.type,
                status: data.status,
                marketTitle: data.marketTitle,
                marketSlug: data.marketSlug,
                outcome: data.outcome,
                assetId: data.assetId,
                orderId: data.orderId,
                txHash: data.txHash,
                size: data.size,
                price: data.price,
                amount: data.amount,
                error: data.error
            }
        });
    } catch (error) {
        console.error('[PolymarketExecutor] Failed to log action:', error);
    }
}
