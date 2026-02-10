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

const CHAIN = 'solana';
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
    || source === 'derived_change_proxy'
    || source === 'rpc_stable_first_swap'
    || source === 'rpc_native_first_swap'
    || source === 'rpc_v4_initialize';
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

async function main() {
  await connectRedis();

  const rows = await prisma.trendingToken.findMany({
    where: { chain: CHAIN },
    orderBy: { rank: 'asc' },
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
    const baselineKey = `token:baseline:v1:${CHAIN}:${address}`;
    const retryKey = `token:baseline:retry:v1:${CHAIN}:${address}`;
    const metaKey = `token:meta:v1:${CHAIN}:${address}`;

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

    // 1) Drop legacy/unknown/fallback baselines (these are the main source of bad x1).
    if (!baselinePrice || baselinePrice <= 0 || !trustedSource(baselineSource)) {
      if (baselineRaw) {
        await delRedis(baselineKey);
        await delRedis(retryKey);
        baselineDropped++;
      }
      baselinePrice = null;
      baselineSource = '';
    }

    // 2) Rebuild a proxy baseline when we still have no trusted one.
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
          baselineDerived++;
        }
      }
    }

    // 3) Write/clear visible launchMultiple.
    if (current && current > 0 && baselinePrice && baselinePrice > 0) {
      const raw = current / baselinePrice;
      if (Number.isFinite(raw) && raw > 0) {
        // Keep existing product behavior: do not show below x1.
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

  console.log(JSON.stringify({
    chain: CHAIN,
    scanned,
    baselineDropped,
    baselineDerived,
    multipleUpdated,
    multipleRemoved,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[repair-solana-launch-multiples] failed:', error?.message || error);
    process.exit(1);
  });

