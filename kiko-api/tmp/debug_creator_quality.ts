import prisma from '../src/db/prisma.js';

type Row = {
  chain: string;
  address: string;
  name: string;
  launchpad: string | null;
  creatorLabel: string | null;
  creatorUrl: string | null;
  creatorAddress: string | null;
};

const lowQuality = (v?: string | null) => {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^fid:\d+$/i.test(s) || /^@?\d+$/.test(s) || /^@?(i|status)$/i.test(s);
};

async function dump(chain: string) {
  const rows = await prisma.trendingToken.findMany({
    where: { chain },
    select: {
      chain: true,
      address: true,
      name: true,
      launchpad: true,
      creatorLabel: true,
      creatorUrl: true,
      creatorAddress: true,
      rank: true,
    },
    orderBy: { rank: 'asc' },
    take: 120,
  });

  const bad = rows.filter((r) => lowQuality(r.creatorLabel));
  const missingCreator = rows.filter((r) => r.launchpad && !r.creatorLabel && !r.creatorUrl && !r.creatorAddress);

  console.log(`\nCHAIN ${chain} total=${rows.length} lowQualityLabel=${bad.length} launchpadButNoCreator=${missingCreator.length}`);
  console.table(bad.slice(0, 20).map((r) => ({
    address: r.address,
    rank: (r as any).rank,
    launchpad: r.launchpad,
    creatorLabel: r.creatorLabel,
    creatorUrl: r.creatorUrl,
  })));
  console.table(missingCreator.slice(0, 20).map((r) => ({
    address: r.address,
    rank: (r as any).rank,
    launchpad: r.launchpad,
    creatorAddress: r.creatorAddress,
    creatorUrl: r.creatorUrl,
    creatorLabel: r.creatorLabel,
  })));
}

await dump('base');
await dump('bsc');
await prisma.$disconnect();
