import { ethers } from 'ethers';
import prisma from '../../../db/prisma.js';

export async function reconcileNoopExitPosition(params: {
  userId: string;
  tokenAddress: string;
  action: 'keep_open' | 'close_position';
  closeReason?: 'balance_empty' | 'balance_dust';
}): Promise<void> {
  if (params.action !== 'close_position') return;
  await prisma.position.updateMany({
    where: { userId: params.userId, tokenAddress: params.tokenAddress, status: 'open' },
    data: {
      status: 'closed',
      exitReason: params.closeReason,
      closedAt: new Date()
    }
  });
}

export async function persistSuccessfulExit(params: {
  userId: string;
  tokenAddress: string;
  txHash: string;
  exitReason: string;
  balance: bigint;
  decimals: number;
  exitPrice: number;
}): Promise<{ openPositions: any[]; sellVolUsd: number }> {
  const openPositions = await prisma.position.findMany({
    where: { userId: params.userId, tokenAddress: params.tokenAddress, status: 'open' }
  });
  const sellAmount = Number(ethers.formatUnits(params.balance, params.decimals));
  const sellVolUsd = Number.isFinite(sellAmount) ? sellAmount * params.exitPrice : 0;

  for (const pos of openPositions) {
    let realizedPnlUsd = sellVolUsd - (pos.entryUsdValue || 0);
    const realizedPnlPct = pos.entryPrice && pos.entryPrice > 0
      ? ((params.exitPrice - pos.entryPrice) / pos.entryPrice) * 100
      : 0;
    const maxPlausiblePnl = Math.max((pos.entryUsdValue || 0) * 10, 100000);
    if (Math.abs(realizedPnlUsd) > maxPlausiblePnl) {
      realizedPnlUsd = 0;
    }
    await prisma.position.update({
      where: { id: pos.id },
      data: {
        status: 'closed',
        exitTxHash: params.txHash,
        exitReason: params.exitReason,
        closedAt: new Date(),
        exitPrice: params.exitPrice,
        exitUsdValue: sellVolUsd,
        realizedPnlUsd,
        realizedPnlPct
      }
    });
  }

  return { openPositions, sellVolUsd };
}

export async function persistFailedExitState(params: {
  userId: string;
  tokenAddress: string;
  exitReason: string;
  maxRetries: number;
}): Promise<{ retryCount: number; terminal: boolean }> {
  const position = await prisma.position.findFirst({
    where: { userId: params.userId, tokenAddress: params.tokenAddress, status: 'open' }
  });
  const retryCount = (position?.exitRetryCount || 0) + 1;
  if (retryCount <= params.maxRetries) {
    await prisma.position.updateMany({
      where: { userId: params.userId, tokenAddress: params.tokenAddress, status: 'open' },
      data: {
        exitRetryCount: retryCount,
        lastExitAttempt: new Date(),
        exitReason: params.exitReason
      }
    });
    return { retryCount, terminal: false };
  }

  await prisma.position.updateMany({
    where: { userId: params.userId, tokenAddress: params.tokenAddress, status: 'open' },
    data: {
      status: 'closed',
      exitReason: 'exit_failed_max_retries',
      closedAt: new Date()
    }
  });
  return { retryCount, terminal: true };
}
