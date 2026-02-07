import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function estimate(position: { entryPrice: number; entryUsdValue: number; currentPrice: number | null; exitPrice: number | null; }) {
  const entryPrice = Number(position.entryPrice || 0);
  const entryUsd = Number(position.entryUsdValue || 0);
  const fallbackExitPrice = Number(position.exitPrice || position.currentPrice || position.entryPrice || 0);

  if (entryPrice <= 0 || entryUsd <= 0 || fallbackExitPrice <= 0) {
    return {
      exitPrice: fallbackExitPrice > 0 ? fallbackExitPrice : null,
      exitUsdValue: entryUsd,
      realizedPnlUsd: 0,
      realizedPnlPct: 0,
    };
  }

  const estimatedTokenAmount = entryUsd / entryPrice;
  const exitUsdValue = estimatedTokenAmount * fallbackExitPrice;
  const realizedPnlUsd = exitUsdValue - entryUsd;
  const realizedPnlPct = entryUsd > 0 ? (realizedPnlUsd / entryUsd) * 100 : 0;
  return {
    exitPrice: fallbackExitPrice,
    exitUsdValue,
    realizedPnlUsd,
    realizedPnlPct,
  };
}

async function main() {
  const rows = await prisma.position.findMany({
    where: {
      status: 'closed',
      OR: [
        { exitUsdValue: null },
        { realizedPnlUsd: null },
        { realizedPnlPct: null },
      ],
    },
    select: {
      id: true,
      entryPrice: true,
      entryUsdValue: true,
      currentPrice: true,
      exitPrice: true,
    },
  });

  let updated = 0;
  for (const row of rows) {
    const patch = estimate(row);
    await prisma.position.update({
      where: { id: row.id },
      data: {
        exitPrice: patch.exitPrice,
        exitUsdValue: patch.exitUsdValue,
        realizedPnlUsd: patch.realizedPnlUsd,
        realizedPnlPct: patch.realizedPnlPct,
      },
    });
    updated += 1;
  }

  console.log(`[backfillClosedPositionPnl] updated=${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
