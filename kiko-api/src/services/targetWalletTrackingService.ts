import prisma from '../db/prisma.js';
import { withRetry } from '../db/prisma.js';
import { normalizeAddress } from '../utils/address.js';
import { getWalletTransactions } from './alchemy.js';
import { calculateTargetPnlSummary } from './targetWalletPnl.js';
import { setIfNotExists } from '../cache/cacheClient.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getChainConfig } from '../config/chainConfig.js';
import { getNativeTokenPriceUsd } from './onChainPriceService.js';
import { getTokenMetadata } from './rpcService.js';
import { ethers } from 'ethers';
import { getTokenDetails } from './dexscreener.js';

const TARGET_STATUS_MIN_TX_USD = Number(process.env.TARGET_STATUS_MIN_TX_USD || 0.000001);
const TARGET_STATUS_MAX_TX_USD = Number(process.env.TARGET_STATUS_MAX_TX_USD || 250000);
const TARGET_STATUS_MAX_TX_USD_LOW_CONF = Number(process.env.TARGET_STATUS_MAX_TX_USD_LOW_CONF || 10000);
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

function chainLabelToId(chain: string): number {
  const n = String(chain || '').toLowerCase();
  if (n === 'base') return 8453;
  if (n === 'bsc') return 56;
  if (n === 'solana') return 900;
  if (n === 'arbitrum') return 42161;
  if (n === 'optimism') return 10;
  if (n === 'polygon') return 137;
  return 1;
}

function safeNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function choosePositive(...values: Array<number | null | undefined>): number | null {
  for (const v of values) {
    const n = safeNum(v);
    if (n > 0) return n;
  }
  return null;
}

function sanitizeTxUsd(row: {
  valueUsd?: number | null;
  amountIn?: string | null;
  amountOut?: string | null;
  tokenInAddress?: string | null;
  tokenOutAddress?: string | null;
  source?: string | null;
}): number | null {
  const usd = safeNum(row.valueUsd);
  if (usd <= 0) return null;
  const hasDecodedLegs = !!(row.amountIn || row.amountOut || row.tokenInAddress || row.tokenOutAddress);
  const source = String(row.source || '').toLowerCase();
  const hasTrustedSource = source === 'webhook' || source === 'backfill' || source === 'target_history';
  // Legacy rows without decoded legs/source often contain inflated USD values from old parsing logic.
  if (!hasDecodedLegs && !hasTrustedSource && usd > TARGET_STATUS_MAX_TX_USD_LOW_CONF) return null;
  return usd;
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

async function fillUsdFromDecodedLeg(params: {
  chainId: number;
  tokenAddress?: string | null;
  amountRaw?: string | null;
}): Promise<number | null> {
  const tokenAddress = params.tokenAddress ? normalizeAddress(params.tokenAddress) : '';
  const amountRaw = params.amountRaw || '';
  if (!tokenAddress || !amountRaw) return null;
  let amountBn: bigint;
  try {
    amountBn = BigInt(amountRaw);
  } catch {
    return null;
  }
  if (amountBn <= 0n) return null;

  const chainCfg = getChainConfig(params.chainId);
  const stableSet = new Set((chainCfg.stablecoins || []).map((s) => normalizeAddress(s)));
  if (stableSet.has(tokenAddress)) {
    const meta = await getTokenMetadata(params.chainId, tokenAddress, { rpcStrategy: 'fast' }).catch(() => null);
    const decimals = Number(meta?.decimals ?? 6);
    const usd = Number(ethers.formatUnits(amountBn, decimals));
    return Number.isFinite(usd) ? usd : null;
  }

  const isNativeLike = tokenAddress === normalizeAddress(chainCfg.wrappedNativeAddress) || tokenAddress === normalizeAddress('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
  if (isNativeLike) {
    const nativePrice = Number(await getNativeTokenPriceUsd(params.chainId).catch(() => 0));
    if (!Number.isFinite(nativePrice) || nativePrice <= 0) return null;
    const usd = Number(ethers.formatUnits(amountBn, 18)) * nativePrice;
    return Number.isFinite(usd) ? usd : null;
  }

  return null;
}

async function fillUsdFromTokenSpot(params: {
  chain: string;
  chainId: number;
  tokenAddress?: string | null;
  amountRaw?: string | null;
}): Promise<number | null> {
  const tokenAddress = params.tokenAddress ? normalizeAddress(params.tokenAddress) : '';
  const amountRaw = params.amountRaw || '';
  if (!tokenAddress || !amountRaw) return null;
  let amountBn: bigint;
  try {
    amountBn = BigInt(amountRaw);
  } catch {
    return null;
  }
  if (amountBn <= 0n) return null;
  const meta = await getTokenMetadata(params.chainId, tokenAddress, { rpcStrategy: 'cheap' }).catch(() => null);
  const decimals = Number(meta?.decimals ?? 18);
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) return null;
  const qty = Number(ethers.formatUnits(amountBn, decimals));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const details = await getTokenDetails(params.chain, tokenAddress).catch(() => null);
  const px = Number(details?.price || 0);
  if (!Number.isFinite(px) || px <= 0) return null;
  const usd = qty * px;
  if (!Number.isFinite(usd) || usd <= 0) return null;
  return usd;
}

export async function backfillMissingTargetUsd(params: {
  walletAddress?: string;
  chainId?: number;
  limit?: number;
} = {}): Promise<{ scanned: number; updated: number }> {
  const limit = Math.max(1, Math.min(50, Number(params.limit || 12)));
  const where: any = {
    txType: { in: ['TARGET_BUY', 'TARGET_SELL'] },
    valueUsd: null,
    AND: [
      {
        OR: [
          { parseReason: null },
          { parseReason: { not: 'backfill_unresolved' } },
        ],
      },
    ],
  };
  if (params.walletAddress) where.walletAddress = normalizeAddress(params.walletAddress);
  if (params.chainId) {
    const chain = chainIdToLabel(params.chainId);
    where.AND.push({
      OR: [
        { chainId: params.chainId },
        { chainId: null, chain },
      ],
    });
  }

  const rows = await prisma.walletTransaction.findMany({
    where,
    orderBy: { blockTimestamp: 'desc' },
    take: limit,
    select: {
      id: true,
      txHash: true,
      txType: true,
      walletAddress: true,
      chain: true,
      chainId: true,
      tokenAddress: true,
      amount: true,
      amountIn: true,
      amountOut: true,
      tokenInAddress: true,
      tokenOutAddress: true,
      valueInUsd: true,
      valueOutUsd: true,
    },
  });

  let updated = 0;
  for (const row of rows) {
    let valueUsd: number | null = null;

    if (row.txType === 'TARGET_BUY' && Number(row.valueInUsd || 0) > 0) valueUsd = Number(row.valueInUsd);
    if (row.txType === 'TARGET_SELL' && Number(row.valueOutUsd || 0) > 0) valueUsd = Number(row.valueOutUsd);

    const cid = Number(row.chainId || chainLabelToId(row.chain));
    if (!valueUsd) {
      if (row.txType === 'TARGET_BUY') {
        valueUsd = await fillUsdFromDecodedLeg({ chainId: cid, tokenAddress: row.tokenInAddress, amountRaw: row.amountIn });
      } else if (row.txType === 'TARGET_SELL') {
        valueUsd = await fillUsdFromDecodedLeg({ chainId: cid, tokenAddress: row.tokenOutAddress, amountRaw: row.amountOut });
      }
    }

    // last resort: decode tx once to recover amountIn/amountOut legs, then compute USD from cash leg
    if (!valueUsd && row.txHash) {
      try {
        const { fetchTransaction, fetchTransactionReceipt } = await import('./watcherService.js');
        const { parseSwapTransaction } = await import('./txDecoder.js');
        const [tx, receipt] = await Promise.all([
          fetchTransaction(row.txHash, cid),
          fetchTransactionReceipt(row.txHash, cid),
        ]);
        if (tx && receipt) {
          const swap = await parseSwapTransaction(tx, receipt, cid, row.walletAddress);
          if (swap) {
            const legUsd = row.txType === 'TARGET_BUY'
              ? await fillUsdFromDecodedLeg({ chainId: cid, tokenAddress: swap.tokenIn, amountRaw: swap.amountIn })
              : await fillUsdFromDecodedLeg({ chainId: cid, tokenAddress: swap.tokenOut, amountRaw: swap.amountOut });
            if (legUsd && legUsd > 0) {
              valueUsd = legUsd;
              await withRetry(() => prisma.walletTransaction.update({
                where: { id: row.id },
                data: {
                  chainId: cid,
                  tokenInAddress: normalizeAddress(swap.tokenIn),
                  tokenOutAddress: normalizeAddress(swap.tokenOut),
                  amountIn: swap.amountIn || null,
                  amountOut: swap.amountOut || null,
                  valueUsd: legUsd,
                  parseReason: 'backfill_decode',
                  source: 'backfill',
                },
              }), 4, 200);
              updated += 1;
              continue;
            }
          }
        }
      } catch {
        // keep silent: backfill best-effort only
      }
    }

    if (valueUsd && Number.isFinite(valueUsd) && valueUsd > 0) {
      await withRetry(() => prisma.walletTransaction.update({
        where: { id: row.id },
        data: {
          chainId: cid,
          valueUsd,
          parseReason: row.txType === 'TARGET_BUY' ? 'backfill_buy_leg' : 'backfill_sell_leg',
          source: 'backfill',
        },
      }), 4, 200);
      updated += 1;
    } else {
      // final fallback: estimate by current token spot using tokenAddress+amount
      const spotUsd = await fillUsdFromTokenSpot({
        chain: row.chain,
        chainId: cid,
        tokenAddress: row.tokenAddress,
        amountRaw: row.amount,
      });
      if (spotUsd && Number.isFinite(spotUsd) && spotUsd > 0) {
        await withRetry(() => prisma.walletTransaction.update({
          where: { id: row.id },
          data: {
            chainId: cid,
            valueUsd: spotUsd,
            parseReason: 'backfill_spot',
            source: 'backfill',
          },
        }), 4, 200);
        updated += 1;
        continue;
      }

      // Mark as unresolved so repeated status refreshes don't re-run heavy decode forever.
      await withRetry(() => prisma.walletTransaction.update({
        where: { id: row.id },
        data: {
          chainId: cid,
          parseReason: 'backfill_unresolved',
          source: 'backfill',
        },
      }), 4, 200);
    }
  }

  return { scanned: rows.length, updated };
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
  const db = <T>(fn: () => Promise<T>) => withRetry(fn, 4, 250);
  const cfg = await db(() => prisma.copyTradeConfig.findFirst({
    where: { id: params.configId, userId: params.userId },
  }));
  if (!cfg) return null;

  const walletAddress = normalizeAddress(cfg.targetWallet);
  const chain = chainIdToLabel(cfg.chainId);
  // Use config creation time as strict baseline so target metrics are "since subscription start".
  // This avoids mixing pre-subscription wallet history into current strategy stats.
  const since = cfg.createdAt;
  const recentLimit = params.recentLimit ?? 80;

  // Refresh latest wallet activity before aggregating so card data stays current.
  await bootstrapTrackedWalletHistory(walletAddress, cfg.chainId, Math.max(120, recentLimit), {
    source: 'target_status'
  }).catch(() => undefined);
  // Non-blocking best-effort repair for missing USD values (does not affect trading path).
  void backfillMissingTargetUsd({ walletAddress, chainId: cfg.chainId, limit: 8 }).catch(() => undefined);

  const [leaderStats, recentTx, copiedPositions, targetTradeTxs, walletTxCount] = await Promise.all([
    db(() => prisma.leaderWalletStats.findUnique({
      where: { address_chainId: { address: walletAddress, chainId: cfg.chainId } },
    })),
    db(() => prisma.walletTransaction.findMany({
      where: {
        walletAddress,
        chain,
        blockTimestamp: { gte: since },
      },
      orderBy: { blockTimestamp: 'desc' },
      take: recentLimit,
    })),
    db(() => prisma.position.count({
      where: { configId: cfg.id },
    })),
    db(() => prisma.walletTransaction.findMany({
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
        source: true,
        blockTimestamp: true,
      },
      orderBy: { blockTimestamp: 'asc' },
    })),
    db(() => prisma.walletTransaction.count({
      where: {
        walletAddress,
        chain,
        blockTimestamp: { gte: since },
      },
    })),
  ]);

  let tokenSwaps = 0;
  let rawBuyCount = 0;
  let rawSellCount = 0;
  const buySellRows = targetTradeTxs.flatMap((row) => {
    if (row.txType === 'TARGET_BUY' || row.txType === 'TARGET_SELL' || row.txType === 'BUY' || row.txType === 'SELL') {
      if (row.txType === 'TARGET_BUY' || row.txType === 'BUY') rawBuyCount += 1;
      if (row.txType === 'TARGET_SELL' || row.txType === 'SELL') rawSellCount += 1;
      return [{
        id: row.id,
        txType: row.txType as 'TARGET_BUY' | 'TARGET_SELL' | 'BUY' | 'SELL',
        tokenAddress: row.tokenAddress,
        amount: row.amount,
        valueUsd: sanitizeTxUsd(row),
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
      // Fallback layer:
      // even if one leg USD is missing (common on non-standard routers/DEXes),
      // still synthesize sell+buy from tokenIn/tokenOut so cross-DEX exits are not dropped from PnL.
      const inferredSellUsd = choosePositive(row.valueInUsd, row.valueUsd, row.valueOutUsd);
      const inferredBuyUsd = choosePositive(row.valueOutUsd, row.valueUsd, row.valueInUsd);
      if (inferredSellUsd && inferredBuyUsd) {
        synthetic.push({
          id: row.id,
          txType: 'TARGET_SELL',
          tokenAddress: row.tokenInAddress || null,
          amount: row.amountIn || null,
          valueUsd: inferredSellUsd,
          blockTimestamp: row.blockTimestamp,
        });
        synthetic.push({
          id: row.id,
          txType: 'TARGET_BUY',
          tokenAddress: row.tokenOutAddress || null,
          amount: row.amountOut || null,
          valueUsd: inferredBuyUsd,
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
  const trackedTxCount = rawBuyCount + rawSellCount + tokenSwaps;
  const targetProfitUsd = safeNum(pnl.targetRealizedProfitUsd) + Math.max(0, safeNum(pnl.targetUnrealizedPnlUsd));
  const targetLossUsd = safeNum(pnl.targetRealizedLossUsd) + Math.max(0, -safeNum(pnl.targetUnrealizedPnlUsd));

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
      walletTxCount,
      buyCount: rawBuyCount,
      sellCount: rawSellCount,
      tokenSwapCount: tokenSwaps,
      buyVolumeUsd: pnl.buyVolumeUsd,
      sellVolumeUsd: pnl.sellVolumeUsd,
      netFlowUsd: pnl.netFlowUsd,
      targetRealizedPnlUsd: pnl.targetRealizedPnlUsd,
      targetRealizedProfitUsd: pnl.targetRealizedProfitUsd,
      targetRealizedLossUsd: pnl.targetRealizedLossUsd,
      targetProfitUsd,
      targetLossUsd,
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
