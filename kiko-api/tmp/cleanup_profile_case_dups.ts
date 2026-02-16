import prisma from '../src/db/prisma.js';

async function main() {
  const before = await prisma.$queryRawUnsafe<Array<{ chain: string; lower_addr: string; cnt: bigint }>>(`
    SELECT chain, lower(address) AS lower_addr, COUNT(*)::bigint AS cnt
    FROM \"TokenLaunchpadProfile\"
    GROUP BY chain, lower(address)
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);
  console.log('duplicates_before', before.length);

  await prisma.$executeRawUnsafe(`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY chain, lower(address)
               ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
             ) AS rn
      FROM \"TokenLaunchpadProfile\"
    )
    DELETE FROM \"TokenLaunchpadProfile\" p
    USING ranked r
    WHERE p.id = r.id
      AND r.rn > 1
  `);

  const after = await prisma.$queryRawUnsafe<Array<{ chain: string; lower_addr: string; cnt: bigint }>>(`
    SELECT chain, lower(address) AS lower_addr, COUNT(*)::bigint AS cnt
    FROM \"TokenLaunchpadProfile\"
    GROUP BY chain, lower(address)
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);
  console.log('duplicates_after', after.length);
}

main().finally(async () => {
  await prisma.$disconnect();
});
