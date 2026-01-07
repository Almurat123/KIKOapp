/**
 * Polymarket Data Service
 * Fetches wallet positions and user stats from Polymarket Data API
 */

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
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            console.error(`[PolymarketData] API error: ${response.status}`);
            return [];
        }

        const data = await response.json() as any[];

        return data.map(pos => ({
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
            assetId: pos.asset || pos.assetId || pos.tokenId || '' // API returns 'asset' field
        }));
    } catch (error) {
        console.error('[PolymarketData] Failed to fetch positions:', error);
        return [];
    }
}

/**
 * Get user trading stats (PnL, volume, etc.)
 */
export async function getWalletStats(wallet: string): Promise<PolymarketUserStats | null> {
    const url = `${POLYMARKET_DATA_API}/users/${wallet.toLowerCase()}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            console.error(`[PolymarketData] API error: ${response.status}`);
            return null;
        }

        const data = await response.json() as any;

        return {
            wallet: wallet,
            totalVolume: parseFloat(data.volume || data.totalVolume) || 0,
            totalPnl: parseFloat(data.pnl || data.totalPnl) || 0,
            winRate: parseFloat(data.winRate) || 0,
            positionsCount: data.positionsCount || data.positions?.length || 0
        };
    } catch (error) {
        console.error('[PolymarketData] Failed to fetch user stats:', error);
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
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            console.error(`[PolymarketData] API error: ${response.status}`);
            return [];
        }

        const data = await response.json() as any[];

        return data.map(trade => ({
            id: trade.id || '',
            market: trade.slug || trade.market || '',
            asset: trade.asset || '',
            side: (trade.side || 'BUY').toUpperCase(),
            size: parseFloat(trade.size) || 0,
            price: parseFloat(trade.price) || 0,
            timestamp: parseInt(trade.timestamp) * 1000 || Date.now(),
            transactionHash: trade.transactionHash || '',
            outcome: trade.outcome || '',
            title: trade.title || 'Unknown Market'
        }));
    } catch (error) {
        console.error('[PolymarketData] Failed to fetch trades:', error);
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
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            return [];
        }

        const data = await response.json() as any;

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
    } catch (error) {
        console.error('[PolymarketData] Failed to fetch open orders:', error);
        return [];
    }
}
