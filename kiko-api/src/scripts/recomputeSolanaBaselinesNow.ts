import prisma from '../db/prisma.js';
import { connectRedis, del } from '../cache/redis.js';
import { refreshSingleChain } from '../jobs/tokenDataJob.js';

async function main() {
  await connectRedis();

  const rows = await prisma.trendingToken.findMany({
    where: { chain: 'solana' },
    select: { address: true },
  });

  const uniq = Array.from(new Set(rows.map((r) => String(r.address || '').toLowerCase()).filter(Boolean)));
  console.log(`[sol-baseline-reset] solana tokens=${uniq.length}`);

  let deleted = 0;
  for (const addr of uniq) {
    await del(`token:baseline:v1:solana:${addr}`);
    await del(`token:baseline:retry:v1:solana:${addr}`);
    await del(`token:meta:v1:solana:${addr}`);
    deleted += 3;
  }
  console.log(`[sol-baseline-reset] deleted keys=${deleted}`);

  const ok = await refreshSingleChain('solana', true);
  console.log(`[sol-baseline-reset] refreshSingleChain('solana') => ${ok}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[sol-baseline-reset] failed', err?.message || err);
    process.exit(1);
  });
