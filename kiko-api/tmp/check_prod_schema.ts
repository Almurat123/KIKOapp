import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe<Array<{column_name: string}>>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='AITask'
      AND column_name IN ('executionMode','sandboxJobId')
    ORDER BY column_name
  `);

  const tables = await prisma.$queryRawUnsafe<Array<{table_name: string}>>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN ('sandbox_artifacts','sandbox_job_events')
    ORDER BY table_name
  `);

  console.log('AITask columns:', cols.map(c => c.column_name));
  console.log('Sandbox tables:', tables.map(t => t.table_name));
}

main().finally(async () => prisma.$disconnect());
