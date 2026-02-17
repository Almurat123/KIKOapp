import prisma from '../db/prisma.js';

type Mode = 'dry-run' | 'apply';

function parseMode(): Mode {
  return process.env.APPLY === '1' ? 'apply' : 'dry-run';
}

function normalize(addr?: string | null): string | null {
  if (!addr) return null;
  return String(addr).trim().toLowerCase();
}

async function resolveScope(): Promise<Array<{ walletAddress: string; chainId: number }>> {
  const wallet = normalize(process.env.TARGET_WALLET);
  const chainId = Number(process.env.CHAIN_ID || 0);
  const configId = String(process.env.CONFIG_ID || '').trim();
  const userId = String(process.env.USER_ID || '').trim();

  if (wallet && chainId > 0) return [{ walletAddress: wallet, chainId }];

  if (configId) {
    const cfg = await prisma.copyTradeConfig.findUnique({
      where: { id: configId },
      select: { targetWallet: true, chainId: true },
    });
    if (!cfg) throw new Error(`CONFIG_ID not found: ${configId}`);
    return [{ walletAddress: normalize(cfg.targetWallet)!, chainId: cfg.chainId }];
  }

  const where = userId ? { userId } : {};
  const cfgs = await prisma.copyTradeConfig.findMany({
    where,
    select: { targetWallet: true, chainId: true },
  });
  const uniq = new Map<string, { walletAddress: string; chainId: number }>();
  for (const c of cfgs) {
    const w = normalize(c.targetWallet);
    if (!w) continue;
    uniq.set(`${w}:${c.chainId}`, { walletAddress: w, chainId: c.chainId });
  }
  return [...uniq.values()];
}

async function main() {
  const mode = parseMode();
  const scope = await resolveScope();
  if (!scope.length) {
    console.log('[resetTargetWalletHistory] no scope found (no matching copyTradeConfig).');
    return;
  }

  const where = {
    OR: scope.map((s) => ({
      walletAddress: s.walletAddress,
      chainId: s.chainId,
    })),
    txType: { in: ['TARGET_BUY', 'TARGET_SELL', 'TARGET_TOKEN_SWAP'] },
  };

  const total = await prisma.walletTransaction.count({ where });
  const zeroUsd = await prisma.walletTransaction.count({ where: { ...where, valueUsd: 0 } });
  const nullUsd = await prisma.walletTransaction.count({ where: { ...where, valueUsd: null } });

  console.log('[resetTargetWalletHistory] scope', { wallets: scope.length, mode });
  console.log('[resetTargetWalletHistory] preview', { total, zeroUsd, nullUsd });

  if (mode !== 'apply') {
    console.log('[resetTargetWalletHistory] dry-run only. Set APPLY=1 to execute delete.');
    return;
  }

  const deleted = await prisma.walletTransaction.deleteMany({ where });
  console.log('[resetTargetWalletHistory] deleted', { count: deleted.count });
}

main()
  .catch((err) => {
    console.error('[resetTargetWalletHistory] failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
