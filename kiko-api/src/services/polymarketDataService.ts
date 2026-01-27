/**
 * Polymarket Data Service
 * Fetches wallet positions and user stats from Polymarket Data API
 */
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import * as unifiedApiService from '../config/unifiedApiService.js';

const POLYMARKET_DATA_API = 'https://data-api.polymarket.com';

export interface PolymarketUserPosition {
    market: string;           // Market slug
    title: string;            // Question text
    outcome: string;          // "Yes" or "No"
    outcomeIndex: number;     // 0 or 1
    size: number;             // Number of shares
    avgPrice: number;         // Average entry price (0-1)
    currentPrice: number;     // Current market price
    initialValue: number;     // Cost basis in USDC
    currentValue: number;     // Current value in USDC
    pnl: number;              // Profit/Loss in USDC
    pnlPercent: number;       // P/L percentage
    conditionId: string;      // CTF condition ID
    assetId: string;          // Token ID for this outcome
}

export interface PolymarketUserStats {
    wallet: string;
    totalVolume: number;
    totalPnl: number;
    winRate: number;
    positionsCount: number;
}

/**
 * Get all open positions for a wallet
 */
export async function getWalletPositions(wallet: string): Promise<PolymarketUserPosition[]> {
    const url = `${POLYMARKET_DATA_API}/positions?user=${wallet.toLowerCase()}`;

    try {
        const data = await unifiedApiService.fetchJson<any[]>({
            url,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000,
            endpointName: 'data-api.polymarket.com'
        });

        let positions = data.map(pos => ({
            market: pos.slug || pos.market || '',
            title: pos.title || pos.question || 'Unknown Market',
            outcome: pos.outcome || (pos.outcomeIndex === 0 ? 'Yes' : 'No'),
            outcomeIndex: pos.outcomeIndex ?? 0,
            size: parseFloat(pos.size) || 0,
            avgPrice: parseFloat(pos.avgPrice) || 0,
            currentPrice: parseFloat(pos.curPrice || pos.currentPrice) || 0,
            initialValue: parseFloat(pos.initialValue) || 0,
            currentValue: parseFloat(pos.currentValue) || 0,
            pnl: parseFloat(pos.cashPnl || pos.pnl) || 0,
            pnlPercent: parseFloat(pos.percentPnl || pos.pnlPercent) || 0,
            conditionId: pos.conditionId || '',
            assetId: pos.asset || pos.assetId || pos.tokenId || ''
        }));

        // Filter out positions that we know were successfully closed recently (avoid API indexing lag)
        try {
            const prisma = (await import('../db/prisma.js')).default as any;
            const user = await prisma.user.findFirst({ where: { walletAddress: wallet.toLowerCase() } });
            if (user) {
                const recentSells = await prisma.polymarketAction.findMany({
                    where: {
                        userId: user.id,
                        type: 'SELL',
                        status: 'SUCCESS',
                        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
                    }
                });

                if (recentSells.length > 0) {
                    const closedAssetIds = new Set(recentSells.map((s: any) => s.assetId));
                    positions = positions.filter(p => !closedAssetIds.has(p.assetId));
                }
            }
        } catch (e: any) {
            logger.warn(LogCode.SYS_ERROR, 'Failed to filter closed Polymarket positions', { wallet, error: e.message });
        }

        return positions;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch Polymarket positions', { wallet, error: error.message });
        return [];
    }
}

/**
 * Get user trading stats (PnL, volume, etc.)
 */
export async function getWalletStats(wallet: string): Promise<PolymarketUserStats | null> {
    const url = `${POLYMARKET_DATA_API}/users/${wallet.toLowerCase()}`;

    try {
        const data = await unifiedApiService.fetchJson<any>({
            url,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000,
            endpointName: 'data-api.polymarket.com'
        });

        return {
            wallet: wallet,
            totalVolume: parseFloat(data.volume || data.totalVolume) || 0,
            totalPnl: parseFloat(data.pnl || data.totalPnl) || 0,
            winRate: parseFloat(data.winRate) || 0,
            positionsCount: data.positionsCount || data.positions?.length || 0
        };
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch Polymarket user stats', { wallet, error: error.message });
        return null;
    }
}

/**
 * Get position changes between two snapshots
 * Used by watcher to detect new trades
 */
export function diffPositions(
    oldPositions: PolymarketUserPosition[],
    newPositions: PolymarketUserPosition[]
): {
    opened: PolymarketUserPosition[];
    closed: PolymarketUserPosition[];
    increased: PolymarketUserPosition[];
    decreased: PolymarketUserPosition[];
} {
    const oldMap = new Map(oldPositions.map(p => [p.assetId, p]));
    const newMap = new Map(newPositions.map(p => [p.assetId, p]));

    const opened: PolymarketUserPosition[] = [];
    const closed: PolymarketUserPosition[] = [];
    const increased: PolymarketUserPosition[] = [];
    const decreased: PolymarketUserPosition[] = [];

    // Check for new or increased positions
    for (const [assetId, newPos] of newMap) {
        const oldPos = oldMap.get(assetId);
        if (!oldPos) {
            opened.push(newPos);
        } else if (newPos.size > oldPos.size) {
            increased.push(newPos);
        } else if (newPos.size < oldPos.size) {
            decreased.push(newPos);
        }
    }

    // Check for closed positions
    for (const [assetId, oldPos] of oldMap) {
        if (!newMap.has(assetId)) {
            closed.push(oldPos);
        }
    }

    return { opened, closed, increased, decreased };
}


export interface PolymarketTrade {
    id: string;
    market: string;
    asset: string;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    timestamp: number;
    transactionHash: string;
    outcome: string;
    title: string;
}

/**
 * Get trade history for a wallet
 */
export async function getWalletTrades(wallet: string): Promise<PolymarketTrade[]> {
    const url = `${POLYMARKET_DATA_API}/trades?user=${wallet.toLowerCase()}&limit=50`;

    try {
        const data = await unifiedApiService.fetchJson<any[]>({
            url,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000,
            endpointName: 'data-api.polymarket.com'
        });

        const trades: PolymarketTrade[] = data.map(trade => ({
            id: trade.id || '',
            market: trade.slug || trade.market || '',
            asset: trade.asset || '',
            side: (trade.side || 'BUY').toUpperCase() as 'BUY' | 'SELL',
            size: parseFloat(trade.size) || 0,
            price: parseFloat(trade.price) || 0,
            timestamp: parseInt(trade.timestamp) * 1000 || Date.now(),
            transactionHash: trade.transactionHash || '',
            outcome: trade.outcome || '',
            title: trade.title || 'Unknown Market',
            status: 'SUCCESS' // All found in trades API are successes
        }));

        // Merge with local actions for responsiveness and to show failures/cancellations
        try {
            const prisma = (await import('../db/prisma.js')).default as any;
            const user = await prisma.user.findFirst({ where: { walletAddress: wallet.toLowerCase() } });
            if (user) {
                const localActions = await prisma.polymarketAction.findMany({
                    where: { userId: user.id },
                    orderBy: { createdAt: 'desc' },
                    take: 50
                });

                // Convert local actions to trade-like format
                const localTrades: PolymarketTrade[] = localActions.map((action: any) => ({
                    id: action.id,
                    market: action.marketSlug || '',
                    asset: action.assetId || '',
                    side: action.type as 'BUY' | 'SELL',
                    size: action.size || 0,
                    price: action.price || 0,
                    timestamp: action.createdAt.getTime(),
                    transactionHash: action.txHash || '',
                    outcome: action.outcome || '',
                    title: action.marketTitle || 'Polymarket Action',
                    status: action.status
                }));

                // Combine and deduplicate (by transaction hash or order id)
                // We prioritize local actions for statuses and titles
                const combined = [...localTrades];
                const seenTxHashes = new Set(localTrades.filter(t => t.transactionHash).map(t => t.transactionHash));

                for (const trade of trades) {
                    if (!seenTxHashes.has(trade.transactionHash)) {
                        combined.push(trade);
                    }
                }

                return combined.sort((a, b) => b.timestamp - a.timestamp);
            }
        } catch (e: any) {
            logger.warn(LogCode.SYS_ERROR, 'Failed to merge local Polymarket actions', { wallet, error: e.message });
        }

        return trades;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch Polymarket trades', { wallet, error: error.message });
        return [];
    }
}

export interface PolymarketOpenOrder {
    id: string;
    assetId: string;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    filled: number;
    timestamp: number;
    title: string;
    outcome: string;
}

/**
 * Get open (pending) orders for a wallet
 */
export async function getOpenOrders(wallet: string): Promise<PolymarketOpenOrder[]> {
    const url = `https://clob.polymarket.com/orders?maker_address=${wallet.toLowerCase()}`;

    try {
        const data = await unifiedApiService.fetchJson<any>({
            url,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000,
            endpointName: 'clob.polymarket.com'
        });

        // The CLOB API might return an array or an object with a data field
        const orders = Array.isArray(data) ? data : (data?.data || data?.results || []);

        if (!Array.isArray(orders)) {
            return [];
        }

        return orders.map(order => ({
            id: order.id || order.orderID || order.orderHash || '',
            assetId: order.asset_id || order.tokenId || '',
            side: (order.side || 'BUY').toUpperCase() as 'BUY' | 'SELL',
            size: parseFloat(order.original_size || order.size || '0'),
            price: parseFloat(order.price || '0'),
            filled: parseFloat(order.size_filled || '0'),
            timestamp: order.created_at ? (typeof order.created_at === 'number' ? order.created_at : new Date(order.created_at).getTime()) : Date.now(),
            title: order.title || order.question || 'Order',
            outcome: order.outcome || ''
        }));
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch Polymarket open orders', { wallet, error: error.message });
        return [];
    }
}

/**
 * Get the best bid price for an asset from the CLOB
 * Used to implement a "Market Sell" by selling at the highest bid
 */
export async function getBestBid(tokenId: string): Promise<number | null> {
    const url = `https://clob.polymarket.com/book?token_id=${tokenId}`;

    try {
        const data = await unifiedApiService.fetchJson<any>({
            url,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 5000, // Faster timeout for order book
            endpointName: 'clob.polymarket.com'
        });
        const bids = data.bids || [];

        if (bids.length > 0) {
            // Bids are usually sorted high to low
            return parseFloat(bids[0].price);
        }

        return null;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch Polymarket orderbook', { tokenId, error: error.message });
        return null;
    }
}
