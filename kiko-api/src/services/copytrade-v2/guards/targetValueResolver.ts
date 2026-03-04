import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

export type TargetValueReasonCode =
  | 'TARGET_VALUE_STRICT_SOURCE_TX_SELECTED'
  | 'TARGET_VALUE_STRICT_POOL_AMOUNT_SELECTED'
  | 'TARGET_VALUE_STRICT_AMOUNT_IN_SELECTED'
  | 'TARGET_VALUE_CASH_HINT_ONLY'
  | 'TARGET_VALUE_CASH_HINT_REJECTED_OVERCOUNT'
  | 'TARGET_VALUE_ESTIMATE_ONLY'
  | 'TARGET_VALUE_UNAVAILABLE';

export interface NativeLikeTargetValueParams {
  broadTargetValueUsd: number;
  hintedCashSpentUsd: number;
  amountInUsd: number;
  sourceTxValueUsd: number;
  poolAmountInUsd: number;
  txHash?: string;
  chainId: number;
}

export interface NativeLikeTargetValueResult {
  targetSwapValueUsd: number;
  strictTargetSwapValueUsd: number;
  strictTargetSwapValueReliable: boolean;
  strictTargetSwapValueSource: string;
  reasonCode: TargetValueReasonCode;
  metrics: {
    broadTargetValueUsd?: number;
    hintedCashSpentUsd?: number;
    amountInUsd?: number;
    sourceTxValueUsd?: number;
    poolAmountInUsd?: number;
    hintRejected?: boolean;
  };
}

const HINT_ACCEPTANCE_TOLERANCE = 0.15;

function toPositiveFinite(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function withinTolerance(base: number, candidate: number, tolerance: number): boolean {
  if (base <= 0 || candidate <= 0) return false;
  const delta = Math.abs(candidate - base) / base;
  return delta <= tolerance;
}

export function resolveNativeLikeTargetValue(params: NativeLikeTargetValueParams): NativeLikeTargetValueResult {
  const broadTargetValueUsd = toPositiveFinite(params.broadTargetValueUsd);
  const hintedCashSpentUsd = toPositiveFinite(params.hintedCashSpentUsd);
  const amountInUsd = toPositiveFinite(params.amountInUsd);
  const sourceTxValueUsd = toPositiveFinite(params.sourceTxValueUsd);
  const poolAmountInUsd = toPositiveFinite(params.poolAmountInUsd);

  let strictTargetSwapValueUsd = 0;
  let strictTargetSwapValueReliable = false;
  let strictTargetSwapValueSource = 'none';
  let reasonCode: TargetValueReasonCode = 'TARGET_VALUE_UNAVAILABLE';

  if (sourceTxValueUsd > 0) {
    strictTargetSwapValueUsd = sourceTxValueUsd;
    strictTargetSwapValueReliable = true;
    strictTargetSwapValueSource = 'native_like_source_tx_value';
    reasonCode = 'TARGET_VALUE_STRICT_SOURCE_TX_SELECTED';
  } else if (poolAmountInUsd > 0) {
    strictTargetSwapValueUsd = poolAmountInUsd;
    strictTargetSwapValueReliable = true;
    strictTargetSwapValueSource = 'native_like_pool_amount_in';
    reasonCode = 'TARGET_VALUE_STRICT_POOL_AMOUNT_SELECTED';
  } else if (amountInUsd > 0) {
    strictTargetSwapValueUsd = amountInUsd;
    strictTargetSwapValueReliable = true;
    strictTargetSwapValueSource = 'native_like_amount_in';
    reasonCode = 'TARGET_VALUE_STRICT_AMOUNT_IN_SELECTED';
  }

  let targetSwapValueUsd = broadTargetValueUsd;
  let hintRejected = false;

  if (strictTargetSwapValueReliable && strictTargetSwapValueUsd > 0) {
    targetSwapValueUsd = strictTargetSwapValueUsd;

    if (hintedCashSpentUsd > 0 && !withinTolerance(strictTargetSwapValueUsd, hintedCashSpentUsd, HINT_ACCEPTANCE_TOLERANCE)) {
      hintRejected = hintedCashSpentUsd > strictTargetSwapValueUsd;
      if (hintRejected) {
        logger.warn(LogCode.DATA_CORRUPTION, '[CopyTrade] Rejected widened cash hint for native-like target value', {
          txHash: params.txHash,
          chainId: params.chainId,
          strictTargetSwapValueUsd: Number(strictTargetSwapValueUsd.toFixed(4)),
          hintedCashSpentUsd: Number(hintedCashSpentUsd.toFixed(4)),
          broadTargetValueUsd: Number(broadTargetValueUsd.toFixed(4)),
        });
        reasonCode = 'TARGET_VALUE_CASH_HINT_REJECTED_OVERCOUNT';
      }
    }
  } else if (hintedCashSpentUsd > 0) {
    targetSwapValueUsd = hintedCashSpentUsd;
    strictTargetSwapValueUsd = hintedCashSpentUsd;
    strictTargetSwapValueReliable = true;
    strictTargetSwapValueSource = 'cash_leg_hint';
    reasonCode = 'TARGET_VALUE_CASH_HINT_ONLY';
  } else if (broadTargetValueUsd > 0) {
    targetSwapValueUsd = broadTargetValueUsd;
    reasonCode = 'TARGET_VALUE_ESTIMATE_ONLY';
  }

  return {
    targetSwapValueUsd,
    strictTargetSwapValueUsd,
    strictTargetSwapValueReliable,
    strictTargetSwapValueSource,
    reasonCode,
    metrics: {
      broadTargetValueUsd: broadTargetValueUsd || undefined,
      hintedCashSpentUsd: hintedCashSpentUsd || undefined,
      amountInUsd: amountInUsd || undefined,
      sourceTxValueUsd: sourceTxValueUsd || undefined,
      poolAmountInUsd: poolAmountInUsd || undefined,
      hintRejected,
    },
  };
}
