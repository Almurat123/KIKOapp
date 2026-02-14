import prisma, { withRetry } from '../db/prisma.js';
import { backfillMissingTargetUsd } from '../services/targetWalletTrackingService.js';
import { calculateTargetPnlSummary } from '../services/targetWalletPnl.js';

const USER_ID = process.env.USER_ID || 'did:privy:cmk74yj4r03jcl70b8hwyuh2c';
const MAX_TX_USD = Number(process.env.TARGET_STATUS_MAX_TX_USD || 250000);
const MAX_BACKFILL_ROUNDS_PER_WALLET = Number(process.env.MAX_BACKFILL_ROUNDS_PER_WALLET || 12);
const DB_RETRIES = Number(process.env.REBUILD_DB_RETRIES || 5);

async function db<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, DB_RETRIES, 300);
}

function chainLabel(chainId: number): string {
  if (chainId === 8453) return 'base';
  if (chainId === 56) return 'bsc';
  if (chainId === 900) return 'solana';
  if (chainId === 42161) return 'arbitrum';
  if (chainId === 10) return 'optimism';
  if (chainId === 137) return 'polygon';
  return 'eth';
}

async function summarizeConfig(configId: string, wallet: string, chainId: number, createdAt: Date) {
  const chain = chainLabel(chainId);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since = createdAt > monthAgo ? createdAt : monthAgo;

  const [rows, txRows] = await Promise.all([
    db(() => prisma.walletTransaction.groupBy({
      by: ['txType'],
      where: {
        walletAddress: wallet.toLowerCase(),
        chain,
        blockTimestamp: { gte: since },
        txType: { in: ['TARGET_BUY', 'TARGET_SELL'] },
      },
      _count: { _all: true },
    })),
    db(() => prisma.walletTransaction.findMany({
      where: {
        walletAddress: wallet.toLowerCase(),
        chain,
        blockTimestamp: { gte: since },
        txType: { in: ['TARGET_BUY', 'TARGET_SELL', 'BUY', 'SELL'] },
      },
      select: {
        id: true,
        txType: true,
        tokenAddress: true,
        amount: true,
        valueUsd: true,
        blockTimestamp: true,
      },
      orderBy: { blockTimestamp: 'asc' },
    })),
  ]);

  const normalizedRows = txRows
    .filter((r): r is typeof r & { txType: 'TARGET_BUY' | 'TARGET_SELL' | 'BUY' | 'SELL' } =>
      r.txType === 'TARGET_BUY' || r.txType === 'TARGET_SELL' || r.txType === 'BUY' || r.txType === 'SELL')
    .map((r) => ({
      id: r.id,
      txType: r.txType,
      tokenAddress: r.tokenAddress,
      amount: r.amount,
      valueUsd: r.valueUsd,
      blockTimestamp: r.blockTimestamp,
    }));

  const pnl = await calculateTargetPnlSummary(normalizedRows, {
    minTxUsd: 0.000001,
    maxTxUsd: MAX_TX_USD,
    chain,
    chainId,
  });

  const walletTxCount = await db(() => prisma.walletTransaction.count({
    where: {
      walletAddress: wallet.toLowerCase(),
      chain,
      blockTimestamp: { gte: since },
    },
  }));

  const missingUsd = await db(() => prisma.walletTransaction.count({
    where: {
      walletAddress: wallet.toLowerCase(),
      chain,
      blockTimestamp: { gte: since },
      txType: { in: ['TARGET_BUY', 'TARGET_SELL'] },
      valueUsd: null,
    },
  }));

  return {
    configId,
    wallet,
    chainId,
    grouped: rows.map((r) => ({ txType: r.txType, count: r._count._all })),
    missingUsd,
    aggregate: {
      trackedTxCount: normalizedRows.length,
      walletTxCount,
      targetRealizedProfitUsd: pnl.targetRealizedProfitUsd,
      targetRealizedLossUsd: pnl.targetRealizedLossUsd,
      targetRealizedPnlUsd: pnl.targetRealizedPnlUsd,
      targetUnrealizedPnlUsd: pnl.targetUnrealizedPnlUsd,
      targetTotalPnlUsd: pnl.targetTotalPnlUsd,
    },
  };
}

async function main() {
  const configs = await db(() => prisma.copyTradeConfig.findMany({
    where: { userId: USER_ID },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      targetWallet: true,
      chainId: true,
      createdAt: true,
      status: true,
    },
  }));

  console.log('[rebuildTargetWalletMetrics] configs', configs.length);

  for (const cfg of configs) {
    const chain = chainLabel(cfg.chainId);
    const wallet = cfg.targetWallet.toLowerCase();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const since = cfg.createdAt > monthAgo ? cfg.createdAt : monthAgo;

    try {
      const outlierUpdate = await db(() => prisma.walletTransaction.updateMany({
        where: {
          walletAddress: wallet,
          chain,
          blockTimestamp: { gte: since },
          txType: { in: ['TARGET_BUY', 'TARGET_SELL'] },
          valueUsd: { gt: MAX_TX_USD },
        },
        data: {
          valueUsd: null,
          parseReason: 'clean_outlier',
          source: 'cleanup',
        },
      }));

      let totalScanned = 0;
      let totalUpdated = 0;
      for (let i = 0; i < MAX_BACKFILL_ROUNDS_PER_WALLET; i++) {
        const r = await backfillMissingTargetUsd({
          walletAddress: wallet,
          chainId: cfg.chainId,
          limit: 40,
        });
        totalScanned += r.scanned;
        totalUpdated += r.updated;
        if (r.scanned === 0) break;
      }

      const summary = await summarizeConfig(cfg.id, wallet, cfg.chainId, cfg.createdAt);
      console.log(JSON.stringify({
        configId: cfg.id,
        wallet,
        chainId: cfg.chainId,
        status: cfg.status,
        outlierUpdated: outlierUpdate.count,
        backfillScanned: totalScanned,
        backfillUpdated: totalUpdated,
        grouped: summary.grouped,
        missingUsd: summary.missingUsd,
        trackedTxCount: summary.aggregate?.trackedTxCount ?? null,
        walletTxCount: (summary.aggregate as any)?.walletTxCount ?? null,
        realizedProfit: summary.aggregate?.targetRealizedProfitUsd ?? null,
        realizedLoss: summary.aggregate?.targetRealizedLossUsd ?? null,
        realized: summary.aggregate?.targetRealizedPnlUsd ?? null,
        unrealized: summary.aggregate?.targetUnrealizedPnlUsd ?? null,
        total: summary.aggregate?.targetTotalPnlUsd ?? null,
      }));
    } catch (err) {
      console.error('[rebuildTargetWalletMetrics] per-config failed', {
        configId: cfg.id,
        wallet,
        chainId: cfg.chainId,
        error: (err as any)?.message || err
      });
    }
  }
}

main()
  .catch((e) => {
    console.error('[rebuildTargetWalletMetrics] failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
