import { DuneClient, ExecutionState } from '@duneanalytics/client-sdk';
import * as dotenv from 'dotenv';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { LogCode, LogRole } from '../config/logRegistry.js';
import { isQuoteToken, normalizeDuneChain } from './dunePnlCommon.js';

dotenv.config();

const DUNE_API_KEY = env.duneQueries?.apiKey || env.apiKeys.dune || process.env.DUNE_API_KEY || '';
const STATUS_POLL_INTERVAL_MS = 2_500;
const EXECUTE_TIMEOUT_MS = 20_000;
const STATUS_TIMEOUT_MS = 10_000;
const RESULTS_TIMEOUT_MS = 15_000;
const TOTAL_TIMEOUT_MS = 120_000;
const RESULTS_PAGE_SIZE = 1_000;
const RATE_LIMIT_RETRY_DELAY_MS = 5_000;

type BatchTokenRow = {
    wallet_address?: unknown;
    blockchain?: unknown;
    token_address?: unknown;
    token_symbol?: unknown;
    total_buy_usd?: unknown;
    total_sell_usd?: unknown;
    realized_pnl_usd?: unknown;
    profit_pct?: unknown;
};

type BatchPortfolioRow = BatchTokenRow;

export type BatchWalletTokenPnl = {
    walletAddress: string;
    chain: string;
    tokenAddress: string;
    tokenSymbol: string | null;
    days: number;
    totalBuyUsd: number;
    totalSellUsd: number;
    realizedPnlUsd: number;
    profitPct: number | null;
    coverage: 'batch_wallet_list_sql';
};

export type BatchWalletPortfolioAggregate = {
    walletAddress: string;
    chain: string;
    days: number;
    totalBuyUsd: number;
    totalSellUsd: number;
    realizedPnlUsd: number;
    profitPct: number | null;
    totalTrades: number;
    coverage: 'batch_wallet_list_sql';
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
            next_uri?: string | null;
            error?: { message?: string };
        }>;
    };
};

type BatchDeps = {
    apiKey: string;
    createClient: (apiKey: string) => ExecClient;
    sleep: (ms: number) => Promise<void>;
    now: () => number;
};

const defaultDeps: BatchDeps = {
    apiKey: DUNE_API_KEY,
    createClient: (apiKey) => new DuneClient(apiKey),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
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

function normalizeUsd(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeNullableNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function isDuneRateLimitError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || '');
    return message.includes('Status: 429') || message.toLowerCase().includes('too many requests');
}

function buildWalletValuesClause(addresses: string[]): string {
    return addresses
        .map((address) => {
            const normalized = normalizeWalletAddress(address);
            return `(${sqlQuote(normalized)}, from_hex(${sqlQuote(hexLiteral(normalized))}))`;
        })
        .join(',\n        ');
}

function buildBatchTokenPnlSql(addresses: string[], chain: string, days: number, tokenAddress: string): string {
    const duneChain = normalizeDuneChain(chain);
    const normalizedToken = normalizeWalletAddress(tokenAddress);
    const tokenVarbinary = `from_hex(${sqlQuote(hexLiteral(normalizedToken))})`;
    return `
WITH input_wallets(wallet_address, wallet_varbinary) AS (
    VALUES
        ${buildWalletValuesClause(addresses)}
),
buy_totals AS (
    SELECT
        t.wallet_address AS wallet_address,
        lower(${sqlQuote(normalizedToken)}) AS token_address,
        max(token_bought_symbol) AS token_symbol,
        sum(amount_usd) AS total_buy_usd
    FROM dex.trades
    INNER JOIN input_wallets t
      ON dex.trades.taker = t.wallet_varbinary
    WHERE lower(blockchain) = lower(${sqlQuote(duneChain)})
      AND block_time >= now() - INTERVAL '${days}' day
      AND token_bought_address = ${tokenVarbinary}
    GROUP BY 1, 2
),
sell_totals AS (
    SELECT
        t.wallet_address AS wallet_address,
        lower(${sqlQuote(normalizedToken)}) AS token_address,
        max(token_sold_symbol) AS token_symbol,
        sum(amount_usd) AS total_sell_usd
    FROM dex.trades
    INNER JOIN input_wallets t
      ON dex.trades.taker = t.wallet_varbinary
    WHERE lower(blockchain) = lower(${sqlQuote(duneChain)})
      AND block_time >= now() - INTERVAL '${days}' day
      AND token_sold_address = ${tokenVarbinary}
    GROUP BY 1, 2
)
SELECT
    w.wallet_address,
    lower(${sqlQuote(duneChain)}) AS blockchain,
    lower(${sqlQuote(normalizedToken)}) AS token_address,
    coalesce(b.token_symbol, s.token_symbol) AS token_symbol,
    coalesce(b.total_buy_usd, 0) AS total_buy_usd,
    coalesce(s.total_sell_usd, 0) AS total_sell_usd,
    coalesce(s.total_sell_usd, 0) - coalesce(b.total_buy_usd, 0) AS realized_pnl_usd,
    CASE
        WHEN coalesce(b.total_buy_usd, 0) > 0
            THEN (coalesce(s.total_sell_usd, 0) - coalesce(b.total_buy_usd, 0)) / b.total_buy_usd * 100
        ELSE NULL
    END AS profit_pct
FROM input_wallets w
LEFT JOIN buy_totals b
    ON w.wallet_address = b.wallet_address
LEFT JOIN sell_totals s
    ON w.wallet_address = s.wallet_address
ORDER BY realized_pnl_usd DESC, w.wallet_address ASC
`.trim();
}

function buildBatchPortfolioBreakdownSql(addresses: string[], chain: string, days: number): string {
    const duneChain = normalizeDuneChain(chain);
    return `
WITH input_wallets(wallet_address, wallet_varbinary) AS (
    VALUES
        ${buildWalletValuesClause(addresses)}
),
buy_totals AS (
    SELECT
        t.wallet_address AS wallet_address,
        concat('0x', lower(to_hex(token_bought_address))) AS token_address,
        max(token_bought_symbol) AS token_symbol,
        sum(amount_usd) AS total_buy_usd
    FROM dex.trades
    INNER JOIN input_wallets t
      ON dex.trades.taker = t.wallet_varbinary
    WHERE lower(blockchain) = lower(${sqlQuote(duneChain)})
      AND block_time >= now() - INTERVAL '${days}' day
    GROUP BY 1, 2
),
sell_totals AS (
    SELECT
        t.wallet_address AS wallet_address,
        concat('0x', lower(to_hex(token_sold_address))) AS token_address,
        max(token_sold_symbol) AS token_symbol,
        sum(amount_usd) AS total_sell_usd
    FROM dex.trades
    INNER JOIN input_wallets t
      ON dex.trades.taker = t.wallet_varbinary
    WHERE lower(blockchain) = lower(${sqlQuote(duneChain)})
      AND block_time >= now() - INTERVAL '${days}' day
    GROUP BY 1, 2
),
combined AS (
    SELECT
        coalesce(b.wallet_address, s.wallet_address) AS wallet_address,
        coalesce(b.token_address, s.token_address) AS token_address,
        coalesce(b.token_symbol, s.token_symbol) AS token_symbol,
        coalesce(b.total_buy_usd, 0) AS total_buy_usd,
        coalesce(s.total_sell_usd, 0) AS total_sell_usd,
        coalesce(s.total_sell_usd, 0) - coalesce(b.total_buy_usd, 0) AS realized_pnl_usd,
        CASE
            WHEN coalesce(b.total_buy_usd, 0) > 0
                THEN (coalesce(s.total_sell_usd, 0) - coalesce(b.total_buy_usd, 0)) / b.total_buy_usd * 100
            ELSE NULL
        END AS profit_pct
    FROM buy_totals b
    FULL OUTER JOIN sell_totals s
      ON b.wallet_address = s.wallet_address
     AND b.token_address = s.token_address
)
SELECT
    w.wallet_address,
    lower(${sqlQuote(duneChain)}) AS blockchain,
    c.token_address,
    c.token_symbol,
    c.total_buy_usd,
    c.total_sell_usd,
    c.realized_pnl_usd,
    c.profit_pct
FROM input_wallets w
LEFT JOIN combined c
    ON w.wallet_address = c.wallet_address
ORDER BY w.wallet_address ASC, abs(coalesce(c.realized_pnl_usd, 0)) DESC
`.trim();
}

async function waitForCompletion(client: ExecClient, executionId: string, deps: BatchDeps): Promise<void> {
    const deadline = deps.now() + TOTAL_TIMEOUT_MS;

    while (true) {
        let status: Awaited<ReturnType<ExecClient['exec']['getExecutionStatus']>>;
        try {
            status = await withTimeout(
                client.exec.getExecutionStatus(executionId),
                STATUS_TIMEOUT_MS,
                'Dune batch execution status'
            );
        } catch (error) {
            if (isDuneRateLimitError(error) && deps.now() < deadline) {
                logger.warn(LogCode.API_FETCH_FAILED, '[Dune Batch PNL] Status polling rate-limited; backing off', {
                    executionId,
                    retryDelayMs: RATE_LIMIT_RETRY_DELAY_MS,
                    role: LogRole.METRIC,
                });
                await deps.sleep(RATE_LIMIT_RETRY_DELAY_MS);
                continue;
            }
            throw error;
        }

        if (status.state === ExecutionState.COMPLETED) return;
        if (status.state === ExecutionState.FAILED || status.state === ExecutionState.CANCELLED || status.state === ExecutionState.EXPIRED) {
            throw new Error(status.error?.message || `Dune batch execution ended in state ${status.state}`);
        }
        if (deps.now() >= deadline) {
            throw new Error(`Dune batch execution exceeded ${TOTAL_TIMEOUT_MS}ms`);
        }

        await deps.sleep(STATUS_POLL_INTERVAL_MS);
    }
}

async function fetchAllRows(client: ExecClient, executionId: string): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    let offset = 0;

    while (true) {
        let response: Awaited<ReturnType<ExecClient['exec']['getExecutionResults']>>;
        try {
            response = await withTimeout(
                client.exec.getExecutionResults(executionId, {
                    limit: RESULTS_PAGE_SIZE,
                    offset,
                }),
                RESULTS_TIMEOUT_MS,
                'Dune batch execution results'
            );
        } catch (error) {
            if (isDuneRateLimitError(error)) {
                logger.warn(LogCode.API_FETCH_FAILED, '[Dune Batch PNL] Result fetch rate-limited; backing off', {
                    executionId,
                    offset,
                    retryDelayMs: RATE_LIMIT_RETRY_DELAY_MS,
                    role: LogRole.METRIC,
                });
                await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_DELAY_MS));
                continue;
            }
            throw error;
        }

        if (response.error?.message) {
            throw new Error(response.error.message);
        }

        const chunk = response.result?.rows || [];
        rows.push(...chunk);

        const totalRowCount = response.result?.metadata?.total_row_count ?? chunk.length;
        const nextOffset = typeof response.next_offset === 'number' ? response.next_offset : rows.length;
        const hasMore = chunk.length > 0 && nextOffset < totalRowCount;

        if (!hasMore) break;
        offset = nextOffset;
    }

    return rows;
}

async function executeBatchSql(sql: string, deps: BatchDeps = defaultDeps): Promise<Record<string, unknown>[]> {
    if (!deps.apiKey) {
        logger.error(LogCode.API_AUTH_FAILED, '[Dune Batch PNL] API key not configured', { role: LogRole.EVENT });
        throw new Error('Dune API key not configured');
    }

    const client = deps.createClient(deps.apiKey);
    const execution = await withTimeout(
        client.exec.executeSql({ sql }),
        EXECUTE_TIMEOUT_MS,
        'Dune batch executeSql'
    );

    await waitForCompletion(client, execution.execution_id, deps);
    return fetchAllRows(client, execution.execution_id);
}

export async function getBatchWalletTokenPnlFromDune(
    addresses: string[],
    chain: string,
    days: number,
    tokenAddress: string,
    deps: BatchDeps = defaultDeps
): Promise<BatchWalletTokenPnl[]> {
    const normalizedAddresses = addresses.map(normalizeWalletAddress);
    const duneChain = normalizeDuneChain(chain);
    const normalizedToken = normalizeWalletAddress(tokenAddress);
    const sql = buildBatchTokenPnlSql(normalizedAddresses, duneChain, days, normalizedToken);
    const rows = await executeBatchSql(sql, deps);

    const byWallet = new Map<string, BatchWalletTokenPnl>();
    for (const address of normalizedAddresses) {
        byWallet.set(address, {
            walletAddress: address,
            chain: duneChain,
            tokenAddress: normalizedToken,
            tokenSymbol: null,
            days,
            totalBuyUsd: 0,
            totalSellUsd: 0,
            realizedPnlUsd: 0,
            profitPct: null,
            coverage: 'batch_wallet_list_sql',
        });
    }

    for (const rawRow of rows as BatchTokenRow[]) {
        const walletAddress = normalizeWalletAddress(String(rawRow.wallet_address || ''));
        if (!walletAddress || !byWallet.has(walletAddress)) continue;

        byWallet.set(walletAddress, {
            walletAddress,
            chain: String(rawRow.blockchain || duneChain).toLowerCase(),
            tokenAddress: normalizeWalletAddress(String(rawRow.token_address || normalizedToken)),
            tokenSymbol: rawRow.token_symbol ? String(rawRow.token_symbol) : null,
            days,
            totalBuyUsd: normalizeUsd(rawRow.total_buy_usd),
            totalSellUsd: normalizeUsd(rawRow.total_sell_usd),
            realizedPnlUsd: normalizeUsd(rawRow.realized_pnl_usd),
            profitPct: normalizeNullableNumber(rawRow.profit_pct),
            coverage: 'batch_wallet_list_sql',
        });
    }

    return normalizedAddresses.map((address) => byWallet.get(address)!);
}

export async function getBatchWalletPortfolioPnlFromDune(
    addresses: string[],
    chain: string,
    days: number,
    deps: BatchDeps = defaultDeps
): Promise<BatchWalletPortfolioAggregate[]> {
    const normalizedAddresses = addresses.map(normalizeWalletAddress);
    const duneChain = normalizeDuneChain(chain);
    const sql = buildBatchPortfolioBreakdownSql(normalizedAddresses, duneChain, days);
    const rows = await executeBatchSql(sql, deps);

    const byWallet = new Map<string, BatchWalletPortfolioAggregate>();
    for (const address of normalizedAddresses) {
        byWallet.set(address, {
            walletAddress: address,
            chain: duneChain,
            days,
            totalBuyUsd: 0,
            totalSellUsd: 0,
            realizedPnlUsd: 0,
            profitPct: null,
            totalTrades: 0,
            coverage: 'batch_wallet_list_sql',
        });
    }

    for (const rawRow of rows as BatchPortfolioRow[]) {
        const walletAddress = normalizeWalletAddress(String(rawRow.wallet_address || ''));
        const tokenAddress = rawRow.token_address ? normalizeWalletAddress(String(rawRow.token_address)) : '';
        if (!walletAddress || !tokenAddress || !byWallet.has(walletAddress)) continue;
        if (isQuoteToken(rawRow.token_symbol ? String(rawRow.token_symbol) : undefined, tokenAddress, duneChain)) {
            continue;
        }

        const current = byWallet.get(walletAddress)!;
        const totalBuyUsd = current.totalBuyUsd + normalizeUsd(rawRow.total_buy_usd);
        const realizedPnlUsd = current.realizedPnlUsd + normalizeUsd(rawRow.realized_pnl_usd);

        byWallet.set(walletAddress, {
            walletAddress,
            chain: duneChain,
            days,
            totalBuyUsd,
            totalSellUsd: current.totalSellUsd + normalizeUsd(rawRow.total_sell_usd),
            realizedPnlUsd,
            profitPct: totalBuyUsd > 0 ? (realizedPnlUsd / totalBuyUsd) * 100 : null,
            totalTrades: current.totalTrades + 1,
            coverage: 'batch_wallet_list_sql',
        });
    }

    return normalizedAddresses.map((address) => byWallet.get(address)!);
}

export const __testOnlyDuneBatchPnl = {
    buildBatchTokenPnlSql,
    buildBatchPortfolioBreakdownSql,
    normalizeWalletAddress,
};
