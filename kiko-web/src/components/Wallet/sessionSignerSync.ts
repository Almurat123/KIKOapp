import type { User } from '@privy-io/react-auth';

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function isWalletDelegated(user: User | null | undefined, address: string | null | undefined): boolean | null {
  if (!user || !address) return null;

  const normalizedAddress = normalizeAddress(address);
  const wallet = (user.linkedAccounts || []).find((account) => (
    account.type === 'wallet'
      && account.walletClientType === 'privy'
      && typeof account.address === 'string'
      && normalizeAddress(account.address) === normalizedAddress
  ));

  return wallet && 'delegated' in wallet ? wallet.delegated === true : null;
}

export async function waitForWalletDelegation(params: {
  address: string;
  expected: boolean;
  refreshUser: () => Promise<User | null>;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<boolean> {
  const maxAttempts = params.maxAttempts ?? 4;
  const delayMs = params.delayMs ?? 900;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const nextUser = await params.refreshUser();
    const delegated = isWalletDelegated(nextUser, params.address);
    if (delegated === params.expected) {
      return delegated;
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }

  return false;
}
