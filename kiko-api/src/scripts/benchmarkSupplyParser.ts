import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';
import { parseSwapTransaction } from '../services/txDecoder.js';
import {
  parseSwapSupplyFromSourceTx,
  resolveHintedPoolFromSwapSupply
} from '../services/dex/directSwap/supplyParser.js';
import { getChainConfig } from '../config/chainConfig.js';

type Status = 'ok' | 'missing' | 'not_swap' | 'parser_miss';

interface InputSample {
  txHash: string;
  bucket: 'new' | 'old';
}

interface BenchRow {
  txHash: string;
  bucket: 'new' | 'old';
  status: Status;
  fetchMs: number;
  baselineParseMs: number;
  parserUncachedMs: number;
  parserCachedMs: number;
  resolverMs: number;
  parserHit: boolean;
  pairMatch: boolean;
  baselineHasHint: boolean;
  parserHasHint: boolean;
  hintKindMatch: boolean;
  hintPoolAddressMatch: boolean;
  resolverHit: boolean;
}

const CHAIN_ID = Number(process.env.CHAIN_ID || '8453');
const INPUT_PATH = process.env.INPUT_PATH || path.resolve(process.cwd(), '../test/base-samples-1000-mixed.json');
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.resolve(process.cwd(), '../test/supply-parser-benchmark-report.json');
const MAX_TX = Number(process.env.MAX_TX || '120');
const CONCURRENCY = Number(process.env.CONCURRENCY || '4');

const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function normalizeTokenForPair(token: string, chainId: number): string {
  const raw = String(token || '').toLowerCase();
  if (!raw) return raw;
  if (raw === NATIVE) return String(getChainConfig(chainId).wrappedNativeAddress || raw).toLowerCase();
  return raw;
}

function isSamePair(aIn: string, aOut: string, bIn: string, bOut: string, chainId: number): boolean {
  const xIn = normalizeTokenForPair(aIn, chainId);
  const xOut = normalizeTokenForPair(aOut, chainId);
  const yIn = normalizeTokenForPair(bIn, chainId);
  const yOut = normalizeTokenForPair(bOut, chainId);
  return (xIn === yIn && xOut === yOut) || (xIn === yOut && xOut === yIn);
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((acc, cur) => acc + cur, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(rows: BenchRow[]) {
  const baselineSwapRows = rows.filter((r) => r.status === 'ok' || r.status === 'parser_miss');
  const okRows = rows.filter((r) => r.status === 'ok');
  const parserHits = rows.filter((r) => r.parserHit);
  const baselineHints = rows.filter((r) => r.baselineHasHint);

  const uncached = okRows.map((r) => r.parserUncachedMs).filter((n) => n > 0);
  const cached = okRows.map((r) => r.parserCachedMs).filter((n) => n > 0);
  const resolver = okRows.map((r) => r.resolverMs).filter((n) => n > 0);

  return {
    total: rows.length,
    statusBreakdown: {
      ok: rows.filter((r) => r.status === 'ok').length,
      missing: rows.filter((r) => r.status === 'missing').length,
      not_swap: rows.filter((r) => r.status === 'not_swap').length,
      parser_miss: rows.filter((r) => r.status === 'parser_miss').length
    },
    quality: {
      parserHit: parserHits.length,
      parserHitRatePct: baselineSwapRows.length ? Number(((parserHits.length / baselineSwapRows.length) * 100).toFixed(2)) : 0,
      pairMatchRatePct: parserHits.length ? Number(((rows.filter((r) => r.pairMatch).length / parserHits.length) * 100).toFixed(2)) : 0,
      baselineHintCoveragePct: baselineSwapRows.length ? Number(((baselineHints.length / baselineSwapRows.length) * 100).toFixed(2)) : 0,
      parserHintCoveragePct: parserHits.length ? Number(((rows.filter((r) => r.parserHasHint).length / parserHits.length) * 100).toFixed(2)) : 0,
      hintKindMatchRatePct: baselineHints.length ? Number(((rows.filter((r) => r.hintKindMatch).length / baselineHints.length) * 100).toFixed(2)) : 0,
      hintPoolAddressMatchRatePct: baselineHints.length ? Number(((rows.filter((r) => r.hintPoolAddressMatch).length / baselineHints.length) * 100).toFixed(2)) : 0,
      resolverHitRatePct: parserHits.length ? Number(((rows.filter((r) => r.resolverHit).length / parserHits.length) * 100).toFixed(2)) : 0
    },
    latencyMs: {
      parser_uncached: {
        avg: Number(avg(uncached).toFixed(2)),
        p50: percentile(uncached, 50),
        p95: percentile(uncached, 95)
      },
      parser_cached: {
        avg: Number(avg(cached).toFixed(2)),
        p50: percentile(cached, 50),
        p95: percentile(cached, 95)
      },
      resolver: {
        avg: Number(avg(resolver).toFixed(2)),
        p50: percentile(resolver, 50),
        p95: percentile(resolver, 95)
      }
    },
    cacheSpeedupX: Number((avg(uncached) / Math.max(0.0001, avg(cached))).toFixed(2))
  };
}

async function runOne(sample: InputSample): Promise<BenchRow> {
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
      fetchMs: Number((t1 - t0).toFixed(3)),
      baselineParseMs: 0,
      parserUncachedMs: 0,
      parserCachedMs: 0,
      resolverMs: 0,
      parserHit: false,
      pairMatch: false,
      baselineHasHint: false,
      parserHasHint: false,
      hintKindMatch: false,
      hintPoolAddressMatch: false,
      resolverHit: false
    };
  }

  const baselineStart = performance.now();
  const baseline = await parseSwapTransaction(
    { hash: sample.txHash, from: tx.from, to: tx.to, input: tx.input, value: tx.value },
    { logs: receipt.logs, status: parseInt(receipt.status, 16) },
    CHAIN_ID,
    String(tx.from || '').toLowerCase()
  );
  const baselineParseMs = Number((performance.now() - baselineStart).toFixed(3));

  if (!baseline) {
    return {
      txHash: sample.txHash,
      bucket: sample.bucket,
      status: 'not_swap',
      fetchMs: Number((t1 - t0).toFixed(3)),
      baselineParseMs,
      parserUncachedMs: 0,
      parserCachedMs: 0,
      resolverMs: 0,
      parserHit: false,
      pairMatch: false,
      baselineHasHint: false,
      parserHasHint: false,
      hintKindMatch: false,
      hintPoolAddressMatch: false,
      resolverHit: false
    };
  }

  const parserUncachedStart = performance.now();
  const parsedUncached = await parseSwapSupplyFromSourceTx({
    chainId: CHAIN_ID,
    sourceTxHash: sample.txHash,
    tokenIn: baseline.tokenIn,
    tokenOut: baseline.tokenOut
  });
  const parserUncachedMs = Number((performance.now() - parserUncachedStart).toFixed(3));

  const parserCachedStart = performance.now();
  const parsedCached = await parseSwapSupplyFromSourceTx({
    chainId: CHAIN_ID,
    sourceTxHash: sample.txHash,
    tokenIn: baseline.tokenIn,
    tokenOut: baseline.tokenOut
  });
  const parserCachedMs = Number((performance.now() - parserCachedStart).toFixed(3));
  const parsed = parsedCached || parsedUncached;

  if (!parsed) {
    return {
      txHash: sample.txHash,
      bucket: sample.bucket,
      status: 'parser_miss',
      fetchMs: Number((t1 - t0).toFixed(3)),
      baselineParseMs,
      parserUncachedMs,
      parserCachedMs,
      resolverMs: 0,
      parserHit: false,
      pairMatch: false,
      baselineHasHint: Boolean(baseline.resolvedPoolHint),
      parserHasHint: false,
      hintKindMatch: false,
      hintPoolAddressMatch: false,
      resolverHit: false
    };
  }

  const resolverStart = performance.now();
  const resolved = await resolveHintedPoolFromSwapSupply({
    tokenIn: baseline.tokenIn,
    tokenOut: baseline.tokenOut,
    chainId: CHAIN_ID,
    hint: { sourceTxHash: sample.txHash }
  });
  const resolverMs = Number((performance.now() - resolverStart).toFixed(3));

  const baselineHint = baseline.resolvedPoolHint;
  const parserHint = parsed.resolvedPoolHint;
  const hintKindMatch = Boolean(
    baselineHint && parserHint && baselineHint.kind === parserHint.kind
  );
  const hintPoolAddressMatch = Boolean(
    baselineHint?.poolAddress
    && parserHint?.poolAddress
    && baselineHint.poolAddress.toLowerCase() === parserHint.poolAddress.toLowerCase()
  );

  return {
    txHash: sample.txHash,
    bucket: sample.bucket,
    status: 'ok',
    fetchMs: Number((t1 - t0).toFixed(3)),
    baselineParseMs,
    parserUncachedMs,
    parserCachedMs,
    resolverMs,
    parserHit: true,
    pairMatch: isSamePair(baseline.tokenIn, baseline.tokenOut, parsed.tokenIn, parsed.tokenOut, CHAIN_ID),
    baselineHasHint: Boolean(baselineHint),
    parserHasHint: Boolean(parserHint),
    hintKindMatch,
    hintPoolAddressMatch,
    resolverHit: Boolean(resolved)
  };
}

async function runConcurrent(samples: InputSample[], concurrency: number): Promise<BenchRow[]> {
  const out: BenchRow[] = [];
  let cursor = 0;

  async function worker(workerId: number) {
    while (cursor < samples.length) {
      const idx = cursor++;
      const sample = samples[idx];
      try {
        const row = await runOne(sample);
        out.push(row);
        if ((idx + 1) % 20 === 0) {
          console.log(`[parser-bench] progress ${idx + 1}/${samples.length} worker=${workerId} status=${row.status} parserHit=${row.parserHit}`);
        }
      } catch (err: any) {
        out.push({
          txHash: sample.txHash,
          bucket: sample.bucket,
          status: 'missing',
          fetchMs: 0,
          baselineParseMs: 0,
          parserUncachedMs: 0,
          parserCachedMs: 0,
          resolverMs: 0,
          parserHit: false,
          pairMatch: false,
          baselineHasHint: false,
          parserHasHint: false,
          hintKindMatch: false,
          hintPoolAddressMatch: false,
          resolverHit: false
        });
        console.log(`[parser-bench] error tx=${sample.txHash} worker=${workerId} err=${String(err?.message || err).slice(0, 180)}`);
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
  const dedup = new Set<string>();
  const samples: InputSample[] = (Array.isArray(parsed?.samples) ? parsed.samples : [])
    .map((s: any) => ({
      txHash: String(s.txHash || '').toLowerCase(),
      bucket: s.bucket === 'old' ? 'old' : 'new'
    }))
    .filter((s: InputSample) => /^0x[a-f0-9]{64}$/.test(s.txHash))
    .filter((s: InputSample) => (dedup.has(s.txHash) ? false : (dedup.add(s.txHash), true)))
    .slice(0, Math.max(1, MAX_TX));

  if (!samples.length) {
    throw new Error(`No valid samples found in ${INPUT_PATH}`);
  }

  console.log(`[parser-bench] start chain=${CHAIN_ID} samples=${samples.length} concurrency=${CONCURRENCY}`);
  const t0 = performance.now();
  const rows = await runConcurrent(samples, CONCURRENCY);
  const elapsedMs = Math.round(performance.now() - t0);
  const summary = summarize(rows);

  const report = {
    startedAt,
    endedAt: new Date().toISOString(),
    chainId: CHAIN_ID,
    inputPath: INPUT_PATH,
    samples: samples.length,
    concurrency: CONCURRENCY,
    elapsedMs,
    summary,
    rows
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(`[parser-bench] done output=${OUTPUT_PATH}`);
  console.log(`[parser-bench] summary=${JSON.stringify(summary)}`);
}

main().catch((err) => {
  console.error('[parser-bench] fatal', err);
  process.exit(1);
});
