import { ethers } from 'ethers';

import { isNativeToken } from '../../../config/tokenRegistry.js';
import { getTransactionReceipt } from '../../rpcManager.js';

const ERC20_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

function normalizeAddress(value?: string | null): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return ethers.getAddress(raw).toLowerCase();
  } catch {
    return null;
  }
}

function parseTransferAmount(log: { data?: string | null }): bigint {
  const raw = String(log?.data || '').trim();
  if (!raw || raw === '0x') return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export function extractReceiptTokenAmount(params: {
  receipt?: {
    logs?: Array<{ address?: string; topics?: string[]; data?: string | null }>;
  } | null;
  tokenAddress: string;
  walletAddress: string;
  chainId: number;
}): string | null {
  if (isNativeToken(params.tokenAddress, params.chainId)) return null;

  const tokenAddress = normalizeAddress(params.tokenAddress);
  const walletAddress = normalizeAddress(params.walletAddress);
  if (!tokenAddress || !walletAddress) return null;

  let total = 0n;
  for (const log of params.receipt?.logs || []) {
    const logAddress = normalizeAddress(log?.address);
    if (!logAddress || logAddress !== tokenAddress) continue;
    if (!Array.isArray(log?.topics) || log.topics.length < 3) continue;
    if (String(log.topics[0] || '').toLowerCase() !== ERC20_TRANSFER_TOPIC.toLowerCase()) continue;

    const to = normalizeAddress(`0x${String(log.topics[2] || '').slice(-40)}`);
    if (!to || to !== walletAddress) continue;

    total += parseTransferAmount(log);
  }

  return total > 0n ? total.toString() : null;
}

export async function resolveConfirmedReceiptTokenAmount(params: {
  chainId: number;
  txHash: string;
  tokenAddress: string;
  walletAddress: string;
  receipt?: {
    logs?: Array<{ address?: string; topics?: string[]; data?: string | null }>;
  } | null;
}): Promise<string | null> {
  const receipt = params.receipt || await getTransactionReceipt(params.chainId, params.txHash).catch(() => null);
  return extractReceiptTokenAmount({
    receipt,
    tokenAddress: params.tokenAddress,
    walletAddress: params.walletAddress,
    chainId: params.chainId,
  });
}
