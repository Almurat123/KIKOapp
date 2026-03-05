import { ethers } from 'ethers';
import prisma from '../../../db/prisma.js';
import { normalizeAddress } from '../../../utils/address.js';

function parseAmountRaw(value: string | null | undefined, decimals: number): bigint | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    try {
      return BigInt(raw);
    } catch {
      return null;
    }
  }
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  try {
    return ethers.parseUnits(raw, decimals);
  } catch {
    return null;
  }
}

function clampBps(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 10_000) return 10_000;
  return Math.floor(value);
}

export interface MirrorSellRatioContext {
  ratioBps: number | null;
  reasonCode:
    | 'RATIO_RESOLVED'
    | 'RATIO_SELL_NOT_FOUND'
    | 'RATIO_SELL_AMOUNT_UNAVAILABLE'
    | 'RATIO_BUY_NOT_FOUND'
    | 'RATIO_BUY_AMOUNT_UNAVAILABLE'
    | 'RATIO_INVALID_AMOUNT';
}

export async function resolveMirrorSellRatioContext(params: {
  targetWallet: string;
  chainId: number;
  tokenAddress: string;
  decimals: number;
  latestTargetSellTxHash?: string | null;
  leaderBuyTxHash?: string | null;
}): Promise<MirrorSellRatioContext> {
  const targetWallet = normalizeAddress(params.targetWallet || '');
  const tokenAddress = normalizeAddress(params.tokenAddress || '');
  if (!targetWallet || !tokenAddress) {
    return { ratioBps: null, reasonCode: 'RATIO_SELL_NOT_FOUND' };
  }

  const normalizedSellHash = String(params.latestTargetSellTxHash || '').trim();
  const sellTx = await prisma.walletTransaction.findFirst({
    where: {
      walletAddress: { equals: targetWallet, mode: 'insensitive' },
      chainId: params.chainId,
      txType: 'TARGET_SELL',
      ...(normalizedSellHash ? { txHash: normalizedSellHash } : {}),
      OR: [
        { tokenAddress: { equals: tokenAddress, mode: 'insensitive' } },
        { tokenInAddress: { equals: tokenAddress, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ blockTimestamp: 'desc' }, { createdAt: 'desc' }],
    select: {
      txHash: true,
      blockTimestamp: true,
      amountIn: true,
      amount: true,
    },
  });
  if (!sellTx) {
    return { ratioBps: null, reasonCode: 'RATIO_SELL_NOT_FOUND' };
  }

  const targetSellAmountRaw = parseAmountRaw(sellTx.amountIn || sellTx.amount, params.decimals);
  if (!targetSellAmountRaw || targetSellAmountRaw <= 0n) {
    return { ratioBps: null, reasonCode: 'RATIO_SELL_AMOUNT_UNAVAILABLE' };
  }

  const normalizedBuyHash = String(params.leaderBuyTxHash || '').trim();
  const buyTx = await prisma.walletTransaction.findFirst({
    where: {
      walletAddress: { equals: targetWallet, mode: 'insensitive' },
      chainId: params.chainId,
      txType: 'TARGET_BUY',
      ...(normalizedBuyHash ? { txHash: normalizedBuyHash } : {}),
      OR: [
        { tokenAddress: { equals: tokenAddress, mode: 'insensitive' } },
        { tokenOutAddress: { equals: tokenAddress, mode: 'insensitive' } },
      ],
      ...(sellTx.blockTimestamp ? { blockTimestamp: { lte: sellTx.blockTimestamp } } : {}),
    },
    orderBy: [{ blockTimestamp: 'desc' }, { createdAt: 'desc' }],
    select: {
      amountOut: true,
      amount: true,
    },
  });
  if (!buyTx) {
    return { ratioBps: null, reasonCode: 'RATIO_BUY_NOT_FOUND' };
  }

  const targetBuyAmountRaw = parseAmountRaw(buyTx.amountOut || buyTx.amount, params.decimals);
  if (!targetBuyAmountRaw || targetBuyAmountRaw <= 0n) {
    return { ratioBps: null, reasonCode: 'RATIO_BUY_AMOUNT_UNAVAILABLE' };
  }
  if (targetSellAmountRaw <= 0n || targetBuyAmountRaw <= 0n) {
    return { ratioBps: null, reasonCode: 'RATIO_INVALID_AMOUNT' };
  }

  const ratioBpsRaw = Number((targetSellAmountRaw * 10_000n) / targetBuyAmountRaw);
  return {
    ratioBps: clampBps(ratioBpsRaw),
    reasonCode: 'RATIO_RESOLVED',
  };
}

