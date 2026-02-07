import prisma from '../db/prisma.js';
import { bootstrapTrackedWalletHistory } from '../services/targetWalletTrackingService.js';

async function main() {
  const configs = await prisma.copyTradeConfig.findMany({
    select: {
      targetWallet: true,
      chainId: true,
      status: true,
    },
  });

  const uniqueTargets = new Map<string, { wallet: string; chainId: number; status: string }>();
  for (const cfg of configs) {
    const key = `${cfg.chainId}:${cfg.targetWallet.toLowerCase()}`;
    if (!uniqueTargets.has(key)) {
      uniqueTargets.set(key, {
        wallet: cfg.targetWallet,
        chainId: cfg.chainId,
        status: cfg.status,
      });
    }
  }

  const targets = [...uniqueTargets.values()];
  console.log('[TargetTracking] Backfill start', {
    totalConfigs: configs.length,
    uniqueTargets: targets.length,
  });

  let done = 0;
  let failed = 0;
  for (const target of targets) {
    try {
      await bootstrapTrackedWalletHistory(target.wallet, target.chainId, 180);
      done += 1;
    } catch (err: any) {
      failed += 1;
      console.warn('[TargetTracking] Backfill failed for target', {
        wallet: target.wallet,
        chainId: target.chainId,
        status: target.status,
        error: err?.message || err,
      });
    }
  }

  console.log('[TargetTracking] Backfill done', { done, failed });
}

main()
  .catch((err) => {
    console.error('[TargetTracking] Backfill script crashed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
