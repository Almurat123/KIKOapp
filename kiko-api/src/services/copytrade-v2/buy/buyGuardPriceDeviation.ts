import type { BuyGuardPolicy } from '../guards/types.js';
import { shouldEnforceBuyGuard } from '../guards/policy.js';

export interface PriceDeviationGuardParams {
  chainId: number;
  oraclePrice: number;
  oracleProvider?: string;
  oracleDexName?: string;
  oracleValidationReason?: string;
  referencePrice?: number;
  referenceProvider?: string;
  oracleFallbackUsed?: boolean;
  estimatedOut: number;
  targetSwapValueUsd: number;
  strictTargetSwapValueUsd?: number;
  strictTargetSwapValueReliable?: boolean;
  strictTargetSwapValueSource?: string;
  policy: BuyGuardPolicy;
  maxRatio?: number;
}

export interface PriceDeviationGuardResult {
  passed: boolean;
  reasonCode:
    | 'PRICE_DEVIATION_CHECK_SKIPPED'
    | 'PRICE_REFERENCE_UNAVAILABLE'
    | 'PRICE_REFERENCE_ZERO'
    | 'PRICE_DEVIATION_TOO_HIGH'
    | 'PRICE_DEVIATION_OK';
  targetExecutionPrice: number;
  ratio?: number;
  metrics: {
    oraclePrice?: number;
    targetExecutionPrice?: number;
    ratio?: number;
    maxRatio?: number;
    oracleProvider?: string;
    oracleDexName?: string;
    oracleValidationReason?: string;
    referencePrice?: number;
    referenceProvider?: string;
    oracleFallbackUsed?: boolean;
    priceGuardValueUsd?: number;
    estimatedOut?: number;
  };
}

const STRICT_TARGET_VALUE_SOURCES = new Set([
  'cash_leg_hint',
  'native_like_pool_amount_in',
  'native_like_source_tx_value',
  'native_like_amount_in',
  'stable_amount_in',
]);

export function evaluateBuyPriceDeviationGuard(
  params: PriceDeviationGuardParams
): PriceDeviationGuardResult {
  // G2: Solana 同样参与 3x 价格比例检测，移除硬跳过
  if (params.targetSwapValueUsd <= 0 || params.estimatedOut <= 0) {
    return {
      passed: true,
      reasonCode: 'PRICE_DEVIATION_CHECK_SKIPPED',
      targetExecutionPrice: 0,
      metrics: {},
    };
  }

  const oraclePrice = Number(params.oraclePrice || 0);
  const priceGuardValueUsd =
    params.strictTargetSwapValueReliable
    && Number(params.strictTargetSwapValueUsd || 0) > 0
    && STRICT_TARGET_VALUE_SOURCES.has(String(params.strictTargetSwapValueSource || ''))
      ? Number(params.strictTargetSwapValueUsd || 0)
      : Number(params.targetSwapValueUsd || 0);

  const targetExecutionPrice = priceGuardValueUsd / params.estimatedOut;
  const metrics = {
    oraclePrice: oraclePrice > 0 ? oraclePrice : undefined,
    targetExecutionPrice: Number.isFinite(targetExecutionPrice) && targetExecutionPrice > 0 ? targetExecutionPrice : undefined,
    maxRatio: params.maxRatio || 3,
    oracleProvider: params.oracleProvider,
    oracleDexName: params.oracleDexName,
    oracleValidationReason: params.oracleValidationReason,
    referencePrice: Number.isFinite(Number(params.referencePrice)) ? Number(params.referencePrice) : undefined,
    referenceProvider: params.referenceProvider,
    oracleFallbackUsed: Boolean(params.oracleFallbackUsed),
    priceGuardValueUsd,
    estimatedOut: params.estimatedOut,
  };

  if (!Number.isFinite(oraclePrice)) {
    return {
      passed: !shouldEnforceBuyGuard(params.policy, 'priceDeviationRatio'),
      reasonCode: 'PRICE_REFERENCE_UNAVAILABLE',
      targetExecutionPrice,
      metrics,
    };
  }

  if (oraclePrice < 0) {
    return {
      passed: false,
      reasonCode: 'PRICE_REFERENCE_UNAVAILABLE',
      targetExecutionPrice,
      metrics,
    };
  }

  if (oraclePrice === 0) {
    return {
      passed: !shouldEnforceBuyGuard(params.policy, 'priceDeviationRatio'),
      reasonCode: 'PRICE_REFERENCE_ZERO',
      targetExecutionPrice,
      metrics,
    };
  }

  const ratio = targetExecutionPrice / oraclePrice;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return {
      passed: false,
      reasonCode: 'PRICE_REFERENCE_UNAVAILABLE',
      targetExecutionPrice,
      metrics,
    };
  }

  if (shouldEnforceBuyGuard(params.policy, 'priceDeviationRatio') && ratio > (params.maxRatio || 3)) {
    return {
      passed: false,
      reasonCode: 'PRICE_DEVIATION_TOO_HIGH',
      targetExecutionPrice,
      ratio,
      metrics: {
        ...metrics,
        ratio,
      },
    };
  }

  return {
    passed: true,
    reasonCode: 'PRICE_DEVIATION_OK',
    targetExecutionPrice,
    ratio,
    metrics: {
      ...metrics,
      ratio,
    },
  };
}
