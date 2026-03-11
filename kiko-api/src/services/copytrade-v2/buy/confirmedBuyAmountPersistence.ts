import { ethers } from 'ethers';

import prisma from '../../../db/prisma.js';
import { encodePositionTokenAmount } from '../positions/positionDecimalCodec.js';
import { syncCopytradeLedgerFromLegacy } from '../ledger/copytradeLedgerRepository.js';

export async function persistConfirmedBuyAmount(params: {
  positionId?: string | null;
  chainId: number;
  tokenAddress: string;
  walletAddress: string;
  targetWallet?: string | null;
  txHash: string;
  amountRaw: string;
  decimals: number;
}): Promise<{ amountHuman: string } | null> {
  if (!params.positionId) return null;

  const normalizedRaw = String(params.amountRaw || '').trim();
  if (!/^\d+$/.test(normalizedRaw)) return null;

  const amountHuman = ethers.formatUnits(normalizedRaw, params.decimals);
  const encoded = encodePositionTokenAmount({ exactAmount: normalizedRaw });

  await prisma.position.updateMany({
    where: { id: params.positionId },
    data: {
      entryTxHash: params.txHash,
      entryAmount: amountHuman,
      entryAmountExact: encoded.exactAmount || normalizedRaw,
      entryAmountDec: encoded.decimalAmount || undefined,
    },
  });

  await prisma.pendingAttributedPosition.updateMany({
    where: {
      positionId: params.positionId,
      status: { in: ['armed', 'sell_armed'] },
    },
    data: {
      entryTxHash: params.txHash,
      expectedAmountRaw: normalizedRaw,
      expectedAmountDec: encoded.decimalAmount || undefined,
      reasonCode: 'confirmed_receipt_amount',
    },
  }).catch(() => null);

  await syncCopytradeLedgerFromLegacy({
    positionId: params.positionId,
    targetWallet: params.targetWallet,
    followerBuyTxHash: params.txHash,
    lastExecutionState: 'confirmed_success',
    lastExecutionReasonCode: 'confirmed_receipt_amount',
  }).catch(() => null);

  return { amountHuman };
}
