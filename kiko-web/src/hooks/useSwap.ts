/**
 * useSwap Hook - Swap 卡片逻辑管理
 * 处理代币交换的所有状态、报价更新和执行
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { formatUnits } from 'viem';
import type { Token, SwapState, PriceData, SwapQuote } from '@/types/swap';
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
  const quoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (quoteTimeoutRef.current) {
      clearTimeout(quoteTimeoutRef.current);
    }

    const amountVal = parseFloat(state.amountIn);
    if (!state.tokenIn || !state.tokenOut || !state.amountIn || isNaN(amountVal) || amountVal <= 0) {
      setState(prev => ({ ...prev, quote: null, amountOut: '0' }));
      return;
    }

    quoteTimeoutRef.current = setTimeout(async () => {
      // Early return if tokens are the same (prevents invalid API calls)
      if (state.tokenIn!.address.toLowerCase() === state.tokenOut!.address.toLowerCase()) {
        console.warn('[useSwap] tokenIn and tokenOut are the same, skipping quote fetch');
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Cannot swap the same token',
          quote: null,
          amountOut: '0',
        }));
        return;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // SKIP FETCH if we just initialized with a valid quote (Instant Swap)
      if (initialQuote && state.quote === initialQuote && state.amountIn === initialQuote.amountIn) {
        console.log('[useSwap] Skipping fetch - using pre-warmed initial quote');
        setState(prev => ({ ...prev, isLoading: false }));
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
        // Backend returns amountOut as human-readable format, no need to convert
        const amountOutNum = parseFloat(normalizedBest.amountOut);
        const formattedAmount = amountOutNum > 0 ? amountOutNum.toFixed(6) : '0';

        setState(prev => ({
          ...prev,
          quote: normalizedBest,
          availableQuotes: normalizedQuotes,
          selectedDex: normalizedBest.dex || normalizedBest.dexName,
          amountOut: formattedAmount,
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

        setState(prev => ({
          ...prev,
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



  const fetchUserBalance = useCallback(async (retryCount = 0) => {

    if (!userAddress || !state.tokenIn) {
      setUserBalance('0');
      return;
    }

    // Store the token address we're fetching for to prevent race conditions
    const fetchingForToken = state.tokenIn.address;

    try {
      let balance = 0n;
      const apiBalance = await getUserBalance(userAddress, fetchingForToken, chainId, state.tokenIn.decimals);
      if (apiBalance) {
        balance = BigInt(apiBalance);
      }

      // RACE CONDITION FIX: Check if token has changed since we started the fetch
      // Use the REF (not state) because state is captured at callback creation time (stale closure)
      if (currentTokenInAddressRef.current !== fetchingForToken) {
        return; // Token changed during fetch, discard result
      }

      const decimals = state.tokenIn.decimals || 18;
      const formatted = formatUnits(balance, decimals);

      console.log('[useSwap] Balance Fetched (Direct RPC):', {
        token: state.tokenIn.symbol,
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
          fetchUserBalance(retryCount + 1);
        }, delay);
      }
    }
  }, [userAddress, state.tokenIn?.address, chainId]);


  const checkUserApproval = useCallback(async () => {
    if (!userAddress || !state.tokenIn || !state.quote?.allowanceTarget) return;

    // Don't check approval if amount is empty or zero (would cause 400 error)
    const amountNum = parseFloat(state.amountIn || '0');
    if (!state.amountIn || isNaN(amountNum) || amountNum <= 0) {
      return;
    }

    try {
      const isApproved = await checkApproval(
        userAddress,
        state.tokenIn.address,
        state.amountIn,
        chainId,
        state.quote.allowanceTarget
      );
      setState(prev => {
        // Only update if approval status actually changed
        if (prev.isApproved !== isApproved) {
          return { ...prev, isApproved };
        }
        return prev;
      });
    } catch (error) {
      console.error('[useSwap] checkUserApproval failed', error);
    }
  }, [userAddress, state.tokenIn?.address, state.amountIn, chainId]); // Only depend on address

  // Use refs to track if we're already fetching to prevent duplicate requests
  const fetchingBalanceRef = useRef(false);
  const lastBalanceKeyRef = useRef<string>('');
  // Track current tokenIn address for race condition detection (avoids stale closure)
  const currentTokenInAddressRef = useRef<string | null>(null);

  // Store function refs to avoid re-triggering useEffect when functions are recreated

  const fetchUserBalanceRef = useRef(fetchUserBalance);
  const checkUserApprovalRef = useRef(checkUserApproval);

  // Update refs when functions change
  useEffect(() => {
    fetchUserBalanceRef.current = fetchUserBalance;
    checkUserApprovalRef.current = checkUserApproval;
  }, [fetchUserBalance, checkUserApproval]);

  // Removed independent price fetching - price is fetched as part of quote request
  // This ensures only ONE request per swap card (the quote request)
  useEffect(() => {
    // CRITICAL: Only fetch balance when user is authenticated
    // This prevents race condition where balance is fetched before token is ready
    if (!userAddress || !state.tokenIn || !authenticated) {
      return;
    }

    // Only fetch balance and approval, not price
    // Price will be fetched as part of quote request when user enters amount
    const balanceKey = `${chainId}_${userAddress}_${state.tokenIn.address.toLowerCase()}_${authenticated}`;

    // Only fetch if the key changed and we're not already fetching
    if (balanceKey !== lastBalanceKeyRef.current && !fetchingBalanceRef.current) {
      fetchingBalanceRef.current = true;
      lastBalanceKeyRef.current = balanceKey;

      // CRITICAL: Update the ref BEFORE fetching to prevent race condition
      currentTokenInAddressRef.current = state.tokenIn.address;

      // Use ref to get latest function without causing re-renders
      fetchUserBalanceRef.current().finally(() => {
        fetchingBalanceRef.current = false;
      });

      // Check approval separately with debounce
      const approvalTimeout = setTimeout(() => {
        checkUserApprovalRef.current();
      }, 1000);

      return () => {
        clearTimeout(approvalTimeout);
      };
    }
  }, [state.tokenIn?.address, userAddress, chainId, authenticated]);

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
      }

      return {
        ...prev,
        tokenIn: {
          ...token,
          // Preserve logoUrl if new token doesn't have one but previous token does
          logoUrl: token.logoUrl || prev.tokenIn?.logoUrl,
        },
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
      tokenOut: {
        ...token,
        // Preserve logoUrl if new token doesn't have one but previous token does
        logoUrl: token.logoUrl || prev.tokenOut?.logoUrl,
      },
      error: null,
    }));
  }, []);

  const setAmountIn = useCallback((amount: string) => {
    const sanitized = amount.replace(/[^\d.]/g, '');
    const parts = sanitized.split('.');
    const normalized = parts.length > 2
      ? `${parts[0]}.${parts.slice(1).join('')}`
      : sanitized;
    setState(prev => ({ ...prev, amountIn: normalized, error: null }));
  }, []);

  const swapTokens = useCallback(() => {
    setState(prev => ({
      ...prev,
      tokenIn: prev.tokenOut,
      tokenOut: prev.tokenIn,
      amountIn: prev.amountOut,
      amountOut: prev.amountIn,
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
    setState(prev => ({ ...prev, error: 'Approvals are handled automatically during swap execution.' }));
    return { success: false, error: 'Approvals are handled automatically during swap execution.' };
  }, []);

  const executeSwap = useCallback(async () => {
    if (!state.quote || !userAddress) {
      setState(prev => ({ ...prev, error: 'Missing quote or wallet address' }));
      return { success: false, error: 'Missing quote or wallet address' };
    }

    if (!state.tokenIn || !state.tokenOut) {
      setState(prev => ({ ...prev, error: 'Missing token information' }));
      return { success: false, error: 'Missing token information' };
    }

    setState(prev => ({ ...prev, isExecuting: true, error: null }));
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
        setState(prev => ({ ...prev, isExecuting: false, amountIn: '0', amountOut: '0', quote: null }));
        await fetchUserBalance();
        return {
          success: true,
          txHash: instantResult.txHash,
        };
      }

      const errorMessage = instantResult.error || 'Instant swap failed. Please try again later.';
      console.log('[useSwap] Instant swap failed:', errorMessage);
      setState(prev => ({ ...prev, isExecuting: false, error: errorMessage }));
      return { success: false, error: errorMessage };
    } catch (error) {
      console.error('[executeSwap] Transaction failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to execute swap';
      setState(prev => ({ ...prev, error: message, isExecuting: false }));
      logger.swap('fail', { error: message });
      return { success: false, error: message };
    }
  }, [state.quote, state.tokenIn, state.tokenOut, state.amountIn, userAddress, chainId, fetchUserBalance, slippageBps, maxPriceImpact]);

  const getDisplayInfo = useCallback(() => {
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
      const isL2 = chainId === 8453 || chainId === 42161 || chainId === 10; // Base, Arb, OP
      // For L2s, gas is cheap (use 0.0001). For Mainnet use 0.001.
      const gasBuffer = isL2 ? 0.0001 : 0.001;

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

    return {
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
      priceImpact: state.quote?.priceImpact || 0,
      gasEstimate: state.quote?.gasEstimate || 0,
      gasCostUSD,
      minAmountOut: state.quote?.minAmountOut || '0',
      dexName: state.quote?.dex || state.quote?.dexName || 'N/A',
      userBalance: formattedBalance,
      hasEnoughBalance,
      availableQuotes: state.availableQuotes || [],
      selectedDex: state.selectedDex,
      // MEV Protection info
      mevProtection: getMEVProtectionInfo(),
    };
  }, [state, priceData, userBalance, chainId, mevProtectionEnabled]);

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
          quote: found,
          amountOut: found.amountOut || prev.amountOut,
          selectedDex: dex,
        };
      }
      return prev;
    });
  }, []);

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
