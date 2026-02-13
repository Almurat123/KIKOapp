import fs from 'node:fs/promises';
import path from 'node:path';
import prisma from '../db/prisma.js';
import { probeTokenBaselineViaRpc } from '../jobs/tokenDataJob.js';

type Sample = {
  chain: string;
  launchpad: string;
  address: string;
  price: number;
  source: string;
  poolAddress?: string;
};

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

function median(values: number[]): number | null {
  return percentile(values, 0.5);
}

async function main(): Promise<void> {
  const perLaunchpad = Math.max(2, Number(process.env.LAUNCHPAD_CALIBRATION_SAMPLES || '4'));
  const perTokenTimeoutMs = Math.max(3000, Number(process.env.LAUNCHPAD_CALIBRATION_TIMEOUT_MS || '8000'));
  const concurrency = Math.max(1, Number(process.env.LAUNCHPAD_CALIBRATION_CONCURRENCY || '2'));
  const chains = ['eth', 'base', 'bsc', 'solana'];

  const rows = await prisma.trendingToken.findMany({
    where: {
      chain: { in: chains },
      launchpad: { not: null },
    },
    orderBy: [{ chain: 'asc' }, { rank: 'asc' }],
    select: {
      chain: true,
      launchpad: true,
      address: true,
      poolCreatedAt: true,
    },
    take: 800,
  });

  const byKey = new Map<string, typeof rows>();
  for (const row of rows) {
    const chain = String(row.chain || '').toLowerCase();
    const launchpad = String(row.launchpad || '').trim().toLowerCase();
    if (!chain || !launchpad) continue;
    const key = `${chain}:${launchpad}`;
    const arr = byKey.get(key) || [];
    if (arr.length < perLaunchpad) {
      arr.push(row);
      byKey.set(key, arr);
    }
  }

  const samples: Sample[] = [];
  const tasks: Array<() => Promise<void>> = [];
  for (const [key, selected] of byKey.entries()) {
    const [chain, launchpad] = key.split(':');
    for (const row of selected) {
      tasks.push(async () => {
        try {
          const out = await Promise.race([
            probeTokenBaselineViaRpc(chain, {
              address: row.address,
              launchpad,
              poolCreatedAt: row.poolCreatedAt ? row.poolCreatedAt.toISOString() : undefined,
            }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), perTokenTimeoutMs)),
          ]);
          if (!out || !Number.isFinite(out.price) || out.price <= 0) return;
          samples.push({
            chain,
            launchpad,
            address: row.address.toLowerCase(),
            price: Number(out.price),
            source: String(out.source || 'unknown'),
            poolAddress: out.poolAddress,
          });
        } catch {
          // best-effort probe only
        }
      });
    }
  }
  for (let i = 0; i < tasks.length; i += concurrency) {
    await Promise.all(tasks.slice(i, i + concurrency).map((run) => run()));
  }

  const grouped: Record<string, { count: number; median: number | null; p25: number | null; p75: number | null; min: number | null; max: number | null }> = {};
  for (const sample of samples) {
    const key = `${sample.chain}:${sample.launchpad}`;
    const arr = samples.filter((s) => `${s.chain}:${s.launchpad}` === key).map((s) => s.price);
    grouped[key] = {
      count: arr.length,
      median: median(arr),
      p25: percentile(arr, 0.25),
      p75: percentile(arr, 0.75),
      min: arr.length ? Math.min(...arr) : null,
      max: arr.length ? Math.max(...arr) : null,
    };
  }

  const outputPath = path.resolve(process.cwd(), 'data/launchpad-start-price-overrides.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        perLaunchpad,
        perTokenTimeoutMs,
        concurrency,
        summary: grouped,
        samples,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`[launchpad-calibration] wrote ${outputPath}`);
  console.log(`[launchpad-calibration] sampled=${samples.length} groups=${Object.keys(grouped).length}`);
}

main().catch((error) => {
  console.error('[launchpad-calibration] failed:', (error as Error)?.message || error);
  process.exit(1);
});
