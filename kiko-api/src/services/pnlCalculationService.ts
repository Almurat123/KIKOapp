import { getAssetTransfers, convertToWalletTransactions, WalletTransaction } from './alchemy.js';
import { getTokenDetails } from './dexscreener.js';
import { env } from '../config/env.js';

interface TokenPosition {
    symbol: string;
    address: string;
    totalAmount: number;
    totalCostUsd: number;
    realizedPnlUsd: number;
    buyCount: number;
    sellCount: number;
    lastPrice?: number;
}

export interface CustomPnlSummary {
    totalRealizedPnlUsd: number;
    totalUnrealizedPnlUsd: number;
    winRate: number;
    totalTrades: number;
    profitableTrades: number;
    tokenBreakdown: Record<string, TokenPosition>;
}

const ALCHEMY_API_KEY = env.apiKeys.alchemy || process.env.ALCHEMY_API_KEY || '';

// Internal cache for historical prices to avoid redundant API calls
const priceCache = new Map<string, number>();

/**
 * Fetch historical price for a token at a specific timestamp using Alchemy Prices API
 * Fallback to DexScreener current price if historical price is unavailable or too old
 */
async function getHistoricalPrice(tokenAddress: string, chain: string, timestamp: Date): Promise<number> {
    const cacheKey = `${tokenAddress.toLowerCase()}-${timestamp.toISOString().slice(0, 13)}`; // Hourly bucket for cache
    if (priceCache.has(cacheKey)) return priceCache.get(cacheKey)!;

    try {
        // Alchemy Prices API (Beta)
        // Note: For newer/smaller tokens, this might return null.
        if (ALCHEMY_API_KEY) {
            const url = `https://api.g.alchemy.com/prices/v1/${ALCHEMY_API_KEY}/tokens/historical`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: tokenAddress,
                    startTime: timestamp.toISOString(),
                    endTime: new Date(timestamp.getTime() + 60000).toISOString(), // 1 minute window
                    interval: '1m'
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.data?.[0]?.price) {
                    const price = parseFloat(data.data[0].price);
                    priceCache.set(cacheKey, price);
                    return price;
                }
            }
        }
    } catch (e) {
        // Silently fallback
    }

    // Fallback: Get current price from DexScreener
    try {
        let details = await getTokenDetails(chain, tokenAddress);

        // If getTokenDetails (direct address) fails, try search (some tokens are tricky)
        if (!details || !details.price) {
            const { searchTokens } = await import('./dexscreener.js');
            const results = await searchTokens(tokenAddress);
            details = results.find(r => r.address.toLowerCase() === tokenAddress.toLowerCase()) || null;
        }

        if (details && details.price) {
            priceCache.set(cacheKey, details.price);
            return details.price;
        }
    } catch (e) {
        // console.error(`[PNL] DexScreener Fallback failed for ${tokenAddress}:`, e);
    }

    return 0;
}

const EXCLUDED_SYMBOLS = new Set(['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBNB', 'BNB', 'SOL', 'WSOL', 'BUSD']);

/**
 * Calculate Wallet PNL and Win Rate using custom logic and Alchemy history
 */
export async function calculateWalletPnlManual(
    walletAddress: string,
    chain: string = 'eth',
    days: number | 'all' = 30
): Promise<CustomPnlSummary> {
    console.log(`[PNL] Calculating optimized manual PNL for ${walletAddress} on ${chain} (${days} days)`);

    // 1. Fetch historical transfers
    const transfers = await getAssetTransfers(walletAddress, chain, {
        maxCount: 1000,
        category: ['erc20', 'external'],
        order: 'asc'
    });

    // Group transfers by transaction hash
    const txGroups = new Map<string, any[]>();
    transfers.forEach(t => {
        if (!txGroups.has(t.hash)) txGroups.set(t.hash, []);
        txGroups.get(t.hash)!.push(t);
    });

    const summary: CustomPnlSummary = {
        totalRealizedPnlUsd: 0,
        totalUnrealizedPnlUsd: 0,
        winRate: 0,
        totalTrades: 0,
        profitableTrades: 0,
        tokenBreakdown: {}
    };

    // 2. Process transactions by group
    for (const [hash, group] of txGroups.entries()) {
        const timestamp = group[0].metadata?.blockTimestamp ? new Date(group[0].metadata.blockTimestamp) : new Date();

        // Find "Base" transfers (ETH, BNB, Stables) and "Target" transfers
        const baseTransfers = group.filter(t => EXCLUDED_SYMBOLS.has(t.asset?.toUpperCase() || ''));
        const targetTransfers = group.filter(t => !EXCLUDED_SYMBOLS.has(t.asset?.toUpperCase() || ''));

        if (targetTransfers.length === 0) continue;

        // Valuation strategy: 
        // A. If there's a base transfer in the same TX, use it to value the target (Swap)
        // B. Otherwise, fallback to Price API
        let valueUsdForGroup = 0;

        if (baseTransfers.length > 0) {
            // Sum up the value of base transfers (approximation: use current price or assume $1 for stables)
            for (const bt of baseTransfers) {
                const amount = parseFloat(bt.value?.toString() || '0');
                if (['USDC', 'USDT', 'DAI', 'BUSD'].includes(bt.asset?.toUpperCase() || '')) {
                    valueUsdForGroup += amount;
                } else {
                    // Fetch price for ETH/BNB/SOL (more likely to be in price API)
                    const p = await getHistoricalPrice(bt.rawContract.address || '0x0000000000000000000000000000000000000000', chain, timestamp);
                    valueUsdForGroup += amount * (p || 2500); // Fallback to rough estimate if failed
                }
            }
        }

        // Process each target transfer in the group
        for (const tt of targetTransfers) {
            if (!tt.asset || !tt.rawContract.address) continue;

            const tokenKey = tt.rawContract.address.toLowerCase();
            if (!summary.tokenBreakdown[tokenKey]) {
                summary.tokenBreakdown[tokenKey] = {
                    symbol: tt.asset,
                    address: tt.rawContract.address,
                    totalAmount: 0,
                    totalCostUsd: 0,
                    realizedPnlUsd: 0,
                    buyCount: 0,
                    sellCount: 0
                };
            }

            const pos = summary.tokenBreakdown[tokenKey];
            const amount = parseFloat(tt.value?.toString() || '0');
            const isIncoming = tt.to.toLowerCase() === walletAddress.toLowerCase();

            // Determine valuation for this specific transfer
            let unitPrice = 0;
            if (valueUsdForGroup > 0) {
                unitPrice = valueUsdForGroup / amount;
            } else {
                unitPrice = await getHistoricalPrice(tt.rawContract.address, chain, timestamp);
            }

            const totalValueUsd = amount * unitPrice;
            if (totalValueUsd === 0) continue;

            if (isIncoming) {
                // BUY or Received
                pos.totalAmount += amount;
                pos.totalCostUsd += totalValueUsd;
                pos.buyCount++;
            } else {
                // SELL or Sent
                if (pos.totalAmount > 0) {
                    const avgCost = pos.totalCostUsd / pos.totalAmount;
                    const costOfSold = amount * avgCost;
                    const profit = totalValueUsd - costOfSold;

                    pos.realizedPnlUsd += profit;
                    pos.totalAmount -= amount;
                    pos.totalCostUsd -= costOfSold;
                    pos.sellCount++;

                    summary.totalRealizedPnlUsd += profit;
                    if (profit > 0) summary.profitableTrades++;
                    summary.totalTrades++;
                }
            }
        }
    }

    // 3. Calculate Unrealized PNL using current prices
    for (const tokenKey in summary.tokenBreakdown) {
        const pos = summary.tokenBreakdown[tokenKey];
        if (pos.totalAmount > 0.000001) { // Floating point safety
            const currentDetails = await getTokenDetails(chain, pos.address);
            if (currentDetails && currentDetails.price) {
                const currentValue = pos.totalAmount * currentDetails.price;
                const unrealized = currentValue - pos.totalCostUsd;
                summary.totalUnrealizedPnlUsd += unrealized;
                pos.lastPrice = currentDetails.price;
            }
        }
    }

    // 4. Final stats
    if (summary.totalTrades > 0) {
        summary.winRate = (summary.profitableTrades / summary.totalTrades) * 100;
    }

    return summary;
}
