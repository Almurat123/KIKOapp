import prisma from '../db/prisma.js';
import { connectRedis, del } from '../cache/redis.js';

async function main() {
  await connectRedis();
  const rows = await prisma.trendingToken.findMany({ where: { chain: 'solana' }, select: { address: true } });
  const addresses = Array.from(new Set(rows.map((r) => String(r.address || '').toLowerCase()).filter(Boolean)));
  let n = 0;
  for (const a of addresses) {
    await del(`token:meta:v1:solana:${a}`);
    n++;
  }
  console.log(`[clear-sol-meta] tokens=${addresses.length} deleted_meta_keys=${n}`);
}

main().then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1);});
