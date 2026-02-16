import prisma from '../src/db/prisma.js';

(async () => {
  const addrs = [
    '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf',
    '0x06CecE127F81Bf76d388859549A93a120Ec52BA3',
    '0x16332535E2c27da578bC2e82bEb09Ce9d3C8EB07',
    '0x9318Ef764eaE1DE8A463296F01113fB18C227Ba3',
    '0xc2E122C518C11d20B108fCBF280AbCF01a4B4444',
    '0xfA72110998F3d401E3d9704afC1Dd4A9Bda04444',
    '0x94e5f19CC645De47121C1082127607b85D1D4444',
  ].map((a) => a.toLowerCase());

  const rows = await prisma.trendingToken.findMany({
    where: { address: { in: addrs } },
    select: {
      chain: true,
      address: true,
      launchpad: true,
      creatorAddress: true,
      creatorUrl: true,
      creatorLabel: true,
      updatedAt: true,
    },
    orderBy: [{ chain: 'asc' }, { address: 'asc' }],
  });

  const prof = await prisma.tokenLaunchpadProfile.findMany({
    where: { address: { in: addrs } },
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
    orderBy: [{ chain: 'asc' }, { address: 'asc' }],
  });

  console.log('TRENDING', JSON.stringify(rows, null, 2));
  console.log('PROFILE', JSON.stringify(prof, null, 2));

  await prisma.$disconnect();
})();
