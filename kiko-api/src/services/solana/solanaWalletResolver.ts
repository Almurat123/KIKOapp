export interface SolanaWalletRecord {
  id: string;
  address: string;
}

export interface SolanaWalletResolution {
  wallet: SolanaWalletRecord | null;
  reasonCode: 'ok' | 'missing_wallet' | 'missing_wallet_id' | 'missing_wallet_address';
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function resolveSolanaWalletRecord(walletData: unknown): SolanaWalletResolution {
  if (!walletData || typeof walletData !== 'object') {
    return { wallet: null, reasonCode: 'missing_wallet' };
  }

  const candidate = walletData as Record<string, unknown>;
  const id = asNonEmptyString(candidate.id);
  const address = asNonEmptyString(candidate.address);

  if (!id) {
    return { wallet: null, reasonCode: 'missing_wallet_id' };
  }

  if (!address) {
    return { wallet: null, reasonCode: 'missing_wallet_address' };
  }

  return {
    wallet: { id, address },
    reasonCode: 'ok',
  };
}
