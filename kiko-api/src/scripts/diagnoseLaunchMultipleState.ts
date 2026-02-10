import prisma from '../db/prisma.js';
import { connectRedis, get as getRedis, redis } from '../cache/redis.js';

type BaselineCache = {
  baselinePrice?: number;
  baselineSource?: string;
  firstSeenAt?: number;
};

type MetaCache = {
  launchMultiple?: number;
  updatedAt?: number;
};

function asNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pct(n: number, d: number): string {
  if (!d) return '0.00%';
  return `${((n / d) * 100).toFixed(2)}%`;
}

function parseArg(name: string, fallback: string): string {
  const idx = process.argv.findIndex((v) => v === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function keyBaseline(chain: string, address: string): string {
  return `token:baseline:v1:${chain}:${address.toLowerCase()}`;
}

function keyMeta(chain: string, address: string): string {
  return `token:meta:v1:${chain}:${address.toLowerCase()}`;
}

function readEnvBool(key: string, fallback: boolean): boolean {
  const raw = String(process.env[key] ?? fallback ? 'true' : 'false').toLowerCase();
  return raw === 'true';
}

async function main() {
  const chain = parseArg('chain', 'solana');
  const take = Math.max(20, Number(parseArg('limit', '200')));

  await connectRedis();

  const rows = await prisma.trendingToken.findMany({
    where: { chain },
    orderBy: { rank: 'asc' },
    take,
    select: {
      address: true,
      symbol: true,
      price: true,
      poolCreatedAt: true,
      updatedAt: true,
    },
  });

  const baselineSourceCount = new Map<string, number>();
  let baselineAny = 0;
  let baselineTrusted = 0;
  let baselineFirstSeen = 0;
  let metaWithMultiple = 0;
  let oneX = 0;
  let gt10 = 0;
  let gt50 = 0;
  let gt100 = 0;

  const missingSamples: Array<Record<string, unknown>> = [];
  const suspiciousSamples: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const address = row.address.toLowerCase();
    const [bRaw, mRaw] = await Promise.all([
      getRedis(keyBaseline(chain, address)),
      getRedis(keyMeta(chain, address)),
    ]);

    let b: BaselineCache | null = null;
    let m: MetaCache | null = null;
    try { b = bRaw ? JSON.parse(bRaw) : null; } catch { b = null; }
    try { m = mRaw ? JSON.parse(mRaw) : null; } catch { m = null; }

    const source = String(b?.baselineSource || '');
    const multiple = asNum(m?.launchMultiple);

    if (b && asNum(b.baselinePrice) && asNum(b.baselinePrice)! > 0) {
      baselineAny++;
      baselineSourceCount.set(source || 'unknown', (baselineSourceCount.get(source || 'unknown') || 0) + 1);
      if (source === 'first_seen_fallback') baselineFirstSeen++;
      else baselineTrusted++;
    }

    if (multiple && multiple > 0) {
      metaWithMultiple++;
      if (multiple >= 0.999 && multiple <= 1.001) oneX++;
      if (multiple >= 10) gt10++;
      if (multiple >= 50) gt50++;
      if (multiple >= 100) gt100++;
    } else if (missingSamples.length < 12) {
      missingSamples.push({
        symbol: row.symbol,
        address: row.address,
        hasBaseline: !!b,
        baselineSource: source || null,
        hasMeta: !!m,
      });
    }

    if (
      suspiciousSamples.length < 12 &&
      multiple &&
      multiple > 0 &&
      source === 'first_seen_fallback'
    ) {
      suspiciousSamples.push({
        symbol: row.symbol,
        address: row.address,
        multiple,
        source,
      });
    }
  }

  const sourceDist = Object.fromEntries(
    Array.from(baselineSourceCount.entries()).sort((a, b) => b[1] - a[1])
  );

  const addresses = rows.map((r) => r.address.toLowerCase());
  let dbVerifiedCount = 0;
  let dbAnyCount = 0;
  try {
    const dbRows = await prisma.tokenLaunchBaseline.findMany({
      where: {
        chain,
        address: { in: addresses },
      },
      select: {
        address: true,
        status: true,
        baselinePrice: true,
      },
    });
    dbAnyCount = dbRows.length;
    dbVerifiedCount = dbRows.filter((r) => r.status === 'verified' && Number(r.baselinePrice || 0) > 0).length;
  } catch {
    // ignore DB baseline stats
  }

  let redisStats: Record<string, unknown> | null = null;
  try {
    if (redis?.isOpen) {
      const keyCountApprox = await redis.dbSize();
      redisStats = { dbSize: keyCountApprox };
    }
  } catch {
    redisStats = null;
  }

  const envSnapshot = {
    NODE_ENV: process.env.NODE_ENV || 'unknown',
    LAUNCH_MULTIPLE_ENRICH_ENABLED: readEnvBool('LAUNCH_MULTIPLE_ENRICH_ENABLED', true),
    LAUNCH_MULTIPLE_BASELINE_ONLY: readEnvBool('LAUNCH_MULTIPLE_BASELINE_ONLY', true),
    LAUNCH_MULTIPLE_ALLOW_SYNTHETIC_BASELINE: readEnvBool('LAUNCH_MULTIPLE_ALLOW_SYNTHETIC_BASELINE', true),
    BASELINE_EXTERNAL_FETCH_BUDGET_PER_RUN: Number(process.env.BASELINE_EXTERNAL_FETCH_BUDGET_PER_RUN || '120'),
    SOL_RPC_SIGNATURE_PAGE_LIMIT: Number(process.env.SOL_RPC_SIGNATURE_PAGE_LIMIT || '250'),
    SOL_RPC_SIGNATURE_MAX_PAGES: Number(process.env.SOL_RPC_SIGNATURE_MAX_PAGES || '10'),
    SOL_RPC_MIN_QUOTE_USD: Number(process.env.SOL_RPC_MIN_QUOTE_USD || '25'),
    SOL_RPC_MIN_TARGET_AMOUNT: Number(process.env.SOL_RPC_MIN_TARGET_AMOUNT || '100'),
  };

  const now = new Date().toISOString();
  console.log(JSON.stringify({
    now,
    chain,
    scanned: rows.length,
    coverage: {
      baselineAny,
      baselineAnyPct: pct(baselineAny, rows.length),
      baselineTrusted,
      baselineTrustedPct: pct(baselineTrusted, rows.length),
      baselineFirstSeen,
      baselineFirstSeenPct: pct(baselineFirstSeen, rows.length),
      metaWithMultiple,
      metaWithMultiplePct: pct(metaWithMultiple, rows.length),
      dbBaselineRows: dbAnyCount,
      dbBaselineRowsPct: pct(dbAnyCount, rows.length),
      dbVerifiedRows: dbVerifiedCount,
      dbVerifiedRowsPct: pct(dbVerifiedCount, rows.length),
    },
    multipleDist: {
      oneX,
      oneXPctAmongVisible: pct(oneX, Math.max(metaWithMultiple, 1)),
      gte10x: gt10,
      gte50x: gt50,
      gte100x: gt100,
    },
    baselineSourceDistribution: sourceDist,
    suspiciousSamples,
    missingSamples,
    envSnapshot,
    redisStats,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[diagnose-launch-multiple] failed:', error?.message || error);
    process.exit(1);
  });
