import prisma from '../db/prisma.js';
import { connectRedis, get as getRedis } from '../cache/redis.js';

const CHAINS = ['eth', 'base', 'bsc', 'arbitrum', 'optimism', 'polygon', 'solana'];

function parseChains(): string[] {
  const idx = process.argv.findIndex((v) => v === '--chains');
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1].split(',').map((s) => s.trim()).filter(Boolean);
  }
  return CHAINS;
}

function trusted(source?: string): boolean {
  return source === 'gecko_launch_window'
    || source === 'dex_candles'
    || source === 'rpc_stable_first_swap'
    || source === 'rpc_native_first_swap'
    || source === 'rpc_v4_initialize'
    || source === 'solana_public_rpc'
    || source === 'derived_change_proxy';
}

async function main() {
  await connectRedis();
  const chains = parseChains();
  const result: Array<Record<string, unknown>> = [];

  for (const chain of chains) {
    const rows = await prisma.trendingToken.findMany({
      where: { chain },
      select: { address: true },
    });
    let scanned = 0;
    let upserted = 0;

    for (const row of rows) {
      scanned++;
      const address = row.address.toLowerCase();
      const raw = await getRedis(`token:baseline:v1:${chain}:${address}`);
      if (!raw) continue;
      let parsed: any = null;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      const baselinePrice = Number(parsed?.baselinePrice || 0);
      const baselineSource = String(parsed?.baselineSource || '');
      if (!Number.isFinite(baselinePrice) || baselinePrice <= 0 || !trusted(baselineSource)) continue;

      await prisma.tokenLaunchBaseline.upsert({
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
      });
      upserted++;
    }

    result.push({ chain, scanned, upserted });
  }

  console.log(JSON.stringify({ chains, result }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[sync-baseline-redis-to-db] failed:', error?.message || error);
    process.exit(1);
  });

