import prisma from '../src/db/prisma.js';

async function main() {
  const tables = ['TrendingToken', 'TokenLaunchpadProfile', 'TokenLaunchBaseline'];
  for (const t of tables) {
    const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(
      `SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='${t}' ORDER BY ordinal_position`
    );
    console.log(`\nTABLE ${t}`);
    console.table(rows);
  }

  const addrs = [
    '0x9318Ef764eaE1DE8A463296F01113fB18C227Ba3',
    '0x06CecE127F81Bf76d388859549A93a120Ec52BA3',
    '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf',
    '0xc2E122C518C11d20B108fCBF280AbCF01a4B4444',
    '0xfA72110998F3d401E3d9704afC1Dd4A9Bda04444',
    '0x94e5f19CC645De47121C1082127607b85D1D4444',
  ];

  for (const a of addrs) {
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
      take: 5,
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
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    console.log(`\nADDR ${a}`);
    console.log('TrendingToken');
    console.table(tt);
    console.log('TokenLaunchpadProfile');
    console.table(lp);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
