import prisma from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { syncCopytradeLedgerFromLegacy } from '../services/copytrade-v2/ledger/copytradeLedgerRepository.js';

async function main(): Promise<void> {
  let cursor: string | undefined;
  let processed = 0;
  let synced = 0;

  while (true) {
    const rows = await prisma.position.findMany({
      where: {
        config: {
          status: 'active',
        },
      },
      select: {
        id: true,
        config: {
          select: {
            targetWallet: true,
          },
        },
      },
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      processed += 1;
      const ledger = await syncCopytradeLedgerFromLegacy({
        positionId: row.id,
        targetWallet: row.config.targetWallet,
      });
      if (ledger) synced += 1;
    }
    cursor = rows[rows.length - 1]?.id;
  }

  const openCount = await prisma.position.count({ where: { status: 'open' } });
  const pendingCount = await prisma.pendingAttributedPosition.count({
    where: { status: { in: ['armed', 'sell_armed'] } },
  });
  const ledgerCount = await prisma.copytradePositionLedger.count();

  logger.info(LogCode.SYS_INFO, '[CopytradeLedgerBackfill] completed', {
    processed,
    synced,
    openCount,
    pendingCount,
    ledgerCount,
  });
}

main()
  .catch((error) => {
    logger.error(LogCode.SYS_ERROR, '[CopytradeLedgerBackfill] failed', {
      error: error?.message || String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
