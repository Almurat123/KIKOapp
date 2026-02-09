import prisma from '../db/prisma.js';
import { connectRedis, get as getRedis, set as setRedis } from '../cache/redis.js';

const BASELINE_TTL_SECONDS = Math.max(24 * 60 * 60, Number(process.env.TOKEN_BASELINE_CACHE_TTL_SECONDS || `${7 * 24 * 60 * 60}`));
const META_TTL_SECONDS = Math.max(60 * 60, Number(process.env.TOKEN_META_CACHE_TTL_SECONDS || `${6 * 60 * 60}`));

async function main(){
  await connectRedis();
  const rows = await prisma.trendingToken.findMany({
    where: { chain: 'solana' },
    select: {
      address: true,
      price: true,
      priceChange1h: true,
      priceChange6h: true,
      priceChange24h: true,
      poolCreatedAt: true,
    }
  });

  let touched = 0;
  for (const r of rows) {
    const address = String(r.address || '').toLowerCase();
    const current = Number(r.price || 0);
    if (!Number.isFinite(current) || current <= 0) continue;

    const bKey = `token:baseline:v1:solana:${address}`;
    const mKey = `token:meta:v1:solana:${address}`;

    const [bRaw, mRaw] = await Promise.all([getRedis(bKey), getRedis(mKey)]);
    const existingMul = (() => {
      try { const m = JSON.parse(mRaw || '{}'); return Number(m?.launchMultiple || 0); } catch { return 0; }
    })();
    if (Number.isFinite(existingMul) && existingMul > 0) continue;

    const createdMs = r.poolCreatedAt ? r.poolCreatedAt.getTime() : NaN;
    const ageHours = Number.isFinite(createdMs) ? Math.max(0, (Date.now() - createdMs) / (1000 * 60 * 60)) : NaN;

    const c1h = Number(r.priceChange1h || 0);
    const c6h = Number(r.priceChange6h || 0);
    const c24h = Number(r.priceChange24h || 0);

    let pct: number | null = null;
    if (Number.isFinite(ageHours) && ageHours <= 2 && Number.isFinite(c1h) && c1h > 0) pct = c1h;
    else if (Number.isFinite(ageHours) && ageHours <= 8 && Number.isFinite(c6h) && c6h > 0) pct = c6h;
    else if (Number.isFinite(c24h) && c24h > 0) pct = c24h;
    if (!Number.isFinite(pct || NaN) || (pct || 0) <= 0) continue;

    const growth = 1 + Number(pct) / 100;
    if (!Number.isFinite(growth) || growth <= 1) continue;

    const baselinePrice = current / growth;
    if (!Number.isFinite(baselinePrice) || baselinePrice <= 0) continue;

    const multiple = Math.max(1, current / baselinePrice);

    await setRedis(bKey, JSON.stringify({ baselinePrice, firstSeenAt: Date.now(), baselineSource: 'derived_change_proxy' }), BASELINE_TTL_SECONDS);

    let meta: any = {};
    try { meta = JSON.parse(mRaw || '{}'); } catch { meta = {}; }
    meta.launchMultiple = multiple;
    meta.updatedAt = Date.now();
    await setRedis(mKey, JSON.stringify(meta), META_TTL_SECONDS);
    touched++;
  }

  console.log(`[backfill-sol-derived] total=${rows.length} touched=${touched}`);
}

main().then(()=>process.exit(0)).catch((e)=>{console.error('[backfill-sol-derived] failed', e?.message || e); process.exit(1)});
