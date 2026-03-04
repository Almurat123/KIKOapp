import { createHash } from 'node:crypto';

import prisma from '../../db/prisma.js';

function makeHex(seed: string, length: number): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, length);
}

export function makeAddress(seed: string): string {
  return `0x${makeHex(seed, 40)}`;
}

export function makeTxHash(seed: string): string {
  return `0x${makeHex(seed, 64)}`;
}

export async function createCopytradeExecutionFixture(params: {
  seed: string;
  targetWallet: string;
  tokenAddress: string;
  chainId: number;
}) {
  const userId = `did:copytrade-exec:${params.seed}`;
  const walletAddress = makeAddress(`follower:${params.seed}`);
  await prisma.user.upsert({
    where: { privyDid: userId },
    update: { walletAddress },
    create: {
      privyDid: userId,
      walletAddress,
    },
  });
  await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  const config = await prisma.copyTradeConfig.create({
    data: {
      userId,
      targetWallet: params.targetWallet,
      chainId: params.chainId,
      buyAmountUsd: 100,
      mirrorSell: true,
      executionMode: 'turbo',
    },
  });
  return {
    userId,
    walletAddress,
    configId: config.id,
    tokenAddress: params.tokenAddress,
    chainId: params.chainId,
    targetWallet: params.targetWallet,
  };
}

export async function cleanupCopytradeExecutionFixture(params: {
  userIds?: string[];
  configIds?: string[];
  txHashes?: string[];
  targetWallets?: string[];
}) {
  if (params.txHashes?.length) {
    await prisma.walletTransaction.deleteMany({
      where: { txHash: { in: params.txHashes } },
    }).catch(() => undefined);
  }
  if (params.userIds?.length) {
    await prisma.copytradePositionLedger.deleteMany({
      where: { userId: { in: params.userIds } },
    }).catch(() => undefined);
    await prisma.pendingAttributedPosition.deleteMany({
      where: { userId: { in: params.userIds } },
    }).catch(() => undefined);
    await prisma.position.deleteMany({
      where: { userId: { in: params.userIds } },
    }).catch(() => undefined);
    await prisma.copyTradeConfig.deleteMany({
      where: { id: { in: params.configIds || [] } },
    }).catch(() => undefined);
    await prisma.userSettings.deleteMany({
      where: { userId: { in: params.userIds } },
    }).catch(() => undefined);
    await prisma.user.deleteMany({
      where: { privyDid: { in: params.userIds } },
    }).catch(() => undefined);
  }
  if (params.targetWallets?.length) {
    await prisma.trackedWallet.deleteMany({
      where: { address: { in: params.targetWallets } },
    }).catch(() => undefined);
  }
}
