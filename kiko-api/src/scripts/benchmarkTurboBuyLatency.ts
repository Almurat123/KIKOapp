/**
 * Benchmark direct-swap turbo buy latency (quote/discovery stages only, no tx send).
 *
 * Usage:
 *   npx tsx src/scripts/benchmarkTurboBuyLatency.ts \
 *     --chainId 8453 \
 *     --amountEth 0.0005 \
 *     --runs 3 \
 *     --token 0x775103214d73ed725fb7f11a866fd77aaa4b3ba3 \
 *     --token 0xE5dd257baB19CB8Cb6B3628C09B62465eF4b2B07
 */

import { performance } from 'node:perf_hooks';
import { ethers } from 'ethers';
import { findTokenPools } from '../services/dex/poolInfo.js';
import { findV4Pools } from '../services/dex/uniswapV4.js';
import {
  getV2ExpectedOutput,
  getV3BestQuoteOut,
  getV4BestPoolQuote,
  getAerodromeExpectedOutput
} from '../services/dex/directSwap/application/quoteEngines.js';

type TimedOk<T> = { label: string; ok: true; ms: number; value: T };
type TimedErr = { label: string; ok: false; ms: number; error: string };
type Timed<T> = TimedOk<T> | TimedErr;

const DEFAULT_CHAIN_ID = 8453;
const DEFAULT_RUNS = 3;
const DEFAULT_AMOUNT_ETH = '0.0005';
const DEFAULT_TOKEN_IN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const DEFAULT_WALLET = '0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b';

function parseArgs() {
  const args = process.argv.slice(2);
  const tokens: string[] = [];
  let chainId = DEFAULT_CHAIN_ID;
  let runs = DEFAULT_RUNS;
  let amountEth = DEFAULT_AMOUNT_ETH;
  let wallet = DEFAULT_WALLET;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--token' && args[i + 1]) {
      tokens.push(args[++i]);
      continue;
    }
    if (a === '--chainId' && args[i + 1]) {
      chainId = Number(args[++i]);
      continue;
    }
    if (a === '--runs' && args[i + 1]) {
      runs = Math.max(1, Number(args[++i]));
      continue;
    }
    if (a === '--amountEth' && args[i + 1]) {
      amountEth = args[++i];
      continue;
    }
    if (a === '--wallet' && args[i + 1]) {
      wallet = args[++i].toLowerCase();
      continue;
    }
  }

  if (tokens.length === 0) {
    throw new Error('Missing --token (can be repeated)');
  }
  return { chainId, tokens: tokens.map((t) => t.toLowerCase()), runs, amountEth, wallet };
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<Timed<T>> {
  const t0 = performance.now();
  try {
    const value = await fn();
    return { label, ok: true, ms: performance.now() - t0, value };
  } catch (e: any) {
    return { label, ok: false, ms: performance.now() - t0, error: String(e?.message || e || 'unknown') };
  }
}

async function runSingle(params: {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountInWei: bigint;
  wallet: string;
}) {
  const { chainId, tokenIn, tokenOut, amountInWei, wallet } = params;

  const steps: Timed<any>[] = [];
  steps.push(await timed('findTokenPools_fastScan', async () => {
    return await findTokenPools(tokenIn, tokenOut, chainId, { fastScan: true });
  }));
  steps.push(await timed('findV4Pools', async () => {
    return await findV4Pools(tokenIn, tokenOut, chainId, { strategy: 'fast' });
  }));
  steps.push(await timed('quote_v4_best', async () => {
    return await getV4BestPoolQuote(tokenIn, tokenOut, amountInWei, chainId, wallet);
  }));
  steps.push(await timed('quote_v3_best_uniswap', async () => {
    return await getV3BestQuoteOut(tokenIn, tokenOut, amountInWei, chainId, 'uniswap');
  }));
  steps.push(await timed('quote_aerodrome', async () => {
    return await getAerodromeExpectedOutput(tokenIn, tokenOut, amountInWei, chainId, 50, wallet);
  }));
  steps.push(await timed('quote_v2', async () => {
    return await getV2ExpectedOutput(tokenIn, tokenOut, amountInWei, chainId);
  }));

  const poolsFast = (steps.find((s) => s.label === 'findTokenPools_fastScan' && s.ok) as TimedOk<any[]> | undefined)?.value || [];
  const v4Pools = (steps.find((s) => s.label === 'findV4Pools' && s.ok) as TimedOk<any[]> | undefined)?.value || [];
  const v4Best = (steps.find((s) => s.label === 'quote_v4_best' && s.ok) as TimedOk<any> | undefined)?.value || { pool: null, amountOut: 0n };
  const v3Out = (steps.find((s) => s.label === 'quote_v3_best_uniswap' && s.ok) as TimedOk<bigint> | undefined)?.value || 0n;
  const aeroOut = (steps.find((s) => s.label === 'quote_aerodrome' && s.ok) as TimedOk<bigint> | undefined)?.value || 0n;
  const v2Out = (steps.find((s) => s.label === 'quote_v2' && s.ok) as TimedOk<bigint> | undefined)?.value || 0n;

  const byKind = poolsFast.reduce((acc: Record<string, number>, p: any) => {
    const key = `${String(p.version || 'unknown')}:${String(p.dex || '')}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const positiveRoutes = [
    { route: 'v4', amountOut: BigInt(v4Best?.amountOut || 0n) },
    { route: 'v3', amountOut: BigInt(v3Out || 0n) },
    { route: 'aerodrome', amountOut: BigInt(aeroOut || 0n) },
    { route: 'v2', amountOut: BigInt(v2Out || 0n) }
  ].filter((x) => x.amountOut > 0n).map((x) => ({ route: x.route, amountOut: x.amountOut.toString() }));

  return {
    poolDiscovery: {
      totalFastScan: poolsFast.length,
      byKind,
      v4DirectCount: v4Pools.length
    },
    quotes: {
      v4: BigInt(v4Best?.amountOut || 0n).toString(),
      v3: BigInt(v3Out || 0n).toString(),
      aerodrome: BigInt(aeroOut || 0n).toString(),
      v2: BigInt(v2Out || 0n).toString(),
      positiveRoutes
    },
    timingsMs: steps.map((s) => ({
      step: s.label,
      ok: s.ok,
      ms: Number(s.ms.toFixed(2)),
      error: s.ok ? null : s.error
    }))
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function main() {
  const { chainId, tokens, runs, amountEth, wallet } = parseArgs();
  const tokenIn = DEFAULT_TOKEN_IN;
  const amountInWei = ethers.parseEther(amountEth);
  const results: any[] = [];

  for (const tokenOut of tokens) {
    const runResults: any[] = [];
    for (let i = 0; i < runs; i++) {
      runResults.push(await runSingle({ chainId, tokenIn, tokenOut, amountInWei, wallet }));
    }
    const stepNames: string[] = runResults[0]?.timingsMs?.map((x: any) => x.step) || [];
    const medianTimingsMs: Record<string, number> = {};
    for (const step of stepNames) {
      const vals = runResults.map((r: any) => r.timingsMs.find((x: any) => x.step === step)?.ms).filter((x: any) => typeof x === 'number');
      medianTimingsMs[step] = Number(median(vals).toFixed(2));
    }

    results.push({
      tokenOut,
      runs: runResults,
      medianTimingsMs
    });
  }

  console.log(JSON.stringify({
    chainId,
    tokenIn,
    amountEth,
    amountInWei: amountInWei.toString(),
    runs,
    wallet,
    results
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

