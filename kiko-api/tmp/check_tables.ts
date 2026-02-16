import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const rows = await p.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN ('TokenLaunchBaseline','token_rules','TokenRule','TrendingToken','TokenLaunchpadProfile')
    ORDER BY table_name
  `);
  console.log(rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
