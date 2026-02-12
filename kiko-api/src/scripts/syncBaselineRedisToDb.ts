import prisma, { withRetry } from '../db/prisma.js';
import { connectRedis, get as getRedis } from '../cache/redis.js';

const CHAINS = ['eth', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon', 'solana'];

function parseChains(): string[] {
  const idx = process.argv.findIndex((v) => v === '--chains');
  if (idx >= 0 && process.argv[idx + 1]) {
    const requested = process.argv[idx + 1].split(',').map((s) => s.trim()).filter(Boolean);
    return requested.filter((c) => CHAINS.includes(c));
  }
  return CHAINS;
}

function parseLimit(): number | null {
  const idx = process.argv.findIndex((v) => v === '--limit');
  if (idx >= 0 && process.argv[idx + 1]) {
    const n = Number(process.argv[idx + 1]);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return null;
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
  return 25;
}

function trusted(source?: string): boolean {
  return source === 'rpc_stable_first_swap'
    || source === 'rpc_native_first_swap'
    || source === 'rpc_v4_initialize'
    || source === 'solana_public_rpc';
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
  const limit = parseLimit();
  const batchSize = parseBatchSize();
  const sleepMs = parseSleepMs();
  if (chains.length === 0) {
    console.log(JSON.stringify({ chains: [], result: [], message: 'no valid chains selected' }, null, 2));
    return;
  }
  const result: Array<Record<string, unknown>> = [];

  for (const chain of chains) {
    await connectRedis();
    const rows = await withRetry(() => prisma.trendingToken.findMany({
      where: { chain },
      ...(limit ? { take: limit } : {}),
      select: { address: true },
    }), 5, 800);
    let scanned = 0;
    let upserted = 0;
    let failed = 0;
    let retried = 0;

    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        scanned++;
        if (scanned > 0 && scanned % 30 === 0) {
          // Keep connections warm/recovered on long runs.
          await connectRedis();
          await withRetry(() => prisma.$queryRaw`SELECT 1`, 3, 400).catch(async () => {
            await reconnectPrisma();
          });
        }
        const address = row.address.toLowerCase();
        let raw: string | null = null;
        try {
          raw = await getRedis(`token:baseline:v1:${chain}:${address}`);
        } catch {
          await connectRedis();
          raw = await getRedis(`token:baseline:v1:${chain}:${address}`).catch(() => null);
        }
        if (!raw) continue;
        let parsed: any = null;
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
        const baselinePrice = Number(parsed?.baselinePrice || 0);
        const baselineSource = String(parsed?.baselineSource || '');
        if (!Number.isFinite(baselinePrice) || baselinePrice <= 0 || !trusted(baselineSource)) continue;

        let attempts = 0;
        let success = false;
        while (!success && attempts < 6) {
          attempts++;
          try {
            await withRetry(() => prisma.tokenLaunchBaseline.upsert({
              where: {
                chain_address: { chain, address },
              },
              update: {
                baselinePrice,
                baselineSource,
                status: 'verified',
                firstSeenAt: new Date(Number(parsed?.firstSeenAt || Date.now())),
                lastCheckedAt: new Date(),
                lastError: null,
              },
              create: {
                chain,
                address,
                baselinePrice,
                baselineSource,
                status: 'verified',
                firstSeenAt: new Date(Number(parsed?.firstSeenAt || Date.now())),
                lastCheckedAt: new Date(),
              },
            }), 4, 700);
            upserted++;
            success = true;
          } catch (error: any) {
            if (!isPrismaConnError(error)) {
              failed++;
              break;
            }
            retried++;
            await reconnectPrisma();
            await sleep(350 * attempts);
          }
        }
        if (!success && attempts >= 6) {
          failed++;
        }
        await sleep(sleepMs);
      }
      // Slight pause between batches to avoid remote DB churn.
      await sleep(Math.max(100, sleepMs * 2));
    }

    result.push({ chain, scanned, upserted, failed, retried, batchSize, sleepMs });
  }

  console.log(JSON.stringify({ chains, limit, batchSize, sleepMs, result }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[sync-baseline-redis-to-db] failed:', error?.message || error);
    process.exit(1);
  });
