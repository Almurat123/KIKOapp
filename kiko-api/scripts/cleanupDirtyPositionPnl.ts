/**
 * One-time cleanup script: Reset absurdly large realizedPnlUsd values on closed positions.
 *
 * These were caused by a historical bug where the sell PnL calculation used corrupted
 * balance/price data, producing values like +$78B instead of -$0.01.
 *
 * Logic:
 *   - Find all closed positions where |realizedPnlUsd| > max(entryUsdValue * 10, $100,000)
 *   - Recalculate PnL as (exitUsdValue - entryUsdValue) when both values are present
 *   - If recalculated value is still implausible, set to 0
 *   - Log all changes for audit
 *
 * Usage:
 *   npx tsx scripts/cleanupDirtyPositionPnl.ts          # dry-run (default)
 *   npx tsx scripts/cleanupDirtyPositionPnl.ts --apply   # actually update DB
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  console.log(`\n=== Cleanup Dirty Position PnL (${DRY_RUN ? 'DRY RUN' : '⚡ LIVE'}) ===\n`);

  const allClosed = await prisma.position.findMany({
    where: { status: 'closed' },
    select: {
      id: true,
      userId: true,
      tokenSymbol: true,
      tokenAddress: true,
      chainId: true,
      entryUsdValue: true,
      exitUsdValue: true,
      entryPrice: true,
      exitPrice: true,
      realizedPnlUsd: true,
      realizedPnlPct: true,
      closedAt: true,
    },
    orderBy: { closedAt: 'desc' },
  });

  console.log(`Total closed positions: ${allClosed.length}`);

  let dirty = 0;
  let fixed = 0;

  for (const pos of allClosed) {
    const pnl = pos.realizedPnlUsd ?? 0;
    const entry = pos.entryUsdValue ?? 0;
    const maxPlausible = Math.max(entry * 10, 100_000);

    if (Math.abs(pnl) <= maxPlausible) continue; // fine

    dirty++;

    // Attempt recalculation from exit/entry USD values
    let newPnl = 0;
    if (pos.exitUsdValue && pos.exitUsdValue > 0 && entry > 0) {
      const recalc = pos.exitUsdValue - entry;
      if (Math.abs(recalc) <= maxPlausible) {
        newPnl = recalc;
      }
    }

    // Recalculate pct from entry/exit price if available
    let newPct = 0;
    if (pos.exitPrice && pos.exitPrice > 0 && pos.entryPrice && pos.entryPrice > 0) {
      newPct = ((pos.exitPrice - pos.entryPrice) / pos.entryPrice) * 100;
      if (!Number.isFinite(newPct) || Math.abs(newPct) > 100_000) newPct = 0;
    }

    console.log(
      `  [${pos.id}] ${pos.tokenSymbol || pos.tokenAddress} (chain ${pos.chainId})` +
      `  entry=$${entry.toFixed(2)}  pnl=$${pnl.toFixed(2)}` +
      `  → new pnl=$${newPnl.toFixed(4)} pct=${newPct.toFixed(2)}%`
    );

    if (!DRY_RUN) {
      await prisma.position.update({
        where: { id: pos.id },
        data: {
          realizedPnlUsd: newPnl,
          realizedPnlPct: newPct,
        },
      });
      fixed++;
    }
  }

  console.log(`\nDirty positions found: ${dirty}`);
  console.log(`Positions fixed: ${DRY_RUN ? 0 : fixed} ${DRY_RUN ? '(dry run — use --apply to fix)' : ''}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
