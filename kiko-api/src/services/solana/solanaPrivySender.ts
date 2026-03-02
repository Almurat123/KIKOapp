import { VersionedTransaction } from '@solana/web3.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { resolveSolanaWalletRecord, type SolanaWalletRecord } from './solanaWalletResolver.js';

const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' as const;

type SolanaSenderDeps = {
  getDelegatedWallet: (userId: string) => Promise<unknown>;
  getServerWallet: () => Promise<unknown>;
  deserializeTransaction: typeof VersionedTransaction.deserialize;
  signAndSendTransaction: (params: {
    walletId: string;
    caip2: typeof SOLANA_MAINNET_CAIP2;
    transaction: VersionedTransaction;
  }) => Promise<{ hash: string }>;
};

export async function resolvePreferredSolanaWallet(
  userId: string,
  deps: Pick<SolanaSenderDeps, 'getDelegatedWallet' | 'getServerWallet'>
): Promise<{ wallet: SolanaWalletRecord; walletSource: 'delegated' | 'server'; reasonCode: string }> {
  const delegatedResolution = resolveSolanaWalletRecord(await deps.getDelegatedWallet(userId));
  if (delegatedResolution.wallet) {
    return {
      wallet: delegatedResolution.wallet,
      walletSource: 'delegated',
      reasonCode: 'SOLANA_DELEGATED_WALLET_OK',
    };
  }

  const serverResolution = resolveSolanaWalletRecord(await deps.getServerWallet());
  if (serverResolution.wallet) {
    return {
      wallet: serverResolution.wallet,
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

export async function sendSolanaTransactionWithDeps(
  userId: string,
  transactionBase64: string,
  deps: SolanaSenderDeps
): Promise<string> {
  const { wallet, walletSource, reasonCode } = await resolvePreferredSolanaWallet(userId, deps);

  logger.info(LogCode.EXE_TX_BROADCAST, 'Sending Solana transaction via Privy', {
    walletSource,
    hasWalletId: true,
    walletIdPrefix: wallet.id.slice(0, 12),
    address: wallet.address,
    userId,
    reasonCode,
  });

  try {
    const transactionBuffer = Buffer.from(transactionBase64, 'base64');
    const transaction = deps.deserializeTransaction(transactionBuffer);

    const response = await deps.signAndSendTransaction({
      walletId: wallet.id,
      caip2: SOLANA_MAINNET_CAIP2,
      transaction,
    });

    logger.info(LogCode.EXE_TX_BROADCAST, 'Solana transaction sent via Privy', {
      txHash: response.hash,
      walletSource,
      reasonCode,
    });
    return response.hash;
  } catch (error: any) {
    logger.error(LogCode.EXE_TX_REVERTED, 'Solana transaction failed via Privy', {
      error: error?.message,
      userId,
      walletSource,
      reasonCode,
    });

    throw new AppError(
      500,
      `Failed to send Solana transaction: ${error?.message || 'Unknown error'}`,
      'SOLANA_TRANSACTION_FAILED'
    );
  }
}

export const __solanaPrivySenderTest = {
  resolvePreferredSolanaWallet,
  sendSolanaTransactionWithDeps,
};
