import { getChainConfig } from '../config/chainConfig.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';
import { getCanonicalAssetIdentity, getWrappedNativeAddressForChain } from './evmCanonicalAsset.js';
import { normalizeAddress } from '../utils/address.js';

export type CopytradeForbiddenAssetReasonCode =
  | 'forbidden_asset_stablecoin'
  | 'forbidden_asset_native_like'
  | 'forbidden_asset_wrapped_native';

export interface CopytradeAssetEligibility {
  allowed: boolean;
  reasonCode: CopytradeForbiddenAssetReasonCode | null;
  classification: 'token' | 'stablecoin' | 'native_like' | 'wrapped_native';
  normalizedToken: string;
}

export interface CopytradeSignalAssetPolicyResult {
  allowed: boolean;
  blockedToken: string | null;
  reasonCode: CopytradeForbiddenAssetReasonCode | null;
}

function normalizeSolanaToken(token: string | null | undefined): string {
  return normalizeAddress(String(token || '').trim());
}

export function classifyCopytradeAssetEligibility(params: {
  chainId: number;
  tokenAddress: string | null | undefined;
}): CopytradeAssetEligibility {
  const rawToken = String(params.tokenAddress || '').trim();
  if (!rawToken) {
    return {
      allowed: true,
      reasonCode: null,
      classification: 'token',
      normalizedToken: '',
    };
  }

  const chainConfig = getChainConfig(params.chainId);
  const stablecoins = new Set((chainConfig.stablecoins || []).map((token) => normalizeAddress(token)));

  if (params.chainId === SOLANA_CONFIG.CHAIN_ID) {
    const normalizedToken = normalizeSolanaToken(rawToken);
    if (stablecoins.has(normalizedToken)) {
      return {
        allowed: false,
        reasonCode: 'forbidden_asset_stablecoin',
        classification: 'stablecoin',
        normalizedToken,
      };
    }
    if (normalizedToken === normalizeSolanaToken(SOLANA_CONFIG.TOKENS.SOL)) {
      return {
        allowed: false,
        reasonCode: 'forbidden_asset_native_like',
        classification: 'native_like',
        normalizedToken,
      };
    }
    return {
      allowed: true,
      reasonCode: null,
      classification: 'token',
      normalizedToken,
    };
  }

  const wrappedNativeAddress = getWrappedNativeAddressForChain(params.chainId, chainConfig.wrappedNativeAddress) || '';
  const normalizedRaw = normalizeAddress(rawToken);
  const canonical = getCanonicalAssetIdentity(params.chainId, rawToken, wrappedNativeAddress);

  if (stablecoins.has(canonical.normalized)) {
    return {
      allowed: false,
      reasonCode: 'forbidden_asset_stablecoin',
      classification: 'stablecoin',
      normalizedToken: canonical.normalized,
    };
  }

  if (normalizedRaw && wrappedNativeAddress && normalizedRaw === wrappedNativeAddress) {
    return {
      allowed: false,
      reasonCode: 'forbidden_asset_wrapped_native',
      classification: 'wrapped_native',
      normalizedToken: canonical.normalized,
    };
  }

  if (canonical.isNativeLike) {
    return {
      allowed: false,
      reasonCode: 'forbidden_asset_native_like',
      classification: 'native_like',
      normalizedToken: canonical.normalized,
    };
  }

  return {
    allowed: true,
    reasonCode: null,
    classification: 'token',
    normalizedToken: canonical.normalized,
  };
}

export function evaluateCopytradeSignalAssetPolicy(params: {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  direction: 'buy' | 'sell' | 'token_swap' | 'unknown';
}): CopytradeSignalAssetPolicyResult {
  const tokenIn = classifyCopytradeAssetEligibility({
    chainId: params.chainId,
    tokenAddress: params.tokenIn,
  });
  const tokenOut = classifyCopytradeAssetEligibility({
    chainId: params.chainId,
    tokenAddress: params.tokenOut,
  });

  if (params.direction === 'buy' && !tokenOut.allowed) {
    return {
      allowed: false,
      blockedToken: tokenOut.normalizedToken,
      reasonCode: tokenOut.reasonCode,
    };
  }

  if (params.direction === 'sell' && !tokenIn.allowed) {
    return {
      allowed: false,
      blockedToken: tokenIn.normalizedToken,
      reasonCode: tokenIn.reasonCode,
    };
  }

  if (params.direction === 'token_swap') {
    const blocked = !tokenIn.allowed ? tokenIn : !tokenOut.allowed ? tokenOut : null;
    if (blocked) {
      return {
        allowed: false,
        blockedToken: blocked.normalizedToken,
        reasonCode: blocked.reasonCode,
      };
    }
  }

  return {
    allowed: true,
    blockedToken: null,
    reasonCode: null,
  };
}
