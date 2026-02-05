import { getAssetTransfers, convertToWalletTransactions, WalletTransaction } from './alchemy.js';
import { getTokenDetails } from './dexscreener.js';
import { getCoinbaseSpotPrice } from './coinbase.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { CHAINS } from '../config/chainConfig.js';

interface TokenPosition {
    symbol: string;
    address: string;
    totalAmount: number;
    totalCostUsd: number;
    totalBuyUsd: number;
    totalSellUsd: number;
    realizedPnlUsd: number;
    buyCount: number;
    sellCount: number;
    lastPrice?: number;
}

export interface CustomPnlSummary {
    totalRealizedPnlUsd: number;
    totalRealizedProfitUsd: number;
    totalRealizedLossUsd: number;
    totalUnrealizedPnlUsd: number;
    totalBoughtUsd: number;
    totalSoldUsd: number;
    winRate: number;
    totalTrades: number;
    profitableTrades: number;
    tokenBreakdown: Record<string, TokenPosition>;
}

const ALCHEMY_API_KEY = env.apiKeys.alchemy || process.env.ALCHEMY_API_KEY || '';

// Internal cache for historical prices to avoid redundant API calls
const priceCache = new Map<string, number>();
const currentPriceCache = new Map<string, number>();

const coinbaseSpotCache = new Map<string, { price: number; cachedAt: number }>();

async function getCoinbaseSpotUsdPrice(symbol: string): Promise<number> {
    const upper = symbol.toUpperCase();
    const cacheKey = `${upper}:USD`;
    const cached = coinbaseSpotCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < 60_000) return cached.price;

    const result = await getCoinbaseSpotPrice(upper, 'USD');
    const price = result?.price && Number.isFinite(result.price) ? result.price : 0;
    coinbaseSpotCache.set(cacheKey, { price, cachedAt: Date.now() });
    return price;
}

function resolveNativeCoinbaseSymbol(chain: string): 'ETH' | 'BNB' | 'MATIC' | 'SOL' {
    const key = chain.toLowerCase();
    if (key === 'bsc' || key === 'bnb') return 'BNB';
    if (key === 'polygon' || key === 'matic') return 'MATIC';
    if (key === 'solana' || key === 'sol') return 'SOL';
    return 'ETH';
}

async function buildQuoteUsdPriceMap(chain: string): Promise<Record<string, number>> {
    const native = resolveNativeCoinbaseSymbol(chain);
    const nativeUsd = await getCoinbaseSpotUsdPrice(native);
    return {
        ETH: native === 'ETH' ? nativeUsd : 0,
        BNB: native === 'BNB' ? nativeUsd : 0,
        MATIC: native === 'MATIC' ? nativeUsd : 0,
        SOL: native === 'SOL' ? nativeUsd : 0,
    };
}

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

            const data = await fetchJson({
                url,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: tokenAddress,
                    startTime: timestamp.toISOString(),
                    endTime: new Date(timestamp.getTime() + 60000).toISOString(), // 1 minute window
                    interval: '1m'
                })
            });

            if (data.data?.[0]?.price) {
                const price = parseFloat(data.data[0].price);
                priceCache.set(cacheKey, price);
                return price;
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

async function getCurrentTokenPrice(tokenAddress: string, chain: string): Promise<number> {
    const key = `${chain.toLowerCase()}:${tokenAddress.toLowerCase()}`;
    if (currentPriceCache.has(key)) return currentPriceCache.get(key)!;

    try {
        const details = await getTokenDetails(chain, tokenAddress);
        const price = details?.price ? Number(details.price) : 0;
        currentPriceCache.set(key, price);
        return price;
    } catch {
        currentPriceCache.set(key, 0);
        return 0;
    }
}

async function prefetchDexScreenerPrices(chain: string, tokenAddresses: string[]): Promise<void> {
    const normalized = Array.from(new Set(tokenAddresses.map(a => a.toLowerCase()))).filter(Boolean);
    if (normalized.length === 0) return;

    const batchSize = 30;
    for (let i = 0; i < normalized.length; i += batchSize) {
        const batch = normalized.slice(i, i + batchSize);
        try {
            const url = `https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`;
            const data: any = await fetchJson({ url });
            const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : [];

            const bestByBase = new Map<string, { price: number; liquidityUsd: number }>();
            for (const pair of pairs) {
                const baseAddr = pair?.baseToken?.address?.toLowerCase();
                if (!baseAddr || !batch.includes(baseAddr)) continue;

                const price = pair?.priceUsd ? Number(pair.priceUsd) : 0;
                if (!Number.isFinite(price) || price <= 0) continue;

                const liquidityUsd = pair?.liquidity?.usd ? Number(pair.liquidity.usd) : 0;
                const prev = bestByBase.get(baseAddr);
                if (!prev || liquidityUsd > prev.liquidityUsd) {
                    bestByBase.set(baseAddr, {
                        price,
                        liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : 0,
                    });
                }
            }

            for (const addr of batch) {
                const best = bestByBase.get(addr);
                // Cache even misses as 0 to avoid extra per-token calls later.
                currentPriceCache.set(`${chain.toLowerCase()}:${addr}`, best ? best.price : 0);
            }
        } catch {
            // ignore
        }
    }
}
const EXCLUDED_SYMBOLS = new Set(['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBNB', 'BNB', 'SOL', 'WSOL', 'BUSD', 'USDC.E', 'USDT.E', 'WMATIC']);

const CHAIN_ID_MAP: Record<string, number> = {
    eth: 1,
    ethereum: 1,
    base: 8453,
    bsc: 56,
    bnb: 56,
    polygon: 137,
    matic: 137,
    arbitrum: 42161,
    optimism: 10,
    op: 10,
    solana: 900,
    sol: 900,
};

function getExcludedTokenAddresses(chain: string): Set<string> {
    const chainId = CHAIN_ID_MAP[chain.toLowerCase()];
    if (!chainId || !CHAINS[chainId]) return new Set();
    const config = CHAINS[chainId];
    const addresses = [config.wrappedNativeAddress, ...(config.stablecoins || [])]
        .filter(Boolean)
        .map(addr => addr.toLowerCase());
    return new Set(addresses);
}

function isExcludedTransfer(chain: string, transfer: any): boolean {
    const symbol = transfer?.asset ? String(transfer.asset).toUpperCase() : '';
    if (symbol && EXCLUDED_SYMBOLS.has(symbol)) return true;
    const addr = transfer?.rawContract?.address ? String(transfer.rawContract.address).toLowerCase() : '';
    if (!addr) return false;
    const excluded = getExcludedTokenAddresses(chain);
    return excluded.has(addr);
}

/**
 * Calculate Wallet PNL and Win Rate using custom logic and Alchemy history
 */
export async function calculateWalletPnlManual(
    walletAddress: string,
    chain: string = 'eth',
    days: number | 'all' = 30,
    options?: {
        mode?: 'fast' | 'accurate';
        maxTransfers?: number;
        includeUnrealized?: boolean;
    }
): Promise<CustomPnlSummary> {
    const mode = options?.mode ?? 'fast';
    const maxTransfers = options?.maxTransfers ?? 1000;
    const includeUnrealized = options?.includeUnrealized ?? mode === 'accurate';

    logger.info(LogCode.SYS_INFO, `PNL: Calculating optimized manual PNL`, { wallet: walletAddress, chain, days, mode });
    const quoteUsdPrice = await buildQuoteUsdPriceMap(chain);

    // 1. Fetch historical transfers (ERC20 + external).
    // Note: internal transfers are often unavailable via free endpoints; we prefer pricing fallback instead.
    const transfersRaw = await getAssetTransfers(walletAddress, chain, {
        maxCount: maxTransfers,
        category: ['erc20', 'external'],
        order: 'desc'
    });

    const nowMs = Date.now();
    const startMs = days === 'all' ? 0 : nowMs - days * 24 * 60 * 60 * 1000;
    const transfers = transfersRaw.filter(t => {
        const ts = t.metadata?.blockTimestamp ? Date.parse(t.metadata.blockTimestamp) : NaN;
        if (!Number.isFinite(ts)) return true; // Keep if unknown timestamp
        return ts >= startMs;
    });

    // Group transfers by transaction hash
    const txGroups = new Map<string, any[]>();
    transfers.forEach(t => {
        if (!txGroups.has(t.hash)) txGroups.set(t.hash, []);
        txGroups.get(t.hash)!.push(t);
    });

    const summary: CustomPnlSummary = {
        totalRealizedPnlUsd: 0,
        totalRealizedProfitUsd: 0,
        totalRealizedLossUsd: 0,
        totalUnrealizedPnlUsd: 0,
        totalBoughtUsd: 0,
        totalSoldUsd: 0,
        winRate: 0,
        totalTrades: 0,
        profitableTrades: 0,
        tokenBreakdown: {}
    };

    let priceLookupBudget = mode === 'fast' ? 30 : 500;

    // 2. Process transactions by group
    const groupedTxs = Array.from(txGroups.entries())
        .map(([hash, group]) => {
            const ts = group[0]?.metadata?.blockTimestamp ? Date.parse(group[0].metadata.blockTimestamp) : 0;
            return { hash, group, ts: Number.isFinite(ts) ? ts : 0 };
        })
        .sort((a, b) => a.ts - b.ts);

    // Batch-prefetch current prices for the token transfers that need price fallback.
    // This avoids N sequential requests and speeds up the "no base valuation in tx" path.
    if (priceLookupBudget > 0) {
        const candidates: string[] = [];
        for (const { group } of groupedTxs) {
            if (candidates.length >= priceLookupBudget) break;

            const baseTransfers = group.filter(t => isExcludedTransfer(chain, t));
            const targetTransfers = group.filter(t => !isExcludedTransfer(chain, t));
            if (targetTransfers.length === 0) continue;

            const normalizedWallet = walletAddress.toLowerCase();
            let quoteUsdIn = 0;
            let quoteUsdOut = 0;
            if (baseTransfers.length > 0) {
                for (const bt of baseTransfers) {
                    const amount = parseFloat(bt.value?.toString() || '0');
                    if (amount <= 0) continue;
                    const asset = (bt.asset || '').toUpperCase();
                    let usdValue = 0;
                    if (['USDC', 'USDT', 'DAI', 'BUSD'].includes(asset)) {
                        usdValue = amount;
                    } else if (asset === 'ETH' || asset === 'WETH') {
                        usdValue = amount * quoteUsdPrice.ETH;
                    } else if (asset === 'BNB' || asset === 'WBNB') {
                        usdValue = amount * quoteUsdPrice.BNB;
                    } else if (asset === 'MATIC' || asset === 'WMATIC') {
                        usdValue = amount * quoteUsdPrice.MATIC;
                    } else if (asset === 'SOL' || asset === 'WSOL') {
                        usdValue = amount * quoteUsdPrice.SOL;
                    }

                    if (usdValue <= 0) continue;

	                    const from = (bt.from || '').toLowerCase();
	                    const to = (bt.to || '').toLowerCase();
	                    if (to === normalizedWallet) quoteUsdIn += usdValue;
	                    if (from === normalizedWallet) quoteUsdOut += usdValue;
	                }
	            }
            if (quoteUsdIn > 0 || quoteUsdOut > 0) continue;

            // Primary token (largest transfer amount) for this tx.
            const totals = new Map<string, number>();
            for (const tt of targetTransfers) {
                const addr = tt.rawContract?.address;
                if (!addr) continue;
                const tokenKey = String(addr).toLowerCase();
                const amount = Math.abs(parseFloat(tt.value?.toString() || '0'));
                totals.set(tokenKey, (totals.get(tokenKey) || 0) + amount);
            }
            let bestToken: string | null = null;
            let bestAmount = 0;
            for (const [tokenKey, total] of totals.entries()) {
                if (total > bestAmount) {
                    bestAmount = total;
                    bestToken = tokenKey;
                }
            }
            if (bestToken) candidates.push(bestToken);
        }

        await prefetchDexScreenerPrices(chain, candidates.slice(0, priceLookupBudget));
    }

    for (const { group } of groupedTxs) {
        const timestamp = group[0].metadata?.blockTimestamp ? new Date(group[0].metadata.blockTimestamp) : new Date();

        // Find "Base" transfers (ETH, BNB, Stables) and "Target" transfers
        const baseTransfers = group.filter(t => isExcludedTransfer(chain, t));
        const targetTransfers = group.filter(t => !isExcludedTransfer(chain, t));

        if (targetTransfers.length === 0) continue;

        // Valuation strategy: 
        // A. If there's a base transfer in the same TX, use it to value the target (Swap)
        // B. Otherwise, in fast mode we skip (treat as non-valued transfer); accurate mode may fallback to Price API
        const normalizedWallet = walletAddress.toLowerCase();
        let quoteUsdIn = 0;
        let quoteUsdOut = 0;

        if (baseTransfers.length > 0) {
            // Compute quote cashflow for this tx in USD.
            // BUY valuation uses quote outflow; SELL valuation uses quote inflow.
            for (const bt of baseTransfers) {
                const amount = parseFloat(bt.value?.toString() || '0');
                if (amount <= 0) continue;
                const asset = (bt.asset || '').toUpperCase();
                let usdValue = 0;
                if (['USDC', 'USDT', 'DAI', 'BUSD'].includes(asset)) {
                    usdValue = amount;
                } else if (asset === 'ETH' || asset === 'WETH') {
                    usdValue = amount * quoteUsdPrice.ETH;
                } else if (asset === 'BNB' || asset === 'WBNB') {
                    usdValue = amount * quoteUsdPrice.BNB;
                } else if (asset === 'MATIC' || asset === 'WMATIC') {
                    usdValue = amount * quoteUsdPrice.MATIC;
                } else if (asset === 'SOL' || asset === 'WSOL') {
                    usdValue = amount * quoteUsdPrice.SOL;
                } else if (mode === 'accurate' && bt.rawContract?.address) {
                    const p = await getHistoricalPrice(bt.rawContract.address, chain, timestamp);
                    usdValue = amount * p;
                }

                if (usdValue <= 0) continue;
                const from = (bt.from || '').toLowerCase();
                const to = (bt.to || '').toLowerCase();
                if (to === normalizedWallet) quoteUsdIn += usdValue;
                if (from === normalizedWallet) quoteUsdOut += usdValue;
            }
        }

        // Reduce noise: many tx groups can have multiple token transfers (fees/airdrops).
        // Only the primary (largest-amount) token transfer is valued by the baseTransfers USD.
        let primaryTokenKey: string | null = null;
        if (targetTransfers.length > 1) {
            const totals = new Map<string, number>();
            for (const tt of targetTransfers) {
                const addr = tt.rawContract?.address;
                if (!addr) continue;
                const tokenKey = String(addr).toLowerCase();
                const amount = Math.abs(parseFloat(tt.value?.toString() || '0'));
                totals.set(tokenKey, (totals.get(tokenKey) || 0) + amount);
            }
            let maxAmount = 0;
            for (const [tokenKey, total] of totals.entries()) {
                if (total > maxAmount) {
                    maxAmount = total;
                    primaryTokenKey = tokenKey;
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
                    totalBuyUsd: 0,
                    totalSellUsd: 0,
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
            const cashflowUsd = isIncoming ? quoteUsdOut : quoteUsdIn;
            if (cashflowUsd > 0) {
                // Allocate the group value only to the primary token transfer to avoid double-counting.
                if (primaryTokenKey && tokenKey !== primaryTokenKey) continue;
                unitPrice = cashflowUsd / amount;
            } else {
                // Fallback: approximate with CURRENT token price (fast) to avoid per-tx deep pricing.
                if (primaryTokenKey && tokenKey !== primaryTokenKey) continue;
                if (priceLookupBudget <= 0) continue;
                priceLookupBudget -= 1;

                unitPrice = await getCurrentTokenPrice(tt.rawContract.address, chain);
                if (!unitPrice && mode === 'accurate') {
                    unitPrice = await getHistoricalPrice(tt.rawContract.address, chain, timestamp);
                }
            }

            const totalValueUsd = amount * unitPrice;
            if (totalValueUsd === 0) continue;

            if (isIncoming) {
                // BUY or Received
                pos.totalAmount += amount;
                pos.totalCostUsd += totalValueUsd;
                pos.totalBuyUsd += totalValueUsd;
                summary.totalBoughtUsd += totalValueUsd;
                pos.buyCount++;
            } else {
                // SELL or Sent
                if (pos.totalAmount > 0) {
                    const avgCost = pos.totalCostUsd / pos.totalAmount;
                    const costOfSold = amount * avgCost;
                    const profit = totalValueUsd - costOfSold;

                    pos.realizedPnlUsd += profit;
                    pos.totalSellUsd += totalValueUsd;
                    pos.totalAmount -= amount;
                    pos.totalCostUsd -= costOfSold;
                    pos.sellCount++;

                    // Floating safety (dust)
                    if (Math.abs(pos.totalAmount) < 1e-9) pos.totalAmount = 0;
                    if (Math.abs(pos.totalCostUsd) < 1e-9) pos.totalCostUsd = 0;

                    summary.totalRealizedPnlUsd += profit;
                    summary.totalSoldUsd += totalValueUsd;
                    if (profit > 0) {
                        summary.totalRealizedProfitUsd += profit;
                        summary.profitableTrades++;
                    } else if (profit < 0) {
                        summary.totalRealizedLossUsd += profit;
                    }
                    summary.totalTrades++;
                }
            }
        }
    }

    // 4. Final stats (computed even when unrealized is skipped)
    if (summary.totalTrades > 0) {
        summary.winRate = (summary.profitableTrades / summary.totalTrades) * 100;
    }

    // 3. Calculate Unrealized PNL using current prices
    if (!includeUnrealized) {
        return summary;
    }

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

    return summary;
}
