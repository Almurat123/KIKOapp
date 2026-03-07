const walletChainTransactionLocks: Map<string, Promise<any>> = new Map();

export function buildWalletChainKey(chainId: number, walletAddress: string): string {
  return `${chainId}:${String(walletAddress || '').toLowerCase()}`;
}

export async function withWalletChainLock<T>(chainId: number, walletAddress: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = buildWalletChainKey(chainId, walletAddress);
  const currentLock = walletChainTransactionLocks.get(lockKey) || Promise.resolve();
  const nextLock = currentLock
    .catch(() => {})
    .then(() => fn())
    .finally(() => {
      if (walletChainTransactionLocks.get(lockKey) === nextLock) {
        walletChainTransactionLocks.delete(lockKey);
      }
    });

  walletChainTransactionLocks.set(lockKey, nextLock);
  return nextLock;
}
