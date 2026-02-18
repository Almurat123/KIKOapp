import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';
import { callGeckoTerminal } from '../config/unifiedApiService.js';
import { getTrendingTokens, TokenSearchResult } from '../services/geckoTerminal.js';
import { detectLaunchpadToken } from '../services/ai/launchpadDetector.js';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { executeDirectSwap, isDirectSwapSupported } from '../services/dex/directSwapService.js';
import { isNativeToken } from '../config/tokenRegistry.js';

type LaunchpadProvider = 'zora' | 'fourmeme' | 'flap' | 'pumpfun' | 'pumpswap' | 'bonkfun' | 'virtuals' | 'clanker' | 'paragraph' | 'doppler' | 'unknown';

interface TokenCandidate {
    address: string;
    symbol: string;
    name: string;
    poolAddress?: string;
    poolCreatedAt?: string;
    launchpadProvider: LaunchpadProvider;
}

interface TradeSample {
    tokenAddress: string;
    poolAddress: string;
    txHash: string;
    txFromAddress: string;
    kind: string;
    blockTimestamp?: string;
}

interface ReplayResult {
    txHash: string;
    tokenAddress: string;
    status: 'ok' | 'missing' | 'not_swap' | 'not_native_buy' | 'direct_failed';
    directAttempted: boolean;
    directSuccess: boolean;
    provider?: string;
    error?: string;
    durationMs: number;
    tokenIn?: string;
    tokenOut?: string;
    sourceDexName?: string;
    sourceRouter?: string;
}

const NETWORK = 'base';
const CHAIN_ID = 8453;
const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const TOKEN_LIMIT = Number(process.env.GECKO_TOKEN_LIMIT || '80');
const MIN_LIQUIDITY_USD = Number(process.env.GECKO_MIN_LIQUIDITY_USD || '1500');
const MAX_PAGES = Number(process.env.GECKO_MAX_PAGES || '8');
const MAX_BUY_TX_PER_TOKEN = Number(process.env.GECKO_MAX_BUY_TX_PER_TOKEN || '3');
const MAX_REPLAY_TX = Number(process.env.REPLAY_MAX_TX || '240');
const NEW_POOL_WINDOW_MINUTES = Number(process.env.NEW_POOL_WINDOW_MINUTES || '120');
const OUTPUT_PATH = process.env.OUTPUT_PATH
    || path.resolve(process.cwd(), '../test/base-launchpad-replay-report.json');

process.env.SIMULATION_MODE = process.env.SIMULATION_MODE || 'true';
process.env.DIRECT_SWAP_REF_MODE = process.env.DIRECT_SWAP_REF_MODE || 'onchain-only';

function nowIso(): string {
    return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTopPoolByToken(tokenAddress: string): Promise<string | null> {
    const endpoint = `/networks/${NETWORK}/tokens/${tokenAddress}/pools?include=base_token,quote_token`;
    const data = await callGeckoTerminal(endpoint);
    const first = (data as any)?.data?.[0];
    const addr = first?.attributes?.address || first?.id?.split('_')?.slice(1)?.join('_');
    return addr || null;
}

async function fetchPoolTrades(poolAddress: string): Promise<TradeSample[]> {
    const endpoint = `/networks/${NETWORK}/pools/${poolAddress}/trades`;
    const data = await callGeckoTerminal(endpoint);
    const rows = Array.isArray((data as any)?.data) ? (data as any).data : [];
    return rows.map((item: any) => ({
        tokenAddress: '',
        poolAddress,
        txHash: String(item?.attributes?.tx_hash || '').toLowerCase(),
        txFromAddress: String(item?.attributes?.tx_from_address || '').toLowerCase(),
        kind: String(item?.attributes?.kind || '').toLowerCase(),
        blockTimestamp: item?.attributes?.block_timestamp
    })).filter((row: TradeSample) => row.txHash.startsWith('0x'));
}

async function detectTokenLaunchpad(tokenAddress: string): Promise<LaunchpadProvider> {
    const detected = await detectLaunchpadToken(tokenAddress, CHAIN_ID);
    if (!detected?.provider) return 'unknown';
    return detected.provider;
}

function uniqueByAddress(tokens: TokenSearchResult[]): TokenSearchResult[] {
    const m = new Map<string, TokenSearchResult>();
    for (const t of tokens) {
        const key = t.address.toLowerCase();
        const existing = m.get(key);
        if (!existing) {
            m.set(key, t);
            continue;
        }
        const liqOld = Number(existing.liquidity || 0);
        const liqNew = Number(t.liquidity || 0);
        if (liqNew > liqOld) m.set(key, t);
    }
    return Array.from(m.values());
}

async function buildTokenUniverse(): Promise<TokenCandidate[]> {
    async function safeTrending(duration: '5m' | '1h' | '24h', limit: number, pages: number): Promise<TokenSearchResult[]> {
        for (let attempt = 1; attempt <= 3; attempt++) {
            const rows = await getTrendingTokens(NETWORK, limit, duration, MIN_LIQUIDITY_USD, pages);
            if (rows.length > 0) return rows;
            if (attempt < 3) {
                const waitMs = 65000;
                console.log(`[replay] trending ${duration} empty, retrying after ${waitMs}ms (attempt ${attempt}/3)`);
                await sleep(waitMs);
            }
        }
        return [];
    }

    const t5m = await safeTrending('5m', TOKEN_LIMIT, MAX_PAGES);
    await sleep(300);
    const t1h = await safeTrending('1h', TOKEN_LIMIT, Math.max(2, Math.floor(MAX_PAGES / 2)));
    await sleep(300);
    const t24h = await safeTrending('24h', Math.max(20, Math.floor(TOKEN_LIMIT / 2)), Math.max(2, Math.floor(MAX_PAGES / 2)));

    const merged = uniqueByAddress([...t5m, ...t1h, ...t24h]).slice(0, TOKEN_LIMIT);

    const out: TokenCandidate[] = [];
    for (const token of merged) {
        const provider = await detectTokenLaunchpad(token.address);
        out.push({
            address: token.address.toLowerCase(),
            symbol: token.symbol || '',
            name: token.name || '',
            poolAddress: token.poolAddress,
            poolCreatedAt: token.poolCreatedAt,
            launchpadProvider: provider
        });
        await sleep(40);
    }
    return out;
}

async function collectTradeSamples(tokens: TokenCandidate[]): Promise<TradeSample[]> {
    const all: TradeSample[] = [];
    for (const token of tokens) {
        const pool = token.poolAddress || await fetchTopPoolByToken(token.address);
        if (!pool) continue;
        try {
            const trades = await fetchPoolTrades(pool);
            const buyTrades = trades.filter((t) => t.kind === 'buy').slice(0, MAX_BUY_TX_PER_TOKEN);
            for (const trade of buyTrades) {
                all.push({
                    ...trade,
                    tokenAddress: token.address
                });
            }
        } catch {
            // ignore per-token trade fetch failure
        }
        await sleep(30);
    }

    const dedup = new Map<string, TradeSample>();
    for (const row of all) {
        if (!dedup.has(row.txHash)) dedup.set(row.txHash, row);
    }
    return Array.from(dedup.values()).slice(0, MAX_REPLAY_TX);
}

async function replayOne(sample: TradeSample): Promise<ReplayResult> {
    const start = Date.now();
    const [tx, receipt] = await Promise.all([
        fetchTransaction(sample.txHash, CHAIN_ID),
        fetchTransactionReceipt(sample.txHash, CHAIN_ID)
    ]);
    if (!tx || !receipt) {
        return {
            txHash: sample.txHash,
            tokenAddress: sample.tokenAddress,
            status: 'missing',
            directAttempted: false,
            directSuccess: false,
            durationMs: Date.now() - start
        };
    }

    const targetWallet = (sample.txFromAddress || tx.from || '').toLowerCase();
    const swap = await parseSwapTransaction(
        { hash: sample.txHash, from: tx.from, to: tx.to, input: tx.input, value: tx.value },
        { logs: receipt.logs, status: parseInt(receipt.status, 16) },
        CHAIN_ID,
        targetWallet
    );
    if (!swap) {
        return {
            txHash: sample.txHash,
            tokenAddress: sample.tokenAddress,
            status: 'not_swap',
            directAttempted: false,
            directSuccess: false,
            durationMs: Date.now() - start
        };
    }

    if (!isDirectSwapSupported(CHAIN_ID) || !isNativeToken(swap.tokenIn, CHAIN_ID)) {
        return {
            txHash: sample.txHash,
            tokenAddress: sample.tokenAddress,
            status: 'not_native_buy',
            directAttempted: false,
            directSuccess: false,
            durationMs: Date.now() - start,
            tokenIn: swap.tokenIn,
            tokenOut: swap.tokenOut,
            sourceDexName: swap.dexName || '',
            sourceRouter: swap.router || ''
        };
    }

    const amountIn = ethers.formatEther(BigInt(swap.amountIn));
    const direct = await executeDirectSwap({
        userId: 'gecko-launchpad-replay',
        accessToken: '',
        walletAddress: targetWallet || tx.from,
        tokenIn: swap.tokenIn || NATIVE,
        tokenOut: swap.tokenOut,
        amountIn,
        chainId: CHAIN_ID,
        slippageBps: 1500,
        hint: {
            sourceDexName: swap.dexName || undefined,
            sourceRouter: swap.router || undefined,
            sourceTxHash: sample.txHash
        }
    });

    return {
        txHash: sample.txHash,
        tokenAddress: sample.tokenAddress,
        status: direct.success ? 'ok' : 'direct_failed',
        directAttempted: true,
        directSuccess: direct.success,
        provider: direct.provider,
        error: direct.error,
        durationMs: Date.now() - start,
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        sourceDexName: swap.dexName || '',
        sourceRouter: swap.router || ''
    };
}

function buildSniperCandidates(tokens: TokenCandidate[]): TokenCandidate[] {
    const now = Date.now();
    const windowMs = NEW_POOL_WINDOW_MINUTES * 60 * 1000;
    const ranked = tokens
        .filter((t) => !!t.poolCreatedAt)
        .sort((a, b) => {
            const ta = new Date(String(a.poolCreatedAt)).getTime();
            const tb = new Date(String(b.poolCreatedAt)).getTime();
            return tb - ta;
        });

    const inWindow = ranked.filter((t) => {
        const ts = new Date(String(t.poolCreatedAt)).getTime();
        return Number.isFinite(ts) && now - ts <= windowMs;
    });

    if (inWindow.length > 0) return inWindow;
    return ranked.slice(0, Math.min(20, ranked.length));
}

async function main(): Promise<void> {
    const startedAt = Date.now();
    console.log(`[replay] start ${nowIso()}`);
    console.log(`[replay] config tokenLimit=${TOKEN_LIMIT} maxReplayTx=${MAX_REPLAY_TX} maxBuyTxPerToken=${MAX_BUY_TX_PER_TOKEN}`);

    const tokens = await buildTokenUniverse();
    console.log(`[replay] token universe size=${tokens.length}`);

    const byProvider = tokens.reduce<Record<string, number>>((acc, t) => {
        acc[t.launchpadProvider] = (acc[t.launchpadProvider] || 0) + 1;
        return acc;
    }, {});
    console.log(`[replay] launchpad distribution=${JSON.stringify(byProvider)}`);

    const tradeSamples = await collectTradeSamples(tokens);
    console.log(`[replay] collected trade samples=${tradeSamples.length}`);

    const replayResults: ReplayResult[] = [];
    for (const sample of tradeSamples) {
        try {
            const row = await replayOne(sample);
            replayResults.push(row);
            console.log(`[replay] tx=${sample.txHash.slice(0, 12)} status=${row.status} provider=${row.provider || 'n/a'} err=${row.error || ''}`);
        } catch (err: any) {
            replayResults.push({
                txHash: sample.txHash,
                tokenAddress: sample.tokenAddress,
                status: 'direct_failed',
                directAttempted: true,
                directSuccess: false,
                provider: 'failed',
                error: String(err?.message || err || 'unknown').slice(0, 180),
                durationMs: 0
            });
        }
    }

    const sniperCandidates = buildSniperCandidates(tokens);
    const summary = {
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: nowIso(),
        durationMs: Date.now() - startedAt,
        tokenCount: tokens.length,
        launchpadDistribution: byProvider,
        tradeSampleCount: tradeSamples.length,
        replayCount: replayResults.length,
        directAttempted: replayResults.filter((r) => r.directAttempted).length,
        directSuccess: replayResults.filter((r) => r.directSuccess).length,
        directFailed: replayResults.filter((r) => r.status === 'direct_failed').length,
        notSwap: replayResults.filter((r) => r.status === 'not_swap').length,
        notNativeBuy: replayResults.filter((r) => r.status === 'not_native_buy').length,
        missing: replayResults.filter((r) => r.status === 'missing').length,
        sniperCandidateCount: sniperCandidates.length,
    };

    const report = {
        summary,
        tokens,
        tradeSamples,
        replayResults,
        sniperCandidates: sniperCandidates.slice(0, 120)
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[replay] done report=${OUTPUT_PATH}`);
    console.log(`[replay] summary=${JSON.stringify(summary)}`);
}

main().catch((err) => {
    console.error(`[replay] failed ${String(err?.message || err)}`);
    process.exit(1);
});
