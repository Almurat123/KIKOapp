import prisma from '../db/prisma.js';
import { withRetry } from '../db/prisma.js';
import { normalizeAddress } from '../utils/address.js';
import { getWalletTransactions, type WalletTransaction } from './alchemy.js';
import { calculateTargetPnlSummary } from './targetWalletPnl.js';
import { del as cacheDel, setIfNotExists } from '../cache/cacheClient.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getChainConfig } from '../config/chainConfig.js';
import { getCachedNativeTokenPriceUsd, getNativeTokenPriceUsd } from './onChainPriceService.js';
import { getTokenMetadata } from './rpcService.js';
import { ethers } from 'ethers';
import { determineCopyTradeDirection } from './copyTradeDirection.js';

const TARGET_STATUS_MIN_TX_USD = Number(process.env.TARGET_STATUS_MIN_TX_USD || 0.000001);
const TARGET_STATUS_MAX_TX_USD = Number(process.env.TARGET_STATUS_MAX_TX_USD || 250000);
const TARGET_STATUS_MAX_TX_USD_LOW_CONF = Number(process.env.TARGET_STATUS_MAX_TX_USD_LOW_CONF || 10000);
const TARGET_HISTORY_REFRESH_TTL_SEC = Number(process.env.TARGET_HISTORY_REFRESH_TTL_SEC || 180);
// How old (in seconds) cached PnL metrics can be before being considered stale and recomputed on-demand.
const TARGET_METRICS_STALE_SEC = Number(process.env.TARGET_METRICS_STALE_SEC || 300);

type BootstrapWalletTransaction = WalletTransaction & Record<string, unknown>;

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

function scoreWalletTransactionForBootstrap(tx: Partial<BootstrapWalletTransaction>): number {
  let score = 0;
  if (tx.txType && tx.txType !== 'TRANSFER_IN' && tx.txType !== 'TRANSFER_OUT') score += 10;
  if (tx.tokenAddress) score += 4;
  if ((tx as any).tokenInAddress || (tx as any).tokenOutAddress) score += 6;
  if (tx.amount && tx.amount !== '0' && tx.amount !== '0.0') score += 2;
  if ((tx as any).amountIn || (tx as any).amountOut) score += 3;
  if (safeNum(tx.valueUsd) > 0) score += 3;
  if (safeNum((tx as any).valueInUsd) > 0 || safeNum((tx as any).valueOutUsd) > 0) score += 2;
  if ((tx as any).parseReason) score += 2;
  if ((tx as any).source) score += 1;
  if (tx.blockTimestamp) score += 1;
  return score;
}

function choosePreferredBootstrapTransaction(
  left: BootstrapWalletTransaction,
  right: BootstrapWalletTransaction
): BootstrapWalletTransaction {
  const leftScore = scoreWalletTransactionForBootstrap(left);
  const rightScore = scoreWalletTransactionForBootstrap(right);
  if (rightScore !== leftScore) return rightScore > leftScore ? right : left;

  const leftTs = left.blockTimestamp ? new Date(left.blockTimestamp).getTime() : 0;
  const rightTs = right.blockTimestamp ? new Date(right.blockTimestamp).getTime() : 0;
  if (rightTs !== leftTs) return rightTs > leftTs ? right : left;

  return right;
}

function dedupeBootstrapWalletTransactions(
  txs: BootstrapWalletTransaction[]
): BootstrapWalletTransaction[] {
  const deduped = new Map<string, BootstrapWalletTransaction>();
  for (const tx of txs) {
    const txHash = String(tx?.txHash || '').trim().toLowerCase();
    if (!txHash) continue;
    const existing = deduped.get(txHash);
    deduped.set(txHash, existing ? choosePreferredBootstrapTransaction(existing, tx) : tx);
  }
  return Array.from(deduped.values()).sort((a, b) => {
    const leftTs = a.blockTimestamp ? new Date(a.blockTimestamp).getTime() : 0;
    const rightTs = b.blockTimestamp ? new Date(b.blockTimestamp).getTime() : 0;
    return rightTs - leftTs;
  });
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

type TargetTradeTxRow = {
  id: number;
  txType: string;
  valueUsd: number | null;
  tokenAddress: string | null;
  amount: string | null;
  amountIn: string | null;
  amountOut: string | null;
  tokenInAddress: string | null;
  tokenOutAddress: string | null;
  valueInUsd: number | null;
  valueOutUsd: number | null;
  source: string | null;
  blockTimestamp: Date;
};

function mapDirectionToTargetTxType(direction: ReturnType<typeof determineCopyTradeDirection>): 'TARGET_BUY' | 'TARGET_SELL' | 'TARGET_TOKEN_SWAP' {
  if (direction.directionLeg === 'buy_leg') return 'TARGET_BUY';
  if (direction.directionLeg === 'sell_leg') return 'TARGET_SELL';
  return 'TARGET_TOKEN_SWAP';
}

function mapDirectionToParseReason(prefix: 'backfill_decode' | 'history_decode', direction: ReturnType<typeof determineCopyTradeDirection>): string {
  if (direction.directionLeg === 'buy_leg') return `${prefix}_buy`;
  if (direction.directionLeg === 'sell_leg') return `${prefix}_sell`;
  if (direction.directionLeg === 'both') return `${prefix}_swap_both_legs`;
  return `${prefix}_swap`;
}

export function buildTargetBuySellRows(targetTradeTxs: TargetTradeTxRow[]) {
  let tokenSwaps = 0;
  let semanticBuyCount = 0;
  let semanticSellCount = 0;
  const buySellRows = targetTradeTxs.flatMap((row) => {
    if (row.txType === 'TARGET_BUY' || row.txType === 'TARGET_SELL' || row.txType === 'BUY' || row.txType === 'SELL') {
      if (row.txType === 'TARGET_BUY' || row.txType === 'BUY') semanticBuyCount += 1;
      if (row.txType === 'TARGET_SELL' || row.txType === 'SELL') semanticSellCount += 1;
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
        semanticSellCount += 1;
        semanticBuyCount += 1;
      }
      return synthetic;
    }
    return [];
  });

  return { buySellRows, semanticBuyCount, semanticSellCount, tokenSwaps };
}

export async function recomputeTargetMetricsForConfig(configId: string, attempt = 0): Promise<void> {
  const lockKey = `target_metrics:recompute:${configId}`;
  const claimed = await setIfNotExists(lockKey, String(Date.now()), 20).catch(() => true);
  if (!claimed) {
    if (attempt >= 4) return;
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    return recomputeTargetMetricsForConfig(configId, attempt + 1);
  }

  try {
    const cfg = await withRetry(() => prisma.copyTradeConfig.findUnique({ where: { id: configId } }), 4, 200);
    if (!cfg) return;

    const walletAddress = normalizeAddress(cfg.targetWallet);
    const chain = chainIdToLabel(cfg.chainId);
    const since = cfg.createdAt;

    const [targetTradeTxs, walletTxCount] = await Promise.all([
      withRetry(() => prisma.walletTransaction.findMany({
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
      }), 4, 200),
      withRetry(() => prisma.walletTransaction.count({
        where: {
          walletAddress,
          chain,
          blockTimestamp: { gte: since },
        },
      }), 4, 200),
    ]);

    const { buySellRows, semanticBuyCount, semanticSellCount, tokenSwaps } = buildTargetBuySellRows(targetTradeTxs);
    const pnl = await calculateTargetPnlSummary(buySellRows, {
      minTxUsd: TARGET_STATUS_MIN_TX_USD,
      maxTxUsd: TARGET_STATUS_MAX_TX_USD,
      chain,
      chainId: cfg.chainId,
    });
    const trackedTxCount = targetTradeTxs.length;
    // Card-level Profit/Loss: sum per-closed-trade realized outcomes.
    const targetProfitUsd = safeNum(pnl.targetRealizedProfitUsd);
    const targetLossUsd = safeNum(pnl.targetRealizedLossUsd);

    await withRetry(() => prisma.copyTradeConfig.update({
      where: { id: cfg.id },
      data: {
        targetTrackedTxCount: trackedTxCount,
        targetWalletTxCount: walletTxCount,
        targetBuyCount: semanticBuyCount,
        targetSellCount: semanticSellCount,
        targetTokenSwapCount: tokenSwaps,
        targetRealizedPnlUsd: safeNum(pnl.targetRealizedPnlUsd),
        targetRealizedProfitUsd: safeNum(pnl.targetRealizedProfitUsd),
        targetRealizedLossUsd: safeNum(pnl.targetRealizedLossUsd),
        targetUnrealizedPnlUsd: safeNum(pnl.targetUnrealizedPnlUsd),
        targetTotalPnlUsd: safeNum(pnl.targetTotalPnlUsd),
        targetProfitUsd: safeNum(targetProfitUsd),
        targetLossUsd: safeNum(targetLossUsd),
        targetMetricsUpdatedAt: new Date(),
      },
    }), 4, 200);
  } finally {
    void cacheDel(lockKey).catch(() => undefined);
  }
}

export async function recomputeTargetMetricsForWallet(walletAddressRaw: string, chainId: number): Promise<void> {
  const walletAddress = normalizeAddress(walletAddressRaw);
  const cfgs = await withRetry(() => prisma.copyTradeConfig.findMany({
    where: { targetWallet: walletAddress, chainId },
    select: { id: true }
  }), 4, 200);
  for (const cfg of cfgs) {
    await recomputeTargetMetricsForConfig(cfg.id).catch(() => undefined);
  }
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
  const normUsd = (v?: number): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // ── Resolve USD values when caller didn't provide them ──────────────────
  // The webhook cashLegHint is often empty for pure-token swaps, but we can
  // derive the USD value from the cash leg (stablecoins / native token) of the
  // swap using fillUsdFromDecodedLeg.  Without this, the WalletTransaction row
  // is inserted with valueUsd=null and the PnL calculator ignores the row.
  let resolvedValueInUsd = normUsd(params.valueInUsd);
  let resolvedValueOutUsd = normUsd(params.valueOutUsd);
  let resolvedValueUsd = normUsd(params.valueUsd);

  const tokenInAddr = params.tokenInAddress ? normalizeAddress(params.tokenInAddress) : normalizeAddress(params.tokenIn);
  const tokenOutAddr = params.tokenOutAddress ? normalizeAddress(params.tokenOutAddress) : normalizeAddress(params.tokenOut);

  if (!resolvedValueInUsd && params.amountIn && tokenInAddr) {
    resolvedValueInUsd = await fillUsdFromDecodedLeg({
      chainId: params.chainId,
      tokenAddress: tokenInAddr,
      amountRaw: params.amountIn,
    }).catch(() => null);
  }
  if (!resolvedValueOutUsd && params.amountOut && tokenOutAddr) {
    resolvedValueOutUsd = await fillUsdFromDecodedLeg({
      chainId: params.chainId,
      tokenAddress: tokenOutAddr,
      amountRaw: params.amountOut,
    }).catch(() => null);
  }

  // Derive the aggregate valueUsd from whichever leg we could price.
  // For TARGET_BUY  the cost  is the "in"  leg  (ETH/USDC spent).
  // For TARGET_SELL the proceeds is the "out" leg (ETH/USDC received).
  if (!resolvedValueUsd) {
    if (params.txType === 'TARGET_BUY') {
      resolvedValueUsd = resolvedValueInUsd ?? resolvedValueOutUsd ?? null;
    } else if (params.txType === 'TARGET_SELL') {
      resolvedValueUsd = resolvedValueOutUsd ?? resolvedValueInUsd ?? null;
    } else {
      // TOKEN_SWAP: prefer whichever leg has a value
      resolvedValueUsd = resolvedValueInUsd ?? resolvedValueOutUsd ?? null;
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  await withRetry(() => prisma.walletTransaction.upsert({
    where: {
      txHash_walletAddress_chain: {
        txHash,
        walletAddress,
        chain: chainIdToLabel(params.chainId),
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
      valueUsd: resolvedValueUsd,
      valueInUsd: resolvedValueInUsd,
      valueOutUsd: resolvedValueOutUsd,
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
      valueUsd: resolvedValueUsd ?? undefined,
      valueInUsd: resolvedValueInUsd ?? undefined,
      valueOutUsd: resolvedValueOutUsd ?? undefined,
      parseReason: params.parseReason ?? undefined,
      source: params.source ?? undefined,
      blockTimestamp: params.blockTimestamp || new Date(),
    },
  }), 4, 250);
  void recomputeTargetMetricsForWallet(walletAddress, params.chainId).catch(() => undefined);
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
    let nativePrice = Number(await getCachedNativeTokenPriceUsd(params.chainId).catch(() => 0));
    if (!Number.isFinite(nativePrice) || nativePrice <= 0) {
      nativePrice = Number(await getNativeTokenPriceUsd(params.chainId).catch(() => 0));
    }
    if (!Number.isFinite(nativePrice) || nativePrice <= 0) return null;
    const nativeDecimals = chainCfg.nativeCurrency?.decimals || 18;
    const usd = Number(ethers.formatUnits(amountBn, nativeDecimals)) * nativePrice;
    return Number.isFinite(usd) ? usd : null;
  }

  return null;
}

export async function backfillMissingTargetUsd(params: {
  walletAddress?: string;
  chainId?: number;
  limit?: number;
} = {}): Promise<{ scanned: number; updated: number }> {
  const limit = Math.max(1, Math.min(50, Number(params.limit || 12)));
  const where: any = {
    txType: { in: ['TARGET_BUY', 'TARGET_SELL', 'TARGET_TOKEN_SWAP'] },
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
    if (row.txType === 'TARGET_TOKEN_SWAP') valueUsd = Number(row.valueOutUsd || row.valueInUsd || 0) || null;

    const cid = Number(row.chainId || chainLabelToId(row.chain));
    if (!valueUsd) {
      if (row.txType === 'TARGET_BUY') {
        valueUsd = await fillUsdFromDecodedLeg({ chainId: cid, tokenAddress: row.tokenInAddress, amountRaw: row.amountIn });
      } else if (row.txType === 'TARGET_SELL') {
        valueUsd = await fillUsdFromDecodedLeg({ chainId: cid, tokenAddress: row.tokenOutAddress, amountRaw: row.amountOut });
      } else if (row.txType === 'TARGET_TOKEN_SWAP') {
        valueUsd =
          await fillUsdFromDecodedLeg({ chainId: cid, tokenAddress: row.tokenOutAddress, amountRaw: row.amountOut })
          || await fillUsdFromDecodedLeg({ chainId: cid, tokenAddress: row.tokenInAddress, amountRaw: row.amountIn });
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
          const swap = await parseSwapTransaction(tx, receipt, cid, row.walletAddress, {
            decodeMode: 'history'
          });
          if (swap) {
            const tokenIn = normalizeAddress(swap.tokenIn);
            const tokenOut = normalizeAddress(swap.tokenOut);
            const direction = determineCopyTradeDirection({
              chainId: cid,
              tokenIn,
              tokenOut,
              cashLegHint: swap.cashLegHint
            });
            const decodedTxType = mapDirectionToTargetTxType(direction);

            const decodedValueInUsd = await fillUsdFromDecodedLeg({ chainId: cid, tokenAddress: swap.tokenIn, amountRaw: swap.amountIn });
            const decodedValueOutUsd = await fillUsdFromDecodedLeg({ chainId: cid, tokenAddress: swap.tokenOut, amountRaw: swap.amountOut });
            const legUsd = decodedTxType === 'TARGET_BUY'
              ? decodedValueInUsd
              : decodedTxType === 'TARGET_SELL'
                ? decodedValueOutUsd
                : null;

            await withRetry(() => prisma.walletTransaction.update({
              where: { id: row.id },
              data: {
                chainId: cid,
                txType: decodedTxType,
                tokenInAddress: tokenIn,
                tokenOutAddress: tokenOut,
                tokenAddress: decodedTxType === 'TARGET_SELL' ? tokenIn : tokenOut,
                amount: decodedTxType === 'TARGET_SELL'
                  ? (swap.amountIn || null)
                  : (swap.amountOut || swap.amountIn || null),
                amountIn: swap.amountIn || null,
                amountOut: swap.amountOut || null,
                valueInUsd: decodedValueInUsd || null,
                valueOutUsd: decodedValueOutUsd || null,
                valueUsd: legUsd || null,
                parseReason: mapDirectionToParseReason('backfill_decode', direction),
                source: 'backfill',
              },
            }), 4, 200);

            if (legUsd && legUsd > 0) {
              valueUsd = legUsd;
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
      // Mark as unresolved so repeated status refreshes don't re-run heavy decode forever.
      // Do NOT write current-spot estimates into historical trade legs; it corrupts realized PnL.
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

  if (updated > 0 && params.walletAddress && params.chainId) {
    void recomputeTargetMetricsForWallet(params.walletAddress, params.chainId).catch(() => undefined);
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

  const rawTxs = await getWalletTransactions(walletAddress, { chain, limit, source }).catch((err: any) => {
    console.warn('[TargetTracking] Failed to fetch wallet history:', err?.message || err);
    return [];
  });
  const txs = dedupeBootstrapWalletTransactions(rawTxs as BootstrapWalletTransaction[]);
  if (!txs?.length) return;

  const isTradeType = (txType?: string | null): boolean =>
    txType === 'TARGET_BUY' || txType === 'TARGET_SELL' || txType === 'TARGET_TOKEN_SWAP' ||
    txType === 'BUY' || txType === 'SELL' || txType === 'SWAP';
  let decodeDeps:
    | {
      fetchTransaction: (txHash: string, chainId: number) => Promise<any>;
      fetchTransactionReceipt: (txHash: string, chainId: number) => Promise<any>;
      parseSwapTransaction: (
        tx: any,
        receipt: any,
        chainId: number,
        walletAddress: string,
        options?: { decodeMode?: 'live' | 'history' }
      ) => Promise<any>;
    }
    | null
    = null;
  const ensureDecodeDeps = async () => {
    if (decodeDeps) return decodeDeps;
    const [{ fetchTransaction, fetchTransactionReceipt }, { parseSwapTransaction }] = await Promise.all([
      import('./watcherService.js'),
      import('./txDecoder.js'),
    ]);
    decodeDeps = { fetchTransaction, fetchTransactionReceipt, parseSwapTransaction };
    return decodeDeps;
  };

  const CHUNK_SIZE = 20;
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < txs.length; i += CHUNK_SIZE) {
    const chunk = txs.slice(i, i + CHUNK_SIZE);
    for (const tx of chunk) {
      const raw: any = tx as any;
      if (!raw.txHash) continue;
      try {
        let txType: string = raw.txType || 'TRANSFER_OUT';
        let tokenAddress = raw.tokenAddress ? normalizeAddress(raw.tokenAddress) : null;
        let tokenInAddress: string | null = raw.tokenInAddress ? normalizeAddress(raw.tokenInAddress) : null;
        let tokenOutAddress: string | null = raw.tokenOutAddress ? normalizeAddress(raw.tokenOutAddress) : null;
        let amountIn: string | null = raw.amountIn || null;
        let amountOut: string | null = raw.amountOut || null;
        let amount: string | null = raw.amount || null;
        let valueUsd: number | null = safeNum(raw.valueUsd) || null;
        let valueInUsd: number | null = safeNum(raw.valueInUsd) || null;
        let valueOutUsd: number | null = safeNum(raw.valueOutUsd) || null;
        let parseReason: string | null = raw.parseReason || null;

        // History API often stores swaps as TRANSFER_IN/TRANSFER_OUT.
        // Decode tx hash here so target-status aggregation can classify BUY/SELL/SWAP.
        if (!isTradeType(txType)) {
          try {
            const deps = await ensureDecodeDeps();
            const [rawTx, receipt] = await Promise.all([
              deps.fetchTransaction(tx.txHash, chainId),
              deps.fetchTransactionReceipt(tx.txHash, chainId),
            ]);
            if (rawTx && receipt) {
              const swap = await deps.parseSwapTransaction(rawTx, receipt, chainId, walletAddress, {
                decodeMode: 'history'
              });
              if (swap?.tokenIn && swap?.tokenOut) {
                const tokenIn = normalizeAddress(swap.tokenIn);
                const tokenOut = normalizeAddress(swap.tokenOut);
                const direction = determineCopyTradeDirection({
                  chainId,
                  tokenIn,
                  tokenOut,
                  cashLegHint: swap.cashLegHint
                });
                txType = mapDirectionToTargetTxType(direction);
                tokenInAddress = tokenIn;
                tokenOutAddress = tokenOut;
                amountIn = swap.amountIn || null;
                amountOut = swap.amountOut || null;
                amount = txType === 'TARGET_SELL' ? amountIn : (amountOut || amountIn);
                tokenAddress = txType === 'TARGET_SELL' ? tokenIn : tokenOut;
                valueInUsd = await fillUsdFromDecodedLeg({ chainId, tokenAddress: tokenInAddress, amountRaw: amountIn });
                valueOutUsd = await fillUsdFromDecodedLeg({ chainId, tokenAddress: tokenOutAddress, amountRaw: amountOut });
                valueUsd = txType === 'TARGET_BUY' ? valueInUsd : txType === 'TARGET_SELL' ? valueOutUsd : null;
                parseReason = mapDirectionToParseReason('history_decode', direction);
              }
            }
          } catch {
            // best-effort only
          }
        }

        await withRetry(() => prisma.walletTransaction.upsert({
          where: {
            txHash_walletAddress_chain: {
              txHash: tx.txHash.toLowerCase(),
              walletAddress,
              chain,
            },
          },
          create: {
            walletAddress,
            chain,
            chainId,
            txHash: raw.txHash.toLowerCase(),
            txType,
            fromAddress: raw.fromAddress || null,
            toAddress: raw.toAddress || null,
            tokenSymbol: raw.tokenSymbol || null,
            tokenAddress,
            tokenInSymbol: raw.tokenInSymbol || null,
            tokenOutSymbol: raw.tokenOutSymbol || null,
            tokenInAddress,
            tokenOutAddress,
            amount,
            amountIn,
            amountOut,
            valueUsd,
            valueInUsd,
            valueOutUsd,
            parseReason,
            source,
            blockTimestamp: tx.blockTimestamp ? new Date(tx.blockTimestamp) : new Date(),
          },
          update: {
            chainId,
            txType,
            fromAddress: raw.fromAddress || null,
            toAddress: raw.toAddress || null,
            tokenSymbol: raw.tokenSymbol || null,
            tokenAddress,
            tokenInSymbol: raw.tokenInSymbol || null,
            tokenOutSymbol: raw.tokenOutSymbol || null,
            tokenInAddress,
            tokenOutAddress,
            amount,
            amountIn,
            amountOut,
            valueUsd,
            valueInUsd,
            valueOutUsd,
            parseReason,
            source,
            blockTimestamp: tx.blockTimestamp ? new Date(tx.blockTimestamp) : new Date(),
          },
        }), 4, 250);
        ok += 1;
      } catch (err: any) {
        failed += 1;
        console.warn('[TargetTracking] Failed to upsert history tx:', {
          walletAddress,
          chainId,
          txHash: raw.txHash?.slice(0, 10),
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
    fetched: rawTxs.length,
    deduped: txs.length,
    upserted: ok,
    failed
  });
  void recomputeTargetMetricsForWallet(walletAddress, chainId).catch(() => undefined);
}

export async function getTargetWalletStatus(params: {
  userId: string;
  configId: string;
  recentLimit?: number;
}) {
  const db = <T>(fn: () => Promise<T>) => withRetry(fn, 4, 250);
  let cfg = await db(() => prisma.copyTradeConfig.findFirst({
    where: { id: params.configId, userId: params.userId },
  }));
  if (!cfg) return null;

  // ── On-demand staleness refresh ──────────────────────────────────────────
  // If PnL metrics have never been computed (null) OR are older than
  // TARGET_METRICS_STALE_SEC, bootstrap history and recompute before returning.
  // This ensures the card always shows up-to-date data even when the
  // background recompute hasn't fired yet (e.g. newly created configs, missed
  // webhook events, or multi-instance deployments where the lock owner is a
  // different pod).
  const metricsAge = cfg.targetMetricsUpdatedAt
    ? (Date.now() - new Date(cfg.targetMetricsUpdatedAt).getTime()) / 1000
    : Infinity;
  if (metricsAge > TARGET_METRICS_STALE_SEC) {
    // Fire-and-forget: run the heavy sync in the background so the UI doesn't block.
    // The UI will show the currently cached stats immediately and naturally refetch on the next poll.
    void (async () => {
      try {
        await bootstrapTrackedWalletHistory(cfg!.targetWallet, cfg!.chainId, 120, { source: 'on_demand' });
        await recomputeTargetMetricsForConfig(params.configId);
        console.log(`[TargetTracking] Async background refresh completed for config ${params.configId}`);
      } catch (err: any) {
        console.error(`[TargetTracking] Async background refresh failed for config ${params.configId}`, err?.message || err);
      }
    })();
  }
  // ─────────────────────────────────────────────────────────────────────────

  const walletAddress = normalizeAddress(cfg.targetWallet);
  const chain = chainIdToLabel(cfg.chainId);
  // Use config creation time as strict baseline so target metrics are "since subscription start".
  // This avoids mixing pre-subscription wallet history into current strategy stats.
  const since = cfg.createdAt;
  const recentLimit = params.recentLimit ?? 80;

  const [leaderStats, recentTx, copiedPositions] = await Promise.all([
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
  ]);

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
      trackedTxCount: cfg.targetTrackedTxCount ?? 0,
      walletTxCount: cfg.targetWalletTxCount ?? 0,
      buyCount: cfg.targetBuyCount ?? 0,
      sellCount: cfg.targetSellCount ?? 0,
      tokenSwapCount: cfg.targetTokenSwapCount ?? 0,
      targetRealizedPnlUsd: cfg.targetRealizedPnlUsd ?? 0,
      targetRealizedProfitUsd: cfg.targetRealizedProfitUsd ?? 0,
      targetRealizedLossUsd: cfg.targetRealizedLossUsd ?? 0,
      targetProfitUsd: cfg.targetProfitUsd ?? 0,
      targetLossUsd: cfg.targetLossUsd ?? 0,
      targetUnrealizedPnlUsd: cfg.targetUnrealizedPnlUsd ?? 0,
      targetTotalPnlUsd: cfg.targetTotalPnlUsd ?? 0,
      buyVolumeUsd: 0,
      sellVolumeUsd: 0,
      netFlowUsd: 0,
      openPositionCostUsd: 0,
      openPositionValueUsd: 0,
      pricedOpenTokenCount: 0,
      unpricedOpenTokenCount: 0,
      ignoredTxCount: 0,
      unmatchedSellCount: 0,
      unmatchedSellUsd: 0,
      copyPositionsCount: copiedPositions,
      latestTxAt: recentTx[0]?.blockTimestamp || null,
      metricsUpdatedAt: cfg.targetMetricsUpdatedAt ?? null,
    },
    leaderStats,
    recentTransactions: recentTx,
  };
}

export const __targetWalletTrackingTest = {
  dedupeBootstrapWalletTransactions,
  choosePreferredBootstrapTransaction,
  scoreWalletTransactionForBootstrap,
};
