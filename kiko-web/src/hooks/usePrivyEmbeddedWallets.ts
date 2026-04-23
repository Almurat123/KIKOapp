import { useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';

export type EmbeddedPrivyWallet = WalletWithMetadata & {
  walletInstance?: any;
  signAndSendTransaction?: (...args: any[]) => Promise<any>;
  signTransaction?: (...args: any[]) => Promise<any>;
};

function isPrivyWallet(account: any): boolean {
  const accountType = String(account?.type || '').toLowerCase();
  return (
    (!accountType || accountType === 'wallet' || accountType === 'ethereum' || accountType === 'solana') &&
    account?.walletClientType === 'privy' &&
    typeof account?.address === 'string' &&
    account.address.length > 0
  );
}

export function usePrivyEmbeddedWallets() {
  const { user } = usePrivy();
  const { wallets: connectedWallets } = useWallets();
  const { wallets: embeddedSolanaWallets } = useSolanaWallets();

  return useMemo(() => {
    const linkedWallets = (user?.linkedAccounts || [])
      .filter(isPrivyWallet)
      .map((account) => ({ ...account })) as EmbeddedPrivyWallet[];

    const mergedByAddress = new Map<string, EmbeddedPrivyWallet>();
    for (const wallet of linkedWallets) {
      mergedByAddress.set(wallet.address.toLowerCase(), wallet);
    }

    for (const wallet of connectedWallets || []) {
      if (!isPrivyWallet(wallet)) continue;
      const existing = mergedByAddress.get(wallet.address.toLowerCase());
      mergedByAddress.set(wallet.address.toLowerCase(), {
        ...(existing || {}),
        ...wallet,
      } as unknown as EmbeddedPrivyWallet);
    }

    for (const wallet of embeddedSolanaWallets || []) {
      const key = String(wallet.address || '').toLowerCase();
      if (!key) continue;
      const existing = mergedByAddress.get(key);
      mergedByAddress.set(key, {
        ...(existing || {}),
        address: wallet.address,
        chainType: 'solana',
        type: 'wallet',
        walletClientType: 'privy',
        connectorType: existing?.connectorType || 'solana',
        walletInstance: wallet,
        signAndSendTransaction: wallet.signAndSendTransaction?.bind(wallet),
        signTransaction: wallet.signTransaction?.bind(wallet),
      } as EmbeddedPrivyWallet);
    }

    const allWallets = Array.from(mergedByAddress.values());
    const evmWallet =
      allWallets.find((wallet) => wallet.chainType === 'ethereum')
      || null;
    const solanaWallet =
      allWallets.find((wallet) => wallet.chainType === 'solana' || !wallet.address.startsWith('0x'))
      || null;

    return {
      allWallets,
      evmWallet,
      solanaWallet,
    };
  }, [connectedWallets, embeddedSolanaWallets, user]);
}
