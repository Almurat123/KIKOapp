import prisma from '../src/db/prisma.js';

async function main() {
  const addrs = [
    '0x9318Ef764eaE1DE8A463296F01113fB18C227Ba3',
    '0x06CecE127F81Bf76d388859549A93a120Ec52BA3',
    '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf',
    '0x16332535E2c27da578bC2e82bEb09Ce9d3C8EB07',
    '0xc2E122C518C11d20B108fCBF280AbCF01a4B4444',
    '0xfA72110998F3d401E3d9704afC1Dd4A9Bda04444',
    '0x94e5f19CC645De47121C1082127607b85D1D4444',
  ].map((a) => a.toLowerCase());

  const rows = await prisma.trendingToken.findMany({
    where: {
      OR: [
        { chain: 'base', address: { in: addrs } },
        { chain: 'bsc', address: { in: addrs } },
      ],
    },
    select: {
      chain: true,
      address: true,
      rank: true,
      name: true,
      symbol: true,
      launchpad: true,
      creatorAddress: true,
      creatorUrl: true,
      creatorLabel: true,
      updatedAt: true,
    },
  });

  const profiles = await prisma.tokenLaunchpadProfile.findMany({
    where: {
      OR: [
        { chain: 'base', address: { in: addrs } },
        { chain: 'bsc', address: { in: addrs } },
      ],
    },
    select: {
      chain: true,
      address: true,
      launchpad: true,
      creatorAddress: true,
      creatorUrl: true,
      creatorLabel: true,
      source: true,
      updatedAt: true,
      lastCheckedAt: true,
    },
  });

  const baseTop = await prisma.trendingToken.findMany({
    where: { chain: 'base' },
    orderBy: { rank: 'asc' },
    take: 120,
    select: {
      rank: true,
      symbol: true,
      address: true,
      launchpad: true,
      creatorUrl: true,
      creatorLabel: true,
    },
  });

  const bscTop = await prisma.trendingToken.findMany({
    where: { chain: 'bsc' },
    orderBy: { rank: 'asc' },
    take: 120,
    select: {
      rank: true,
      symbol: true,
      address: true,
      launchpad: true,
      creatorUrl: true,
      creatorLabel: true,
    },
  });

  const bad = (arr: any[]) =>
    arr
      .filter((r) => {
        const l = (r.creatorLabel || '').trim();
        return /^fid:\d+$/i.test(l) || /^@?\d+$/.test(l) || /^@?(i|status)$/i.test(l);
      })
      .map((r) => ({
        rank: r.rank,
        symbol: r.symbol,
        address: r.address,
        launchpad: r.launchpad,
        creatorLabel: r.creatorLabel,
        creatorUrl: r.creatorUrl,
      }));

  console.log(
    JSON.stringify(
      {
        rows,
        profiles,
        badBase: bad(baseTop),
        badBsc: bad(bscTop),
        baseTopSample: baseTop.slice(0, 25),
        bscTopSample: bscTop.slice(0, 25),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
