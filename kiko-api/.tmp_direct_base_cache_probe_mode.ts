import dotenv from 'dotenv';
dotenv.config({ path: '/Users/almurat/KiKo/.env' });
dotenv.config({ path: '/Users/almurat/KiKo/kiko-api/.env' });

process.env.SIMULATION_MODE = process.env.SIMULATION_MODE || 'true';
process.env.DIRECT_SWAP_REF_MODE = process.env.DIRECT_SWAP_REF_MODE || 'onchain-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';
import { PrismaClient } from '@prisma/client';
import { executeDirectSwap } from './src/services/dex/directSwap/orchestrator.ts';

const CHAIN_ID = 8453;
const ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const AMOUNT_IN = process.env.DIRECT_PROBE_AMOUNT_IN || '0.0005';
const CONCURRENCY = Number(process.env.DIRECT_PROBE_CONCURRENCY || '3');
const LIMIT = Number(process.env.DIRECT_PROBE_LIMIT || '79');
const MODE = (process.env.DIRECT_PROBE_MODE || 'normal') as 'safe' | 'normal' | 'turbo';
const WALLET = (process.env.DIRECT_PROBE_WALLET || '0xf199e2a67a3862a4d1178c697abb8e76ef7c681b').toLowerCase();

type Row = {
  token: string;
  symbol: string;
  rank: number | null;
  liquidity: string | null;
  startedAt: string;
  durationMs: number;
  success: boolean;
  provider: string;
  error: string;
};

async function main() {
  const prisma = new PrismaClient();
  const startedAt = Date.now();

  const tokens = await prisma.trendingToken.findMany({
    where: { chain: 'base' },
    orderBy: [{ rank: 'asc' }, { updatedAt: 'desc' }],
    take: LIMIT,
    select: { address: true, symbol: true, rank: true, liquidity: true }
  });

  const filtered = tokens.filter(t => /^0x[a-fA-F0-9]{40}$/.test(t.address));
  console.log(JSON.stringify({ phase: 'loaded_tokens', chainId: CHAIN_ID, mode: MODE, loaded: filtered.length, amountIn: AMOUNT_IN, concurrency: CONCURRENCY }));

  const limit = pLimit(CONCURRENCY);
  let cursor = 0;
  const rows: Row[] = await Promise.all(filtered.map((t) => limit(async () => {
    const idx = ++cursor;
    const t0 = Date.now();
    const startedIso = new Date(t0).toISOString();

    try {
      const result = await executeDirectSwap({
        userId: `direct-base-cache-probe-${MODE}`,
        accessToken: '',
        walletAddress: WALLET,
        tokenIn: ETH,
        tokenOut: t.address.toLowerCase(),
        amountIn: AMOUNT_IN,
        chainId: CHAIN_ID,
        slippageBps: 1500,
        executionMode: MODE
      });

      const row: Row = {
        token: t.address.toLowerCase(),
        symbol: t.symbol || 'UNKNOWN',
        rank: t.rank ?? null,
        liquidity: t.liquidity?.toString?.() ?? null,
        startedAt: startedIso,
        durationMs: Date.now() - t0,
        success: !!result.success,
        provider: String(result.provider || 'unknown'),
        error: result.success ? '' : String(result.error || 'unknown').slice(0, 300)
      };

      if (idx % 10 === 0 || !row.success) {
        console.log(JSON.stringify({ phase: 'progress', idx, total: filtered.length, mode: MODE, symbol: row.symbol, token: row.token, success: row.success, provider: row.provider, durationMs: row.durationMs, error: row.error || undefined }));
      }

      return row;
    } catch (e: any) {
      const row: Row = {
        token: t.address.toLowerCase(),
        symbol: t.symbol || 'UNKNOWN',
        rank: t.rank ?? null,
        liquidity: t.liquidity?.toString?.() ?? null,
        startedAt: startedIso,
        durationMs: Date.now() - t0,
        success: false,
        provider: 'failed',
        error: String(e?.message || e || 'unknown').slice(0, 300)
      };
      console.log(JSON.stringify({ phase: 'progress', idx, total: filtered.length, mode: MODE, symbol: row.symbol, token: row.token, success: false, provider: 'failed', durationMs: row.durationMs, error: row.error }));
      return row;
    }
  })));

  const successRows = rows.filter(r => r.success);
  const failRows = rows.filter(r => !r.success);
  const providerCounts = new Map<string, number>();
  const errorCounts = new Map<string, number>();
  for (const r of rows) {
    providerCounts.set(r.provider, (providerCounts.get(r.provider) || 0) + 1);
    if (!r.success) errorCounts.set(r.error || 'unknown', (errorCounts.get(r.error || 'unknown') || 0) + 1);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    chainId: CHAIN_ID,
    mode: MODE,
    amountIn: AMOUNT_IN,
    totals: {
      total: rows.length,
      success: successRows.length,
      failed: failRows.length,
      successRate: rows.length ? Number((successRows.length / rows.length).toFixed(4)) : 0,
      elapsedMs: Date.now() - startedAt
    },
    providerCounts: [...providerCounts.entries()].sort((a, b) => b[1] - a[1]),
    errorCounts: [...errorCounts.entries()].sort((a, b) => b[1] - a[1]),
    rows
  };

  const outPath = path.join(process.cwd(), 'data', `direct_base_cache_probe_${MODE}_afterfix_${Date.now()}.json`);
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify({ phase: 'done', outPath, totals: out.totals, providerCounts: out.providerCounts.slice(0, 8), errorTop: out.errorCounts.slice(0, 8) }));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
