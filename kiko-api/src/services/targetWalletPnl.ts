import { getTokenDetails } from './dexscreener.js';
import { getTokenMetadata } from './rpcService.js';

export interface TargetBuySellRow {
  id?: number;
  txType: 'TARGET_BUY' | 'TARGET_SELL' | 'BUY' | 'SELL';
  tokenAddress: string | null;
  amount: string | null;
  valueUsd: number | null;
  blockTimestamp?: Date | string | null;
}

export interface TargetPnlOptions {
  minTxUsd: number;
  maxTxUsd: number;
}

export interface TargetPnlAggregate {
  buyCount: number;
  sellCount: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  netFlowUsd: number;
  targetRealizedPnlUsd: number;
  targetRealizedProfitUsd: number;
  targetRealizedLossUsd: number;
  ignoredTxCount: number;
  unmatchedSellCount: number;
  unmatchedSellUsd: number;
}

export interface TargetPnlSummary extends TargetPnlAggregate {
  targetUnrealizedPnlUsd: number;
  targetTotalPnlUsd: number;
  openPositionCostUsd: number;
  openPositionValueUsd: number;
  pricedOpenTokenCount: number;
  unpricedOpenTokenCount: number;
}

export interface TargetPnlSummaryOptions extends TargetPnlOptions {
  chain: string;
  chainId: number;
}

const EPS = 1e-12;

function safeNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safePositive(v: number | string | null | undefined): number {
  const n = safeNum(v);
  return n > 0 ? n : 0;
}

function sortRows(rows: TargetBuySellRow[]): TargetBuySellRow[] {
  return [...rows].sort((a, b) => {
    const ta = a.blockTimestamp ? new Date(a.blockTimestamp).getTime() : 0;
    const tb = b.blockTimestamp ? new Date(b.blockTimestamp).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return (a.id || 0) - (b.id || 0);
  });
}

export function calculateTargetRealizedPnl(
  rows: TargetBuySellRow[],
  options: TargetPnlOptions
): TargetPnlAggregate {
  const lots = new Map<string, Array<{ qty: number; unitCostUsd: number }>>();

  let buyCount = 0;
  let sellCount = 0;
  let buyVolumeUsd = 0;
  let sellVolumeUsd = 0;
  let targetRealizedPnlUsd = 0;
  let targetRealizedProfitUsd = 0;
  let targetRealizedLossUsd = 0;
  let ignoredTxCount = 0;
  let unmatchedSellCount = 0;
  let unmatchedSellUsd = 0;

  for (const row of sortRows(rows)) {
    const tokenAddress = row.tokenAddress?.trim().toLowerCase() || '';
    const usd = safeNum(row.valueUsd);
    const qty = safePositive(row.amount);
    const isUsdPlausible = usd >= options.minTxUsd && usd <= options.maxTxUsd;

    if (!tokenAddress || !isUsdPlausible || qty <= EPS) {
      ignoredTxCount += 1;
      continue;
    }

    if (row.txType === 'TARGET_BUY' || row.txType === 'BUY') {
      buyCount += 1;
      buyVolumeUsd += usd;
      const unitCostUsd = usd / qty;
      const tokenLots = lots.get(tokenAddress) || [];
      tokenLots.push({ qty, unitCostUsd });
      lots.set(tokenAddress, tokenLots);
      continue;
    }

    sellCount += 1;
    sellVolumeUsd += usd;

    const proceedsPerUnit = usd / qty;
    const tokenLots = lots.get(tokenAddress) || [];
    let remaining = qty;
    let matchedQty = 0;
    let matchedCostUsd = 0;

    while (remaining > EPS && tokenLots.length > 0) {
      const head = tokenLots[0];
      const takeQty = Math.min(remaining, head.qty);

      matchedQty += takeQty;
      matchedCostUsd += takeQty * head.unitCostUsd;
      remaining -= takeQty;
      head.qty -= takeQty;

      if (head.qty <= EPS) tokenLots.shift();
    }

    if (matchedQty > EPS) {
      const matchedProceedsUsd = matchedQty * proceedsPerUnit;
      const pnl = matchedProceedsUsd - matchedCostUsd;
      targetRealizedPnlUsd += pnl;
      if (pnl >= 0) {
        targetRealizedProfitUsd += pnl;
      } else {
        targetRealizedLossUsd += Math.abs(pnl);
      }
    }

    if (remaining > EPS) {
      unmatchedSellCount += 1;
      unmatchedSellUsd += remaining * proceedsPerUnit;
    }
  }

  return {
    buyCount,
    sellCount,
    buyVolumeUsd,
    sellVolumeUsd,
    netFlowUsd: sellVolumeUsd - buyVolumeUsd,
    targetRealizedPnlUsd,
    targetRealizedProfitUsd,
    targetRealizedLossUsd,
    ignoredTxCount,
    unmatchedSellCount,
    unmatchedSellUsd,
  };
}

async function getCurrentTokenPriceUsd(chain: string, tokenAddress: string): Promise<number> {
  try {
    const details = await getTokenDetails(chain, tokenAddress);
    const price = Number(details?.price || 0);
    return Number.isFinite(price) && price > 0 ? price : 0;
  } catch {
    return 0;
  }
}

async function getTokenDecimals(chainId: number, tokenAddress: string): Promise<number> {
  try {
    const meta = await getTokenMetadata(chainId, tokenAddress, { rpcStrategy: 'cheap' });
    const decimals = Number(meta?.decimals ?? 0);
    if (Number.isFinite(decimals) && decimals >= 0 && decimals <= 30) {
      return decimals;
    }
    return chainId === 900 ? 9 : 18;
  } catch {
    return chainId === 900 ? 9 : 18;
  }
}

export async function calculateTargetPnlSummary(
  rows: TargetBuySellRow[],
  options: TargetPnlSummaryOptions
): Promise<TargetPnlSummary> {
  const lots = new Map<string, Array<{ qty: number; unitCostUsd: number }>>();
  const decimalsCache = new Map<string, number>();

  const normalizeQtyHuman = async (tokenAddress: string, qtyRaw: number): Promise<number> => {
    if (qtyRaw <= EPS) return 0;
    if (!tokenAddress) return 0;
    let decimals = decimalsCache.get(tokenAddress);
    if (decimals === undefined) {
      decimals = await getTokenDecimals(options.chainId, tokenAddress);
      decimalsCache.set(tokenAddress, decimals);
    }
    const qtyHuman = qtyRaw / Math.pow(10, decimals);
    if (!Number.isFinite(qtyHuman) || qtyHuman <= EPS) return 0;
    // Defensive guard for corrupted amounts.
    if (qtyHuman > 1e15) return 0;
    return qtyHuman;
  };

  let buyCount = 0;
  let sellCount = 0;
  let buyVolumeUsd = 0;
  let sellVolumeUsd = 0;
  let targetRealizedPnlUsd = 0;
  let targetRealizedProfitUsd = 0;
  let targetRealizedLossUsd = 0;
  let ignoredTxCount = 0;
  let unmatchedSellCount = 0;
  let unmatchedSellUsd = 0;

  for (const row of sortRows(rows)) {
    const tokenAddress = row.tokenAddress?.trim().toLowerCase() || '';
    const usd = safeNum(row.valueUsd);
    const qtyRaw = safePositive(row.amount);
    const qty = await normalizeQtyHuman(tokenAddress, qtyRaw);
    const isUsdPlausible = usd >= options.minTxUsd && usd <= options.maxTxUsd;

    if (!tokenAddress || !isUsdPlausible || qty <= EPS) {
      ignoredTxCount += 1;
      continue;
    }

    if (row.txType === 'TARGET_BUY' || row.txType === 'BUY') {
      buyCount += 1;
      buyVolumeUsd += usd;
      const unitCostUsd = usd / qty;
      const tokenLots = lots.get(tokenAddress) || [];
      tokenLots.push({ qty, unitCostUsd });
      lots.set(tokenAddress, tokenLots);
      continue;
    }

    sellCount += 1;
    sellVolumeUsd += usd;

    const proceedsPerUnit = usd / qty;
    const tokenLots = lots.get(tokenAddress) || [];
    let remaining = qty;
    let matchedQty = 0;
    let matchedCostUsd = 0;

    while (remaining > EPS && tokenLots.length > 0) {
      const head = tokenLots[0];
      const takeQty = Math.min(remaining, head.qty);

      matchedQty += takeQty;
      matchedCostUsd += takeQty * head.unitCostUsd;
      remaining -= takeQty;
      head.qty -= takeQty;

      if (head.qty <= EPS) tokenLots.shift();
    }

    if (matchedQty > EPS) {
      const matchedProceedsUsd = matchedQty * proceedsPerUnit;
      const pnl = matchedProceedsUsd - matchedCostUsd;
      targetRealizedPnlUsd += pnl;
      if (pnl >= 0) {
        targetRealizedProfitUsd += pnl;
      } else {
        targetRealizedLossUsd += Math.abs(pnl);
      }
    }

    if (remaining > EPS) {
      unmatchedSellCount += 1;
      unmatchedSellUsd += remaining * proceedsPerUnit;
    }
  }

  const tokenExposure: Array<{ tokenAddress: string; qty: number; costUsd: number }> = [];
  for (const [tokenAddress, tokenLots] of lots.entries()) {
    const qty = tokenLots.reduce((acc, lot) => acc + lot.qty, 0);
    const costUsd = tokenLots.reduce((acc, lot) => acc + lot.qty * lot.unitCostUsd, 0);
    if (qty > EPS && costUsd > EPS) {
      tokenExposure.push({ tokenAddress, qty, costUsd });
    }
  }

  let targetUnrealizedPnlUsd = 0;
  let openPositionCostUsd = 0;
  let openPositionValueUsd = 0;
  let pricedOpenTokenCount = 0;
  let unpricedOpenTokenCount = 0;
  for (const pos of tokenExposure) {
    openPositionCostUsd += pos.costUsd;
    let decimals = decimalsCache.get(pos.tokenAddress);
    if (decimals === undefined) {
      decimals = await getTokenDecimals(options.chainId, pos.tokenAddress);
      decimalsCache.set(pos.tokenAddress, decimals);
    }
    const priceUsd = await getCurrentTokenPriceUsd(options.chain, pos.tokenAddress);
    if (priceUsd <= 0) {
      unpricedOpenTokenCount += 1;
      continue;
    }

    // pos.qty is already normalized to human units in this function.
    const qtyHuman = pos.qty;
    const valueUsd = qtyHuman * priceUsd;
    openPositionValueUsd += valueUsd;
    targetUnrealizedPnlUsd += (valueUsd - pos.costUsd);
    pricedOpenTokenCount += 1;
  }

  return {
    buyCount,
    sellCount,
    buyVolumeUsd,
    sellVolumeUsd,
    netFlowUsd: sellVolumeUsd - buyVolumeUsd,
    targetRealizedPnlUsd,
    targetRealizedProfitUsd,
    targetRealizedLossUsd,
    ignoredTxCount,
    unmatchedSellCount,
    unmatchedSellUsd,
    targetUnrealizedPnlUsd,
    targetTotalPnlUsd: targetRealizedPnlUsd + targetUnrealizedPnlUsd,
    openPositionCostUsd,
    openPositionValueUsd,
    pricedOpenTokenCount,
    unpricedOpenTokenCount,
  };
}
