import { getPlatformFee, isValidEvmAddress, type FeeContext } from '../../platformFeeService.js';
import type { DirectSwapFeeSettlement } from './directSwapFeeCollector.js';

export type BuyFeeApplicationKind = 'direct_post_trade' | 'aggregator_inline';

export interface BuyFeeApplication {
  kind: BuyFeeApplicationKind;
  feeContext: FeeContext;
  feeBps: number;
  feeRecipient: string;
  feeToken: string | null;
  chargeFeeBy: 'currency_in' | 'currency_out' | null;
  sourceTxHash: string | null;
  deferred: boolean;
  reasonCode: string | null;
  provider: string | null;
}

export function buildBuyFeeApplicationFromDirectSettlement(
  settlement: DirectSwapFeeSettlement | null | undefined,
): BuyFeeApplication | null {
  if (!settlement) return null;
  const fee = getPlatformFee(settlement.feeContext, settlement.feeBpsOverride);
  if (fee.bps <= 0 || !isValidEvmAddress(fee.evmRecipient)) {
    return null;
  }

  return {
    kind: 'direct_post_trade',
    feeContext: settlement.feeContext,
    feeBps: fee.bps,
    feeRecipient: fee.evmRecipient!.toLowerCase(),
    feeToken: settlement.normalizedTokenOut || null,
    chargeFeeBy: null,
    sourceTxHash: settlement.sourceTxHash || null,
    deferred: Boolean(settlement.deferred),
    reasonCode: settlement.reasonCode || null,
    provider: null,
  };
}

export function buildInlineAggregatorBuyFeeApplication(params: {
  feeContext: FeeContext;
  feeBpsOverride?: number;
  feeToken: string;
  sourceTxHash?: string | null;
  provider: string;
}): BuyFeeApplication | null {
  const fee = getPlatformFee(params.feeContext, params.feeBpsOverride);
  if (fee.bps <= 0 || !isValidEvmAddress(fee.evmRecipient)) {
    return null;
  }

  return {
    kind: 'aggregator_inline',
    feeContext: params.feeContext,
    feeBps: fee.bps,
    feeRecipient: fee.evmRecipient!.toLowerCase(),
    feeToken: params.feeToken || null,
    chargeFeeBy: 'currency_in',
    sourceTxHash: params.sourceTxHash || null,
    deferred: false,
    reasonCode: 'aggregator_inline_fee',
    provider: params.provider,
  };
}
