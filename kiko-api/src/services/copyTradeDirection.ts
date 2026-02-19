import { getChainConfig } from '../config/chainConfig.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';
import { normalizeAddress } from '../utils/address.js';

const NATIVE_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

type InferredTxType = 'TARGET_BUY' | 'TARGET_SELL' | 'TARGET_TOKEN_SWAP';

export interface CopyTradeCashLegHint {
  cashSpentUsd?: number;
  cashReceivedUsd?: number;
  inferredTxType?: InferredTxType;
}

export interface CopyTradeDirectionInput {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  cashLegHint?: CopyTradeCashLegHint;
}

export interface CopyTradeDirectionResult {
  isBuy: boolean;
  isSell: boolean;
  isTokenToToken: boolean;
  tokenInIsCash: boolean;
  tokenOutIsCash: boolean;
  source: 'token_pair' | 'cash_hint';
  inferredTxType?: InferredTxType;
  hintConflict?: boolean;
}

function inferTxTypeFromCashFlow(cashLegHint?: CopyTradeCashLegHint): InferredTxType | undefined {
  const cashSpentUsd = Number(cashLegHint?.cashSpentUsd || 0);
  const cashReceivedUsd = Number(cashLegHint?.cashReceivedUsd || 0);
  if (!Number.isFinite(cashSpentUsd) || !Number.isFinite(cashReceivedUsd)) return undefined;
  if (cashSpentUsd <= 0 && cashReceivedUsd <= 0) return undefined;

  const delta = cashSpentUsd - cashReceivedUsd;
  const turnover = cashSpentUsd + cashReceivedUsd;
  const directionalThreshold = Math.max(0.5, turnover * 0.15);
  if (Math.abs(delta) < directionalThreshold) return undefined;
  return delta > 0 ? 'TARGET_BUY' : 'TARGET_SELL';
}

function buildCashTokenSet(chainId: number): Set<string> {
  const chainConfig = getChainConfig(chainId);
  const tokens = [
    NATIVE_TOKEN,
    chainConfig.wrappedNativeAddress,
    ...(chainConfig.stablecoins || []),
    SOLANA_CONFIG.TOKENS.SOL,
    SOLANA_CONFIG.TOKENS.USDC,
    SOLANA_CONFIG.TOKENS.USDT
  ]
    .map((token) => normalizeAddress(token))
    .filter(Boolean);
  return new Set(tokens);
}

export function determineCopyTradeDirection(input: CopyTradeDirectionInput): CopyTradeDirectionResult {
  const { chainId, tokenIn, tokenOut, cashLegHint } = input;
  const cashTokens = buildCashTokenSet(chainId);

  const tokenInIsCash = cashTokens.has(normalizeAddress(tokenIn));
  const tokenOutIsCash = cashTokens.has(normalizeAddress(tokenOut));

  let isBuy = tokenInIsCash && !tokenOutIsCash;
  let isSell = !tokenInIsCash && tokenOutIsCash;
  let isTokenToToken = !tokenInIsCash && !tokenOutIsCash;
  let source: 'token_pair' | 'cash_hint' = 'token_pair';
  let hintConflict = false;
  let inferredTxType = cashLegHint?.inferredTxType;
  if (!inferredTxType || inferredTxType === 'TARGET_TOKEN_SWAP') {
    inferredTxType = inferTxTypeFromCashFlow(cashLegHint) || inferredTxType;
  }

  // Guardrail: when token pair already determines direction (cash<->token),
  // never let cash-leg hint override it; hint can be noisy in bundled activity payloads.
  const tokenPairDeterministic = isBuy || isSell;
  // Use hint override only for token->token ambiguity. Do not force trades on cash->cash activity.
  const canUseHintOverride = !tokenPairDeterministic && !tokenInIsCash && !tokenOutIsCash;
  if (inferredTxType) {
    if (canUseHintOverride) {
      if (inferredTxType === 'TARGET_BUY') {
        isBuy = true;
        isSell = false;
        isTokenToToken = false;
        source = 'cash_hint';
      } else if (inferredTxType === 'TARGET_SELL') {
        isBuy = false;
        isSell = true;
        isTokenToToken = false;
        source = 'cash_hint';
      } else if (inferredTxType === 'TARGET_TOKEN_SWAP') {
        isBuy = false;
        isSell = false;
        isTokenToToken = true;
        source = 'cash_hint';
      }
    } else if (
      (inferredTxType === 'TARGET_BUY' && isSell)
      || (inferredTxType === 'TARGET_SELL' && isBuy)
      || (inferredTxType === 'TARGET_TOKEN_SWAP' && tokenPairDeterministic)
    ) {
      hintConflict = true;
    }
  }

  return {
    isBuy,
    isSell,
    isTokenToToken,
    tokenInIsCash,
    tokenOutIsCash,
    source,
    inferredTxType,
    hintConflict
  };
}
