import prisma from '../db/prisma.js';
import pLimit from 'p-limit';
import { connectRedis, get as getRedis, set as setRedis } from '../cache/redis.js';
import { getTokenDetails as getDexTokenDetails, getCandlestickData as getDexCandlestickData } from '../services/dexscreener.js';
import { fetchJson } from '../config/unifiedApiService.js';

type Row = {
  chain: string;
  address: string;
  price: unknown;
  poolCreatedAt: Date | null;
};

const BASELINE_TTL_SECONDS = Math.max(
  24 * 60 * 60,
  Number(process.env.TOKEN_BASELINE_CACHE_TTL_SECONDS || `${7 * 24 * 60 * 60}`)
);
const META_TTL_SECONDS = Math.max(
  60 * 60,
  Number(process.env.TOKEN_META_CACHE_TTL_SECONDS || `${6 * 60 * 60}`)
);
const CONCURRENCY = Math.max(1, Number(process.env.BASELINE_BACKFILL_CONCURRENCY || '1'));
const FORCE_REFRESH = String(process.env.BASELINE_BACKFILL_FORCE_REFRESH || 'true').toLowerCase() === 'true';
const GECKO_MIN_INTERVAL_MS = Math.max(1500, Number(process.env.GECKO_CANDLE_MIN_INTERVAL_MS || '3500'));
const GECKO_BACKOFF_MS_ON_429 = Math.max(30_000, Number(process.env.GECKO_BACKOFF_MS_ON_429 || '90000'));

let geckoNextAt = 0;
let geckoBackoffUntil = 0;

function baselineKey(chain: string, address: string): string {
  return `token:baseline:v1:${chain}:${address.toLowerCase()}`;
}

function metaKey(chain: string, address: string): string {
  return `token:meta:v1:${chain}:${address.toLowerCase()}`;
}

function geckoNetwork(chain: string): string | null {
  if (chain === 'eth') return 'eth';
  if (chain === 'solana') return 'solana';
  if (chain === 'base') return 'base';
  if (chain === 'bsc') return 'bsc';
  if (chain === 'arbitrum') return 'arbitrum';
  if (chain === 'optimism') return 'optimism';
  if (chain === 'polygon') return 'polygon_pos';
  return null;
}

function safeNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function waitGeckoSlot(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, geckoNextAt - now, geckoBackoffUntil - now);
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  geckoNextAt = Date.now() + GECKO_MIN_INTERVAL_MS;
}

function isRateLimitError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests');
}

async function fetchLaunchBaseline(
  chain: string,
  pairAddress: string,
  poolCreatedAt: Date | null
): Promise<number | null> {
  const network = geckoNetwork(chain);
  if (!network || !poolCreatedAt) return null;

  const createdMs = poolCreatedAt.getTime();
  if (!Number.isFinite(createdMs) || createdMs <= 0) return null;
  const ageHours = (Date.now() - createdMs) / (1000 * 60 * 60);

  // Public Gecko API only supports historical range within ~180 days.
  const ageDays = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);

  // First try DexScreener if it has real history (>=2 candles).
  try {
    const timeframe: 'm5' | 'h1' | 'd1' =
      ageHours <= 12 ? 'm5' : ageDays <= 14 ? 'h1' : 'd1';
    const limit = timeframe === 'm5' ? 180 : timeframe === 'h1' ? 240 : 180;
    const candlesRaw = await getDexCandlestickData(chain, pairAddress, timeframe, limit);
    if (Array.isArray(candlesRaw) && candlesRaw.length >= 2) {
      const candles = candlesRaw
        .map((item: any) => ({ time: Number(item?.time), open: Number(item?.open) }))
        .filter((c: any) => Number.isFinite(c.time) && Number.isFinite(c.open) && c.open > 0)
        .sort((a: any, b: any) => a.time - b.time);
      if (candles.length >= 2 && candles[candles.length - 1].time > candles[0].time) {
        return candles[0].open;
      }
    }
  } catch {
    // ignore and continue with Gecko
  }

  if (!Number.isFinite(ageDays) || ageDays > 179) return null;

  const createdSec = Math.floor(createdMs / 1000);
  const windows: Array<{ timeframe: 'minute' | 'hour'; windowSeconds: number; limit: number }> = [
    { timeframe: 'minute', windowSeconds: 12 * 3600, limit: 720 },
    { timeframe: 'hour', windowSeconds: 14 * 24 * 3600, limit: 336 },
  ];

  for (const w of windows) {
    const beforeTs = Math.floor(Math.min(Date.now() / 1000 - 60, createdSec + w.windowSeconds));
    if (beforeTs <= createdSec) continue;

    const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pairAddress}/ohlcv/${w.timeframe}?aggregate=1&before_timestamp=${beforeTs}&limit=${w.limit}`;

    try {
      await waitGeckoSlot();
      const data = await fetchJson<any>({
        url,
        headers: { Accept: 'application/json', 'User-Agent': 'KiKo/1.0' },
      });
      const list = data?.data?.attributes?.ohlcv_list;
      if (!Array.isArray(list) || list.length === 0) continue;

      const candles = list
        .map((item: any) => ({ time: Number(item?.[0]), open: Number(item?.[1]) }))
        .filter((c: any) => Number.isFinite(c.time) && Number.isFinite(c.open) && c.open > 0)
        .sort((a: any, b: any) => a.time - b.time);

      if (candles.length === 0) continue;
      const launch = candles.find((c: any) => c.time >= createdSec - 300) || candles[0];
      if (Number.isFinite(launch?.open) && launch.open > 0) return launch.open;
    } catch (error) {
      if (isRateLimitError(error)) {
        geckoBackoffUntil = Date.now() + GECKO_BACKOFF_MS_ON_429;
      }
      continue;
    }
  }

  return null;
}

async function main(): Promise<void> {
  await connectRedis();

  const rows = await prisma.trendingToken.findMany({
    select: {
      chain: true,
      address: true,
      price: true,
      poolCreatedAt: true,
    },
  }) as Row[];

  const eligible = rows.filter((r) => !!safeNum(r.price) && !!r.address);
  console.log(`[baseline-backfill] rows=${rows.length}, eligible=${eligible.length}, forceRefresh=${FORCE_REFRESH}`);

  let touched = 0;
  let refreshedFromExternal = 0;
  let fallbackCurrent = 0;
  let skippedHasBaseline = 0;
  let updatedFromExistingBaseline = 0;
  let unresolvedPool = 0;

  const limiter = pLimit(CONCURRENCY);
  await Promise.all(eligible.map((row) => limiter(async () => {
    const key = baselineKey(row.chain, row.address);
    const meta = metaKey(row.chain, row.address);
    const current = safeNum(row.price);
    if (!current) return;

    const existingRaw = await getRedis(key);
    let existingBaseline: number | null = null;
    let existingSource = 'unknown';

    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as { baselinePrice?: number; baselineSource?: string };
        existingBaseline = safeNum(existing?.baselinePrice);
        existingSource = typeof existing?.baselineSource === 'string' ? existing.baselineSource : 'unknown';
      } catch {
        existingBaseline = null;
      }
    }

    if (existingBaseline && !FORCE_REFRESH) {
      skippedHasBaseline++;
      const multipleRaw = current / existingBaseline;
      const multiple = Number.isFinite(multipleRaw) && multipleRaw > 0 ? Math.max(1, multipleRaw) : 1;
      const metaRaw = await getRedis(meta);
      let metaPayload: any = {};
      if (metaRaw) {
        try { metaPayload = JSON.parse(metaRaw); } catch { metaPayload = {}; }
      }
      metaPayload.launchMultiple = multiple;
      metaPayload.updatedAt = Date.now();
      await setRedis(meta, JSON.stringify(metaPayload), META_TTL_SECONDS);
      updatedFromExistingBaseline++;
      return;
    }

    let baseline: number | null = null;
    let baselineSource = existingSource;

    try {
      const details = await getDexTokenDetails(row.chain, row.address);
      const pairAddress = details?.poolAddress;
      if (pairAddress) {
        baseline = await fetchLaunchBaseline(row.chain, pairAddress, row.poolCreatedAt);
        if (baseline) {
          baselineSource = 'gecko_launch_window';
          refreshedFromExternal++;
        }
      } else {
        unresolvedPool++;
      }
    } catch {
      // ignore and continue with fallback
    }

    if (!baseline) {
      baseline = existingBaseline || current;
      baselineSource = existingBaseline ? 'existing_cache' : 'first_seen_fallback';
      if (!existingBaseline) fallbackCurrent++;
    }

    const multipleRaw = current / baseline;
    const multiple = Number.isFinite(multipleRaw) && multipleRaw > 0 ? Math.max(1, multipleRaw) : 1;

    await setRedis(
      key,
      JSON.stringify({ baselinePrice: baseline, firstSeenAt: Date.now(), baselineSource }),
      BASELINE_TTL_SECONDS
    );

    const metaRaw = await getRedis(meta);
    let metaPayload: any = {};
    if (metaRaw) {
      try { metaPayload = JSON.parse(metaRaw); } catch { metaPayload = {}; }
    }
    metaPayload.launchMultiple = multiple;
    metaPayload.updatedAt = Date.now();
    await setRedis(meta, JSON.stringify(metaPayload), META_TTL_SECONDS);
    touched++;
  })));

  console.log(
    `[baseline-backfill] touched=${touched} refreshedFromExternal=${refreshedFromExternal} fallbackCurrent=${fallbackCurrent} skippedHasBaseline=${skippedHasBaseline} updatedFromExistingBaseline=${updatedFromExistingBaseline} unresolvedPool=${unresolvedPool}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[baseline-backfill] failed', err?.message || err);
    process.exit(1);
  });
