import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { ethers } from 'ethers';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import { executeDirectSwap, isDirectSwapSupported } from '../services/dex/directSwapService.js';
import { isNativeToken } from '../config/tokenRegistry.js';
import { getChainConfig } from '../config/chainConfig.js';
import { getTokenMetadata } from '../services/rpcService.js';

type Status = 'ok' | 'missing' | 'not_swap' | 'not_native_buy' | 'direct_failed';

interface InputSample {
    txHash: string;
    bucket: 'new' | 'old';
    tokenAddress: string;
}

interface Row {
    txHash: string;
    bucket: 'new' | 'old';
    status: Status;
    directAttempted: boolean;
    directSuccess: boolean;
    provider?: string;
    error?: string;
    failureDomain?: 'external' | 'liquidity' | 'rpc' | 'execution' | 'unknown';
    fetchMs: number;
    parseMs: number;
    directMs: number;
    totalMs: number;
}

function classifyFailureDomain(error?: string): Row['failureDomain'] {
    const msg = String(error || '').toLowerCase();
    if (!msg) return 'unknown';
    if (msg.includes('failed_external') || msg.includes('zora') || msg.includes('reference')) return 'external';
    if (msg.includes('pool_unavailable') || msg.includes('no suitable pool')) return 'liquidity';
    if (msg.includes('rate_limited') || msg.includes('429') || msg.includes('rpc')) return 'rpc';
    if (msg.includes('insufficient_funds') || msg.includes('invalid_amount') || msg.includes('revert') || msg.includes('failed_')) return 'execution';
    return 'unknown';
}

const CHAIN_ID = Number(process.env.CHAIN_ID || '8453');
const INPUT_PATH = process.env.INPUT_PATH || path.resolve(process.cwd(), '../test/base-samples-1000-mixed.json');
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.resolve(process.cwd(), '../test/direct-swap-efficiency-report.json');
const MAX_TX = Number(process.env.MAX_TX || '200');
const CONCURRENCY = Number(process.env.CONCURRENCY || '4');
const SLIPPAGE_BPS = Number(process.env.SLIPPAGE_BPS || '1500');
const BENCH_WALLET = (process.env.BENCH_WALLET || '').toLowerCase();
const tokenDecimalsCache = new Map<string, number>();

function isCashLikeToken(token: string, chainId: number): boolean {
    const normalized = String(token || '').trim().toLowerCase();
    if (!normalized) return false;
    if (isNativeToken(normalized, chainId)) return true;
    const cfg = getChainConfig(chainId);
    const cash = [cfg.wrappedNativeAddress, ...(cfg.stablecoins || [])]
        .map((x) => String(x || '').toLowerCase())
        .filter(Boolean);
    return cash.includes(normalized) || normalized === 'weth' || normalized === 'usdc' || normalized === 'usdt';
}

async function getTokenDecimals(token: string, chainId: number): Promise<number> {
    const normalized = String(token || '').toLowerCase();
    if (!normalized) return 18;
    if (isNativeToken(normalized, chainId)) return 18;
    const cached = tokenDecimalsCache.get(`${chainId}:${normalized}`);
    if (typeof cached === 'number') return cached;
    try {
        const meta = await getTokenMetadata(chainId, normalized);
        const decimals = Number.isFinite(meta?.decimals) ? Number(meta.decimals) : 18;
        tokenDecimalsCache.set(`${chainId}:${normalized}`, decimals);
        return decimals;
    } catch {
        tokenDecimalsCache.set(`${chainId}:${normalized}`, 18);
        return 18;
    }
}

process.env.SIMULATION_MODE = process.env.SIMULATION_MODE || 'true';
process.env.DIRECT_SWAP_REF_MODE = process.env.DIRECT_SWAP_REF_MODE || 'onchain-only';
process.env.COPYTRADE_PROFILE = process.env.COPYTRADE_PROFILE || 'false';

function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
}

function avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function summarize(rows: Row[]) {
    const attempted = rows.filter((r) => r.directAttempted);
    const success = attempted.filter((r) => r.directSuccess);
    const failed = attempted.filter((r) => !r.directSuccess);

    const totalAll = rows.map((r) => r.totalMs);
    const directOnly = attempted.map((r) => r.directMs).filter((n) => n > 0);
    const successOnly = success.map((r) => r.directMs).filter((n) => n > 0);

    const failReasons = new Map<string, number>();
    const failDomains = new Map<string, number>();
    for (const r of failed) {
        const key = r.error || 'unknown';
        failReasons.set(key, (failReasons.get(key) || 0) + 1);
        const domain = r.failureDomain || 'unknown';
        failDomains.set(domain, (failDomains.get(domain) || 0) + 1);
    }

    const providerMap = new Map<string, number>();
    for (const r of attempted) {
        const key = r.provider || 'unknown';
        providerMap.set(key, (providerMap.get(key) || 0) + 1);
    }

    return {
        total: rows.length,
        attempted: attempted.length,
        success: success.length,
        failed: failed.length,
        successRatePct: attempted.length > 0 ? Number(((success.length / attempted.length) * 100).toFixed(2)) : 0,
        statusBreakdown: {
            ok: rows.filter((r) => r.status === 'ok').length,
            missing: rows.filter((r) => r.status === 'missing').length,
            not_swap: rows.filter((r) => r.status === 'not_swap').length,
            not_native_buy: rows.filter((r) => r.status === 'not_native_buy').length,
            direct_failed: rows.filter((r) => r.status === 'direct_failed').length,
        },
        latencyMs: {
            all: {
                avg: Number(avg(totalAll).toFixed(2)),
                p50: percentile(totalAll, 50),
                p95: percentile(totalAll, 95),
            },
            direct: {
                avg: Number(avg(directOnly).toFixed(2)),
                p50: percentile(directOnly, 50),
                p95: percentile(directOnly, 95),
            },
            direct_success: {
                avg: Number(avg(successOnly).toFixed(2)),
                p50: percentile(successOnly, 50),
                p95: percentile(successOnly, 95),
            }
        },
        providerBreakdown: Array.from(providerMap.entries())
            .map(([provider, count]) => ({ provider, count }))
            .sort((a, b) => b.count - a.count),
        failReasons: Array.from(failReasons.entries())
            .map(([error, count]) => ({ error, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 12),
        failDomains: Array.from(failDomains.entries())
            .map(([domain, count]) => ({ domain, count }))
            .sort((a, b) => b.count - a.count),
    };
}

async function runOne(sample: InputSample): Promise<Row> {
    const t0 = performance.now();
    const [tx, receipt] = await Promise.all([
        fetchTransaction(sample.txHash, CHAIN_ID),
        fetchTransactionReceipt(sample.txHash, CHAIN_ID)
    ]);
    const t1 = performance.now();

    if (!tx || !receipt) {
        return {
            txHash: sample.txHash,
            bucket: sample.bucket,
            status: 'missing',
            directAttempted: false,
            directSuccess: false,
            fetchMs: Math.round(t1 - t0),
            parseMs: 0,
            directMs: 0,
            totalMs: Math.round(performance.now() - t0),
        };
    }

    const swap = await parseSwapTransaction(
        { hash: sample.txHash, from: tx.from, to: tx.to, input: tx.input, value: tx.value },
        { logs: receipt.logs, status: parseInt(receipt.status, 16) },
        CHAIN_ID,
        String(tx.from || '').toLowerCase()
    );
    const t2 = performance.now();

    if (!swap) {
        return {
            txHash: sample.txHash,
            bucket: sample.bucket,
            status: 'not_swap',
            directAttempted: false,
            directSuccess: false,
            fetchMs: Math.round(t1 - t0),
            parseMs: Math.round(t2 - t1),
            directMs: 0,
            totalMs: Math.round(performance.now() - t0),
        };
    }

    const isBuyDirection = isCashLikeToken(swap.tokenIn, CHAIN_ID) && !isCashLikeToken(swap.tokenOut, CHAIN_ID);
    const shouldDirect = isDirectSwapSupported(CHAIN_ID) && isBuyDirection;
    if (!shouldDirect) {
        return {
            txHash: sample.txHash,
            bucket: sample.bucket,
            status: 'not_native_buy',
            directAttempted: false,
            directSuccess: false,
            fetchMs: Math.round(t1 - t0),
            parseMs: Math.round(t2 - t1),
            directMs: 0,
            totalMs: Math.round(performance.now() - t0),
        };
    }

    const t3 = performance.now();
    const tokenInDecimals = await getTokenDecimals(swap.tokenIn, CHAIN_ID);
    const amountIn = ethers.formatUnits(BigInt(swap.amountIn), tokenInDecimals);
    const walletAddress = BENCH_WALLET || String(tx.from || '').toLowerCase();
    const direct = await executeDirectSwap({
        userId: 'efficiency-benchmark',
        accessToken: '',
        walletAddress,
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        amountIn,
        chainId: CHAIN_ID,
        slippageBps: SLIPPAGE_BPS,
        hint: {
            sourceDexName: swap.dexName || undefined,
            sourceRouter: swap.router || undefined,
            sourceTxHash: sample.txHash
        }
    });
    const t4 = performance.now();

    return {
        txHash: sample.txHash,
        bucket: sample.bucket,
        status: direct.success ? 'ok' : 'direct_failed',
        directAttempted: true,
        directSuccess: direct.success,
        provider: direct.provider,
        error: direct.error || '',
        failureDomain: classifyFailureDomain(direct.error),
        fetchMs: Math.round(t1 - t0),
        parseMs: Math.round(t2 - t1),
        directMs: Math.round(t4 - t3),
        totalMs: Math.round(t4 - t0),
    };
}

async function runConcurrent(samples: InputSample[], concurrency: number): Promise<Row[]> {
    const out: Row[] = [];
    let cursor = 0;

    async function worker(workerId: number) {
        while (cursor < samples.length) {
            const idx = cursor++;
            const sample = samples[idx];
            try {
                const row = await runOne(sample);
                out.push(row);
                if ((idx + 1) % 20 === 0) {
                    console.log(`[bench] progress ${idx + 1}/${samples.length} worker=${workerId} status=${row.status} direct=${row.directSuccess}`);
                }
            } catch (err: any) {
                out.push({
                    txHash: sample.txHash,
                    bucket: sample.bucket,
                    status: 'direct_failed',
                    directAttempted: true,
                    directSuccess: false,
                    provider: 'failed',
                    error: String(err?.message || err || 'unknown').slice(0, 180),
                    failureDomain: classifyFailureDomain(String(err?.message || err || 'unknown')),
                    fetchMs: 0,
                    parseMs: 0,
                    directMs: 0,
                    totalMs: 0,
                });
            }
        }
    }

    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, (_, i) => worker(i + 1)));
    return out;
}

async function main() {
    const startedAt = new Date().toISOString();
    const raw = fs.readFileSync(INPUT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const samples: InputSample[] = (Array.isArray(parsed?.samples) ? parsed.samples : [])
        .map((s: any) => ({
            txHash: String(s.txHash || '').toLowerCase(),
            bucket: s.bucket === 'old' ? 'old' : 'new',
            tokenAddress: String(s.tokenAddress || '').toLowerCase()
        }))
        .filter((s: InputSample) => s.txHash.startsWith('0x'))
        .slice(0, Math.max(1, MAX_TX));

    if (!samples.length) {
        throw new Error(`No valid samples found in ${INPUT_PATH}`);
    }

    console.log(`[bench] start chain=${CHAIN_ID} samples=${samples.length} concurrency=${CONCURRENCY}`);
    const t0 = performance.now();
    const rows = await runConcurrent(samples, CONCURRENCY);
    const elapsed = Math.round(performance.now() - t0);

    const summary = summarize(rows);
    const report = {
        startedAt,
        finishedAt: new Date().toISOString(),
        inputPath: INPUT_PATH,
        outputPath: OUTPUT_PATH,
        config: {
            chainId: CHAIN_ID,
            maxTx: MAX_TX,
            concurrency: CONCURRENCY,
            slippageBps: SLIPPAGE_BPS,
            simulationMode: process.env.SIMULATION_MODE
        },
        elapsedMs: elapsed,
        summary,
        rows
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[bench] done output=${OUTPUT_PATH}`);
    console.log(`[bench] summary=${JSON.stringify(summary)}`);
}

main().catch((err) => {
    console.error(`[bench] failed ${String(err?.message || err)}`);
    process.exit(1);
});
