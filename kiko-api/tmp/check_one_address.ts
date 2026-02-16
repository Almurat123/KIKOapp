import prisma from '../src/db/prisma.js';

async function main() {
  const a = '0x9EadbE35F3Ee3bF3e28180070C429298a1b02F93';
  const low = a.toLowerCase();

  const tt = await prisma.trendingToken.findMany({
    where: { address: { in: [a, low] } },
    select: {
      chain: true,
      address: true,
      name: true,
      symbol: true,
      launchpad: true,
      creatorAddress: true,
      creatorUrl: true,
      creatorLabel: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const lp = await prisma.tokenLaunchpadProfile.findMany({
    where: { address: { in: [a, low] } },
    select: {
      chain: true,
      address: true,
      launchpad: true,
      creatorAddress: true,
      creatorUrl: true,
      creatorLabel: true,
      source: true,
      lastCheckedAt: true,
      lastError: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  console.log('TrendingToken');
  console.table(tt);
  console.log('TokenLaunchpadProfile');
  console.table(lp);
}

main().finally(async () => {
  await prisma.$disconnect();
});
