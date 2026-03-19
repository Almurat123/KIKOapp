import { getChainConfig } from '../config/chainConfig.js';

const NATIVE_TOKEN_PLACEHOLDER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function normalizeNativeTokenFor0x(token: string, chainId: number): string {
  const raw = String(token || '').trim();
  if (!raw) return raw;

  const lower = raw.toLowerCase();
  if (lower === ZERO_ADDRESS || lower === NATIVE_TOKEN_PLACEHOLDER.toLowerCase()) {
    return NATIVE_TOKEN_PLACEHOLDER;
  }

  const chainConfig = getChainConfig(chainId);
  const nativeSymbol = String(chainConfig?.nativeCurrency?.symbol || '').trim().toLowerCase();
  const nativeName = String(chainConfig?.nativeCurrency?.name || '').trim().toLowerCase();
  const nativeAliases = new Set([
    nativeSymbol,
    nativeName,
    'eth',
    'ether',
    'bnb',
    'binance coin',
    'pol',
    'polygon',
    'matic',
    'sol',
    'solana',
    'base',
  ].filter(Boolean));

  if (nativeAliases.has(lower)) {
    return NATIVE_TOKEN_PLACEHOLDER;
  }

  return raw;
}

export const __testOnly = {
  NATIVE_TOKEN_PLACEHOLDER,
  ZERO_ADDRESS,
};
