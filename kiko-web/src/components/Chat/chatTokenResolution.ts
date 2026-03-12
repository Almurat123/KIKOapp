import { tokenApi, type TokenSearchResult } from '../../services/api';
import { findTokenOnAnyChain, getCommonTokens, getTokenData, type TokenData } from '../../services/tokenDataService';

export interface ResolvedChatToken {
  address: string;
  symbol: string;
  name: string;
  logoURI?: string;
  chainId: number;
  isNative: boolean;
  source: 'native' | 'cache' | 'address' | 'search' | 'fallback';
}

type ResolveTokenOptions = {
  disallowedAddresses?: string[];
};

const EVM_ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const SOL_NATIVE_ADDRESS = 'So11111111111111111111111111111111111111112';

const NATIVE_TOKEN_ALIASES: Record<number, string[]> = {
  1: ['ETH', 'WETH'],
  10: ['ETH', 'WETH'],
  56: ['BNB', 'WBNB'],
  137: ['POL', 'MATIC', 'WMATIC'],
  8453: ['ETH', 'WETH'],
  42161: ['ETH', 'WETH'],
  43114: ['AVAX', 'WAVAX'],
  900: ['SOL', 'WSOL'],
};

const FAST_MODE_SWAP_INTENT_PATTERN = /\b(swap|buy|sell|trade|exchange)\b|买|卖|换|兑换/i;

function getNetworkSlug(chainId: number): string {
  const map: Record<number, string> = {
    1: 'eth',
    8453: 'base',
    56: 'bsc',
    42161: 'arbitrum',
    137: 'polygon',
    10: 'optimism',
    43114: 'avalanche',
    250: 'fantom',
    900: 'solana',
  };
  return map[chainId] || 'eth';
}

function normalizeTokenText(value?: string | null): string {
  return String(value || '').trim().split('-')[0].toUpperCase();
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function toResolvedToken(data: TokenData, source: ResolvedChatToken['source'], isNative = false): ResolvedChatToken {
  return {
    address: data.address,
    symbol: data.symbol,
    name: data.name,
    logoURI: data.logoURI,
    chainId: data.chainId,
    isNative,
    source,
  };
}

function toResolvedSearchResult(data: TokenSearchResult, chainId: number, source: ResolvedChatToken['source']): ResolvedChatToken {
  return {
    address: data.address,
    symbol: data.symbol,
    name: data.name,
    logoURI: data.imageUrl || data.logoUrl || undefined,
    chainId,
    isNative: false,
    source,
  };
}

export function resolveNativeToken(chainId: number, rawValue: string | null | undefined): ResolvedChatToken | null {
  const normalized = normalizeTokenText(rawValue);
  if (!normalized) return null;

  const aliases = NATIVE_TOKEN_ALIASES[chainId] || [];
  if (!aliases.includes(normalized)) return null;

  const common = getCommonTokens(chainId).find(token => normalizeTokenText(token.symbol) === normalized);
  if (common) {
    return toResolvedToken(common, 'native', true);
  }

  return {
    address: chainId === 900 ? SOL_NATIVE_ADDRESS : EVM_ZERO_ADDRESS,
    symbol: normalized,
    name: normalized,
    logoURI: undefined,
    chainId,
    isNative: true,
    source: 'native',
  };
}

function pickBestSearchResult(results: TokenSearchResult[], rawQuery: string): TokenSearchResult | null {
  if (!results.length) return null;
  const normalized = normalizeTokenText(rawQuery);

  const exactSymbol = results.find(result => normalizeTokenText(result.symbol) === normalized);
  if (exactSymbol) return exactSymbol;

  const exactName = results.find(result => normalizeTokenText(result.name) === normalized);
  if (exactName) return exactName;

  return results[0];
}

export async function resolveTokenForChat(
  rawToken: string | { address?: string; symbol?: string; name?: string; logoURI?: string; imageUrl?: string } | null | undefined,
  chainId: number,
  options: ResolveTokenOptions = {}
): Promise<ResolvedChatToken | null> {
  if (!rawToken) return null;

  const directAddress = typeof rawToken === 'object' ? rawToken.address : undefined;
  const directSymbol = typeof rawToken === 'object' ? (rawToken.symbol || rawToken.name) : rawToken;
  const disallowedAddresses = new Set(
    (options.disallowedAddresses || [])
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
  );
  const explicitNative = resolveNativeToken(chainId, directSymbol);
  if (explicitNative) return explicitNative;

  if (directAddress && (isEvmAddress(directAddress) || isSolanaAddress(directAddress))) {
    if (disallowedAddresses.has(directAddress.trim().toLowerCase())) {
      return null;
    }
    const local = await getTokenData(directAddress, chainId);
    if (local.symbol !== 'UNK') {
      return {
        ...toResolvedToken(local, 'address'),
        logoURI: rawToken && typeof rawToken === 'object' ? rawToken.logoURI || rawToken.imageUrl || local.logoURI : local.logoURI,
      };
    }
    const global = await findTokenOnAnyChain(directAddress);
    if (global) {
      return {
        ...toResolvedToken(global, 'address'),
        logoURI: rawToken && typeof rawToken === 'object' ? rawToken.logoURI || rawToken.imageUrl || global.logoURI : global.logoURI,
      };
    }
  }

  const normalized = normalizeTokenText(directSymbol);
  if (!normalized) return null;

  const common = getCommonTokens(chainId).find(token => {
    const symbolMatch = normalizeTokenText(token.symbol) === normalized;
    const nameMatch = normalizeTokenText(token.name) === normalized;
    return symbolMatch || nameMatch;
  });
  if (common) {
    return toResolvedToken(common, 'cache');
  }

  const searchResults = await tokenApi.search(directSymbol!, getNetworkSlug(chainId));
  const currentChainMatch = pickBestSearchResult(searchResults, directSymbol!);
  if (currentChainMatch) {
    return toResolvedSearchResult(currentChainMatch, chainId, 'search');
  }

  const global = await findTokenOnAnyChain(directSymbol!);
  if (global) {
    return toResolvedToken(global, 'search');
  }

  return {
    address: directAddress || '',
    symbol: directSymbol || 'TOKEN',
    name: directSymbol || 'Unknown Token',
    logoURI: typeof rawToken === 'object' ? rawToken.logoURI || rawToken.imageUrl : undefined,
    chainId,
    isNative: false,
    source: 'fallback',
  };
}

export async function resolveTokenForFastSwap(
  rawToken: string | { address?: string; symbol?: string; name?: string; logoURI?: string; imageUrl?: string } | null | undefined,
  chainId: number,
  options: ResolveTokenOptions = {}
): Promise<ResolvedChatToken | null> {
  if (!rawToken) return null;

  const directAddress = typeof rawToken === 'object' ? rawToken.address : undefined;
  const directSymbol = typeof rawToken === 'object' ? (rawToken.symbol || rawToken.name) : rawToken;
  const disallowedAddresses = new Set(
    (options.disallowedAddresses || [])
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
  );
  const explicitNative = resolveNativeToken(chainId, directSymbol);
  if (explicitNative) return explicitNative;

  if (directAddress && (isEvmAddress(directAddress) || isSolanaAddress(directAddress))) {
    if (disallowedAddresses.has(directAddress.trim().toLowerCase())) {
      return null;
    }
    const local = await getTokenData(directAddress, chainId);
    if (local.symbol !== 'UNK') {
      return {
        ...toResolvedToken(local, 'address'),
        logoURI: rawToken && typeof rawToken === 'object' ? rawToken.logoURI || rawToken.imageUrl || local.logoURI : local.logoURI,
      };
    }
    const global = await findTokenOnAnyChain(directAddress);
    if (global) {
      return {
        ...toResolvedToken(global, 'address'),
        logoURI: rawToken && typeof rawToken === 'object' ? rawToken.logoURI || rawToken.imageUrl || global.logoURI : global.logoURI,
      };
    }
  }

  const normalized = normalizeTokenText(directSymbol);
  if (!normalized) return null;

  const common = getCommonTokens(chainId).find(token => {
    const symbolMatch = normalizeTokenText(token.symbol) === normalized;
    const nameMatch = normalizeTokenText(token.name) === normalized;
    return symbolMatch || nameMatch;
  });
  if (common) {
    return toResolvedToken(common, 'cache');
  }

  return null;
}

export function requiresContractAddressInFastMode(text: string, chainId: number): boolean {
  void chainId;
  // Client-side chat input should never hard-block a swap request.
  // Resolution belongs to the server/AI flow, which can use cached token data
  // and ask a follow-up only when the token still cannot be resolved safely.
  if (!FAST_MODE_SWAP_INTENT_PATTERN.test(text)) return false;
  return false;
}
