import fs from 'node:fs';
import path from 'node:path';
import { getTrendingTokens } from '../services/geckoTerminal.js';
import { getTrendingTokensByChain } from '../services/dexscreener.js';
import { callGeckoTerminal } from '../config/unifiedApiService.js';

type Bucket = 'new' | 'old';

interface PoolCandidate {
    tokenAddress: string;
    poolAddress: string;
    poolCreatedAt: string;
    sources: Set<'gecko' | 'dexscreener'>;
    symbol?: string;
    name?: string;
}

interface TradeSample {
    bucket: Bucket;
    txHash: string;
    tradeKind: string;
    blockTimestamp?: string;
    tokenAddress: string;
    poolAddress: string;
    poolCreatedAt: string;
    sourceApis: string[];
}

const NETWORK = 'base';
const TARGET_PER_BUCKET = Number(process.env.TARGET_PER_BUCKET || '500');
const TOKEN_LIMIT_PER_FEED = Number(process.env.TOKEN_LIMIT_PER_FEED || '350');
const MAX_PAGES = Number(process.env.MAX_PAGES || '12');
const MIN_LIQUIDITY_USD = Number(process.env.MIN_LIQUIDITY_USD || '1200');
const OUTPUT_PATH = process.env.OUTPUT_PATH
    || path.resolve(process.cwd(), '../test/base-samples-1000.json');

const WAIT_BETWEEN_POOL_MS = Number(process.env.WAIT_BETWEEN_POOL_MS || '120');
const ALCHEMY_BASE_URL = process.env.ALCHEMY_BASE_URL || 'https://base-mainnet.g.alchemy.com/v2';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function asIso(input: any): string | null {
    if (!input) return null;
    const d = new Date(String(input));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

async function geckoCallWithRetry(endpoint: string, retries = 6): Promise<any> {
    for (let i = 1; i <= retries; i++) {
        try {
            return await callGeckoTerminal(endpoint);
        } catch (err: any) {
            const msg = String(err?.message || err || '');
            const looksBackoff = msg.toLowerCase().includes('backoff') || msg.includes('429');
            if (i === retries) throw err;
            const waitMs = looksBackoff ? 65000 : 2000;
            console.log(`[samples] gecko retry ${i}/${retries} wait=${waitMs}ms endpoint=${endpoint}`);
            await sleep(waitMs);
        }
    }
    throw new Error('unreachable');
}

async function fetchPoolTrades(poolAddress: string, retries = 1): Promise<Array<{ txHash: string; kind: string; blockTimestamp?: string }>> {
    const endpoint = `/networks/${NETWORK}/pools/${poolAddress}/trades`;
    const data = await geckoCallWithRetry(endpoint, retries);
    const rows = Array.isArray((data as any)?.data) ? (data as any).data : [];
    return rows
        .map((item: any) => ({
            txHash: String(item?.attributes?.tx_hash || '').toLowerCase(),
            kind: String(item?.attributes?.kind || '').toLowerCase(),
            blockTimestamp: item?.attributes?.block_timestamp
        }))
        .filter((r: any) => r.txHash.startsWith('0x'));
}

async function fetchTokenTransfersFromAlchemy(tokenAddress: string, maxCount = 120): Promise<string[]> {
    if (!ALCHEMY_API_KEY) return [];
    try {
        const payload = {
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'alchemy_getAssetTransfers',
            params: [{
                fromBlock: '0x0',
                toBlock: 'latest',
                category: ['erc20'],
                contractAddresses: [tokenAddress],
                withMetadata: false,
                excludeZeroValue: true,
                maxCount: `0x${Math.max(1, Math.min(maxCount, 1000)).toString(16)}`,
                order: 'desc'
            }]
        };
        const response = await fetch(`${ALCHEMY_BASE_URL}/${ALCHEMY_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) return [];
        const json: any = await response.json();
        const transfers = Array.isArray(json?.result?.transfers) ? json.result.transfers : [];
        const dedup = new Set<string>();
        for (const item of transfers) {
            const hash = String(item?.hash || '').toLowerCase();
            if (hash.startsWith('0x')) dedup.add(hash);
        }
        return Array.from(dedup);
    } catch {
        return [];
    }
}

function mergeCandidates(rows: Array<{
    tokenAddress?: string;
    poolAddress?: string;
    poolCreatedAt?: string;
    symbol?: string;
    name?: string;
    source: 'gecko' | 'dexscreener';
}>): PoolCandidate[] {
    const m = new Map<string, PoolCandidate>();
    for (const row of rows) {
        const token = String(row.tokenAddress || '').toLowerCase();
        const pool = String(row.poolAddress || '').toLowerCase();
        const createdAt = asIso(row.poolCreatedAt);
        if (!token || !pool || !createdAt) continue;
        const key = `${pool}`;
        const existing = m.get(key);
        if (!existing) {
            m.set(key, {
                tokenAddress: token,
                poolAddress: pool,
                poolCreatedAt: createdAt,
                sources: new Set([row.source]),
                symbol: row.symbol,
                name: row.name
            });
            continue;
        }
        existing.sources.add(row.source);
        if (!existing.symbol && row.symbol) existing.symbol = row.symbol;
        if (!existing.name && row.name) existing.name = row.name;
        if (new Date(createdAt).getTime() > new Date(existing.poolCreatedAt).getTime()) {
            existing.poolCreatedAt = createdAt;
        }
    }
    return Array.from(m.values());
}

async function buildPoolUniverse(): Promise<PoolCandidate[]> {
    const geckoRetries = Number(process.env.GECKO_RETRIES || '1');
    async function safeGecko(duration: '5m' | '1h' | '24h', limit: number, pages: number): Promise<any[]> {
        for (let attempt = 1; attempt <= geckoRetries; attempt++) {
            const rows = await getTrendingTokens(NETWORK, limit, duration, MIN_LIQUIDITY_USD, pages);
            if (rows.length > 0) return rows;
            if (attempt < geckoRetries) {
                const waitMs = 65000;
                console.log(`[samples] gecko ${duration} empty, retry after ${waitMs}ms (${attempt}/${geckoRetries})`);
                await sleep(waitMs);
            }
        }
        return [];
    }

    console.log('[samples] fetching gecko feeds');
    let gecko5m = await safeGecko('5m', TOKEN_LIMIT_PER_FEED, MAX_PAGES);
    await sleep(300);
    let gecko1h = await safeGecko('1h', TOKEN_LIMIT_PER_FEED, Math.max(4, Math.floor(MAX_PAGES / 2)));
    await sleep(300);
    let gecko24h = await safeGecko('24h', Math.max(150, Math.floor(TOKEN_LIMIT_PER_FEED / 2)), Math.max(4, Math.floor(MAX_PAGES / 2)));

    if (gecko5m.length + gecko1h.length + gecko24h.length === 0) {
        const cachePath = path.resolve(process.cwd(), '../test/base-launchpad-replay-report.json');
        try {
            const raw = fs.readFileSync(cachePath, 'utf8');
            const parsed = JSON.parse(raw);
            const cachedTokens = Array.isArray(parsed?.tokens) ? parsed.tokens : [];
            gecko5m = cachedTokens;
            console.log(`[samples] gecko API unavailable; loaded cached gecko tokens from ${cachePath} count=${gecko5m.length}`);
        } catch {
            // no cache fallback available
        }
    }

    console.log('[samples] fetching dexscreener feeds');
    const dex5m = await getTrendingTokensByChain('base', TOKEN_LIMIT_PER_FEED, '5m');
    const dex1h = await getTrendingTokensByChain('base', TOKEN_LIMIT_PER_FEED, '1h');
    const dex24h = await getTrendingTokensByChain('base', Math.max(150, Math.floor(TOKEN_LIMIT_PER_FEED / 2)), '24h');

    const merged = mergeCandidates([
        ...gecko5m.map((t) => ({ tokenAddress: t.address, poolAddress: t.poolAddress, poolCreatedAt: t.poolCreatedAt, symbol: t.symbol, name: t.name, source: 'gecko' as const })),
        ...gecko1h.map((t) => ({ tokenAddress: t.address, poolAddress: t.poolAddress, poolCreatedAt: t.poolCreatedAt, symbol: t.symbol, name: t.name, source: 'gecko' as const })),
        ...gecko24h.map((t) => ({ tokenAddress: t.address, poolAddress: t.poolAddress, poolCreatedAt: t.poolCreatedAt, symbol: t.symbol, name: t.name, source: 'gecko' as const })),
        ...dex5m.map((t) => ({ tokenAddress: t.address, poolAddress: t.poolAddress, poolCreatedAt: t.poolCreatedAt, symbol: t.symbol, name: t.name, source: 'dexscreener' as const })),
        ...dex1h.map((t) => ({ tokenAddress: t.address, poolAddress: t.poolAddress, poolCreatedAt: t.poolCreatedAt, symbol: t.symbol, name: t.name, source: 'dexscreener' as const })),
        ...dex24h.map((t) => ({ tokenAddress: t.address, poolAddress: t.poolAddress, poolCreatedAt: t.poolCreatedAt, symbol: t.symbol, name: t.name, source: 'dexscreener' as const })),
    ]);

    return merged.filter((c) => c.poolAddress.startsWith('0x') && c.tokenAddress.startsWith('0x'));
}

function pickBucketPools(allPools: PoolCandidate[]): { newPools: PoolCandidate[]; oldPools: PoolCandidate[] } {
    const sortedByNew = [...allPools].sort((a, b) =>
        new Date(b.poolCreatedAt).getTime() - new Date(a.poolCreatedAt).getTime()
    );
    const sortedByOld = [...allPools].sort((a, b) =>
        new Date(a.poolCreatedAt).getTime() - new Date(b.poolCreatedAt).getTime()
    );

    const newPools = sortedByNew.slice(0, Math.min(350, sortedByNew.length));
    const oldPools = sortedByOld.slice(0, Math.min(350, sortedByOld.length));
    return { newPools, oldPools };
}

async function collectBucketSamples(
    pools: PoolCandidate[],
    bucket: Bucket,
    target: number,
    usedTx: Set<string>
): Promise<TradeSample[]> {
    const out: TradeSample[] = [];

    for (const pool of pools) {
        if (out.length >= target) break;
        try {
            const chosen: Array<{ txHash: string; kind: string; blockTimestamp?: string }> = [];
            try {
                const trades = await fetchPoolTrades(pool.poolAddress, 1);
                const buys = trades.filter((t) => t.kind === 'buy');
                const fallback = trades.filter((t) => t.kind !== 'buy');
                chosen.push(...(buys.length > 0 ? buys : fallback).slice(0, 80));
            } catch {
                // ignore gecko pool trade failure; fallback to Alchemy below
            }

            if (chosen.length < 25) {
                const alchemyTxs = await fetchTokenTransfersFromAlchemy(pool.tokenAddress, 140);
                for (const hash of alchemyTxs) {
                    chosen.push({ txHash: hash, kind: 'unknown' });
                }
            }

            for (const trade of chosen) {
                if (out.length >= target) break;
                if (usedTx.has(trade.txHash)) continue;
                usedTx.add(trade.txHash);
                out.push({
                    bucket,
                    txHash: trade.txHash,
                    tradeKind: trade.kind || 'unknown',
                    blockTimestamp: trade.blockTimestamp,
                    tokenAddress: pool.tokenAddress,
                    poolAddress: pool.poolAddress,
                    poolCreatedAt: pool.poolCreatedAt,
                    sourceApis: Array.from(pool.sources)
                });
            }
        } catch (err: any) {
            const msg = String(err?.message || err || '').slice(0, 120);
            console.log(`[samples] skip pool=${pool.poolAddress.slice(0, 12)} err=${msg}`);
        }
        await sleep(WAIT_BETWEEN_POOL_MS);
    }

    return out;
}

async function main(): Promise<void> {
    const startedAt = Date.now();
    console.log(`[samples] start target=${TARGET_PER_BUCKET * 2}`);

    const poolUniverse = await buildPoolUniverse();
    console.log(`[samples] pool universe=${poolUniverse.length}`);

    const { newPools, oldPools } = pickBucketPools(poolUniverse);
    console.log(`[samples] candidate pools new=${newPools.length} old=${oldPools.length}`);

    const usedTx = new Set<string>();
    const newSamples = await collectBucketSamples(newPools, 'new', TARGET_PER_BUCKET, usedTx);
    const oldSamples = await collectBucketSamples(oldPools, 'old', TARGET_PER_BUCKET, usedTx);

    const summary = {
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        poolUniverseCount: poolUniverse.length,
        newPoolCandidates: newPools.length,
        oldPoolCandidates: oldPools.length,
        newSamples: newSamples.length,
        oldSamples: oldSamples.length,
        totalSamples: newSamples.length + oldSamples.length,
        targetSamples: TARGET_PER_BUCKET * 2,
        reachedTarget: newSamples.length >= TARGET_PER_BUCKET && oldSamples.length >= TARGET_PER_BUCKET
    };

    const report = {
        summary,
        samples: [...newSamples, ...oldSamples]
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[samples] report=${OUTPUT_PATH}`);
    console.log(`[samples] summary=${JSON.stringify(summary)}`);
}

main().catch((err) => {
    console.error(`[samples] failed ${String(err?.message || err)}`);
    process.exit(1);
});
