import prisma from '../../../db/prisma.js';
import { normalizeAddress } from '../../../utils/address.js';
import { matchesSemanticTargetSell } from './targetSellSemantics.js';

export type TargetSellLinkReasonCode =
  | 'TARGET_SELL_LINKED_FROM_LEADER_BUY'
  | 'TARGET_SELL_LINKED_FROM_POSITION_CREATED_AT'
  | 'TARGET_SELL_LINKED_FROM_UNANCHORED_VERIFIED_EXIT'
  | 'TARGET_SELL_LINK_NOT_FOUND';

export interface TargetSellLinkResolution {
  txHash: string | null;
  blockTimestamp: Date | null;
  reasonCode: TargetSellLinkReasonCode;
}

function earliestDate(values: Array<Date | null | undefined>): Date | null {
  const dates = values.filter((value): value is Date => value instanceof Date);
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((value) => value.getTime())));
}

async function resolveLeaderBuyAnchor(params: {
  targetWallet: string;
  chainId: number;
  leaderBuyTxHash?: string | null;
}): Promise<Date | null> {
  const normalizedWallet = normalizeAddress(params.targetWallet || '');
  const leaderBuyTxHash = String(params.leaderBuyTxHash || '').trim();
  if (!normalizedWallet || !leaderBuyTxHash) return null;
  const row = await prisma.walletTransaction.findFirst({
    where: {
      walletAddress: { equals: normalizedWallet, mode: 'insensitive' },
      chainId: params.chainId,
      txType: 'TARGET_BUY',
      txHash: leaderBuyTxHash,
    },
    select: { blockTimestamp: true },
  });
  return row?.blockTimestamp || null;
}

async function findLatestTargetSell(params: {
  targetWallet: string;
  chainId: number;
  tokenAddress: string;
  blockTimestampGte?: Date | null;
}): Promise<{ txHash: string; blockTimestamp: Date } | null> {
  const normalizedWallet = normalizeAddress(params.targetWallet || '');
  const normalizedToken = normalizeAddress(params.tokenAddress || '');
  if (!normalizedWallet || !normalizedToken) return null;
  return prisma.walletTransaction.findFirst({
    where: {
      walletAddress: { equals: normalizedWallet, mode: 'insensitive' },
      chainId: params.chainId,
      txType: { in: ['TARGET_SELL', 'TARGET_TOKEN_SWAP'] },
      OR: [
        { tokenAddress: { equals: normalizedToken, mode: 'insensitive' } },
        { tokenInAddress: { equals: normalizedToken, mode: 'insensitive' } },
      ],
      ...(params.blockTimestampGte ? { blockTimestamp: { gte: params.blockTimestampGte } } : {}),
    },
    orderBy: [{ blockTimestamp: 'desc' }, { createdAt: 'desc' }],
    select: { txHash: true, blockTimestamp: true, txType: true, tokenAddress: true, tokenInAddress: true },
  });
}

export async function resolveTargetSellLink(params: {
  targetWallet: string;
  chainId: number;
  tokenAddress: string;
  leaderBuyTxHash?: string | null;
  positionCreatedAt?: Date | null;
  pendingCreatedAt?: Date | null;
  allowUnanchoredVerifiedFallback?: boolean;
  targetFullExitVerified?: boolean;
}): Promise<TargetSellLinkResolution> {
  const leaderBuyAnchor = await resolveLeaderBuyAnchor({
    targetWallet: params.targetWallet,
    chainId: params.chainId,
    leaderBuyTxHash: params.leaderBuyTxHash,
  });
  const createdAnchor = earliestDate([params.positionCreatedAt, params.pendingCreatedAt]);
  const anchoredSince = earliestDate([leaderBuyAnchor, createdAnchor]);
  const anchoredSell = await findLatestTargetSell({
    targetWallet: params.targetWallet,
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    blockTimestampGte: anchoredSince,
  });
  if (anchoredSell) {
    if (!matchesSemanticTargetSell({
      txType: (anchoredSell as any).txType,
      tokenAddress: (anchoredSell as any).tokenAddress,
      tokenInAddress: (anchoredSell as any).tokenInAddress,
      targetTokenAddress: params.tokenAddress,
    })) {
      return {
        txHash: null,
        blockTimestamp: null,
        reasonCode: 'TARGET_SELL_LINK_NOT_FOUND',
      };
    }
    return {
      txHash: anchoredSell.txHash,
      blockTimestamp: anchoredSell.blockTimestamp,
      reasonCode: leaderBuyAnchor ? 'TARGET_SELL_LINKED_FROM_LEADER_BUY' : 'TARGET_SELL_LINKED_FROM_POSITION_CREATED_AT',
    };
  }

  if (params.allowUnanchoredVerifiedFallback && params.targetFullExitVerified) {
    const fallbackSell = await findLatestTargetSell({
      targetWallet: params.targetWallet,
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
    });
    if (fallbackSell) {
      if (!matchesSemanticTargetSell({
        txType: (fallbackSell as any).txType,
        tokenAddress: (fallbackSell as any).tokenAddress,
        tokenInAddress: (fallbackSell as any).tokenInAddress,
        targetTokenAddress: params.tokenAddress,
      })) {
        return {
          txHash: null,
          blockTimestamp: null,
          reasonCode: 'TARGET_SELL_LINK_NOT_FOUND',
        };
      }
      return {
        txHash: fallbackSell.txHash,
        blockTimestamp: fallbackSell.blockTimestamp,
        reasonCode: 'TARGET_SELL_LINKED_FROM_UNANCHORED_VERIFIED_EXIT',
      };
    }
  }

  return {
    txHash: null,
    blockTimestamp: null,
    reasonCode: 'TARGET_SELL_LINK_NOT_FOUND',
  };
}
