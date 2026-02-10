import prisma, { withRetry } from '../db/prisma.js';
import { connectRedis, get as getRedis } from '../cache/redis.js';

const CHAINS = ['eth', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon', 'solana'];

function parseChains(): string[] {
  const idx = process.argv.findIndex((v) => v === '--chains');
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1].split(',').map((s) => s.trim()).filter(Boolean);
  }
  return CHAINS;
}

function parseBatchSize(): number {
  const idx = process.argv.findIndex((v) => v === '--batch-size');
  if (idx >= 0 && process.argv[idx + 1]) {
    const n = Number(process.argv[idx + 1]);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 100;
}

function parseSleepMs(): number {
  const idx = process.argv.findIndex((v) => v === '--sleep-ms');
  if (idx >= 0 && process.argv[idx + 1]) {
    const n = Number(process.argv[idx + 1]);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 20;
}

function asNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickPct(ageHours: number, c1h?: number | null, c6h?: number | null, c24h?: number | null): number | null {
  const p1 = asNum(c1h);
  const p6 = asNum(c6h);
  const p24 = asNum(c24h);
  if (Number.isFinite(ageHours) && ageHours <= 2 && p1 !== null) return p1;
  if (Number.isFinite(ageHours) && ageHours <= 8 && p6 !== null) return p6;
  if (p24 !== null) return p24;
  if (p6 !== null) return p6;
  if (p1 !== null) return p1;
  return null;
}

function trustedSource(source?: string): boolean {
  return source === 'gecko_launch_window'
    || source === 'dex_candles'
    || source === 'rpc_stable_first_swap'
    || source === 'rpc_native_first_swap'
    || source === 'rpc_v4_initialize'
    || source === 'solana_public_rpc'
    || source === 'derived_change_proxy';
}

function isPrismaConnError(error: any): boolean {
  const message = String(error?.message || '');
  return error?.code === 'P1017'
    || message.includes('closed the connection')
    || message.includes('Closed, cause: None')
    || message.includes('Server has closed the connection')
    || message.includes('Can\'t reach database server');
}

async function reconnectPrisma(): Promise<void> {
  try { await prisma.$disconnect(); } catch {}
  try { await prisma.$connect(); } catch {}
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await connectRedis();
  const chains = parseChains();
  const batchSize = parseBatchSize();
  const sleepMs = parseSleepMs();
  const out: Array<Record<string, unknown>> = [];

  for (const chain of chains) {
    await connectRedis();
    const rows = await withRetry(() => prisma.trendingToken.findMany({
      where: { chain },
      select: {
        address: true,
        symbol: true,
        price: true,
        priceChange1h: true,
        priceChange6h: true,
        priceChange24h: true,
        poolCreatedAt: true,
      },
    }), 5, 800);

    let scanned = 0;
    let fromTrustedRedis = 0;
    let fromDerived = 0;
    let fromImputedCurrent = 0;
    let failed = 0;
    let retried = 0;

    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      for (const row of batch) {
        scanned++;
        if (scanned > 0 && scanned % 30 === 0) {
          await connectRedis();
          await withRetry(() => prisma.$queryRaw`SELECT 1`, 3, 400).catch(async () => {
            await reconnectPrisma();
          });
        }
        const address = row.address.toLowerCase();
        const currentRaw = asNum(row.price);
        const current = currentRaw && currentRaw > 0 ? currentRaw : null;

        const baselineKey = `token:baseline:v1:${chain}:${address}`;
        const raw = await getRedis(baselineKey);
        let baselinePrice: number | null = null;
        let baselineSource = '';
        let status: 'verified' | 'estimated' | 'fallback' = 'estimated';

        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const px = asNum(parsed?.baselinePrice);
            const src = String(parsed?.baselineSource || '');
            if (px && px > 0 && trustedSource(src)) {
              baselinePrice = px;
              baselineSource = src;
              status = 'verified';
              fromTrustedRedis++;
            }
          } catch {
            // ignore parse
          }
        }

        if (!baselinePrice || baselinePrice <= 0) {
          const createdMs = row.poolCreatedAt ? row.poolCreatedAt.getTime() : NaN;
          const ageHours = Number.isFinite(createdMs) ? Math.max(0, (Date.now() - createdMs) / (1000 * 60 * 60)) : Number.NaN;
          const pct = pickPct(ageHours, asNum(row.priceChange1h), asNum(row.priceChange6h), asNum(row.priceChange24h));
          if (current && pct !== null && Number.isFinite(pct)) {
            const divisor = 1 + pct / 100;
            // if divisor invalid (e.g. <= 0), fallback to current price
            if (Number.isFinite(divisor) && divisor > 0.0001) {
              const derived = current / divisor;
              if (Number.isFinite(derived) && derived > 0) {
                baselinePrice = derived;
                baselineSource = 'derived_change_proxy';
                status = 'estimated';
                fromDerived++;
              }
            }
          }
        }

        if (!baselinePrice || baselinePrice <= 0) {
          baselinePrice = current || 1e-12;
          baselineSource = current ? 'imputed_current' : 'imputed_minimum';
          status = 'fallback';
          fromImputedCurrent++;
        }

        let success = false;
        let attempts = 0;
        while (!success && attempts < 6) {
          attempts++;
          const now = new Date();
          try {
            await withRetry(() => prisma.tokenLaunchBaseline.upsert({
              where: { chain_address: { chain, address } },
              update: {
                baselinePrice,
                baselineSource,
                status,
                firstSeenAt: now,
                lastCheckedAt: now,
                lastError: null,
              },
              create: {
                chain,
                address,
                baselinePrice,
                baselineSource,
                status,
                firstSeenAt: now,
                lastCheckedAt: now,
              },
            }), 4, 700);
            success = true;
          } catch (error: any) {
            if (!isPrismaConnError(error)) {
              failed++;
              break;
            }
            retried++;
            await reconnectPrisma();
            await sleep(300 * attempts);
          }
        }
        if (!success && attempts >= 6) failed++;
        await sleep(sleepMs);
      }
      await sleep(Math.max(80, sleepMs * 2));
    }

    out.push({
      chain,
      scanned,
      fromTrustedRedis,
      fromDerived,
      fromImputedCurrent,
      failed,
      retried,
      batchSize,
      sleepMs,
    });
  }

  console.log(JSON.stringify({ chains, out }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[force-fill-all-initial-prices] failed:', error?.message || error);
    process.exit(1);
  });
