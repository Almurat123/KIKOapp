export interface TargetBuySellRow {
  id?: number;
  txType: 'TARGET_BUY' | 'TARGET_SELL';
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

    if (row.txType === 'TARGET_BUY') {
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
