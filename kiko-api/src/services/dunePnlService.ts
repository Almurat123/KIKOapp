/**
 * Dune PNL Service
 * Uses Dune dex.trades as an event source, then computes cost basis in code.
 */

import { DuneClient, ExecutionState } from '@duneanalytics/client-sdk';
import * as dotenv from 'dotenv';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { LogCode, LogRole } from '../config/logRegistry.js';
import { isQuoteToken, normalizeDuneChain } from './dunePnlCommon.js';

dotenv.config();

const DUNE_API_KEY = env.duneQueries?.apiKey || env.apiKeys.dune || process.env.DUNE_API_KEY || '';
const EXECUTE_TIMEOUT_MS = 20_000;
const STATUS_TIMEOUT_MS = 10_000;
const RESULTS_TIMEOUT_MS = 15_000;
const TOTAL_TIMEOUT_MS = 120_000;
const STATUS_POLL_INTERVAL_MS = 2_500;
const RESULTS_PAGE_SIZE = 1_000;
const DEFAULT_COST_BASIS_LOOKBACK_DAYS = Number(process.env.DUNE_PNL_COST_BASIS_LOOKBACK_DAYS || 365);

export interface DunePnlResult {
    tokenAddress: string;
    tokenSymbol?: string;
    boughtUsd: number;
    soldUsd: number;
    pnlUsd: number;
    profitPct: number | null;
    buyCount?: number;
    sellCount?: number;
    remainingAmount?: number;
    remainingCostUsd?: number;
    costBasisComplete?: boolean;
}

export interface DuneWalletPnlSummary {
    walletAddress: string;
    chain: string;
    totalRealizedPnlUsd: number;
    totalRealizedProfitUsd: number;
    totalRealizedLossUsd: number;
    tradingPnlUsd: number;
    tradingWinRate: number;
    totalBoughtUsd: number;
    totalSoldUsd: number;
    totalTrades: number;
    profitableTrades: number;
    winRate: number;
    tokens: DunePnlResult[];
    queryExecutionTimeMs: number;
}

type TradeEventRow = {
    blockchain?: unknown;
    block_time?: unknown;
    block_number?: unknown;
    tx_hash?: unknown;
    evt_index?: unknown;
    token_address?: unknown;
    token_symbol?: unknown;
    side?: unknown;
    token_amount?: unknown;
    amount_usd?: unknown;
    in_window?: unknown;
};

type TokenLot = {
    amount: number;
    costUsd: number;
};

type TokenLedger = {
    tokenAddress: string;
    tokenSymbol?: string;
    lots: TokenLot[];
    boughtUsd: number;
    soldUsd: number;
    pnlUsd: number;
    buyCount: number;
    sellCount: number;
    profitableSells: number;
    costBasisComplete: boolean;
};

type ExecClient = {
    exec: {
        executeSql: (params: { sql: string }) => Promise<{ execution_id: string; state: ExecutionState }>;
        getExecutionStatus: (executionId: string) => Promise<{
            state: ExecutionState;
            error?: { message?: string };
        }>;
        getExecutionResults: (executionId: string, params?: { limit?: number; offset?: number }) => Promise<{
            result?: {
                rows: Record<string, unknown>[];
                metadata?: { total_row_count?: number; row_count?: number };
            };
            next_offset?: number;
            error?: { message?: string };
        }>;
    };
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    }) as Promise<T>;
}

function normalizeWalletAddress(address: string): string {
    return String(address || '').trim().toLowerCase();
}

function sqlQuote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function hexLiteral(value: string): string {
    return value.replace(/^0x/i, '').toLowerCase();
}

function normalizeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return String(value || '').toLowerCase() === 'true';
}

function buildEmptySummary(walletAddress: string, chain: string, queryExecutionTimeMs: number): DuneWalletPnlSummary {
    return {
        walletAddress,
        chain,
        totalRealizedPnlUsd: 0,
        totalRealizedProfitUsd: 0,
        totalRealizedLossUsd: 0,
        tradingPnlUsd: 0,
        tradingWinRate: 0,
        totalBoughtUsd: 0,
        totalSoldUsd: 0,
        totalTrades: 0,
        profitableTrades: 0,
        winRate: 0,
        tokens: [],
        queryExecutionTimeMs,
    };
}

function buildWalletTradeEventsSql(walletAddress: string, chain: string, days: number, lookbackDays: number): string {
    const normalizedWallet = normalizeWalletAddress(walletAddress);
    const walletVarbinary = `from_hex(${sqlQuote(hexLiteral(normalizedWallet))})`;
    const duneChain = normalizeDuneChain(chain);
    const safeDays = Math.max(1, Math.trunc(days));
    const safeLookbackDays = Math.max(safeDays, Math.trunc(lookbackDays));

    return `
WITH window_legs AS (
    SELECT
        blockchain,
        block_time,
        block_month,
        block_number,
        tx_hash,
        evt_index,
        token_bought_address,
        token_bought_symbol,
        token_bought_amount,
        token_sold_address,
        token_sold_symbol,
        token_sold_amount,
        amount_usd
    FROM dex.trades
    WHERE lower(blockchain) = lower(${sqlQuote(duneChain)})
      AND block_month >= cast(date_trunc('month', now() - INTERVAL '${safeDays}' day) AS date)
      AND block_time >= now() - INTERVAL '${safeDays}' day
      AND block_time < now()
      AND amount_usd IS NOT NULL
      AND amount_usd > 0
      AND (
        tx_from = ${walletVarbinary}
        OR taker = ${walletVarbinary}
      )
),
tokens_needed AS (
    SELECT token_bought_address AS token_address
    FROM window_legs
    WHERE token_bought_address IS NOT NULL

    UNION

    SELECT token_sold_address AS token_address
    FROM window_legs
    WHERE token_sold_address IS NOT NULL
),
history_legs AS (
    SELECT
        blockchain,
        block_time,
        block_month,
        block_number,
        tx_hash,
        evt_index,
        token_bought_address,
        token_bought_symbol,
        token_bought_amount,
        token_sold_address,
        token_sold_symbol,
        token_sold_amount,
        amount_usd
    FROM dex.trades
    WHERE lower(blockchain) = lower(${sqlQuote(duneChain)})
      AND block_month >= cast(date_trunc('month', now() - INTERVAL '${safeLookbackDays}' day) AS date)
      AND block_time >= now() - INTERVAL '${safeLookbackDays}' day
      AND block_time < now() - INTERVAL '${safeDays}' day
      AND amount_usd IS NOT NULL
      AND amount_usd > 0
      AND (
        tx_from = ${walletVarbinary}
        OR taker = ${walletVarbinary}
      )
      AND (
        token_bought_address IN (SELECT token_address FROM tokens_needed)
        OR token_sold_address IN (SELECT token_address FROM tokens_needed)
      )
),
trade_legs AS (
    SELECT * FROM history_legs
    UNION ALL
    SELECT * FROM window_legs
),
events AS (
    SELECT
        blockchain,
        block_time,
        block_number,
        tx_hash,
        evt_index,
        concat('0x', lower(to_hex(token_bought_address))) AS token_address,
        token_bought_symbol AS token_symbol,
        'buy' AS side,
        token_bought_amount AS token_amount,
        amount_usd,
        block_time >= now() - INTERVAL '${safeDays}' day AS in_window
    FROM trade_legs
    WHERE token_bought_address IS NOT NULL
      AND token_bought_amount IS NOT NULL
      AND token_bought_amount > 0

    UNION ALL

    SELECT
        blockchain,
        block_time,
        block_number,
        tx_hash,
        evt_index,
        concat('0x', lower(to_hex(token_sold_address))) AS token_address,
        token_sold_symbol AS token_symbol,
        'sell' AS side,
        token_sold_amount AS token_amount,
        amount_usd,
        block_time >= now() - INTERVAL '${safeDays}' day AS in_window
    FROM trade_legs
    WHERE token_sold_address IS NOT NULL
      AND token_sold_amount IS NOT NULL
      AND token_sold_amount > 0
)
SELECT *
FROM events
ORDER BY token_address ASC, block_time ASC, block_number ASC, tx_hash ASC, evt_index ASC, side ASC
`.trim();
}

async function waitForExecution(client: ExecClient, executionId: string): Promise<void> {
    const deadline = Date.now() + TOTAL_TIMEOUT_MS;

    while (true) {
        const status = await withTimeout(
            client.exec.getExecutionStatus(executionId),
            STATUS_TIMEOUT_MS,
            'Dune PNL execution status'
        );

        if (status.state === ExecutionState.COMPLETED) return;
        if (status.state === ExecutionState.FAILED || status.state === ExecutionState.CANCELLED || status.state === ExecutionState.EXPIRED) {
            throw new Error(status.error?.message || `Dune PNL execution ended in state ${status.state}`);
        }
        if (Date.now() >= deadline) {
            throw new Error(`Dune PNL execution exceeded ${TOTAL_TIMEOUT_MS}ms`);
        }

        await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));
    }
}

async function executeSqlRows(sql: string): Promise<Record<string, unknown>[]> {
    const client = new DuneClient(DUNE_API_KEY) as ExecClient;
    const execution = await withTimeout(
        client.exec.executeSql({ sql }),
        EXECUTE_TIMEOUT_MS,
        'Dune PNL executeSql'
    );

    await waitForExecution(client, execution.execution_id);

    const rows: Record<string, unknown>[] = [];
    let offset = 0;

    while (true) {
        const response = await withTimeout(
            client.exec.getExecutionResults(execution.execution_id, {
                limit: RESULTS_PAGE_SIZE,
                offset,
            }),
            RESULTS_TIMEOUT_MS,
            'Dune PNL execution results'
        );

        if (response.error?.message) throw new Error(response.error.message);

        const chunk = response.result?.rows || [];
        rows.push(...chunk);

        const totalRowCount = response.result?.metadata?.total_row_count ?? chunk.length;
        const nextOffset = typeof response.next_offset === 'number' ? response.next_offset : rows.length;
        if (chunk.length === 0 || nextOffset >= totalRowCount) break;
        offset = nextOffset;
    }

    return rows;
}

function getOrCreateLedger(ledgers: Map<string, TokenLedger>, tokenAddress: string, tokenSymbol?: string): TokenLedger {
    const existing = ledgers.get(tokenAddress);
    if (existing) {
        if (!existing.tokenSymbol && tokenSymbol) existing.tokenSymbol = tokenSymbol;
        return existing;
    }

    const created: TokenLedger = {
        tokenAddress,
        tokenSymbol,
        lots: [],
        boughtUsd: 0,
        soldUsd: 0,
        pnlUsd: 0,
        buyCount: 0,
        sellCount: 0,
        profitableSells: 0,
        costBasisComplete: true,
    };
    ledgers.set(tokenAddress, created);
    return created;
}

function consumeLots(ledger: TokenLedger, sellAmount: number): { matchedCostUsd: number; complete: boolean } {
    let remaining = sellAmount;
    let matchedCostUsd = 0;

    while (remaining > 1e-12 && ledger.lots.length > 0) {
        const lot = ledger.lots[0];
        const matchedAmount = Math.min(lot.amount, remaining);
        const matchedCost = lot.amount > 0 ? lot.costUsd * (matchedAmount / lot.amount) : 0;

        matchedCostUsd += matchedCost;
        lot.amount -= matchedAmount;
        lot.costUsd -= matchedCost;
        remaining -= matchedAmount;

        if (lot.amount <= 1e-12 || lot.costUsd <= 1e-9) {
            ledger.lots.shift();
        }
    }

    return {
        matchedCostUsd,
        complete: remaining <= 1e-9,
    };
}

function buildSummaryFromTradeRows(
    walletAddress: string,
    chain: string,
    rows: TradeEventRow[],
    queryExecutionTimeMs: number
): DuneWalletPnlSummary {
    const ledgers = new Map<string, TokenLedger>();

    const sortedRows = [...rows].sort((a, b) => {
        const tokenCompare = String(a.token_address || '').localeCompare(String(b.token_address || ''));
        if (tokenCompare !== 0) return tokenCompare;
        const timeCompare = String(a.block_time || '').localeCompare(String(b.block_time || ''));
        if (timeCompare !== 0) return timeCompare;
        const blockCompare = normalizeNumber(a.block_number) - normalizeNumber(b.block_number);
        if (blockCompare !== 0) return blockCompare;
        const txCompare = String(a.tx_hash || '').localeCompare(String(b.tx_hash || ''));
        if (txCompare !== 0) return txCompare;
        const eventCompare = normalizeNumber(a.evt_index) - normalizeNumber(b.evt_index);
        if (eventCompare !== 0) return eventCompare;
        return String(a.side || '').localeCompare(String(b.side || ''));
    });

    for (const row of sortedRows) {
        const tokenAddress = normalizeWalletAddress(String(row.token_address || ''));
        if (!tokenAddress) continue;

        const amount = normalizeNumber(row.token_amount);
        const amountUsd = normalizeNumber(row.amount_usd);
        if (!(amount > 0) || !(amountUsd > 0)) continue;

        const tokenSymbol = row.token_symbol ? String(row.token_symbol) : undefined;
        const ledger = getOrCreateLedger(ledgers, tokenAddress, tokenSymbol);
        const inWindow = normalizeBoolean(row.in_window);
        const side = String(row.side || '').toLowerCase();

        if (side === 'buy') {
            ledger.lots.push({ amount, costUsd: amountUsd });
            if (inWindow) {
                ledger.boughtUsd += amountUsd;
                ledger.buyCount += 1;
            }
            continue;
        }

        if (side === 'sell') {
            const { matchedCostUsd, complete } = consumeLots(ledger, amount);
            if (!complete) ledger.costBasisComplete = false;

            if (inWindow) {
                const realizedPnl = amountUsd - matchedCostUsd;
                ledger.soldUsd += amountUsd;
                ledger.pnlUsd += realizedPnl;
                ledger.sellCount += 1;
                if (complete && realizedPnl > 0.01) ledger.profitableSells += 1;
            }
        }
    }

    const tokens: DunePnlResult[] = [];
    for (const ledger of ledgers.values()) {
        if (isQuoteToken(ledger.tokenSymbol, ledger.tokenAddress, chain)) continue;
        if (ledger.buyCount === 0 && ledger.sellCount === 0) continue;

        const remainingAmount = ledger.lots.reduce((sum, lot) => sum + lot.amount, 0);
        const remainingCostUsd = ledger.lots.reduce((sum, lot) => sum + lot.costUsd, 0);
        const profitPct = ledger.boughtUsd > 0 ? (ledger.pnlUsd / ledger.boughtUsd) * 100 : null;

        tokens.push({
            tokenAddress: ledger.tokenAddress,
            tokenSymbol: ledger.tokenSymbol,
            boughtUsd: ledger.boughtUsd,
            soldUsd: ledger.soldUsd,
            pnlUsd: ledger.costBasisComplete ? ledger.pnlUsd : 0,
            profitPct: ledger.costBasisComplete ? profitPct : null,
            buyCount: ledger.buyCount,
            sellCount: ledger.sellCount,
            remainingAmount,
            remainingCostUsd,
            costBasisComplete: ledger.costBasisComplete,
        });
    }

    const completeTokens = tokens.filter((token) => token.costBasisComplete !== false);
    const totalBought = completeTokens.reduce((sum, token) => sum + token.boughtUsd, 0);
    const totalSold = completeTokens.reduce((sum, token) => sum + token.soldUsd, 0);
    const totalPnl = completeTokens.reduce((sum, token) => sum + token.pnlUsd, 0);
    const totalProfit = completeTokens.reduce((sum, token) => sum + (token.pnlUsd > 0 ? token.pnlUsd : 0), 0);
    const totalLoss = completeTokens.reduce((sum, token) => sum + (token.pnlUsd < 0 ? token.pnlUsd : 0), 0);
    const totalTrades = completeTokens.reduce((sum, token) => sum + (token.sellCount || 0), 0);
    const profitableTrades = completeTokens.reduce((sum, token) => {
        const ledger = ledgers.get(token.tokenAddress);
        return sum + (ledger?.profitableSells || 0);
    }, 0);
    const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

    tokens.sort((a, b) => Math.abs(b.pnlUsd) - Math.abs(a.pnlUsd));

    return {
        walletAddress,
        chain,
        totalRealizedPnlUsd: totalPnl,
        totalRealizedProfitUsd: totalProfit,
        totalRealizedLossUsd: totalLoss,
        tradingPnlUsd: totalPnl,
        tradingWinRate: winRate,
        totalBoughtUsd: totalBought,
        totalSoldUsd: totalSold,
        totalTrades,
        profitableTrades,
        winRate,
        tokens: tokens.slice(0, 50),
        queryExecutionTimeMs,
    };
}

/**
 * Get wallet PNL from Dune (EVM chains only).
 *
 * Dune's dex.trades table is leg-level, not an accounting ledger. This function
 * therefore fetches normalized buy/sell token events and computes realized PNL
 * in application code using FIFO lots. If a sell exceeds the available lookback
 * cost basis, the token is marked costBasisComplete=false and excluded from the
 * aggregate realized PNL instead of reporting a fake profit.
 */
export async function getWalletPnlFromDune(
    walletAddress: string,
    chain: string = 'ethereum',
    days: number = 30
): Promise<DuneWalletPnlSummary | null> {
    if (!DUNE_API_KEY) {
        logger.error(LogCode.API_AUTH_FAILED, '[Dune PNL] API key not configured', { role: LogRole.EVENT });
        return null;
    }

    const duneChain = normalizeDuneChain(chain);

    logger.debug(LogCode.AI_API_CALL, '[Dune PNL] Fetching trade events for FIFO PNL', {
        wallet: walletAddress.slice(0, 10),
        chain: duneChain,
        days,
        role: LogRole.METRIC
    });
    const startTime = Date.now();

    try {
        const lookbackDays = Math.max(days, days + DEFAULT_COST_BASIS_LOOKBACK_DAYS);
        const sql = buildWalletTradeEventsSql(walletAddress, duneChain, days, lookbackDays);
        const rows = await executeSqlRows(sql) as TradeEventRow[];
        const executionTime = Date.now() - startTime;

        logger.debug(LogCode.API_FETCH_SUCCESS, '[Dune PNL] Trade event query completed', {
            durationMs: executionTime,
            rowCount: rows.length,
            costBasisLookbackDays: lookbackDays,
            role: LogRole.METRIC
        });

        if (rows.length === 0) {
            logger.info(LogCode.API_FETCH_SUCCESS, '[Dune PNL] No trades found for this wallet', { role: LogRole.METRIC });
            return buildEmptySummary(walletAddress, duneChain, executionTime);
        }

        const summary = buildSummaryFromTradeRows(walletAddress, duneChain, rows, executionTime);

        logger.info(LogCode.API_FETCH_SUCCESS, `[Dune PNL] Processed FIFO trade ledger. Net Trader PNL: $${summary.totalRealizedPnlUsd.toFixed(2)}`, {
            wallet: walletAddress,
            pnl: summary.totalRealizedPnlUsd,
            role: LogRole.METRIC
        });

        return summary;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, '[Dune PNL] Query failed', {
            error: error.message,
            role: LogRole.METRIC
        });
        return null;
    }
}

/**
 * Get wallet PNL across multiple EVM chains
 */
export async function getWalletPnlMultiChain(
    walletAddress: string,
    chains: string[] = ['ethereum', 'base', 'arbitrum', 'polygon'],
    days: number = 30
): Promise<Map<string, DuneWalletPnlSummary>> {
    const results = new Map<string, DuneWalletPnlSummary>();

    const promises = chains.map(async (chain) => {
        const summary = await getWalletPnlFromDune(walletAddress, chain, days);
        if (summary) {
            results.set(chain, summary);
        }
    });

    await Promise.all(promises);
    return results;
}

/**
 * Get combined PNL summary for a wallet across all EVM chains
 */
export async function getWalletPnlCombined(
    walletAddress: string,
    days: number = 30
): Promise<{
    totalPnlUsd: number;
    totalBoughtUsd: number;
    totalSoldUsd: number;
    overallWinRate: number;
    chains: Map<string, DuneWalletPnlSummary>;
}> {
    const chains = ['ethereum', 'base', 'bnb', 'arbitrum', 'polygon'];
    const chainResults = await getWalletPnlMultiChain(walletAddress, chains, days);

    let totalPnlUsd = 0;
    let totalBoughtUsd = 0;
    let totalSoldUsd = 0;
    let totalProfitable = 0;
    let totalTrades = 0;

    chainResults.forEach(summary => {
        totalPnlUsd += summary.totalRealizedPnlUsd;
        totalBoughtUsd += summary.totalBoughtUsd;
        totalSoldUsd += summary.totalSoldUsd;
        totalProfitable += summary.profitableTrades;
        totalTrades += summary.totalTrades;
    });

    return {
        totalPnlUsd,
        totalBoughtUsd,
        totalSoldUsd,
        overallWinRate: totalTrades > 0 ? (totalProfitable / totalTrades) * 100 : 0,
        chains: chainResults
    };
}

export const __testOnlyDunePnl = {
    buildWalletTradeEventsSql,
    buildSummaryFromTradeRows,
};
