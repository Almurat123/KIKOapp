import { AppError } from '../middleware/errorHandler.js';
import { LogCode } from '../config/logRegistry.js';
import { logger } from '../utils/logger.js';

export type EmbeddedWalletChainType = 'ethereum' | 'solana' | 'auto';

const walletInfoCache = new Map<string, { info: { address: string; id: string } | null; ts: number }>();
const WALLET_INFO_CACHE_TTL_MS = Number(process.env.PRIVY_WALLET_INFO_CACHE_TTL_MS || '600000');

function isLikelyEvmAddress(value: unknown): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ''));
}

function isPrivyEmbeddedWalletAccount(account: any): boolean {
  if (account?.type !== 'wallet') return false;
  const walletClientType = String(account?.walletClientType || '').toLowerCase();
  if (walletClientType && walletClientType !== 'privy') return false;
  return typeof account?.address === 'string' && account.address.length > 0;
}

function resolveEmbeddedWallet(user: any, chainType: EmbeddedWalletChainType) {
  const linkedWallets = (user?.linkedAccounts || []).filter(isPrivyEmbeddedWalletAccount);
  const evmWallet =
    linkedWallets.find((account: any) =>
      String(account?.chainType || '').toLowerCase() === 'ethereum' && isLikelyEvmAddress(account?.address)
    )
    || linkedWallets.find((account: any) => isLikelyEvmAddress(account?.address))
    || null;
  const solanaWallet =
    linkedWallets.find((account: any) => String(account?.chainType || '').toLowerCase() === 'solana')
    || linkedWallets.find((account: any) => !isLikelyEvmAddress(account?.address))
    || null;

  const embeddedWallet =
    chainType === 'ethereum'
      ? evmWallet
      : chainType === 'solana'
        ? solanaWallet
        : (evmWallet || solanaWallet || linkedWallets[0] || null);

  return {
    linkedWallets,
    embeddedWallet,
  };
}

export async function fetchPrivyEmbeddedWalletInfo(
  userId: string,
  deps: {
    chainType?: EmbeddedWalletChainType;
    getUser: (userId: string) => Promise<any>;
  }
): Promise<{ address: string; id: string } | null> {
  const chainType = deps.chainType || 'auto';
  const cacheKey = `${userId}:${chainType}`;
  const cached = walletInfoCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < WALLET_INFO_CACHE_TTL_MS) {
    return cached.info;
  }

  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const user = await deps.getUser(userId);
      const { linkedWallets, embeddedWallet } = resolveEmbeddedWallet(user, chainType);

      if (!embeddedWallet) {
        logger.warn(LogCode.SYS_INFO, 'User has no embedded wallet for requested chain', {
          userId,
          chainType,
          linkedWalletCount: linkedWallets.length,
          linkedChains: linkedWallets.map((account: any) => String(account?.chainType || 'unknown')),
        });
        walletInfoCache.set(cacheKey, { info: null, ts: Date.now() });
        return null;
      }

      const result = {
        address: String(embeddedWallet.address || ''),
        id: String(embeddedWallet.id || embeddedWallet.address || ''),
      };
      walletInfoCache.set(cacheKey, { info: result, ts: Date.now() });
      return result;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delayMs = 500 * Math.pow(2, attempt);
        logger.warn(LogCode.SYS_INFO, `Privy wallet fetch failed, retrying in ${delayMs}ms`, {
          userId,
          attempt: attempt + 1,
          maxRetries,
          error: error?.message || String(error),
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  logger.error(LogCode.SYS_ERROR, 'Error getting user wallet from Privy after retries', {
    userId,
    attempts: maxRetries,
    error: lastError?.message,
  });
  const lastErrorMessage = String(lastError?.message || '');
  if (lastErrorMessage.toLowerCase().includes('invalid app id or app secret')) {
    throw new AppError(
      503,
      'Privy server credentials are invalid on the API server. Check PRIVY_APP_ID and PRIVY_APP_SECRET.',
      'PRIVY_INVALID_SERVER_CONFIG'
    );
  }
  throw new AppError(500, 'Failed to get user wallet', 'WALLET_ERROR');
}
