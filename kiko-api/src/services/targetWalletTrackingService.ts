import prisma from '../db/prisma.js';
import { withRetry } from '../db/prisma.js';
import { normalizeAddress } from '../utils/address.js';
import { getWalletTransactions } from './alchemy.js';
import { calculateTargetPnlSummary } from './targetWalletPnl.js';
import { setIfNotExists } from '../cache/redis.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

const TARGET_STATUS_MIN_TX_USD = Number(process.env.TARGET_STATUS_MIN_TX_USD || 0.000001);
const TARGET_STATUS_MAX_TX_USD = Number(process.env.TARGET_STATUS_MAX_TX_USD || 250000);
const TARGET_HISTORY_REFRESH_TTL_SEC = Number(process.env.TARGET_HISTORY_REFRESH_TTL_SEC || 180);

function chainIdToLabel(chainId: number): string {
  if (chainId === 8453) return 'base';
  if (chainId === 56) return 'bsc';
  if (chainId === 900) return 'solana';
  if (chainId === 42161) return 'arbitrum';
  if (chainId === 10) return 'optimism';
  if (chainId === 137) return 'polygon';
  if (chainId === 1) return 'eth';
  return 'eth';
}

function safeNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function persistTargetSwapEvent(params: {
  walletAddress: string;
  chainId: number;
  txHash?: string;
  txType: 'TARGET_BUY' | 'TARGET_SELL' | 'TARGET_TOKEN_SWAP';
  tokenIn: string;
  tokenOut: string;
  tokenInAddress?: string;
  tokenOutAddress?: string;
  amountIn?: string;
  amountOut?: string;
  valueInUsd?: number;
  valueOutUsd?: number;
  valueUsd?: number;
  blockTimestamp?: Date;
  parseReason?: string;
  source?: string;
}) {
  if (!params.txHash) return;
  const walletAddress = normalizeAddress(params.walletAddress);
  const txHash = params.txHash.toLowerCase();
  const amount = params.txType === 'TARGET_SELL' ? (params.amountIn || null) : (params.amountOut || params.amountIn || null);

  await withRetry(() => prisma.walletTransaction.upsert({
    where: {
      txHash_walletAddress: {
        txHash,
        walletAddress,
      },
    },
    create: {
      walletAddress,
      chain: chainIdToLabel(params.chainId),
      chainId: params.chainId,
      txHash,
      txType: params.txType,
      fromAddress: walletAddress,
      toAddress: walletAddress,
      tokenAddress: params.txType === 'TARGET_SELL' ? normalizeAddress(params.tokenIn) : normalizeAddress(params.tokenOut),
      tokenInSymbol: params.tokenIn,
      tokenOutSymbol: params.tokenOut,
      tokenInAddress: params.tokenInAddress ? normalizeAddress(params.tokenInAddress) : normalizeAddress(params.tokenIn),
      tokenOutAddress: params.tokenOutAddress ? normalizeAddress(params.tokenOutAddress) : normalizeAddress(params.tokenOut),
      amount,
      amountIn: params.amountIn || null,
      amountOut: params.amountOut || null,
      valueUsd: params.valueUsd ?? null,
      valueInUsd: params.valueInUsd ?? null,
      valueOutUsd: params.valueOutUsd ?? null,
      parseReason: params.parseReason ?? null,
      source: params.source ?? 'webhook',
      blockTimestamp: params.blockTimestamp || new Date(),
    },
    update: {
      chainId: params.chainId,
      txType: params.txType,
      tokenAddress: params.txType === 'TARGET_SELL' ? normalizeAddress(params.tokenIn) : normalizeAddress(params.tokenOut),
      tokenInSymbol: params.tokenIn,
      tokenOutSymbol: params.tokenOut,
      tokenInAddress: params.tokenInAddress ? normalizeAddress(params.tokenInAddress) : normalizeAddress(params.tokenIn),
      tokenOutAddress: params.tokenOutAddress ? normalizeAddress(params.tokenOutAddress) : normalizeAddress(params.tokenOut),
      amount,
      amountIn: params.amountIn || null,
      amountOut: params.amountOut || null,
      valueUsd: params.valueUsd ?? undefined,
      valueInUsd: params.valueInUsd ?? undefined,
      valueOutUsd: params.valueOutUsd ?? undefined,
      parseReason: params.parseReason ?? undefined,
      source: params.source ?? undefined,
      blockTimestamp: params.blockTimestamp || new Date(),
    },
  }), 4, 250);
}

export async function bootstrapTrackedWalletHistory(
  walletAddressRaw: string,
  chainId: number,
  limit = 120,
  options?: { force?: boolean; source?: string }
): Promise<void> {
  const walletAddress = normalizeAddress(walletAddressRaw);
  const chain = chainIdToLabel(chainId);
  const source = options?.source || 'target_history';

  if (!options?.force) {
    const lockKey = `target_tracking:history_refresh:${chainId}:${walletAddress.toLowerCase()}`;
    const claimed = await setIfNotExists(lockKey, String(Date.now()), Math.max(30, TARGET_HISTORY_REFRESH_TTL_SEC)).catch(() => true);
    if (!claimed) {
      logger.debug(LogCode.API_FETCH_FAILED, '[TargetTracking] History refresh throttled', {
        walletAddress,
        chainId,
        ttlSec: TARGET_HISTORY_REFRESH_TTL_SEC,
        source
      });
      return;
    }
  }

  const txs = await getWalletTransactions(walletAddress, { chain, limit, source }).catch((err: any) => {
    console.warn('[TargetTracking] Failed to fetch wallet history:', err?.message || err);
    return [];
  });
  if (!txs?.length) return;

  const CHUNK_SIZE = 20;
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < txs.length; i += CHUNK_SIZE) {
    const chunk = txs.slice(i, i + CHUNK_SIZE);
    for (const tx of chunk) {
      if (!tx.txHash) continue;
      try {
        await withRetry(() => prisma.walletTransaction.upsert({
          where: {
            txHash_walletAddress: {
              txHash: tx.txHash.toLowerCase(),
              walletAddress,
            },
          },
          create: {
            walletAddress,
            chain,
            txHash: tx.txHash.toLowerCase(),
            txType: tx.txType || 'TRANSFER_OUT',
            fromAddress: tx.fromAddress || null,
            toAddress: tx.toAddress || null,
            tokenSymbol: tx.tokenSymbol || null,
            tokenAddress: tx.tokenAddress ? normalizeAddress(tx.tokenAddress) : null,
            tokenInSymbol: tx.tokenInSymbol || null,
            tokenOutSymbol: tx.tokenOutSymbol || null,
            amount: tx.amount || null,
            valueUsd: safeNum(tx.valueUsd) || null,
            blockTimestamp: tx.blockTimestamp ? new Date(tx.blockTimestamp) : new Date(),
          },
          update: {
            txType: tx.txType || 'TRANSFER_OUT',
            fromAddress: tx.fromAddress || null,
            toAddress: tx.toAddress || null,
            tokenSymbol: tx.tokenSymbol || null,
            tokenAddress: tx.tokenAddress ? normalizeAddress(tx.tokenAddress) : null,
            tokenInSymbol: tx.tokenInSymbol || null,
            tokenOutSymbol: tx.tokenOutSymbol || null,
            amount: tx.amount || null,
            valueUsd: safeNum(tx.valueUsd) || null,
            blockTimestamp: tx.blockTimestamp ? new Date(tx.blockTimestamp) : new Date(),
          },
        }), 4, 250);
        ok += 1;
      } catch (err: any) {
        failed += 1;
        console.warn('[TargetTracking] Failed to upsert history tx:', {
          walletAddress,
          chainId,
          txHash: tx.txHash?.slice(0, 10),
          error: err?.message || err
        });
      }
    }

    // Small pacing pause lowers connection churn during large backfills.
    await new Promise(resolve => setTimeout(resolve, 40));
  }

  console.log('[TargetTracking] Bootstrap completed', {
    walletAddress,
    chainId,
    fetched: txs.length,
    upserted: ok,
    failed
  });
}

export async function getTargetWalletStatus(params: {
  userId: string;
  configId: string;
  recentLimit?: number;
}) {
  const cfg = await prisma.copyTradeConfig.findFirst({
    where: { id: params.configId, userId: params.userId },
  });
  if (!cfg) return null;

  const walletAddress = normalizeAddress(cfg.targetWallet);
  const chain = chainIdToLabel(cfg.chainId);
  const monthAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  const since = cfg.createdAt > monthAgo ? cfg.createdAt : monthAgo;
  const recentLimit = params.recentLimit ?? 80;

  // Refresh latest wallet activity before aggregating so card data stays current.
  await bootstrapTrackedWalletHistory(walletAddress, cfg.chainId, Math.max(120, recentLimit), {
    source: 'target_status'
  }).catch(() => undefined);

  const [leaderStats, recentTx, copiedPositions, targetTradeTxs] = await Promise.all([
    prisma.leaderWalletStats.findUnique({
      where: { address_chainId: { address: walletAddress, chainId: cfg.chainId } },
    }),
    prisma.walletTransaction.findMany({
      where: {
        walletAddress,
        chain,
        blockTimestamp: { gte: since },
      },
      orderBy: { blockTimestamp: 'desc' },
      take: recentLimit,
    }),
    prisma.position.count({
      where: { configId: cfg.id },
    }),
    prisma.walletTransaction.findMany({
      where: {
        walletAddress,
        chain,
        blockTimestamp: { gte: since },
        txType: { in: ['TARGET_BUY', 'TARGET_SELL', 'BUY', 'SELL', 'TARGET_TOKEN_SWAP', 'SWAP'] }
      },
      select: {
        id: true,
        txType: true,
        valueUsd: true,
        tokenAddress: true,
        amount: true,
        amountIn: true,
        amountOut: true,
        tokenInAddress: true,
        tokenOutAddress: true,
        valueInUsd: true,
        valueOutUsd: true,
        blockTimestamp: true,
      },
      orderBy: { blockTimestamp: 'asc' },
    }),
  ]);

  let tokenSwaps = 0;
  const buySellRows = targetTradeTxs.flatMap((row) => {
    if (row.txType === 'TARGET_BUY' || row.txType === 'TARGET_SELL' || row.txType === 'BUY' || row.txType === 'SELL') {
      return [{
        id: row.id,
        txType: row.txType as 'TARGET_BUY' | 'TARGET_SELL' | 'BUY' | 'SELL',
        tokenAddress: row.tokenAddress,
        amount: row.amount,
        valueUsd: row.valueUsd,
        blockTimestamp: row.blockTimestamp,
      }];
    }

    if (row.txType === 'TARGET_TOKEN_SWAP' || row.txType === 'SWAP') {
      tokenSwaps += 1;
      const synthetic: Array<{
        id: number;
        txType: 'TARGET_BUY' | 'TARGET_SELL';
        tokenAddress: string | null;
        amount: string | null;
        valueUsd: number | null;
        blockTimestamp: Date;
      }> = [];
      // Token->Token: interpret as sell tokenIn + buy tokenOut when both legs carry usable USD.
      if (safeNum(row.valueInUsd) > 0 && safeNum(row.valueOutUsd) > 0) {
        synthetic.push({
          id: row.id,
          txType: 'TARGET_SELL',
          tokenAddress: row.tokenInAddress || null,
          amount: row.amountIn || null,
          valueUsd: row.valueInUsd || null,
          blockTimestamp: row.blockTimestamp,
        });
        synthetic.push({
          id: row.id,
          txType: 'TARGET_BUY',
          tokenAddress: row.tokenOutAddress || null,
          amount: row.amountOut || null,
          valueUsd: row.valueOutUsd || null,
          blockTimestamp: row.blockTimestamp,
        });
      }
      return synthetic;
    }
    return [];
  });

  const pnl = await calculateTargetPnlSummary(buySellRows, {
    minTxUsd: TARGET_STATUS_MIN_TX_USD,
    maxTxUsd: TARGET_STATUS_MAX_TX_USD,
    chain,
    chainId: cfg.chainId,
  });
  const trackedTxCount = pnl.buyCount + pnl.sellCount + tokenSwaps;

  return {
    config: {
      id: cfg.id,
      targetWallet: walletAddress,
      chainId: cfg.chainId,
      createdAt: cfg.createdAt,
      status: cfg.status,
    },
    aggregate: {
      windowStartAt: since,
      windowEndAt: new Date(),
      windowDays: 30,
      trackedTxCount,
      buyCount: pnl.buyCount,
      sellCount: pnl.sellCount,
      tokenSwapCount: tokenSwaps,
      buyVolumeUsd: pnl.buyVolumeUsd,
      sellVolumeUsd: pnl.sellVolumeUsd,
      netFlowUsd: pnl.netFlowUsd,
      targetRealizedPnlUsd: pnl.targetRealizedPnlUsd,
      targetRealizedProfitUsd: pnl.targetRealizedProfitUsd,
      targetRealizedLossUsd: pnl.targetRealizedLossUsd,
      targetUnrealizedPnlUsd: pnl.targetUnrealizedPnlUsd,
      targetTotalPnlUsd: pnl.targetTotalPnlUsd,
      openPositionCostUsd: pnl.openPositionCostUsd,
      openPositionValueUsd: pnl.openPositionValueUsd,
      pricedOpenTokenCount: pnl.pricedOpenTokenCount,
      unpricedOpenTokenCount: pnl.unpricedOpenTokenCount,
      ignoredTxCount: pnl.ignoredTxCount,
      unmatchedSellCount: pnl.unmatchedSellCount,
      unmatchedSellUsd: pnl.unmatchedSellUsd,
      copyPositionsCount: copiedPositions,
      latestTxAt: recentTx[0]?.blockTimestamp || null,
    },
    leaderStats,
    recentTransactions: recentTx,
  };
}
