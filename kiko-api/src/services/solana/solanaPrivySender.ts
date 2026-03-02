import { VersionedTransaction } from '@solana/web3.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { resolveSolanaSigningContext, type ResolvedSolanaSigningContext } from './solanaSigningContext.js';

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

export async function sendSolanaTransactionWithContextDeps(
  userId: string,
  transactionBase64: string,
  context: ResolvedSolanaSigningContext,
  deps: Omit<SolanaSenderDeps, 'getDelegatedWallet' | 'getServerWallet'>
): Promise<string> {
  logger.info(LogCode.EXE_TX_BROADCAST, 'Sending Solana transaction via Privy', {
    walletSource: context.walletSource,
    hasWalletId: true,
    walletIdPrefix: context.walletId.slice(0, 12),
    address: context.address,
    userId,
    reasonCode: context.reasonCode,
  });

  try {
    const transactionBuffer = Buffer.from(transactionBase64, 'base64');
    const transaction = deps.deserializeTransaction(transactionBuffer);

    const response = await deps.signAndSendTransaction({
      walletId: context.walletId,
      caip2: SOLANA_MAINNET_CAIP2,
      transaction,
    });

    logger.info(LogCode.EXE_TX_BROADCAST, 'Solana transaction sent via Privy', {
      txHash: response.hash,
      walletSource: context.walletSource,
      reasonCode: context.reasonCode,
    });
    return response.hash;
  } catch (error: any) {
    const errorMessage = String(error?.message || 'Unknown error');
    const errorCode = String(error?.code || error?.status || '');
    const errorStatus = Number(error?.status || error?.statusCode || 0) || undefined;
    const errorDetails =
      error?.response?.data
      || error?.data
      || error?.details
      || null;

    logger.error(LogCode.EXE_TX_REVERTED, 'Solana transaction failed via Privy', {
      error: errorMessage,
      code: errorCode || undefined,
      status: errorStatus,
      details: errorDetails,
      userId,
      walletSource: context.walletSource,
      reasonCode: context.reasonCode,
    });

    const lower = errorMessage.toLowerCase();
    if (lower.includes('not delegated')) {
      throw new AppError(
        403,
        'User has not enabled Solana server-side signing delegation.',
        'DELEGATION_REQUIRED'
      );
    }

    if (lower.includes('insufficient') || lower.includes('lamports')) {
      throw new AppError(
        400,
        `Failed to send Solana transaction: ${errorMessage}`,
        'INSUFFICIENT_FUNDS'
      );
    }

    throw new AppError(
      500,
      `Failed to send Solana transaction: ${errorMessage}`,
      'SOLANA_TRANSACTION_FAILED'
    );
  }
}

export async function sendSolanaTransactionWithDeps(
  userId: string,
  transactionBase64: string,
  deps: SolanaSenderDeps
): Promise<string> {
  const context = await resolveSolanaSigningContext(userId, deps);
  return sendSolanaTransactionWithContextDeps(userId, transactionBase64, context, deps);
}

export const __solanaPrivySenderTest = {
  resolveSolanaSigningContext,
  sendSolanaTransactionWithContextDeps,
  sendSolanaTransactionWithDeps,
};
