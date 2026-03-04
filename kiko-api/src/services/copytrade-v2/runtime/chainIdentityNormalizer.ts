import { normalizeAddress } from '../../../utils/address.js';
import { normalizeTxIdentity } from '../../../utils/txIdentity.js';

const SOLANA_CHAIN_ID = 900;

function normalizeGenericValue(value: string | null | undefined): string {
  return String(value || '').trim();
}

export function normalizeWallet(chainId: number, address: string | null | undefined): string {
  const normalized = normalizeAddress(normalizeGenericValue(address));
  if (!normalized) return '';
  if (chainId === SOLANA_CHAIN_ID) {
    // Solana Base58 addresses are case-sensitive.
    return normalized;
  }
  return normalized.toLowerCase();
}

export function normalizeToken(chainId: number, token: string | null | undefined): string {
  const value = normalizeGenericValue(token);
  if (!value) return '';
  if (chainId === SOLANA_CHAIN_ID) {
    return value;
  }
  return normalizeAddress(value).toLowerCase();
}

export function normalizeTxHash(chainId: number, txHash: string | null | undefined): string {
  return normalizeTxIdentity(chainId, txHash) || '';
}

export function buildIdentityKey(params: {
  chainId: number;
  txHash: string | null | undefined;
  targetWallet: string | null | undefined;
}): string {
  const txHash = normalizeTxHash(params.chainId, params.txHash);
  const targetWallet = normalizeWallet(params.chainId, params.targetWallet);
  return `${params.chainId}:${txHash}:${targetWallet}`;
}
