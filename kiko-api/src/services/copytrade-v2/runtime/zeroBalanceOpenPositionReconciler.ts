import { ethers } from 'ethers';

import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { readEvmTokenBalanceFast, readEvmTokenDecimalsFast } from '../../rpc/balanceRpcReader.js';
import { reconcileNoopExitPosition } from '../exit/persistence.js';

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Avery Lin
// Reason: Follower wallets can manually sell or otherwise clear token balance without a
//         mirrored target-sell path being detected, which leaves legacy open positions in
//         TP/SL monitoring forever and causes pointless recurring price fetches.
// Goal: Reconcile mature open positions out of the monitor loop when the wallet no longer
//       holds the token balance required to justify an open position.
// Owns: Balance-based closure of mature EVM open positions with no remaining wallet exposure.
// Does Not Own: Detecting target sells, deciding mirror-sell attribution, or pricing policy.
// Design Language:
// - Zero wallet balance is stronger than stale legacy open state for mature positions.
// - Balance-based close must be narrow: mature positions only, EVM only, and dust-safe.
// - Do not use this reconciler to infer mirror-sell attribution or exit execution success.
// - Forbidden local patch patterns: continuing TP/SL checks without first confirming the follower still owns the token.
// Document Provenance:
// - Source: /Users/almurat/Downloads/logs.1776058177552.json
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: proving a manually-sold follower position kept triggering periodic monitor price fetches
// - Verification: verified in runtime
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-open-position-zero-balance-reconciler.md
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: owner boundary for generic self-sell / zero-balance monitor cleanup
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-open-position-zero-balance-reconciler.md

const OPEN_POSITION_ZERO_BALANCE_RECONCILE_MIN_AGE_MS = Math.max(
  60_000,
  Number(process.env.COPYTRADE_OPEN_POSITION_ZERO_BALANCE_RECONCILE_MIN_AGE_MS || '180000'),
);
const ZERO_BALANCE_RAW_THRESHOLD = 1000n;
const ZERO_BALANCE_USD_THRESHOLD = 0.1;

type OpenPositionLike = {
  id: string;
  status?: string | null;
  tokenAddress: string;
  chainId: number;
  tokenSymbol?: string | null;
  userId?: string | null;
  configId?: string | null;
  createdAt?: Date | string | null;
};

type ReconcileDeps = {
  readBalance: typeof readEvmTokenBalanceFast;
  readDecimals: typeof readEvmTokenDecimalsFast;
  reconcile: typeof reconcileNoopExitPosition;
};

export async function reconcileZeroBalanceOpenPosition(params: {
  position: OpenPositionLike;
  walletAddress?: string | null;
  currentPrice?: number | null;
  deps?: Partial<ReconcileDeps>;
}): Promise<{ closed: boolean; balanceRaw?: bigint; closeReason?: 'balance_empty' | 'balance_dust'; skipped?: string }> {
  const position = params.position;
  if (position.chainId === 900) return { closed: false, skipped: 'solana_not_supported' };
  if (String(position.status || '').toLowerCase() !== 'open') return { closed: false, skipped: 'not_open' };

  const createdAt = position.createdAt ? new Date(position.createdAt) : null;
  const positionAgeMs = createdAt && !Number.isNaN(createdAt.getTime())
    ? Date.now() - createdAt.getTime()
    : 0;
  if (positionAgeMs < OPEN_POSITION_ZERO_BALANCE_RECONCILE_MIN_AGE_MS) {
    return { closed: false, skipped: 'too_new' };
  }

  const walletAddress = String(params.walletAddress || '').trim();
  if (!walletAddress) return { closed: false, skipped: 'missing_wallet' };

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
        path: 'copytrade_tpsl_open_zero_balance_reconcile',
        lane: 'critical',
      }),
      deps.readDecimals({
        tokenAddress: position.tokenAddress,
        chainId: position.chainId,
        path: 'copytrade_tpsl_open_zero_balance_reconcile_decimals',
        lane: 'critical',
      }).catch(() => 18),
    ]);

    const price = Number(params.currentPrice || 0);
    const balanceFloat = Number(ethers.formatUnits(balanceRaw, decimals));
    const balanceUsd = Number.isFinite(price) && price > 0 && Number.isFinite(balanceFloat)
      ? balanceFloat * price
      : null;
    const treatAsEmptyOrDust = balanceRaw <= 0n
      || balanceRaw <= ZERO_BALANCE_RAW_THRESHOLD
      || (balanceUsd !== null && balanceUsd < ZERO_BALANCE_USD_THRESHOLD);

    if (!treatAsEmptyOrDust) {
      return { closed: false, balanceRaw, skipped: 'positive_balance' };
    }

    const closeReason = balanceRaw <= 0n ? 'balance_empty' : 'balance_dust';
    await deps.reconcile({
      positions: [position],
      action: 'close_position',
      closeReason,
    });
    logger.warn(LogCode.WTC_TX_SKIPPED, 'Open position reconciled closed from zero follower balance', {
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
      positionAgeMs,
    });
    return { closed: true, balanceRaw, closeReason };
  } catch (error: any) {
    logger.warn(LogCode.API_FETCH_FAILED, 'Zero-balance open-position reconciliation skipped: balance unavailable', {
      positionId: position.id,
      userId: position.userId || undefined,
      configId: position.configId || undefined,
      token: position.tokenSymbol || position.tokenAddress,
      chainId: position.chainId,
      walletAddress,
      error: error?.message || String(error),
    });
    return { closed: false, skipped: 'balance_unavailable' };
  }
}
