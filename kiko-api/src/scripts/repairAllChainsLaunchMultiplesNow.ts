import prisma from '../db/prisma.js';
import { connectRedis, get as getRedis, set as setRedis, del as delRedis } from '../cache/redis.js';

type BaselinePayload = {
  baselinePrice?: number;
  baselineSource?: string;
  firstSeenAt?: number;
};

type MetaPayload = {
  creatorAddress?: string;
  creatorUrl?: string;
  creatorLabel?: string;
  launchMultiple?: number;
  updatedAt?: number;
};

const DEFAULT_CHAINS = ['eth', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon', 'solana'];

const BASELINE_TTL_SECONDS = Math.max(
  24 * 60 * 60,
  Number(process.env.TOKEN_BASELINE_CACHE_TTL_SECONDS || `${7 * 24 * 60 * 60}`)
);
const META_TTL_SECONDS = Math.max(
  60 * 60,
  Number(process.env.TOKEN_META_CACHE_TTL_SECONDS || `${6 * 60 * 60}`)
);

function asNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function trustedSource(source?: string): boolean {
  return source === 'solana_public_rpc'
    || source === 'gecko_launch_window'
    || source === 'dex_candles'
    || source === 'rpc_stable_first_swap'
    || source === 'rpc_native_first_swap'
    || source === 'rpc_v4_initialize';
}

function parseChains(): string[] {
  const idx = process.argv.findIndex((v) => v === '--chains');
  if (idx < 0 || !process.argv[idx + 1]) return DEFAULT_CHAINS;
  const raw = process.argv[idx + 1];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseLimit(): number | null {
  const idx = process.argv.findIndex((v) => v === '--limit');
  if (idx < 0 || !process.argv[idx + 1]) return null;
  const n = Number(process.argv[idx + 1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function derivePct(ageHours: number, c1h?: number | null, c6h?: number | null, c24h?: number | null): number | null {
  const v1 = asNum(c1h);
  const v6 = asNum(c6h);
  const v24 = asNum(c24h);
  if (Number.isFinite(ageHours) && ageHours <= 2 && v1 && v1 > 0) return v1;
  if (Number.isFinite(ageHours) && ageHours <= 8 && v6 && v6 > 0) return v6;
  if (v24 && v24 > 0) return v24;
  return null;
}

async function repairChain(chain: string, limit: number | null) {
  const rows = await prisma.trendingToken.findMany({
    where: { chain },
    orderBy: { rank: 'asc' },
    ...(limit ? { take: limit } : {}),
    select: {
      address: true,
      symbol: true,
      price: true,
      poolCreatedAt: true,
      priceChange1h: true,
      priceChange6h: true,
      priceChange24h: true,
    },
  });

  let scanned = 0;
  let baselineDropped = 0;
  let baselineDerived = 0;
  let multipleUpdated = 0;
  let multipleRemoved = 0;

  for (const row of rows) {
    scanned++;
    const address = String(row.address || '').toLowerCase();
    const current = asNum(row.price);
    const baselineKey = `token:baseline:v1:${chain}:${address}`;
    const retryKey = `token:baseline:retry:v1:${chain}:${address}`;
    const metaKey = `token:meta:v1:${chain}:${address}`;

    const [baselineRaw, metaRaw] = await Promise.all([
      getRedis(baselineKey),
      getRedis(metaKey),
    ]);

    let baseline: BaselinePayload | null = null;
    let meta: MetaPayload = {};
    try { baseline = baselineRaw ? JSON.parse(baselineRaw) : null; } catch { baseline = null; }
    try { meta = metaRaw ? JSON.parse(metaRaw) : {}; } catch { meta = {}; }

    let baselinePrice = asNum(baseline?.baselinePrice);
    let baselineSource = String(baseline?.baselineSource || '');

    if (!baselinePrice || baselinePrice <= 0 || !trustedSource(baselineSource)) {
      if (baselineRaw) {
        await delRedis(baselineKey);
        await delRedis(retryKey);
        await prisma.tokenLaunchBaseline.deleteMany({
          where: { chain, address },
        }).catch(() => undefined);
        baselineDropped++;
      }
      baselinePrice = null;
      baselineSource = '';
    }

    if (!baselinePrice || baselinePrice <= 0) {
      const createdMs = row.poolCreatedAt ? row.poolCreatedAt.getTime() : NaN;
      const ageHours = Number.isFinite(createdMs) ? Math.max(0, (Date.now() - createdMs) / (1000 * 60 * 60)) : Number.NaN;
      const pct = derivePct(ageHours, asNum(row.priceChange1h), asNum(row.priceChange6h), asNum(row.priceChange24h));
      if (current && current > 0 && pct && pct > 0) {
        const growth = 1 + pct / 100;
        const derived = current / growth;
        if (Number.isFinite(derived) && derived > 0) {
          baselinePrice = derived;
          baselineSource = 'derived_change_proxy';
          await setRedis(
            baselineKey,
            JSON.stringify({
              baselinePrice: derived,
              baselineSource,
              firstSeenAt: Date.now(),
            }),
            BASELINE_TTL_SECONDS
          );
          await prisma.tokenLaunchBaseline.upsert({
            where: { chain_address: { chain, address } },
            update: {
              baselinePrice: derived,
              baselineSource,
              status: 'verified',
              firstSeenAt: new Date(),
              lastCheckedAt: new Date(),
              lastError: null,
            },
            create: {
              chain,
              address,
              baselinePrice: derived,
              baselineSource,
              status: 'verified',
              firstSeenAt: new Date(),
              lastCheckedAt: new Date(),
            },
          }).catch(() => undefined);
          baselineDerived++;
        }
      }
    }

    if (current && current > 0 && baselinePrice && baselinePrice > 0) {
      const raw = current / baselinePrice;
      if (Number.isFinite(raw) && raw > 0) {
        const multiple = Math.max(1, raw);
        meta.launchMultiple = multiple;
        meta.updatedAt = Date.now();
        await setRedis(metaKey, JSON.stringify(meta), META_TTL_SECONDS);
        multipleUpdated++;
        continue;
      }
    }

    if (Number.isFinite(asNum(meta.launchMultiple) || NaN)) {
      delete meta.launchMultiple;
      meta.updatedAt = Date.now();
      await setRedis(metaKey, JSON.stringify(meta), META_TTL_SECONDS);
      multipleRemoved++;
    }
  }

  return {
    chain,
    scanned,
    baselineDropped,
    baselineDerived,
    multipleUpdated,
    multipleRemoved,
  };
}

async function main() {
  await connectRedis();
  const chains = parseChains();
  const limit = parseLimit();

  const results = [];
  for (const chain of chains) {
    const out = await repairChain(chain, limit);
    results.push(out);
  }

  console.log(JSON.stringify({
    chains,
    limit,
    results,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[repair-all-chains-launch-multiples] failed:', error?.message || error);
    process.exit(1);
  });
