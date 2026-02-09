import prisma from '../db/prisma.js';

const MAX_TX_USD = Number(process.env.TARGET_STATUS_MAX_TX_USD || 250000);
const APPLY = process.env.APPLY === '1';
const TARGET_OUTLIER_IDS = (process.env.TARGET_OUTLIER_IDS || '')
  .split(',')
  .map(s => Number(s.trim()))
  .filter(n => Number.isInteger(n) && n > 0);
const TARGET_OUTLIER_TX_HASHES = (process.env.TARGET_OUTLIER_TX_HASHES || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);
const hasExplicitSelection = TARGET_OUTLIER_IDS.length > 0 || TARGET_OUTLIER_TX_HASHES.length > 0;

async function main() {
  const rows = await prisma.walletTransaction.findMany({
    where: {
      txType: { in: ['TARGET_BUY', 'TARGET_SELL'] },
      valueUsd: { not: null },
    },
    select: {
      id: true,
      txHash: true,
      walletAddress: true,
      chain: true,
      txType: true,
      valueUsd: true,
      blockTimestamp: true,
    },
    orderBy: { blockTimestamp: 'desc' },
  });

  const outliers = rows.filter((r) => {
    const usd = Number(r.valueUsd || 0);
    return Number.isFinite(usd) && usd > MAX_TX_USD;
  });

  console.log('[cleanupTargetWalletOutliers] scan complete', {
    totalRows: rows.length,
    thresholdUsd: MAX_TX_USD,
    outliers: outliers.length,
    mode: APPLY ? 'apply' : 'dry-run',
  });

  if (outliers.length > 0) {
    console.log('[cleanupTargetWalletOutliers] sample', outliers.slice(0, 20).map((r) => ({
      id: r.id,
      chain: r.chain,
      txType: r.txType,
      valueUsd: r.valueUsd,
      wallet: `${r.walletAddress.slice(0, 8)}...${r.walletAddress.slice(-4)}`,
      txHash: `${r.txHash.slice(0, 12)}...`,
    })));
  }

  if (!APPLY || outliers.length === 0) return;
  if (!hasExplicitSelection) {
    console.log('[cleanupTargetWalletOutliers] APPLY requested but no explicit target set.');
    console.log('[cleanupTargetWalletOutliers] set TARGET_OUTLIER_IDS=1,2 or TARGET_OUTLIER_TX_HASHES=0xabc,0xdef');
    return;
  }

  const selected = outliers.filter((r) => {
    if (TARGET_OUTLIER_IDS.includes(r.id)) return true;
    return TARGET_OUTLIER_TX_HASHES.includes(r.txHash.toLowerCase());
  });

  if (selected.length === 0) {
    console.log('[cleanupTargetWalletOutliers] nothing matched explicit selection.');
    return;
  }

  const ids = selected.map((r) => r.id);
  const result = await prisma.walletTransaction.updateMany({
    where: { id: { in: ids } },
    data: {
      txType: 'TARGET_TOKEN_SWAP',
      valueUsd: null,
    },
  });

  console.log('[cleanupTargetWalletOutliers] updated rows', result.count);
}

main()
  .catch((err) => {
    console.error('[cleanupTargetWalletOutliers] failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
