import prisma from '../src/db/prisma.js';

async function main() {
  const a = '0xdd505db2f238c85004e01632c252906065a6ab07';
  const t = await prisma.trendingToken.findUnique({
    where: { chain_address: { chain: 'base', address: a } },
    select: {
      launchpad: true,
      creatorAddress: true,
      creatorUrl: true,
      creatorLabel: true,
      updatedAt: true,
    },
  });
  const p = await prisma.tokenLaunchpadProfile.findUnique({
    where: { chain_address: { chain: 'base', address: a } },
    select: {
      launchpad: true,
      creatorAddress: true,
      creatorUrl: true,
      creatorLabel: true,
      source: true,
      updatedAt: true,
      lastCheckedAt: true,
    },
  });
  console.log(JSON.stringify({ t, p }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
