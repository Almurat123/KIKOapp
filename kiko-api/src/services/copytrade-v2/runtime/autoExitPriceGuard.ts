const SOFT_DEGRADED_VALIDATION_REASONS = new Set([
  'market_validator_unavailable',
  'launchpad_oracle_validator_unavailable',
]);

const HARD_UNSAFE_VALIDATION_REASONS = new Set([
  'market_validator_reference_conflict',
  'market_validator_single_source_outlier_rejected',
]);

const TRUSTED_DIRECT_PROVIDERS = new Set([
  '0x-dex',
  'jupiter-dex',
  'dexscreener-monitor',
  'geckoterminal-monitor',
  'dexscreener-liquidity',
  'stablecoin',
]);

export type AutoExitPriceGuardResult =
  | {
      allowed: true;
      reasonCode: 'AUTO_EXIT_PRICE_OK';
      metrics: {
        price: number;
        provider: string;
        priceValidationReason: string | null;
        referencePrice: number | null;
        referenceProvider: string | null;
        priceFallbackUsed: boolean;
      };
    }
  | {
      allowed: false;
      reasonCode:
        | 'AUTO_EXIT_PRICE_UNAVAILABLE'
        | 'AUTO_EXIT_PRICE_VALIDATION_FAILED'
        | 'AUTO_EXIT_PRICE_UNVERIFIED';
      metrics: {
        price: number;
        provider: string;
        priceValidationReason: string | null;
        referencePrice: number | null;
        referenceProvider: string | null;
        priceFallbackUsed: boolean;
      };
    };

export function evaluateAutoExitPriceGuard(input: {
  tokenInfo: {
    price?: number;
    provider?: string;
    priceValidationReason?: string | null;
    referencePrice?: number | null;
    referenceProvider?: string | null;
    priceFallbackUsed?: boolean;
  } | null | undefined;
}): AutoExitPriceGuardResult {
  const price = Number(input.tokenInfo?.price || 0);
  const provider = String(input.tokenInfo?.provider || '').trim().toLowerCase();
  const priceValidationReasonRaw = String(input.tokenInfo?.priceValidationReason || '').trim();
  const priceValidationReason = priceValidationReasonRaw || null;
  const referencePrice = Number(input.tokenInfo?.referencePrice || 0);
  const referenceProviderRaw = String(input.tokenInfo?.referenceProvider || '').trim();
  const referenceProvider = referenceProviderRaw || null;
  const priceFallbackUsed = Boolean(input.tokenInfo?.priceFallbackUsed);
  const metrics = {
    price,
    provider,
    priceValidationReason,
    referencePrice: Number.isFinite(referencePrice) && referencePrice > 0 ? referencePrice : null,
    referenceProvider,
    priceFallbackUsed,
  };

  if (!Number.isFinite(price) || price <= 0) {
    return {
      allowed: false,
      reasonCode: 'AUTO_EXIT_PRICE_UNAVAILABLE',
      metrics,
    };
  }

  if (priceValidationReason && HARD_UNSAFE_VALIDATION_REASONS.has(priceValidationReason)) {
    return {
      allowed: false,
      reasonCode: 'AUTO_EXIT_PRICE_VALIDATION_FAILED',
      metrics,
    };
  }

  if (TRUSTED_DIRECT_PROVIDERS.has(provider)) {
    return {
      allowed: true,
      reasonCode: 'AUTO_EXIT_PRICE_OK',
      metrics,
    };
  }

  if (priceFallbackUsed && (metrics.referencePrice || referenceProvider)) {
    return {
      allowed: true,
      reasonCode: 'AUTO_EXIT_PRICE_OK',
      metrics,
    };
  }

  if (metrics.referencePrice || referenceProvider) {
    return {
      allowed: true,
      reasonCode: 'AUTO_EXIT_PRICE_OK',
      metrics,
    };
  }

  if (
    priceValidationReason
    && SOFT_DEGRADED_VALIDATION_REASONS.has(priceValidationReason)
    && provider
    && !provider.includes('fourmeme')
  ) {
    return {
      allowed: true,
      reasonCode: 'AUTO_EXIT_PRICE_OK',
      metrics,
    };
  }

  if (provider.includes('fourmeme') || provider === 'rpc+api' || provider.includes('rpc') || !provider) {
    return {
      allowed: false,
      reasonCode: 'AUTO_EXIT_PRICE_UNVERIFIED',
      metrics,
    };
  }

  return {
    allowed: false,
    reasonCode: 'AUTO_EXIT_PRICE_UNVERIFIED',
    metrics,
  };
}
