import type { BuyGuardPolicy } from '../guards/types.js';
import { shouldEnforceBuyGuard } from '../guards/policy.js';

export interface PriceDeviationGuardParams {
  chainId: number;
  oraclePrice: number;
  oraclePriceSource?: 'market_oracle_price' | 'local_quote_price';
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

export type GuardPriceSourceLabel = 'market_oracle_price' | 'local_quote_price' | 'target_implied_price';

export type TargetImpliedPriceSourceCategory =
  | 'target_cash_flow'
  | 'target_native_like_flow'
  | 'target_estimated_output'
  | 'target_unknown';

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
    oraclePriceSource?: GuardPriceSourceLabel;
    targetExecutionPriceSource?: GuardPriceSourceLabel;
    targetImpliedPriceSourceCategory?: TargetImpliedPriceSourceCategory;
    targetImpliedValueSource?: string;
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

function resolveTargetImpliedPriceSourceCategory(strictTargetSwapValueSource?: string): TargetImpliedPriceSourceCategory {
  const source = String(strictTargetSwapValueSource || 'none');
  if (source === 'cash_leg_hint' || source === 'stable_amount_in') return 'target_cash_flow';
  if (source.startsWith('native_like_')) return 'target_native_like_flow';
  if (source === 'zora_amount_in_estimate') return 'target_estimated_output';
  return 'target_unknown';
}

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
  const targetImpliedPriceSourceCategory = resolveTargetImpliedPriceSourceCategory(params.strictTargetSwapValueSource);
  const metrics = {
    oraclePriceSource: (params.oraclePriceSource || 'market_oracle_price') as GuardPriceSourceLabel,
    targetExecutionPriceSource: 'target_implied_price' as GuardPriceSourceLabel,
    targetImpliedPriceSourceCategory,
    targetImpliedValueSource: String(params.strictTargetSwapValueSource || 'target_swap_value_usd'),
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
