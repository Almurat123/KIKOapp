import prisma from '../db/prisma.js';
import { connectRedis, get as getRedis, set as setRedis, del as delRedis } from '../cache/redis.js';

const META_TTL_SECONDS = Math.max(
  60 * 60,
  Number(process.env.TOKEN_META_CACHE_TTL_SECONDS || `${6 * 60 * 60}`)
);

function allowedMaxByAgeHours(ageHours: number): number {
  if (!Number.isFinite(ageHours) || ageHours < 0) return 2000;
  if (ageHours <= 1) return 30;
  if (ageHours <= 6) return 80;
  if (ageHours <= 24) return 250;
  return 2000;
}

async function main() {
  await connectRedis();

  const rows = await prisma.trendingToken.findMany({
    where: { chain: 'solana' },
    select: { address: true, poolCreatedAt: true },
  });

  let scanned = 0;
  let cleaned = 0;

  for (const row of rows) {
    const address = String(row.address || '').toLowerCase();
    if (!address) continue;
    scanned++;

    const metaKey = `token:meta:v1:solana:${address}`;
    const baselineKey = `token:baseline:v1:solana:${address}`;

    const [metaRaw, baselineRaw] = await Promise.all([getRedis(metaKey), getRedis(baselineKey)]);
    if (!metaRaw) continue;

    let meta: any;
    try {
      meta = JSON.parse(metaRaw);
    } catch {
      await delRedis(metaKey);
      cleaned++;
      continue;
    }

    const multiple = Number(meta?.launchMultiple || 0);
    if (!Number.isFinite(multiple) || multiple <= 0) continue;

    let baselineSource = '';
    if (baselineRaw) {
      try {
        baselineSource = String(JSON.parse(baselineRaw)?.baselineSource || '');
      } catch {
        baselineSource = '';
      }
    }

    const createdMs = row.poolCreatedAt ? row.poolCreatedAt.getTime() : NaN;
    const ageHours = Number.isFinite(createdMs) ? Math.max(0, (Date.now() - createdMs) / (1000 * 60 * 60)) : NaN;
    const allowed = allowedMaxByAgeHours(ageHours);

    const suspicious = !baselineRaw || baselineSource === 'first_seen_fallback' || multiple > allowed;
    if (!suspicious) continue;

    delete meta.launchMultiple;
    meta.updatedAt = Date.now();
    await setRedis(metaKey, JSON.stringify(meta), META_TTL_SECONDS);
    cleaned++;
  }

  console.log(`[clean-sol-multiples] scanned=${scanned} cleaned=${cleaned}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[clean-sol-multiples] failed', err?.message || err);
  process.exit(1);
});
