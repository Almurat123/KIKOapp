/**
 * useSwap Hook - Swap 卡片逻辑管理
 * 处理代币交换的所有状态、报价更新和执行
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { formatUnits } from 'viem';
import type { Token, SwapState, PriceData, SwapQuote, SwapDisplayInfo, SwapStatus } from '@/types/swap';
import {
  checkApproval,
  getUserBalance,
  calculatePriceImpact,
  executeSwapInstant,
} from '@/services/swapService';
import {
  getBestSwapQuote,
  type SwapQuote as AggregatorQuote,
} from '@/services/dexAggregatorService';
import { getCommonTokens, COMMON_TOKENS, type TokenData } from '@/services/tokenDataService';
import { logger } from '@/utils/logger';
import { getMEVProtectionConfig, estimateMEVSavings } from '@/config/mevProtection';
import {
  calculateDynamicSlippage,
  determineTokenRisk,
  slippageToBps,
  DEFAULT_SLIPPAGE_CONFIG,
  type SlippageConfig,
} from '@/config/slippageConfig';
import {
  getQuoteRefreshInterval,
} from '@/config/degenMode';
import {
  validateSwapPrice,
  type PriceValidationResult,
} from '@/services/priceValidation';

const DEFAULT_CHAIN_ID = 1;
const DEFAULT_SLIPPAGE_BPS = 50;



function tokenDataToToken(tokenData: TokenData): Token {
  return {
    address: tokenData.address,
    symbol: tokenData.symbol,
    name: tokenData.name,
    decimals: tokenData.decimals,
    logoUrl: tokenData.logoURI,
    chainId: tokenData.chainId, // Preserve chainId to prevent cross-chain confusion
    emoji:
      tokenData.symbol === 'ETH' || tokenData.symbol === 'WETH'
        ? '🦄'
        : tokenData.symbol === 'USDC'
          ? '💵'
          : tokenData.symbol === 'USDT'
            ? '💳'
            : tokenData.symbol === 'DAI'
              ? '💰'
              : tokenData.symbol === 'WBTC'
                ? '₿'
                : tokenData.symbol === 'UNI'
                  ? '🦄'
                  : '🪙',
  };
}

// AggregatedQuotePayload is now just SwapQuote

function normalizeAggregatorQuote(
  agg: AggregatorQuote,
  amountIn: string,
): SwapQuote {
  // Type assertion to handle optional fields from aggregator
  const aggAny = agg as any;
  return {
    success: true,
    dex: agg.dexName || agg.dex || 'aggregated',
    router: agg.router || aggAny.to || '',
    amountIn: amountIn,
    amountOut: agg.amountOut,
    path: agg.path.length ? agg.path : [],
    gasEstimate: agg.gasEstimate ?? 0,
    priceImpact: agg.priceImpact ?? 0,
    fee: agg.fee ?? 0,
    data: agg.data || '0x',
    deadline: agg.deadline || Math.floor(Date.now() / 1000) + 600,
    minAmountOut: agg.minAmountOut || agg.amountOut,
    dexName: agg.dexName,
    to: aggAny.to || agg.router || '',
    value: aggAny.value || '0',
    allowanceTarget: aggAny.allowanceTarget,
  };
}

function isNativeTokenAddress(address?: string | null): boolean {
  if (!address) return false;
  const lower = address.toLowerCase();
  return lower === '0x0000000000000000000000000000000000000000' || lower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
}

export interface UseSwapOptions {
  chainId?: number;
  slippageBps?: number;
  userAddress?: string;
  initialTokenIn?: Token;
  initialTokenOut?: Token;
  initialQuote?: any;
  maxPriceImpact?: number;
}

export function useSwap(options: UseSwapOptions = {}) {
  const {
    chainId = DEFAULT_CHAIN_ID,
    slippageBps = DEFAULT_SLIPPAGE_BPS,
    userAddress,
    initialTokenIn: optionTokenIn,
    initialTokenOut: optionTokenOut,
    initialQuote,
    maxPriceImpact,
  } = options;

  // Use Privy to track authentication state
  const { authenticated } = usePrivy();

  const commonTokens = useMemo((): Token[] => {
    const tokens = getCommonTokens(chainId);

    if (tokens && tokens.length >= 2) {
      const mapped = tokens.map(tokenDataToToken);
      return mapped;
    }

    // Fallback: Use COMMON_TOKENS if available
    const chainCommonTokens = COMMON_TOKENS[chainId];
    if (chainCommonTokens) {
      const tokenList = Object.values(chainCommonTokens);
      if (tokenList.length >= 2) {
        const mapped = tokenList.map(tokenDataToToken) as Token[];
        return mapped;
      }
    }

    // No fallback to POPULAR_TOKENS - this would cause cross-chain address confusion
    // Instead, log an error and return empty array
    console.error('[useSwap] ERROR: No COMMON_TOKENS defined for chainId:', chainId, 'This will cause swap to fail. Please add token definitions for this chain.');
    return [];
  }, [chainId]);

  // MEV Protection state
  const [mevProtectionEnabled, setMevProtectionEnabled] = useState(true);

  // Slippage state
  const [slippageConfig, setSlippageConfig] = useState<SlippageConfig>(DEFAULT_SLIPPAGE_CONFIG);
  const [calculatedSlippage, setCalculatedSlippage] = useState<number>(0.5);

  // Degen Mode state
  const [degenMode, setDegenMode] = useState(false);


  // Price validation state
  const [priceValidation, setPriceValidation] = useState<PriceValidationResult | null>(null);

  const [state, setState] = useState<SwapState>(() => {
    // Use provided tokens if available, otherwise use commonTokens defaults
    // This allows SwapCardIntegrated to set tokens from the start, avoiding race conditions
    let tokenIn: Token | null = optionTokenIn || null;
    let tokenOut: Token | null = optionTokenOut || null;

    // If no initial tokens provided, use commonTokens defaults
    if (!tokenIn || !tokenOut) {
      if (commonTokens.length < 2) {
        console.error('[useSwap] Initialization failed: Not enough tokens for chainId', chainId);
      }
      const tokens = commonTokens.length >= 2 ? commonTokens : [];
      tokenIn = tokenIn || tokens[0] || null;
      tokenOut = tokenOut || tokens[1] || tokens[0] || null;
    }

    // Hydrate from initialQuote if available
    let initialAmountIn = '';
    let initialAmountOut = '0';
    let initialPriceImpact = 0;

    if (initialQuote) {
      // If we have a quote, we MUST have an amountIn
      initialAmountIn = initialQuote.amountIn || '';
      initialAmountOut = initialQuote.amountOut || '0';
      initialPriceImpact = initialQuote.priceImpact || 0;
      console.log('[useSwap] Hydrated from initial quote:', { initialAmountIn, initialAmountOut });
    }

    return {
      status: initialQuote ? 'quote_ready' : 'idle',
      tokenIn,
      tokenOut,
      amountIn: initialAmountIn,
      amountOut: initialAmountOut,
      quote: initialQuote ? normalizeAggregatorQuote(initialQuote, initialAmountIn) : null,
      priceImpact: initialPriceImpact,
      isLoading: false,
      isExecuting: false,
      error: null,
      priceImpactUSD: 0,
      gasCostUSD: 0,
      isApproved: false,
      lastTxHash: undefined,
      availableQuotes: initialQuote ? [initialQuote] : [],
      selectedDex: initialQuote?.dexName || initialQuote?.dex,
    };
  });

  useEffect(() => {
    if (!commonTokens.length || commonTokens.length < 2) {
      console.warn('[useSwap] Not enough tokens for chainId:', chainId, 'Available tokens:', commonTokens.length);
      // Set error state if no tokens available
      setState(prev => ({
        ...prev,
        status: 'error',
        error: `No tokens available for chain ${chainId}. Please ensure COMMON_TOKENS is defined for this chain.`,
        tokenIn: null,
        tokenOut: null,
      }));
      return;
    }

    // Only reset tokens if they are null or explicitly invalid for this chain
    // DO NOT force reset to commonTokens[0] and commonTokens[1] - this causes BNB to become ETH
    setState(prev => {
      // If tokens are null, initialize with first two common tokens
      if (!prev.tokenIn || !prev.tokenOut) {
        return {
          ...prev,
          status: prev.amountIn && parseFloat(prev.amountIn) > 0 ? 'quoting' : 'idle',
          tokenIn: prev.tokenIn || commonTokens[0],
          tokenOut: prev.tokenOut || (commonTokens[1] || commonTokens[0]),
          quote: null,
          amountOut: '0',
          error: null,
        };
      }

      // If tokens exist, keep them - don't force reset
      // This preserves AI-detected tokens (like BNB) and user selections
      return prev;
    });
  }, [chainId, commonTokens]);

  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [userBalance, setUserBalance] = useState<string>('0');
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const quoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const quoteRequestIdRef = useRef(0);

  useEffect(() => {
    if (quoteTimeoutRef.current) {
      clearTimeout(quoteTimeoutRef.current);
    }

    const amountVal = parseFloat(state.amountIn);
    if (!state.tokenIn || !state.tokenOut || !state.amountIn || isNaN(amountVal) || amountVal <= 0) {
      quoteRequestIdRef.current += 1;
      setState(prev => ({
        ...prev,
        status: 'idle',
        quote: null,
        amountOut: '0',
        isLoading: false,
        error: null,
      }));
      return;
    }

    const requestId = ++quoteRequestIdRef.current;
    quoteTimeoutRef.current = setTimeout(async () => {
      // Early return if tokens are the same (prevents invalid API calls)
      if (state.tokenIn!.address.toLowerCase() === state.tokenOut!.address.toLowerCase()) {
        console.warn('[useSwap] tokenIn and tokenOut are the same, skipping quote fetch');
        setState(prev => ({
          ...prev,
          status: 'error',
          isLoading: false,
          error: 'Cannot swap the same token',
          quote: null,
          amountOut: '0',
        }));
        return;
      }

      setState(prev => ({ ...prev, status: 'quoting', isLoading: true, error: null }));

      // SKIP FETCH if we just initialized with a valid quote (Instant Swap)
      if (initialQuote && state.quote === initialQuote && state.amountIn === initialQuote.amountIn) {
        console.log('[useSwap] Skipping fetch - using pre-warmed initial quote');
        if (requestId !== quoteRequestIdRef.current) return;
        setState(prev => ({ ...prev, status: 'quote_ready', isLoading: false }));
        return;
      }

      try {
        // Calculate dynamic slippage if in auto mode
        let effectiveSlippageBps = slippageBps;

        if (slippageConfig.mode === 'auto' && priceData) {
          const amountInNum = parseFloat(state.amountIn);
          const tokenInPrice = typeof priceData.tokenInPrice === 'number' ? priceData.tokenInPrice : 0;
          const amountUSD = amountInNum * tokenInPrice;

          // Determine token risk (simplified - can be enhanced with real data)
          const tokenRisk = determineTokenRisk({
            liquidityUSD: 100000, // Default, will be updated with real data
            isVerified: true,
          });

          // Calculate dynamic slippage
          const dynamicSlippage = calculateDynamicSlippage({
            amountUSD,
            liquidityUSD: 100000, // Will be updated with real pool data
            priceImpact: 0, // Will be updated after quote
            tokenRisk,
          });

          setCalculatedSlippage(dynamicSlippage);
          effectiveSlippageBps = slippageToBps(dynamicSlippage);
        } else if (slippageConfig.mode === 'custom') {
          effectiveSlippageBps = slippageToBps(slippageConfig.customValue);
        }

        // Pass human-readable amount to getBestSwapQuote
        // Backend expects amountIn as human-readable (e.g., "1.5"), not base units
        // TODO: Pass effectiveSlippageBps to backend when API supports it
        const aggQuoteResult = await getBestSwapQuote(
          state.tokenIn!.address,
          state.tokenOut!.address,
          state.amountIn,
          chainId,
          userAddress,
          effectiveSlippageBps // Pass slippage
        );
        logger.swap('quote', {
          tokenIn: state.tokenIn!.symbol,
          tokenOut: state.tokenOut!.symbol,
          amountIn: state.amountIn,
          dex: aggQuoteResult.best.dexName
        });
        const normalizedBest = normalizeAggregatorQuote(aggQuoteResult.best as any, state.amountIn);
        const normalizedQuotes = (aggQuoteResult.quotes || []).map(q => normalizeAggregatorQuote(q as any, state.amountIn));
        // Keep full precision for execution checks; UI can format separately.
        const rawAmountOut = normalizedBest.amountOut || '0';
        if (requestId !== quoteRequestIdRef.current) return;

        setState(prev => ({
          ...prev,
          status: 'quote_ready',
          quote: normalizedBest,
          availableQuotes: normalizedQuotes,
          selectedDex: normalizedBest.dex || normalizedBest.dexName,
          amountOut: rawAmountOut,
          isLoading: false,
          priceImpactUSD: normalizedBest.priceImpact,
        }));

        if (priceData) {
          const impact = calculatePriceImpact(state.amountIn, normalizedBest.amountOut, priceData);
          setState(prev => ({ ...prev, priceImpactUSD: impact }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch quote';

        // Check if it's a liquidity issue
        const isLiquidityIssue = message.includes('insufficient liquidity') ||
          message.includes('not being supported') ||
          message.includes('no Route matched');

        // Get chain name for better error message
        const chainName = chainId === 1 ? 'Ethereum' :
          chainId === 8453 ? 'Base' :
            chainId === 56 ? 'BSC' :
              chainId === 137 ? 'Polygon' :
                chainId === 42161 ? 'Arbitrum' :
                  `chain ${chainId}`;

        const userMessage = isLiquidityIssue
          ? `No liquidity for ${state.tokenIn?.symbol} → ${state.tokenOut?.symbol} on ${chainName}. Try: 1) Different tokens 2) Larger amount 3) Switch to Ethereum/Base`
          : message;
        if (requestId !== quoteRequestIdRef.current) return;

        setState(prev => ({
          ...prev,
          status: 'error',
          error: userMessage,
          isLoading: false,
          quote: null,
          amountOut: '0',
        }));
        logger.swap('fail', { error: userMessage });
      }
    }, getQuoteRefreshInterval(degenMode)); // Use Degen Mode interval (500ms) or normal (2000ms)

    return () => {
      if (quoteTimeoutRef.current) {
        clearTimeout(quoteTimeoutRef.current);
      }
    };
  }, [state.tokenIn?.address, state.tokenOut?.address, state.amountIn, chainId, slippageBps]); // Remove priceData from deps to avoid loop



  const fetchUserBalance = useCallback(async (token: Token, fetchId: number, retryCount = 0) => {

    if (!userAddress) {
      setUserBalance('0');
      setIsBalanceLoading(false);
      return;
    }

    // Store the token address we're fetching for to prevent race conditions
    const fetchingForToken = token.address;

    try {
      let balance = 0n;
      const apiBalance = await getUserBalance(userAddress, fetchingForToken, chainId, token.decimals);
      if (apiBalance) {
        balance = BigInt(apiBalance);
      }

      // RACE CONDITION FIX: Check if token has changed since we started the fetch
      // Use the REF (not state) because state is captured at callback creation time (stale closure)
      if (currentTokenInAddressRef.current !== fetchingForToken) {
        return; // Token changed during fetch, discard result
      }

      if (fetchId !== balanceFetchIdRef.current) {
        return;
      }

      const decimals = token.decimals || 18;
      const formatted = formatUnits(balance, decimals);

      console.log('[useSwap] Balance Fetched (Direct RPC):', {
        token: token.symbol,
        balance: balance.toString(),
        formatted,
        isRPC: false
      });

      setUserBalance(prev => {
        // Only update if balance actually changed
        if (prev !== formatted) {
          return formatted;
        }
        return prev;
      });
      setIsBalanceLoading(false);

    } catch (error) {
      // Only log non-network errors as errors
      if (!(error instanceof TypeError && error.message.includes('Failed to fetch'))) {
        console.error('[useSwap] fetchUserBalance failed', error);
      }

      // Implement retry logic with exponential backoff
      const MAX_RETRIES = 3;
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`[useSwap] Retrying fetchUserBalance in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          if (fetchId === balanceFetchIdRef.current && currentTokenInAddressRef.current === fetchingForToken) {
            fetchUserBalance(token, fetchId, retryCount + 1);
          }
        }, delay);
      } else if (fetchId === balanceFetchIdRef.current) {
        setIsBalanceLoading(false);
      }
    }
  }, [userAddress, chainId]);


  const checkUserApproval = useCallback(async () => {
    if (!userAddress || !state.tokenIn) return;
    if (isNativeTokenAddress(state.tokenIn.address)) {
      setState(prev => {
        if (prev.status === 'submitting' || prev.status === 'success') return prev;
        const nextStatus: SwapStatus = prev.quote ? 'quote_ready' : prev.status;
        return { ...prev, isApproved: true, status: nextStatus };
      });
      return;
    }
    const spender = state.quote?.allowanceTarget || state.quote?.to;
    if (!spender) return;

    // Don't check approval if amount is empty or zero (would cause 400 error)
    const amountNum = parseFloat(state.amountIn || '0');
    if (!state.amountIn || isNaN(amountNum) || amountNum <= 0) {
      setState(prev => ({ ...prev, isApproved: false }));
      return;
    }

    const checkId = ++approvalCheckIdRef.current;
    const checkingToken = state.tokenIn.address.toLowerCase();
    const checkingAmount = state.amountIn;
    const checkingSpender = spender.toLowerCase();
    setState(prev => {
      if (prev.status === 'submitting' || prev.status === 'success') return prev;
      return { ...prev, status: 'approval_checking' };
    });

    try {
      const isApproved = await checkApproval(
        userAddress,
        state.tokenIn.address,
        state.amountIn,
        chainId,
        spender
      );
      if (
        checkId !== approvalCheckIdRef.current ||
        currentTokenInAddressRef.current?.toLowerCase() !== checkingToken ||
        currentAmountInRef.current !== checkingAmount ||
        currentSpenderRef.current !== checkingSpender
      ) {
        return;
      }

      setState(prev => {
        if (prev.status === 'submitting' || prev.status === 'success') return prev;
        const nextStatus: SwapStatus = isApproved ? 'quote_ready' : 'needs_approval';
        if (prev.isApproved !== isApproved || prev.status !== nextStatus) {
          return { ...prev, isApproved, status: nextStatus };
        }
        return prev;
      });
    } catch (error) {
      console.error('[useSwap] checkUserApproval failed', error);
      setState(prev => {
        if (prev.status === 'submitting' || prev.status === 'success') return prev;
        return { ...prev, status: 'error' };
      });
    }
  }, [userAddress, state.tokenIn?.address, state.amountIn, chainId, state.quote?.allowanceTarget, state.quote?.to]);

  const balanceFetchIdRef = useRef(0);
  const approvalCheckIdRef = useRef(0);
  // Track current tokenIn address for race condition detection (avoids stale closure)
  const currentTokenInAddressRef = useRef<string | null>(null);
  const currentAmountInRef = useRef<string>('');
  const currentSpenderRef = useRef<string>('');

  // Store function refs to avoid re-triggering useEffect when functions are recreated

  const fetchUserBalanceRef = useRef(fetchUserBalance);
  const checkUserApprovalRef = useRef(checkUserApproval);

  // Update refs when functions change
  useEffect(() => {
    fetchUserBalanceRef.current = fetchUserBalance;
    checkUserApprovalRef.current = checkUserApproval;
  }, [fetchUserBalance, checkUserApproval]);

  useEffect(() => {
    currentAmountInRef.current = state.amountIn || '';
    currentSpenderRef.current = (state.quote?.allowanceTarget || state.quote?.to || '').toLowerCase();
  }, [state.amountIn, state.quote?.allowanceTarget, state.quote?.to]);

  // Removed independent price fetching - price is fetched as part of quote request
  // This ensures only ONE request per swap card (the quote request)
  useEffect(() => {
    // CRITICAL: Only fetch balance when user is authenticated
    // This prevents race condition where balance is fetched before token is ready
    if (!userAddress || !state.tokenIn || !authenticated) {
      setUserBalance('0');
      setIsBalanceLoading(false);
      return;
    }

    // CRITICAL: Update refs before async calls to prevent stale updates.
    const tokenSnapshot = state.tokenIn;
    currentTokenInAddressRef.current = tokenSnapshot.address;
    const fetchId = ++balanceFetchIdRef.current;
    setIsBalanceLoading(true);

    // Always fetch for latest token snapshot; stale responses are discarded by fetchId/token guards.
    fetchUserBalanceRef.current(tokenSnapshot, fetchId);

    // Check approval separately with debounce
    const approvalTimeout = setTimeout(() => {
      checkUserApprovalRef.current();
    }, 1000);

    return () => {
      clearTimeout(approvalTimeout);
    };
  }, [state.tokenIn?.address, userAddress, chainId, authenticated]);

  useEffect(() => {
    if (!authenticated || !userAddress || !state.tokenIn || !(state.quote?.allowanceTarget || state.quote?.to)) return;

    const amountNum = parseFloat(state.amountIn || '0');
    if (!state.amountIn || isNaN(amountNum) || amountNum <= 0) {
      setState(prev => ({ ...prev, isApproved: isNativeTokenAddress(state.tokenIn?.address) }));
      return;
    }

    const timeout = setTimeout(() => {
      checkUserApprovalRef.current();
    }, 300);

    return () => clearTimeout(timeout);
  }, [authenticated, userAddress, state.tokenIn?.address, state.amountIn, state.quote?.allowanceTarget, state.quote?.to]);

  // Removed enrichToken effect that caused infinite loops
  // Token metadata is now loaded by tokenDataService when tokens are selected


  const setTokenIn = useCallback((token: Token) => {
    console.log('[useSwap] setTokenIn CALLED:', token.symbol, token.address);

    // IMMEDIATELY update the ref to prevent race conditions
    // This happens synchronously before any async operations
    currentTokenInAddressRef.current = token.address;

    setState(prev => {
      console.log('[useSwap] setTokenIn setState - prev:', prev.tokenIn?.symbol, '-> new:', token.symbol);

      // Reset user balance to 0 momentarily to prevent showing previous token's balance
      // while the new balance is being fetched
      if (prev.tokenIn?.address !== token.address) {
        setUserBalance('0');
        setIsBalanceLoading(true);
      }

      return {
        ...prev,
        status: prev.amountIn && parseFloat(prev.amountIn) > 0 ? 'quoting' : 'idle',
        tokenIn: {
          ...token,
          // Preserve logoUrl if new token doesn't have one but previous token does
          logoUrl: token.logoUrl || prev.tokenIn?.logoUrl,
        },
        quote: null,
        amountOut: '0',
        isApproved: false,
        error: null,
      };
    });
  }, []);

  const setTokenOut = useCallback((token: Token) => {
    console.log('[useSwap] setTokenOut called:', {
      newToken: token.symbol,
      newAddress: token.address,
      hasLogoUrl: !!token.logoUrl,
    });
    setState(prev => ({
      ...prev,
      status: prev.amountIn && parseFloat(prev.amountIn) > 0 ? 'quoting' : 'idle',
      tokenOut: {
        ...token,
        // Preserve logoUrl if new token doesn't have one but previous token does
        logoUrl: token.logoUrl || prev.tokenOut?.logoUrl,
      },
      quote: null,
      amountOut: '0',
      error: null,
    }));
  }, []);

  const setAmountIn = useCallback((amount: string) => {
    let normalizedInput = amount
      // Normalize full-width/locale decimal separators to standard dot.
      .replace(/[。．｡]/g, '.')
      .replace(/\s+/g, '');

    const commaMatches = normalizedInput.match(/[，,]/g);
    if (commaMatches?.length) {
      // If comma is the only decimal separator and appears once, treat as decimal point.
      if (!normalizedInput.includes('.') && commaMatches.length === 1) {
        normalizedInput = normalizedInput.replace(/[，,]/g, '.');
      } else {
        // Otherwise commas are considered thousands separators and removed.
        normalizedInput = normalizedInput.replace(/[，,]/g, '');
      }
    }

    const sanitized = normalizedInput.replace(/[^\d.]/g, '');
    const parts = sanitized.split('.');
    let normalized = parts.length > 2
      ? `${parts[0]}.${parts.slice(1).join('')}`
      : sanitized;

    if (normalized === '.') normalized = '0.';
    if (normalized.startsWith('.')) normalized = `0${normalized}`;
    normalized = normalized.replace(/^0+(?=\d)/, '');

    setState(prev => ({
      ...prev,
      status: normalized && parseFloat(normalized) > 0 ? 'quoting' : 'idle',
      amountIn: normalized,
      isApproved: false,
      error: null,
    }));
  }, []);

  const swapTokens = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: prev.amountOut && parseFloat(prev.amountOut) > 0 ? 'quoting' : 'idle',
      tokenIn: prev.tokenOut,
      tokenOut: prev.tokenIn,
      amountIn: prev.amountOut,
      amountOut: prev.amountIn,
      quote: null,
      isApproved: false,
      error: null,
    }));

    // Swap price data locally to prevent stale prices during calculation
    setPriceData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tokenInPrice: prev.tokenOutPrice,
        tokenOutPrice: prev.tokenInPrice,
      };
    });
  }, []);

  const approveToken = useCallback(async () => {
    await checkUserApproval();
    if (state.isApproved) {
      return { success: true };
    }
    const message = 'Manual approve is not supported here. Use "Swap" to let backend handle approval + swap.';
    setState(prev => ({ ...prev, status: 'error', error: message }));
    return { success: false, error: message };
  }, [checkUserApproval, state.isApproved]);

  const executeSwap = useCallback(async () => {
    if (!state.quote || !userAddress) {
      setState(prev => ({ ...prev, status: 'error', error: 'Missing quote or wallet address' }));
      return { success: false, error: 'Missing quote or wallet address' };
    }

    if (!state.tokenIn || !state.tokenOut) {
      setState(prev => ({ ...prev, status: 'error', error: 'Missing token information' }));
      return { success: false, error: 'Missing token information' };
    }

    setState(prev => ({ ...prev, status: 'submitting', isExecuting: true, error: null }));
    logger.swap('init', {
      tokenIn: state.tokenIn.symbol,
      tokenOut: state.tokenOut.symbol,
      amount: state.amountIn
    });

    try {

      // INSTANT TRADING: Try backend execution first (no user popup needed)
      // This works for Privy embedded wallets with server-side signing enabled
      console.log('[useSwap] Attempting instant swap via backend...');
      const instantResult = await executeSwapInstant({
        tokenIn: state.tokenIn.address,
        tokenOut: state.tokenOut.address,
        amountIn: state.amountIn,
        chainId,
        slippageBps,
        maxPriceImpact,
      });

      if (instantResult.success && instantResult.txHash) {
        console.log('[useSwap] Instant swap successful:', instantResult.txHash);
        setState(prev => ({
          ...prev,
          status: 'success',
          isExecuting: false,
          amountIn: '0',
          amountOut: '0',
          quote: null,
          isApproved: false,
          lastTxHash: instantResult.txHash,
        }));
        const nextFetchId = ++balanceFetchIdRef.current;
        await fetchUserBalance(state.tokenIn, nextFetchId);
        return {
          success: true,
          txHash: instantResult.txHash,
        };
      }

      const errorMessage = instantResult.error || 'Instant swap failed. Please try again later.';
      console.log('[useSwap] Instant swap failed:', errorMessage);
      setState(prev => ({ ...prev, status: 'error', isExecuting: false, error: errorMessage }));
      return { success: false, error: errorMessage };
    } catch (error) {
      console.error('[executeSwap] Transaction failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to execute swap';
      setState(prev => ({ ...prev, status: 'error', error: message, isExecuting: false }));
      logger.swap('fail', { error: message });
      return { success: false, error: message };
    }
  }, [state.quote, state.tokenIn, state.tokenOut, state.amountIn, userAddress, chainId, fetchUserBalance, slippageBps, maxPriceImpact]);

  const getDisplayInfo = useCallback((): SwapDisplayInfo => {
    // Ensure we have valid token symbols - never show 'UNKNOWN' or empty
    const tokenInSymbol = (state.tokenIn?.symbol && state.tokenIn.symbol !== 'UNKNOWN')
      ? state.tokenIn.symbol
      : 'Select';
    const tokenOutSymbol = (state.tokenOut?.symbol && state.tokenOut.symbol !== 'UNKNOWN')
      ? state.tokenOut.symbol
      : 'Select';

    // Calculate USD values - safely parse and validate all numbers
    const amountInNum = state.amountIn ? parseFloat(state.amountIn) : 0;
    const amountOutNum = state.amountOut ? parseFloat(state.amountOut) : 0;

    // Safely get price values and ensure they're numbers
    const tokenInPrice = (priceData && typeof priceData.tokenInPrice === 'number') ? priceData.tokenInPrice : 0;
    const tokenOutPrice = (priceData && typeof priceData.tokenOutPrice === 'number') ? priceData.tokenOutPrice : 0;
    const nativePrice = (priceData && typeof priceData.nativeTokenPrice === 'number') ? priceData.nativeTokenPrice : 0;

    // Calculate USD values with validation
    const amountInUSD = (amountInNum > 0 && tokenInPrice > 0 && !isNaN(amountInNum) && !isNaN(tokenInPrice))
      ? (amountInNum * tokenInPrice).toFixed(2)
      : '0.00';

    const amountOutUSD = (amountOutNum > 0 && tokenOutPrice > 0 && !isNaN(amountOutNum) && !isNaN(tokenOutPrice))
      ? (amountOutNum * tokenOutPrice).toFixed(2)
      : '0.00';

    // Format user balance - userBalance is already formatted as string from fetchUserBalance
    // CRITICAL: DO NOT truncate or round - pass the EXACT value for precision
    // The userBalance string from formatUnits is already the correct precision
    const balanceNum = userBalance ? parseFloat(userBalance) : 0;
    // For display, show meaningful decimals but keep original precision for Max button
    // formattedBalance is for UI display, rawBalance is for calculations
    const formattedBalance = userBalance || '0'; // PASS EXACT STRING - no truncation!

    // Check if user has enough balance
    // CRITICAL: For native tokens (ETH), we must reserve gas fees
    // Otherwise, swapping the entire balance will fail
    const isNativeToken = state.tokenIn?.address === '0x0000000000000000000000000000000000000000' ||
      state.tokenIn?.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

    let hasEnoughBalance = false;
    let balanceRequired = amountInNum;

    if (isNativeToken) {
      // Logic for Native tokens (ETH, MATIC, BNB, etc.)
      // Align with backend native precheck reserve to prevent UI false-positive executability.
      const gasBuffer = chainId === 8453
        ? 0.0003
        : (chainId === 42161 || chainId === 10 ? 0.002 : 0.001);

      // If user is swapping MAX (amountIn ~ balance), we don't apply buffer on top of amount
      // because amountIn is likely already (balance - buffer) calculated by the Max button logic.
      // But we can't easily know if 'Max' was clicked here.
      // So we just ensure balance >= amount + buffer.
      balanceRequired = amountInNum + gasBuffer;
      hasEnoughBalance = balanceNum >= balanceRequired;
    } else {
      // For ERC-20 tokens
      hasEnoughBalance = balanceNum >= amountInNum;
    }

    if (!hasEnoughBalance && amountInNum > 0) {
      console.warn('[useSwap] Insufficient balance:', {
        balance: balanceNum,
        required: balanceRequired,
        isNative: isNativeToken,
        chainId
      });
    }

    // Calculate gas cost in USD (gasEstimate is in wei, nativeTokenPrice is in USD)
    const gasEstimate = state.quote?.gasEstimate || 0;
    const gasCostUSD = (gasEstimate > 0 && nativePrice > 0)
      ? ((gasEstimate * 21000 / 1e9) * nativePrice).toFixed(4)
      : '0.00';

    const amountInValid = amountInNum > 0;
    const amountOutValid = amountOutNum > 0;
    const spender = state.quote?.allowanceTarget || state.quote?.to;
    const needsApproval = !!(
      amountInValid &&
      state.tokenIn &&
      !isNativeTokenAddress(state.tokenIn.address) &&
      spender &&
      !state.isApproved
    );
    const status: SwapStatus =
      state.status === 'quote_ready' && needsApproval ? 'needs_approval' : state.status;

    let actionLabel = 'Swap';
    if (!authenticated) actionLabel = 'Connect Wallet';
    else if (!amountInValid) actionLabel = 'Enter Amount';
    else if (status === 'quoting') actionLabel = 'Getting Quote...';
    else if (status === 'approval_checking') actionLabel = 'Checking Approval...';
    else if (status === 'needs_approval') actionLabel = `Approve & Swap ${tokenInSymbol}`;
    else if (status === 'submitting') actionLabel = needsApproval ? 'Approving & Swapping...' : 'Swapping...';
    else if (!hasEnoughBalance) actionLabel = 'Insufficient Balance';
    else if (status === 'error') actionLabel = 'Swap Unavailable';

    const isActionDisabled = status === 'submitting' ||
      status === 'quoting' ||
      status === 'approval_checking' ||
      !amountInValid ||
      !amountOutValid ||
      !hasEnoughBalance ||
      !!state.error;

    return {
      status,
      tokenInSymbol,
      tokenOutSymbol,
      tokenInEmoji: state.tokenIn?.emoji || '🔄',
      tokenOutEmoji: state.tokenOut?.emoji || '🔄',
      amountIn: state.amountIn || '0',
      amountOut: state.amountOut || '0',
      amountInUSD,
      amountOutUSD,
      isLoading: state.isLoading,
      isExecuting: state.isExecuting,
      error: state.error,
      isApproved: state.isApproved,
      needsApproval,
      actionLabel,
      isActionDisabled,
      priceImpact: state.quote?.priceImpact || 0,
      gasEstimate: state.quote?.gasEstimate || 0,
      gasCostUSD,
      minAmountOut: state.quote?.minAmountOut || '0',
      dexName: state.quote?.dex || state.quote?.dexName || 'N/A',
      userBalance: formattedBalance,
      isBalanceLoading,
      hasEnoughBalance,
      availableQuotes: state.availableQuotes || [],
      selectedDex: state.selectedDex,
      // MEV Protection info
      mevProtection: getMEVProtectionInfo(),
    };
  }, [state, priceData, userBalance, isBalanceLoading, chainId, mevProtectionEnabled, authenticated]);

  // Get MEV protection information
  const getMEVProtectionInfo = useCallback(() => {
    const amountInNum = state.amountIn ? parseFloat(state.amountIn) : 0;
    const tokenInPrice = (priceData && typeof priceData.tokenInPrice === 'number') ? priceData.tokenInPrice : 0;
    const amountInUSD = amountInNum * tokenInPrice;

    const config = getMEVProtectionConfig(chainId, amountInUSD);

    if (!config) {
      return {
        available: false,
        enabled: false,
        provider: null,
        rebatePercentage: 0,
        estimatedSavings: 0,
        features: [],
      };
    }

    const estimatedSavings = estimateMEVSavings(amountInUSD, chainId);

    return {
      available: true,
      enabled: mevProtectionEnabled,
      provider: config.provider,
      rebatePercentage: config.rebatePercentage,
      estimatedSavings,
      features: config.features,
    };
  }, [chainId, state.amountIn, priceData, mevProtectionEnabled]);

  // Get available tokens for the current chain
  const getAvailableTokens = useCallback((): Token[] => {
    // Never fallback to POPULAR_TOKENS - always use chain-specific tokens
    if (commonTokens.length === 0) {
      console.error('[useSwap] No tokens available for chainId:', chainId);
    }
    return commonTokens;
  }, [commonTokens]);

  const selectQuote = useCallback((dex: string) => {
    setState(prev => {
      const found = prev.availableQuotes?.find(q => (q.dex || q.dexName) === dex);
      if (found) {
        return {
          ...prev,
          status: 'quote_ready',
          quote: found,
          amountOut: found.amountOut || prev.amountOut,
          selectedDex: dex,
        };
      }
      return prev;
    });
  }, []);

  const refreshSwapState = useCallback(async () => {
    if (!authenticated || !userAddress || !state.tokenIn) return;
    currentTokenInAddressRef.current = state.tokenIn.address;
    const fetchId = ++balanceFetchIdRef.current;
    setIsBalanceLoading(true);
    await fetchUserBalance(state.tokenIn, fetchId);
    checkUserApprovalRef.current();
  }, [authenticated, userAddress, state.tokenIn, fetchUserBalance]);

  return {
    state,
    displayInfo: getDisplayInfo(),
    setTokenIn,
    setTokenOut,
    setAmountIn,
    swapTokens,
    approveToken,
    executeSwap,
    getAvailableTokens,
    selectQuote,
    mevProtectionEnabled,
    setMevProtectionEnabled,
    // Slippage controls
    slippageConfig,
    setSlippageConfig,
    calculatedSlippage,
    // Degen Mode controls
    degenMode,
    setDegenMode,
    refreshSwapState,
    // Price validation
    priceValidation,
    validatePrice: async () => {
      if (!state.tokenOut || !priceData) return null;
      const tokenPrice = typeof priceData.tokenOutPrice === 'number' ? priceData.tokenOutPrice : 0;
      const result = await validateSwapPrice(state.tokenOut.address, chainId, tokenPrice);
      setPriceValidation(result);
      return result;
    },
  };
}
