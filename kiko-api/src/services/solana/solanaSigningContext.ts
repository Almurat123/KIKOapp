import { AppError } from '../../middleware/errorHandler.js';
import { resolveSolanaWalletRecord } from './solanaWalletResolver.js';

export interface ResolvedSolanaSigningContext {
  walletId: string;
  address: string;
  walletSource: 'delegated' | 'server';
  reasonCode: string;
}

type SolanaSigningContextDeps = {
  getDelegatedWallet: (userId: string) => Promise<unknown>;
  getServerWallet: () => Promise<unknown>;
};

export async function resolveSolanaSigningContext(
  userId: string,
  deps: SolanaSigningContextDeps
): Promise<ResolvedSolanaSigningContext> {
  const delegatedResolution = resolveSolanaWalletRecord(await deps.getDelegatedWallet(userId));
  if (delegatedResolution.wallet) {
    return {
      walletId: delegatedResolution.wallet.id,
      address: delegatedResolution.wallet.address,
      walletSource: 'delegated',
      reasonCode: 'SOLANA_DELEGATED_WALLET_OK',
    };
  }

  const serverResolution = resolveSolanaWalletRecord(await deps.getServerWallet());
  if (serverResolution.wallet) {
    return {
      walletId: serverResolution.wallet.id,
      address: serverResolution.wallet.address,
      walletSource: 'server',
      reasonCode: delegatedResolution.reasonCode === 'missing_wallet'
        ? 'SOLANA_SERVER_WALLET_FALLBACK'
        : 'SOLANA_DELEGATED_WALLET_INVALID',
    };
  }

  throw new AppError(
    500,
    `Failed to resolve Solana signing wallet. delegated=${delegatedResolution.reasonCode} server=${serverResolution.reasonCode}`,
    'SOLANA_WALLET_INVALID'
  );
}

export const __solanaSigningContextTest = {
  resolveSolanaSigningContext,
};
