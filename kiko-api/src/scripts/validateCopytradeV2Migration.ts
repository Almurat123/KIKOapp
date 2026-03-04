import prisma from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

async function main(): Promise<void> {
  const [legacyPositionCount, legacyOpenCount, legacyClosedCount, legacyFailedCount] = await Promise.all([
    prisma.position.count(),
    prisma.position.count({ where: { status: 'open' } }),
    prisma.position.count({ where: { status: 'closed' } }),
    prisma.position.count({ where: { status: { in: ['failed', 'failed_final'] } } }),
  ]);

  const [v2OrderCount, v2OpenLikeCount, v2ClosedCount, v2FailedCount] = await Promise.all([
    prisma.copytradeOrder.count(),
    prisma.copytradeOrder.count({
      where: {
        lifecycleState: {
          in: ['BUY_CONFIRMED_OPEN', 'EXIT_ARMED', 'EXIT_SUBMITTING', 'EXIT_ACCEPTED'],
        },
      },
    }),
    prisma.copytradeOrder.count({ where: { lifecycleState: 'EXIT_CONFIRMED_CLOSED' } }),
    prisma.copytradeOrder.count({ where: { lifecycleState: 'FAILED_TERMINAL' } }),
  ]);

  const missingMappedPositions = await prisma.position.count({
    where: {
      NOT: {
        OR: [
          { leaderTxHash: null },
          {
            leaderTxHash: {
              in: (
                await prisma.copytradeOrder.findMany({
                  select: { txHash: true },
                })
              ).map((row) => row.txHash),
            },
          },
        ],
      },
    },
  });

  const summary = {
    legacyPositionCount,
    legacyOpenCount,
    legacyClosedCount,
    legacyFailedCount,
    v2OrderCount,
    v2OpenLikeCount,
    v2ClosedCount,
    v2FailedCount,
    missingMappedPositions,
  };

  logger.info(LogCode.SYS_INFO, '[CopyTradeV2MigrationValidation] summary', summary);

  const hardFailures: string[] = [];
  if (v2OrderCount < legacyPositionCount) {
    hardFailures.push(`v2OrderCount(${v2OrderCount}) < legacyPositionCount(${legacyPositionCount})`);
  }
  if (v2ClosedCount < legacyClosedCount) {
    hardFailures.push(`v2ClosedCount(${v2ClosedCount}) < legacyClosedCount(${legacyClosedCount})`);
  }
  if (v2FailedCount < legacyFailedCount) {
    hardFailures.push(`v2FailedCount(${v2FailedCount}) < legacyFailedCount(${legacyFailedCount})`);
  }

  if (hardFailures.length > 0) {
    logger.error(LogCode.SYS_ERROR, '[CopyTradeV2MigrationValidation] failed', {
      hardFailures,
    });
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    logger.error(LogCode.SYS_ERROR, '[CopyTradeV2MigrationValidation] failed', {
      error: error?.message || String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
