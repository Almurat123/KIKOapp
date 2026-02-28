import { Tool } from '../../../tooling/registry.js';
import { fetchGmgnRankWithFallback } from '../../../services/gmgnRankService.js';

type GmgnChain = 'base' | 'eth' | 'bsc' | 'sol';
type GmgnWindow = '1d' | '7d' | '30d';
type SortDirection = 'asc' | 'desc';
type TagMatchMode = 'any' | 'all';
type ScoreMode = 'none' | 'composite';

type WalletCandidate = {
    walletAddress: string;
    chain: GmgnChain;
    tags: string[];
    lastActive: number | null;
    realizedProfit1d: number | null;
    realizedProfit7d: number | null;
    realizedProfit30d: number | null;
    pnl1d: number | null;
    pnl7d: number | null;
    pnl30d: number | null;
    winrate1d: number | null;
    winrate7d: number | null;
    winrate30d: number | null;
    buy1d: number | null;
    buy7d: number | null;
    buy30d: number | null;
    sell1d: number | null;
    sell7d: number | null;
    sell30d: number | null;
    txs1d: number | null;
    txs7d: number | null;
    txs30d: number | null;
    balance: number | null;
    raw?: Record<string, unknown>;
};

const SUPPORTED_CHAINS: GmgnChain[] = ['base', 'eth', 'bsc', 'sol'];
const SUPPORTED_WINDOWS: GmgnWindow[] = ['1d', '7d', '30d'];

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
    const n = Number.parseInt(String(v ?? ''), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function toNumber(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number.parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
}

function toInteger(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number.parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
}

function normalizeChain(chain: unknown): GmgnChain {
    const c = String(chain || 'base').toLowerCase();
    if ((SUPPORTED_CHAINS as string[]).includes(c)) return c as GmgnChain;
    return 'base';
}

function normalizeWindow(window: unknown): GmgnWindow {
    const w = String(window || '7d').toLowerCase();
    if ((SUPPORTED_WINDOWS as string[]).includes(w)) return w as GmgnWindow;
    return '7d';
}

function normalizeDirection(direction: unknown): SortDirection {
    return String(direction || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function normalizeTagMatchMode(mode: unknown): TagMatchMode {
    return String(mode || 'any').toLowerCase() === 'all' ? 'all' : 'any';
}

function normalizeScoreMode(mode: unknown): ScoreMode {
    return String(mode || 'composite').toLowerCase() === 'none' ? 'none' : 'composite';
}

function isLikelySolWallet(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function isLikelyEvmWallet(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function normalizeWalletAddress(address: unknown, chain: GmgnChain): string | null {
    const raw = String(address || '').trim();
    if (!raw) return null;
    if (chain === 'sol') return isLikelySolWallet(raw) ? raw : null;
    return isLikelyEvmWallet(raw) ? raw.toLowerCase() : null;
}

function toWalletCandidate(row: Record<string, unknown>, chain: GmgnChain, includeRaw: boolean): WalletCandidate | null {
    const walletAddress = normalizeWalletAddress(row.wallet_address || row.address, chain);
    if (!walletAddress) return null;
    const tags = Array.isArray(row.tags) ? row.tags.map((t) => String(t)) : [];
    return {
        walletAddress,
        chain,
        tags,
        lastActive: toInteger(row.last_active),
        realizedProfit1d: toNumber(row.realized_profit_1d),
        realizedProfit7d: toNumber(row.realized_profit_7d),
        realizedProfit30d: toNumber(row.realized_profit_30d),
        pnl1d: toNumber(row.pnl_1d),
        pnl7d: toNumber(row.pnl_7d),
        pnl30d: toNumber(row.pnl_30d),
        winrate1d: toNumber(row.winrate_1d),
        winrate7d: toNumber(row.winrate_7d),
        winrate30d: toNumber(row.winrate_30d),
        buy1d: toInteger(row.buy_1d),
        buy7d: toInteger(row.buy_7d),
        buy30d: toInteger(row.buy_30d),
        sell1d: toInteger(row.sell_1d),
        sell7d: toInteger(row.sell_7d),
        sell30d: toInteger(row.sell_30d),
        txs1d: toInteger(row.txs_1d),
        txs7d: toInteger(row.txs_7d),
        txs30d: toInteger(row.txs_30d),
        balance: toNumber(row.balance),
        raw: includeRaw ? row : undefined
    };
}

function getWindowMetric(candidate: WalletCandidate, field: 'realizedProfit' | 'winrate' | 'buy' | 'sell' | 'txs', window: GmgnWindow): number | null {
    if (field === 'realizedProfit') return window === '1d' ? candidate.realizedProfit1d : window === '30d' ? candidate.realizedProfit30d : candidate.realizedProfit7d;
    if (field === 'winrate') return window === '1d' ? candidate.winrate1d : window === '30d' ? candidate.winrate30d : candidate.winrate7d;
    if (field === 'buy') return window === '1d' ? candidate.buy1d : window === '30d' ? candidate.buy30d : candidate.buy7d;
    if (field === 'sell') return window === '1d' ? candidate.sell1d : window === '30d' ? candidate.sell30d : candidate.sell7d;
    return window === '1d' ? candidate.txs1d : window === '30d' ? candidate.txs30d : candidate.txs7d;
}

function applyWalletFilters(candidates: WalletCandidate[], args: any, window: GmgnWindow): WalletCandidate[] {
    const minProfit = toNumber(args.min_realized_profit);
    const minWinrate = toNumber(args.min_winrate);
    const minBalance = toNumber(args.min_balance);
    const minBuy = toNumber(args.min_buy_count);
    const minSell = toNumber(args.min_sell_count);
    const minTxs = toNumber(args.min_txs_count);
    const requiredTags = Array.isArray(args.required_tags) ? args.required_tags.map((t: any) => String(t).toLowerCase()).filter(Boolean) : [];
    const tagMatchMode = normalizeTagMatchMode(args.tag_match_mode);

    return candidates.filter((c) => {
        const profit = getWindowMetric(c, 'realizedProfit', window);
        const winrate = getWindowMetric(c, 'winrate', window);
        const buy = getWindowMetric(c, 'buy', window);
        const sell = getWindowMetric(c, 'sell', window);
        const txs = getWindowMetric(c, 'txs', window);

        if (minProfit !== null && (profit === null || profit < minProfit)) return false;
        if (minWinrate !== null && (winrate === null || winrate < minWinrate)) return false;
        if (minBalance !== null && (c.balance === null || c.balance < minBalance)) return false;
        if (minBuy !== null && (buy === null || buy < minBuy)) return false;
        if (minSell !== null && (sell === null || sell < minSell)) return false;
        if (minTxs !== null && (txs === null || txs < minTxs)) return false;

        if (requiredTags.length > 0) {
            const walletTags = new Set(c.tags.map((t: string) => t.toLowerCase()));
            const matched = requiredTags.filter((t: string) => walletTags.has(t)).length;
            if (tagMatchMode === 'all' && matched !== requiredTags.length) return false;
            if (tagMatchMode === 'any' && matched < 1) return false;
        }
        return true;
    });
}

function computeCompositeScore(candidate: WalletCandidate, window: GmgnWindow, args: any): number {
    const wProfit = toNumber(args.score_weight_profit) ?? 0.5;
    const wWinrate = toNumber(args.score_weight_winrate) ?? 0.3;
    const wActivity = toNumber(args.score_weight_activity) ?? 0.2;
    const profit = Math.max(0, getWindowMetric(candidate, 'realizedProfit', window) ?? 0);
    const winrate = Math.max(0, getWindowMetric(candidate, 'winrate', window) ?? 0);
    const activity = Math.max(0, getWindowMetric(candidate, 'txs', window) ?? 0);

    const profitScore = Math.log10(1 + profit);
    const winrateScore = winrate * 100;
    const activityScore = Math.log10(1 + activity) * 10;
    return profitScore * wProfit + winrateScore * wWinrate + activityScore * wActivity;
}

function sortWallets(candidates: WalletCandidate[], args: any, window: GmgnWindow): WalletCandidate[] {
    const scoreMode = normalizeScoreMode(args.score_mode);
    if (scoreMode === 'none') return candidates;
    return [...candidates]
        .map((c) => ({ c, score: computeCompositeScore(c, window, args) }))
        .sort((a, b) => b.score - a.score)
        .map(({ c }) => c);
}

async function fetchGmgnRank(args: any) {
    const chain = normalizeChain(args.chain);
    const window = normalizeWindow(args.window);
    const tag = String(args.tag || 'snipe_bot');
    const orderby = String(args.orderby || `pnl_${window}`);
    const direction = normalizeDirection(args.direction);
    const timeoutMs = clampInt(args.timeout_ms, 2000, 45000, 15000);
    const cookie = typeof args.cookie === 'string' ? args.cookie.trim() : '';

    return fetchGmgnRankWithFallback({
        chain,
        window,
        tag,
        orderby,
        direction,
        timeoutMs,
        ...(cookie ? { cookie } : {})
    });
}

export const GetGmgnSmartWalletsTool: Tool = {
    definition: {
        name: 'gmgn_get_smart_wallets',
        description: 'Fetch smart wallets from GMGN ranking API with parameterized filtering and scoring. Supports chain: base/eth/bsc/sol and window: 1d/7d/30d.',
        parameters: {
            type: 'object',
            properties: {
                chain: { type: 'string', description: 'Target chain: base | eth | bsc | sol. Default base.' },
                window: { type: 'string', description: 'Ranking window: 1d | 7d | 30d. Default 7d.' },
                tag: { type: 'string', description: 'GMGN tag, e.g. snipe_bot, sandwich_bot. Default snipe_bot.' },
                orderby: { type: 'string', description: 'Order key (e.g. pnl_7d, realized_profit_7d, txs_7d). Default matches selected window.' },
                direction: { type: 'string', description: 'Sort direction: desc or asc. Default desc.' },
                limit: { type: 'number', description: 'Final result count after filtering. Default 20, max 100.' },
                min_realized_profit: { type: 'number', description: 'Minimum realized profit under selected window.' },
                min_winrate: { type: 'number', description: 'Minimum winrate under selected window, range 0~1.' },
                min_balance: { type: 'number', description: 'Minimum wallet balance (chain native unit).' },
                min_buy_count: { type: 'number', description: 'Minimum buy count under selected window.' },
                min_sell_count: { type: 'number', description: 'Minimum sell count under selected window.' },
                min_txs_count: { type: 'number', description: 'Minimum tx count under selected window.' },
                required_tags: { type: 'array', items: { type: 'string' }, description: 'Wallet tags required for keep. Example: [\"snipe_bot\",\"sandwich_bot\"].' },
                tag_match_mode: { type: 'string', description: 'Tag filter mode: any | all. Default any.' },
                score_mode: { type: 'string', description: 'Sorting mode after filtering: composite | none. Default composite.' },
                score_weight_profit: { type: 'number', description: 'Composite score weight for realized profit. Default 0.5.' },
                score_weight_winrate: { type: 'number', description: 'Composite score weight for winrate. Default 0.3.' },
                score_weight_activity: { type: 'number', description: 'Composite score weight for tx activity. Default 0.2.' },
                include_raw: { type: 'boolean', description: 'Return raw GMGN row payload for each wallet. Default false.' },
                timeout_ms: { type: 'number', description: 'HTTP timeout. Default 15000.' },
                cookie: { type: 'string', description: 'Optional cookie header if GMGN challenges anonymous requests.' }
            }
        }
    },
    handler: async (args: any) => {
        try {
            const chain = normalizeChain(args.chain);
            const window = normalizeWindow(args.window);
            const includeRaw = Boolean(args.include_raw);
            const limit = clampInt(args.limit, 1, 100, 20);

            const fetchResult = await fetchGmgnRank(args);
            const { url, rows } = fetchResult;
            const mapped = rows
                .map((r) => toWalletCandidate((r || {}) as Record<string, unknown>, chain, includeRaw))
                .filter((r): r is WalletCandidate => Boolean(r));
            const filtered = applyWalletFilters(mapped, args, window);
            const ranked = sortWallets(filtered, args, window);
            const selected = ranked.slice(0, limit);

            return {
                source: 'gmgn',
                endpoint: url,
                route: fetchResult.route,
                fallbackUsed: fetchResult.fallbackUsed,
                latencyMs: fetchResult.latencyMs,
                attempts: fetchResult.attempts,
                chain,
                window,
                totalRows: rows.length,
                validWalletRows: mapped.length,
                filteredRows: filtered.length,
                returnedRows: selected.length,
                appliedFilters: {
                    min_realized_profit: toNumber(args.min_realized_profit),
                    min_winrate: toNumber(args.min_winrate),
                    min_balance: toNumber(args.min_balance),
                    min_buy_count: toNumber(args.min_buy_count),
                    min_sell_count: toNumber(args.min_sell_count),
                    min_txs_count: toNumber(args.min_txs_count),
                    required_tags: Array.isArray(args.required_tags) ? args.required_tags : [],
                    tag_match_mode: normalizeTagMatchMode(args.tag_match_mode),
                    score_mode: normalizeScoreMode(args.score_mode)
                },
                supportedChains: SUPPORTED_CHAINS,
                candidates: selected
            };
        } catch (error: any) {
            return {
                error: String(error?.message || error || 'gmgn_fetch_failed'),
                attempts: Array.isArray(error?.attempts) ? error.attempts : [],
                hint: 'GMGN anonymous HTTP may be challenged. The tool now falls back to browser mode automatically; if both fail, inspect attempts.reasonCode.'
            };
        }
    }
};

export const FilterGmgnWalletCandidatesTool: Tool = {
    definition: {
        name: 'gmgn_filter_wallet_candidates',
        description: 'Filter and score wallet candidates (from gmgn_get_smart_wallets or external dataset) with deterministic rules.',
        parameters: {
            type: 'object',
            properties: {
                chain: { type: 'string', description: 'base | eth | bsc | sol. Used for address normalization.' },
                window: { type: 'string', description: '1d | 7d | 30d. Selects metric horizon for filtering/scoring.' },
                candidates: {
                    type: 'array',
                    description: 'Wallet candidate rows. Can be raw GMGN rows or normalized rows with walletAddress/address.',
                    items: { type: 'object' }
                },
                limit: { type: 'number', description: 'Final output count. Default 20, max 100.' },
                min_realized_profit: { type: 'number', description: 'Minimum realized profit under selected window.' },
                min_winrate: { type: 'number', description: 'Minimum winrate under selected window (0~1).' },
                min_balance: { type: 'number', description: 'Minimum balance.' },
                min_buy_count: { type: 'number', description: 'Minimum buy count under selected window.' },
                min_sell_count: { type: 'number', description: 'Minimum sell count under selected window.' },
                min_txs_count: { type: 'number', description: 'Minimum tx count under selected window.' },
                required_tags: { type: 'array', items: { type: 'string' }, description: 'Tags required to keep wallet.' },
                tag_match_mode: { type: 'string', description: 'any | all. Default any.' },
                score_mode: { type: 'string', description: 'composite | none. Default composite.' },
                score_weight_profit: { type: 'number', description: 'Weight for profit in composite score.' },
                score_weight_winrate: { type: 'number', description: 'Weight for winrate in composite score.' },
                score_weight_activity: { type: 'number', description: 'Weight for tx activity in composite score.' },
                include_raw: { type: 'boolean', description: 'Keep original payload in raw field. Default false.' }
            },
            required: ['candidates']
        }
    },
    handler: async (args: any) => {
        const chain = normalizeChain(args.chain);
        const window = normalizeWindow(args.window);
        const includeRaw = Boolean(args.include_raw);
        const limit = clampInt(args.limit, 1, 100, 20);

        const rawCandidates = Array.isArray(args.candidates) ? args.candidates : [];
        const normalized = rawCandidates
            .map((row: any) => {
                if (row && typeof row === 'object' && typeof row.walletAddress === 'string') {
                    const normalizedAddress = normalizeWalletAddress(row.walletAddress, chain);
                    if (!normalizedAddress) return null;
                    return {
                        ...row,
                        walletAddress: normalizedAddress,
                        chain,
                        tags: Array.isArray(row.tags) ? row.tags : []
                    } as WalletCandidate;
                }
                return toWalletCandidate((row || {}) as Record<string, unknown>, chain, includeRaw);
            })
            .filter((r: WalletCandidate | null): r is WalletCandidate => Boolean(r));

        const filtered = applyWalletFilters(normalized, args, window);
        const ranked = sortWallets(filtered, args, window).slice(0, limit);

        return {
            chain,
            window,
            inputRows: rawCandidates.length,
            validRows: normalized.length,
            filteredRows: filtered.length,
            returnedRows: ranked.length,
            candidates: ranked
        };
    }
};
