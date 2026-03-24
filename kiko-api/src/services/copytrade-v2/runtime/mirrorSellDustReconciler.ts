import { ethers } from 'ethers';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { readEvmTokenBalanceFast, readEvmTokenDecimalsFast } from '../../rpc/balanceRpcReader.js';
import { reconcileNoopExitPosition } from '../exit/persistence.js';

const MIRROR_SELL_DUST_RAW_THRESHOLD = 1000n;
const MIRROR_SELL_DUST_USD_THRESHOLD = 0.1;

type MirrorSellDustPosition = {
  id: string;
  exitReason?: string | null;
  status?: string | null;
  tokenAddress: string;
  chainId: number;
  tokenSymbol?: string | null;
  userId?: string | null;
  configId?: string | null;
};

type ReconcileDeps = {
  readBalance: typeof readEvmTokenBalanceFast;
  readDecimals: typeof readEvmTokenDecimalsFast;
  reconcile: typeof reconcileNoopExitPosition;
};

export async function reconcileMirrorSellDustPosition(params: {
  position: MirrorSellDustPosition;
  walletAddress?: string | null;
  currentPrice?: number | null;
  deps?: Partial<ReconcileDeps>;
}): Promise<{ closed: boolean; balanceRaw?: bigint; closeReason?: 'balance_empty' | 'balance_dust' }> {
  const position = params.position;
  if (position.chainId === 900) return { closed: false };
  if (String(position.status || '').toLowerCase() !== 'open') return { closed: false };
  if (String(position.exitReason || '').toLowerCase() !== 'mirror_sell') return { closed: false };

  const walletAddress = String(params.walletAddress || '').trim();
  if (!walletAddress) return { closed: false };

  const deps: ReconcileDeps = {
    readBalance: params.deps?.readBalance || readEvmTokenBalanceFast,
    readDecimals: params.deps?.readDecimals || readEvmTokenDecimalsFast,
    reconcile: params.deps?.reconcile || reconcileNoopExitPosition,
  };

  try {
    const [balanceRaw, decimals] = await Promise.all([
      deps.readBalance({
        tokenAddress: position.tokenAddress,
        walletAddress,
        chainId: position.chainId,
        path: 'copytrade_tpsl_mirror_sell_dust_reconcile',
        lane: 'critical',
      }),
      deps.readDecimals({
        tokenAddress: position.tokenAddress,
        chainId: position.chainId,
        path: 'copytrade_tpsl_mirror_sell_dust_reconcile_decimals',
        lane: 'critical',
      }).catch(() => 18),
    ]);

    const price = Number(params.currentPrice || 0);
    const balanceFloat = Number(ethers.formatUnits(balanceRaw, decimals));
    const balanceUsd = Number.isFinite(price) && price > 0 && Number.isFinite(balanceFloat)
      ? balanceFloat * price
      : null;
    const treatAsEmptyOrDust = balanceRaw <= 0n
      || balanceRaw <= MIRROR_SELL_DUST_RAW_THRESHOLD
      || (balanceUsd !== null && balanceUsd < MIRROR_SELL_DUST_USD_THRESHOLD);

    if (!treatAsEmptyOrDust) {
      return { closed: false, balanceRaw };
    }

    const closeReason = balanceRaw <= 0n ? 'balance_empty' : 'balance_dust';
    await deps.reconcile({
      positions: [position],
      action: 'close_position',
      closeReason,
    });
    logger.warn(LogCode.WTC_TX_SKIPPED, 'Mirror sell dust/empty position reconciled before TP/SL', {
      positionId: position.id,
      userId: position.userId || undefined,
      configId: position.configId || undefined,
      token: position.tokenSymbol || position.tokenAddress,
      chainId: position.chainId,
      walletAddress,
      balanceRaw: balanceRaw.toString(),
      decimals,
      balanceUsd,
      closeReason,
    });
    return { closed: true, balanceRaw, closeReason };
  } catch (error: any) {
    logger.warn(LogCode.API_FETCH_FAILED, 'Mirror sell dust reconciliation skipped: balance unavailable', {
      positionId: position.id,
      userId: position.userId || undefined,
      configId: position.configId || undefined,
      token: position.tokenSymbol || position.tokenAddress,
      chainId: position.chainId,
      walletAddress,
      error: error?.message || String(error),
    });
    return { closed: false };
  }
}
