import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';

export function isDirectCopyTradeExecutionMode(executionMode: CopyTradeExecutionMode): boolean {
  return executionMode !== 'safe';
}

export function shouldAllowTokenInfoLiquidityFallbackForCopyTrade(executionMode: CopyTradeExecutionMode): boolean {
  return executionMode === 'safe';
}

export function resolveCopyTradePriceGuardOracleInput(params: {
  executionMode: CopyTradeExecutionMode;
  localQuotePriceUsd: number;
  localQuoteProvider?: string;
  tokenInfo: {
    price?: number;
    provider?: string;
    rpcDexName?: string;
    priceValidationReason?: string;
    referencePrice?: number;
    referenceProvider?: string;
    priceFallbackUsed?: boolean;
  };
}): {
  oraclePrice: number;
  oraclePriceSource: 'market_oracle_price' | 'local_quote_price';
  oracleProvider?: string;
  oracleDexName?: string;
  oracleValidationReason?: string;
  referencePrice?: number;
  referenceProvider?: string;
  oracleFallbackUsed?: boolean;
} {
  if (params.localQuotePriceUsd > 0) {
    return {
      oraclePrice: params.localQuotePriceUsd,
      oraclePriceSource: 'local_quote_price',
      oracleProvider: params.localQuoteProvider || 'direct-reference-quote',
      oracleFallbackUsed: false,
    };
  }

  if (isDirectCopyTradeExecutionMode(params.executionMode)) {
    return {
      oraclePrice: 0,
      oraclePriceSource: 'local_quote_price',
      oracleProvider: 'direct_execution_reference_unavailable',
      oracleFallbackUsed: false,
    };
  }

  return {
    oraclePrice: Number(params.tokenInfo.price || 0),
    oraclePriceSource: 'market_oracle_price',
    oracleProvider: params.tokenInfo.provider,
    oracleDexName: params.tokenInfo.rpcDexName,
    oracleValidationReason: params.tokenInfo.priceValidationReason,
    referencePrice: params.tokenInfo.referencePrice,
    referenceProvider: params.tokenInfo.referenceProvider,
    oracleFallbackUsed: Boolean(params.tokenInfo.priceFallbackUsed),
  };
}
