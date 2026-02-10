import prisma from '../db/prisma.js';

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TokenLaunchBaseline" (
      "id" TEXT PRIMARY KEY,
      "chain" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "baseline_price" DECIMAL,
      "baseline_source" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "first_seen_at" TIMESTAMP(3),
      "last_checked_at" TIMESTAMP(3),
      "retry_after" TIMESTAMP(3),
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "last_error" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TokenLaunchBaseline_chain_address_key"
    ON "TokenLaunchBaseline" ("chain", "address");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TokenLaunchBaseline_chain_status_idx"
    ON "TokenLaunchBaseline" ("chain", "status");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TokenLaunchBaseline_updated_at_idx"
    ON "TokenLaunchBaseline" ("updated_at" DESC);
  `);

  // Backfill IDs for legacy rows inserted by manual SQL without id.
  await prisma.$executeRawUnsafe(`
    UPDATE "TokenLaunchBaseline"
    SET "id" = md5("chain" || ':' || "address")
    WHERE "id" IS NULL OR "id" = '';
  `).catch(() => undefined);

  console.log('[ensure-token-launch-baseline-table] done');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[ensure-token-launch-baseline-table] failed:', error?.message || error);
    process.exit(1);
  });

