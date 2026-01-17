/**
 * SwapCardChat - AI 聊天中的 Swap 卡片适配组件
 * 包装 SwapCardIntegrated，支持从 AI 解析的数据初始化
 */

import React, { useEffect, useMemo, useState } from 'react';
import { SwapCardIntegrated } from '../Swap/SwapCardIntegrated';

import { getCommonTokens } from '../../services/tokenDataService';
import type { Token } from '../../types/swap';
import { logger } from '../../utils/logger';

export interface SwapCardData {
  tokenIn?: any;
  tokenOut?: any;
  quote?: any;
  rate?: string;
  slippage?: any;
  [key: string]: any;
}

interface SwapCardChatProps {
  initialData?: SwapCardData; // AI 解析的数据
  userAddress?: string;
  chainId?: number;
  onSwapSuccess?: (txHash: string) => void;
  onSwapError?: (error: string) => void;
  onCancel?: () => void;
}

function getTokenEmoji(symbol: string): string {
  const emojiMap: Record<string, string> = {
    // Native tokens
    'ETH': '💎',
    'BNB': '🟡',
    'MATIC': '🟣',
    'AVAX': '🔺',
    'FTM': '👻',
    'SOL': '🌞',
    // Stablecoins
    'USDC': '💵',
    'USDT': '💳',
    'DAI': '💰',
    'BUSD': '💵',
    // Wrapped tokens
    'WETH': '🔷', // Blue diamond for wrapped ETH
    'WBTC': '₿',
    'WBNB': '🟡',
    // Other
    'BTC': '₿',
    'UNI': '🦄',
  };
  return emojiMap[symbol.toUpperCase()] || '🪙';
}

/**
 * 将网络名称转换为 chainId
 */
function networkToChainId(network: string): number {
  const networkMap: Record<string, number> = {
    'eth': 1,
    'ethereum': 1,
    'base': 8453,
    'bsc': 56,
    'binance': 56,
    'arbitrum': 42161,
    'polygon': 137,
    'optimism': 10,
    'avalanche': 43114,
    'avax': 43114,
    'fantom': 250,
    'solana': 900,
    'sol': 900,
  };
  return networkMap[network.toLowerCase()] || 1;
}





/**
 * 将 SwapCardData 转换为 Token 对象
 */
function swapDataToToken(
  tokenData: SwapCardData['tokenIn'] | SwapCardData['tokenOut'],
  chainId: number
): Token | null {
  logger.debug('[swapDataToToken] Input:', {
    symbol: tokenData.symbol,
    address: tokenData.address,
    chainId,
  });

  try {
    // Map native token symbols to chain-specific native tokens
    const nativeTokenMap: Record<number, string> = {
      1: 'ETH',      // Ethereum
      56: 'BNB',     // BSC
      137: 'POL',    // Polygon
      8453: 'ETH',   // Base
      42161: 'ETH',  // Arbitrum
      10: 'ETH',     // Optimism
      900: 'SOL',    // Solana
    };

    // If the symbol is a generic native token (ETH, BNB, etc.) but we're on a different chain,
    // map it to the correct native token for this chain
    let symbol = tokenData.symbol;
    const isLikelyNativeToken = ['ETH', 'BNB', 'MATIC', 'POL', 'SOL'].includes(symbol.toUpperCase());
    if (isLikelyNativeToken && nativeTokenMap[chainId]) {
      const correctNativeSymbol = nativeTokenMap[chainId];
      if (symbol.toUpperCase() !== correctNativeSymbol.toUpperCase()) {
        logger.debug(`[swapDataToToken] Mapping ${symbol} -> ${correctNativeSymbol} for chain ${chainId}`);
        symbol = correctNativeSymbol;
      }
    }

    // Normalize ETH placeholder address to zero address
    const normalizeAddress = (addr?: string): string | undefined => {
      if (!addr) return addr;
      // Convert ETH placeholder (0xEee...EEeE) to zero address
      if (addr.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        return '0x0000000000000000000000000000000000000000';
      }
      return addr;
    };

    // 如果没有地址，尝试通过 symbol 从 commonTokens 查找
    const commonTokens = getCommonTokens(chainId);

    // Helper function to check if address is native token
    const isNativeAddress = (addr: string) => {
      const normalized = addr.toLowerCase();
      return normalized === '0x0000000000000000000000000000000000000000' ||
        normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    };

    // Find token by symbol or address
    // For native tokens, match by symbol since addresses can vary (0x0000... or 0xEeee...)
    const foundToken = commonTokens.find(t => {
      if (tokenData.address && isNativeAddress(tokenData.address)) {
        // For native tokens, match by symbol (use mapped symbol)
        return t.symbol.toUpperCase() === symbol.toUpperCase();
      }
      // For other tokens, match by symbol (use mapped symbol)
      return t.symbol.toUpperCase() === symbol.toUpperCase();
    });

    logger.debug('[swapDataToToken] Found token:', foundToken?.symbol);

    // 如果有地址，直接使用（但先规范化）
    if (tokenData.address) {
      const normalizedAddress = normalizeAddress(tokenData.address);
      const result = {
        address: normalizedAddress!,
        symbol: tokenData.symbol,
        name: tokenData.name || tokenData.symbol,
        decimals: foundToken?.decimals || 18, // Use decimals from COMMON_TOKENS if available
        chainId,
        logoUrl: foundToken?.logoURI, // Use logo from COMMON_TOKENS if available
        emoji: getTokenEmoji(tokenData.symbol),
      };
      logger.debug('[swapDataToToken] Returning (with address):', result.symbol);
      return result;
    }

    if (foundToken) {
      const result = {
        address: foundToken.address,
        symbol: foundToken.symbol,
        name: foundToken.name,
        decimals: foundToken.decimals || 18,
        chainId,
        logoUrl: foundToken.logoURI,
        emoji: getTokenEmoji(foundToken.symbol),
      };
      logger.debug('[swapDataToToken] Returning (from foundToken):', result.symbol);
      return result;
    }

    // 如果找不到，返回 null（SwapCardIntegrated 会处理）
    logger.warn('[swapDataToToken] No token found, returning null');
    return null;
  } catch (error) {
    logger.error('[SwapCardChat] Error converting swap data to token:', error);
    return null;
  }
}

/**
 * SwapCardChat 组件
 * 在 AI 聊天中使用，支持从 AI 解析的数据初始化
 * 
 * 注意：由于 SwapCardIntegrated 内部已经使用 useSwap hook 管理状态，
 * 我们需要通过修改 SwapCardIntegrated 来支持初始值，或者创建一个新的组件。
 * 这里我们采用简单方案：直接使用 SwapCardIntegrated，并在外部通过 useEffect 设置初始值。
 * 
 * 更好的方案是修改 SwapCardIntegrated 支持 initialTokenIn, initialTokenOut, initialAmountIn props。
 */
export const SwapCardChat: React.FC<SwapCardChatProps> = ({
  initialData,
  userAddress,
  chainId: propChainId,
  onSwapSuccess,
  onSwapError,
}) => {
  // 确定使用的 chainId - 优先使用 AI 检测到的网络
  const chainId = useMemo(() => {
    // Smart detection: If tokenIn or tokenOut is SOL, force Solana chain
    const tokenInSymbol = initialData?.tokenIn?.symbol?.toUpperCase();
    const tokenOutSymbol = initialData?.tokenOut?.symbol?.toUpperCase();

    // Solana-specific tokens
    // Solana-specific tokens
    const solanaTokens = ['SOL', 'USDC-SOL', 'USDT-SOL', 'RAY', 'SRM', 'JUP', 'BONK', 'WIF'];
    const isSolanaToken = (token?: any, symbol?: string) => {
      if (!token) return false;
      const address = token.address;

      // Check explicit Solana symbols using pre-extracted symbol
      if (symbol === 'SOL' || (symbol && solanaTokens.includes(symbol))) return true;

      // Check address format (Solana addresses are Base58 and don't start with 0x)
      if (address && typeof address === 'string') {
        // EVM addresses start with 0x, Solana addresses do not
        if (address.length > 30 && !address.startsWith('0x')) return true;
      }
      return false;
    };

    if (isSolanaToken(initialData?.tokenIn, tokenInSymbol) || isSolanaToken(initialData?.tokenOut, tokenOutSymbol)) {
      return 900; // Force Solana
    }

    // Priority 1: Use network from AI-detected swap data
    if (initialData?.network) {
      return networkToChainId(initialData.network);
    }
    // Priority 2: Use chainId from props (user's current wallet chain)
    // FIXED: Always use propChainId, don't fallback to Ethereum
    if (propChainId) return propChainId;
    // Priority 3: propChainId should always be provided from ChatInterface
    // This fallback should rarely be hit, but use propChainId or log a warning
    logger.warn('[SwapCardChat] No chainId provided in props, this should not happen');
    return propChainId || 1; // Keep final fallback to prevent crash
  }, [initialData?.network, initialData?.tokenIn?.symbol, initialData?.tokenOut?.symbol, propChainId]);

  // 转换初始代币数据
  const [initialTokens, setInitialTokens] = useState<{
    tokenIn: Token | null;
    tokenOut: Token | null;
    amountIn: string;
  } | null>(null);

  // Internal chainId state that can be updated if token is found on another chain
  const [activeChainId, setActiveChainId] = useState<number>(chainId);

  useEffect(() => {
    setActiveChainId(chainId);
  }, [chainId]);

  useEffect(() => {
    const initTokens = async () => {
      if (!initialData) {
        setInitialTokens(null);
        return;
      }

      try {
        // Helper to resolve token data
        const resolveToken = async (data: SwapCardData['tokenIn'] | SwapCardData['tokenOut']): Promise<Token | null> => {
          // Handle string input (e.g., just "ETH" or "USDC")
          if (typeof data === 'string') {
            const symbol = data;
            const token = swapDataToToken({ symbol, name: symbol } as any, activeChainId);
            if (!token) {
              logger.warn('[SwapCardChat] Could not resolve token from string:', symbol);
            }
            return token;
          }

          // Add safety check for undefined data or symbol
          if (!data || !data.symbol) {
            logger.warn('[SwapCardChat] Token data is missing or incomplete:', data);
            return null;
          }

          // Special handling for native tokens - use COMMON_TOKENS directly
          const nativeTokens = ['ETH', 'BNB', 'MATIC', 'AVAX', 'FTM', 'SOL'];
          const isNativeToken = nativeTokens.includes(data.symbol.toUpperCase());

          // ETH placeholder address (0xEee...EEeE) should be treated as native, not a contract
          const isEthPlaceholder = data.address?.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
          const hasRealContractAddress = data.address?.startsWith('0x') && !isEthPlaceholder;

          if (isNativeToken && !hasRealContractAddress) {
            return swapDataToToken(data, activeChainId);
          }

          // Check if symbol or address is a contract address
          // IMPORTANT: Exclude ETH placeholder address (0xEee...EEeE)
          const isContractAddress = (str?: string) => {
            if (!str) return false;

            // Check for EVM address (0x + 40 hex)
            if (str.startsWith('0x') && str.length === 42) {
              // Exclude ETH placeholder
              if (str.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return false;
              return true;
            }

            // Check for Solana address (base58, 32-44 chars)
            if (str.length >= 32 && str.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(str)) {
              return true;
            }

            return false;
          };
          const contractAddr = isContractAddress(data.address) ? data.address :
            isContractAddress(data.symbol) ? data.symbol : null;

          if (contractAddr) {
            // Fetch real token data
            try {
              const { getTokenData, findTokenOnAnyChain } = await import('../../services/tokenDataService');

              // 1. Try getting data on current chain
              let tokenData = await getTokenData(contractAddr!, activeChainId);

              // 2. If not found or unknown, try searching all chains
              if (!tokenData || tokenData.symbol === 'UNKNOWN') {
                const globalToken = await findTokenOnAnyChain(contractAddr!);
                if (globalToken) {
                  logger.debug(`[SwapCardChat] Found token ${globalToken.symbol} on chain ${globalToken.chainId}`);
                  tokenData = globalToken;
                  // DON'T call setActiveChainId here - will do it after both tokens are resolved
                }
              }

              return {
                address: tokenData.address,
                symbol: tokenData.symbol,
                name: tokenData.name,
                decimals: tokenData.decimals,
                logoUrl: tokenData.logoURI,
                chainId: tokenData.chainId, // Use the token's actual chainId
                emoji: getTokenEmoji(tokenData.symbol),
              };
            } catch (e) {
              logger.warn('[SwapCardChat] Failed to fetch token data:', e);
              // Fallback to basic info
              return {
                address: contractAddr!,
                symbol: 'UNKNOWN',
                name: 'Unknown Token',
                decimals: 18,
                chainId: activeChainId,
                emoji: '🪙',
              };
            }
          }

          // Standard token resolution - use activeChainId for non-contract tokens
          return swapDataToToken(data, activeChainId);
        };

        const tokenIn = await resolveToken(initialData.tokenIn);
        const tokenOut = await resolveToken(initialData.tokenOut);
        const amountIn = initialData.tokenIn?.amount?.replace(/,/g, '') || '';

        if (tokenIn && tokenOut) {
          // IMPORTANT: Update activeChainId FIRST before setting initialTokens
          // This ensures SwapCardIntegrated receives the correct chainId
          const targetChainId = tokenOut.chainId || tokenIn.chainId || activeChainId;
          if (targetChainId !== activeChainId) {
            setActiveChainId(targetChainId);
          }



          setInitialTokens({ tokenIn, tokenOut, amountIn });
        } else {
          logger.warn('[SwapCardChat] Failed to convert tokens:', { tokenIn, tokenOut });
          setInitialTokens(null);
        }
      } catch (error) {
        logger.error('[SwapCardChat] Error initializing tokens:', error);
        setInitialTokens(null);
      }
    };

    initTokens();
  }, [initialData]); // Only depend on initialData to avoid infinite loop when activeChainId changes

  // 使用 SwapCardIntegrated，传递初始值
  // CRITICAL: Use a key based on token addresses to force remount when tokens resolve
  // This ensures useSwap hook initializes with correct tokens from the start
  const swapKey = initialTokens
    ? `swap_${initialTokens.tokenIn?.address}_${initialTokens.tokenOut?.address}`
    : 'swap_loading';

  return (
    <SwapCardIntegrated
      key={swapKey}
      userAddress={userAddress}
      chainId={activeChainId}
      onSwapSuccess={onSwapSuccess}
      onSwapError={onSwapError}
      initialTokenIn={initialTokens?.tokenIn || null}
      initialTokenOut={initialTokens?.tokenOut || null}
      initialAmountIn={initialTokens?.amountIn}
      isGenerating={!initialTokens}
      maxPriceImpact={initialData?.maxPriceImpact}
      autoExecute={initialData?.autoExecute}
      useServerExecution={initialData?.useServerExecution}
    />
  );
};

