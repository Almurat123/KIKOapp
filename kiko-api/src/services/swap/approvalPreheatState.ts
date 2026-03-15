import { ethers } from 'ethers';

import { del as cacheDel, getJson as cacheGetJson, setJson as cacheSetJson } from '../../cache/cacheClient.js';

const APPROVAL_PREHEAT_STATE_TTL_SEC = Math.max(
  30,
  Number(process.env.COPYTRADE_APPROVAL_PREHEAT_STATE_TTL_SEC || '180')
);

export type ApprovalPreheatStatus = 'submitted' | 'confirmed' | 'failed';

export interface ApprovalPreheatStateRecord {
  userId: string;
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  txHash: string;
  status: ApprovalPreheatStatus;
  updatedAt: string;
}

function normalizeAddress(value: string): string {
  return ethers.getAddress(String(value || '').trim());
}

function buildApprovalPreheatStateKey(params: {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  spenderAddress: string;
}): string {
  return [
    'copytrade:approval-preheat:v1',
    params.chainId,
    normalizeAddress(params.walletAddress).toLowerCase(),
    normalizeAddress(params.tokenAddress).toLowerCase(),
    normalizeAddress(params.spenderAddress).toLowerCase(),
  ].join(':');
}

export async function upsertApprovalPreheatState(params: {
  userId: string;
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  spenderAddress: string;
  txHash: string;
  status: ApprovalPreheatStatus;
}): Promise<ApprovalPreheatStateRecord> {
  const record: ApprovalPreheatStateRecord = {
    userId: params.userId,
    chainId: params.chainId,
    walletAddress: normalizeAddress(params.walletAddress),
    tokenAddress: normalizeAddress(params.tokenAddress),
    spenderAddress: normalizeAddress(params.spenderAddress),
    txHash: String(params.txHash || '').trim(),
    status: params.status,
    updatedAt: new Date().toISOString(),
  };
  await cacheSetJson(buildApprovalPreheatStateKey(record), record, APPROVAL_PREHEAT_STATE_TTL_SEC).catch(() => undefined);
  return record;
}

export async function getApprovalPreheatState(params: {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  spenderAddress: string;
}): Promise<ApprovalPreheatStateRecord | null> {
  return await cacheGetJson<ApprovalPreheatStateRecord>(buildApprovalPreheatStateKey(params)).catch(() => null);
}

export async function clearApprovalPreheatState(params: {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  spenderAddress: string;
}): Promise<void> {
  await cacheDel(buildApprovalPreheatStateKey(params)).catch(() => undefined);
}

export const __approvalPreheatStateTest = {
  buildApprovalPreheatStateKey,
};
