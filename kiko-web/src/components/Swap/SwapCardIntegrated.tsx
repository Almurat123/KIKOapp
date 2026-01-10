/**
 * SwapCard Integrated - Full card component using useSwap Hook
 * Uses CSS Modules for styling
 * Supports real token avatars + DEX aggregation + Real-time prices
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom';
import { ArrowDown, X, Settings2, Zap, ChevronDown, Search, Check } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useSwap } from '@/hooks/useSwap';
import { useSolanaSwap } from '@/hooks/useSolanaSwap';
import type { Token } from '@/types/swap';
import { MEVProtectionBadge } from './MEVProtectionBadge';
import { executeSwapInstant } from '../../services/swapService';
import styles from './SwapCardIntegrated.module.css';

// Base Container Component
const CardWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className={styles.swapCard}>
      {children}
    </div>
  );
};



interface UserHolding {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  value: string;
  decimals: number;
  logo?: string;
  usdValueNum?: number;
  isNative?: boolean;
}

interface SwapCardIntegratedProps {
  userAddress?: string;
  chainId?: number;
  onSwapSuccess?: (txHash: string) => void;
  onSwapError?: (error: string) => void;
  onClose?: () => void; // For modal mode
  // Initial values for AI-generated swaps
  initialTokenIn?: Token | null;
  initialTokenOut?: Token | null;
  initialAmountIn?: string;
  // Solana aggregator selection
  solanaAggregator?: 'jupiter' | 'raydium' | 'auto';
  // Generation state
  isGenerating?: boolean;
  maxPriceImpact?: number; // AI provided limit
  autoExecute?: boolean;
  useServerExecution?: boolean;
  // User holdings for token selector
  userHoldings?: UserHolding[];
}

export const SwapCardIntegrated: React.FC<SwapCardIntegratedProps> = ({
  userAddress,
  chainId = 1,
  onSwapSuccess,
  onSwapError,
  onClose,
  initialTokenIn,
  initialTokenOut,
  initialAmountIn,
  solanaAggregator = 'auto',
  maxPriceImpact: initialMaxPriceImpact = 5,
  autoExecute = false,
  useServerExecution = false,
  userHoldings = [],
}) => {
  // State for settings
  const [maxPriceImpact, setMaxPriceImpact] = useState(initialMaxPriceImpact);
  const [showSettings, setShowSettings] = useState(false);
  const [fastSwapMode, setFastSwapMode] = useState(false);

  // Load Fast Swap setting
  useEffect(() => {
    // Initial load
    try {
      const saved = localStorage.getItem('kiko-custom-ai-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setFastSwapMode(!!parsed.fastSwapMode);
      }
    } catch { /* ignore */ }

    // Listen for changes
    const handleSettingsChange = (e: any) => {
      if (e.detail && typeof e.detail.fastSwapMode !== 'undefined') {
        setFastSwapMode(!!e.detail.fastSwapMode);
      }
    };
    window.addEventListener('kiko-custom-ai-changed', handleSettingsChange);
    return () => window.removeEventListener('kiko-custom-ai-changed', handleSettingsChange);
  }, []);

  // Ref to track if auto-execution has been attempted to prevent loops
  const hasAutoExecutedRef = React.useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  // Internal state for smooth blur transition
  // Show overlay if generating OR if we have initial data that hasn't been populated yet

  // Use Solana swap hook for Solana (chainId 900), otherwise use EVM swap hook
  const isSolana = chainId === 900;

  const evmSwap = useSwap({
    chainId: isSolana ? 1 : chainId, // Fallback to Ethereum if Solana
    slippageBps: 50,
    userAddress,
    // Pass initial tokens to avoid race condition where tokens are set
    // This ensures the hook initializes with correct tokens from the start
    initialTokenIn: !isSolana ? (initialTokenIn ?? undefined) : undefined,
    initialTokenOut: !isSolana ? (initialTokenOut ?? undefined) : undefined,
    maxPriceImpact,
  });

  const solanaSwap = useSolanaSwap({
    slippageBps: 50,
    userAddress,
    aggregator: solanaAggregator,
  });

  // Use the appropriate swap hook based on chain
  const swap = isSolana ? solanaSwap : evmSwap;

  // Typed swap instances and state
  const evmSwapTyped = isSolana ? null : swap as ReturnType<typeof useSwap>;
  const solanaSwapTyped = isSolana ? swap as ReturnType<typeof useSolanaSwap> : null;
  const swapState = isSolana && solanaSwapTyped
    ? solanaSwapTyped.state
    : evmSwapTyped?.state;
  const displayInfo = isSolana && solanaSwapTyped
    ? solanaSwapTyped.displayInfo
    : evmSwapTyped?.displayInfo;

  // Initialize with provided values if available (for AI-generated swaps)
  // Use a ref to track initialization to avoid re-initializing unnecessarily
  const initializedRef = React.useRef<string>('');
  // Use ref for swap to avoid infinite loop in useEffect
  const swapRef = React.useRef(swap);
  React.useEffect(() => {
    swapRef.current = swap;
  }, [swap]);

  React.useEffect(() => {
    // Create a unique key for the current initial values AND chainId
    // Including chainId ensures we re-populate when switching chains
    const initKey = `${chainId}_${initialTokenIn?.address || ''}_${initialTokenOut?.address || ''}_${initialAmountIn || ''}`;

    // Only initialize if values changed
    if (initializedRef.current === initKey) return;

    // Use ref to access current swap without triggering re-renders
    const currentSwap = swapRef.current;

    // Get typed swap instances
    const evmSwap = isSolana ? null : currentSwap as ReturnType<typeof useSwap>;
    const solanaSwap = isSolana ? currentSwap as ReturnType<typeof useSolanaSwap> : null;

    // Get current tokens from swap state
    const currentTokenIn = isSolana ? solanaSwap?.state.tokenIn : evmSwap?.state.tokenIn;
    const currentTokenOut = isSolana ? solanaSwap?.state.tokenOut : evmSwap?.state.tokenOut;

    // Only set tokens if they are different from current tokens
    // This prevents resetting BNB to ETH when amount is entered
    if (import.meta.env.DEV) {
      console.log('[SwapCard] Initialization Effect Triggered', { initKey, isSolana, hasSolanaSwap: !!solanaSwap, hasEvmSwap: !!evmSwap });
    }

    if (initialTokenIn && currentTokenIn?.address !== initialTokenIn.address) {
      if (import.meta.env.DEV) {
        console.log('[SwapCard] Setting Token IN', initialTokenIn.symbol);
      }
      if (isSolana && solanaSwap) {
        solanaSwap.setTokenIn(initialTokenIn);
      } else if (evmSwap) {
        evmSwap.setTokenIn(initialTokenIn);
      }
    }
    if (initialTokenOut && currentTokenOut?.address !== initialTokenOut.address) {
      if (import.meta.env.DEV) {
        console.log('[SwapCard] Setting Token OUT', initialTokenOut.symbol);
      }
      if (isSolana && solanaSwap) {
        solanaSwap.setTokenOut(initialTokenOut);
      } else if (evmSwap) {
        evmSwap.setTokenOut(initialTokenOut);
      }
    }

    // Set amount after tokens are set
    if (initialAmountIn) {
      if (isSolana && solanaSwap) {
        solanaSwap.setAmountIn(initialAmountIn);
      } else if (evmSwap) {
        evmSwap.setAmountIn(initialAmountIn);
      }
    }

    initializedRef.current = initKey;
  }, [initialTokenIn, initialTokenOut, initialAmountIn, isSolana, chainId]); // Removed 'swap' from deps

  // Token selector state
  const [showTokenSelector, setShowTokenSelector] = useState<'in' | 'out' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { login, authenticated, getAccessToken } = usePrivy();

  useEffect(() => {
    // Reset confirmation when quote/spender or amount changes
    setConfirmReady(false);
  }, [
    (swapState?.quote as any)?.allowanceTarget,
    (swapState?.quote as any)?.to,
    swapState?.amountIn,
    swapState?.tokenIn?.address
  ]);

  const executeSwapNow = async () => {
    // If not using server execution, require auth
    if (!useServerExecution && !authenticated) {
      login();
      return;
    }

    // ⚡ FAST SWAP MODE Check (Base Chain Only for now)
    if (fastSwapMode && chainId === 8453 && !isSolana) {
      if (import.meta.env.DEV) {
        console.log('[SwapCard] ⚡ Fast Swap Mode Executing...');
      }
      try {
        const token = await getAccessToken();
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/zora/swap`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            tokenAddress: swapState?.tokenOut?.address,
            buyAmountEth: swapState?.amountIn,
            maxSlippage: 0.5 // Default fast slippage
          })
        });

        const data = await res.json();

        if (data.success && data.txHash) {
          onSwapSuccess?.(data.txHash);
          setConfirmReady(false);
          return;
        } else {
          if (import.meta.env.DEV) {
            console.warn('[FastSwap] Failed, falling back to standard execution:', data.error);
          }
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('[FastSwap] Error:', e);
        }
      }
    }

    if (useServerExecution) {
      // Server-side Execution Mode
      if (!userAddress || !swapState?.tokenIn || !swapState?.tokenOut) {
        onSwapError?.('Missing swap parameters');
        return;
      }

      try {
        const result = await executeSwapInstant({
          tokenIn: swapState.tokenIn.address,
          tokenOut: swapState.tokenOut.address,
          amountIn: swapState.amountIn,
          chainId: chainId,
          slippageBps: 50 // Default
        });

        if (result.success && result.txHash) {
          onSwapSuccess?.(result.txHash);
        } else {
          onSwapError?.(result.error || 'Server execution failed');
        }
      } catch (e: any) {
        onSwapError?.(e.message || 'Server execution error');
      }
      return;
    }

    // Client-side Execution Mode
    const result = isSolana && solanaSwapTyped
      ? await solanaSwapTyped.executeSwap()
      : evmSwapTyped
        ? await evmSwapTyped.executeSwap()
        : { success: false, error: 'Swap not available' };

    if (result?.success && result?.txHash) {
      onSwapSuccess?.(result.txHash);
    } else if (result?.error) {
      onSwapError?.(result.error);
    }
    setConfirmReady(false);
  };

  const handleExecuteSwap = async () => {
    // If approval is needed, do that first - NO separate confirmation modal needed for approval
    // (Wallet will provide the confirmation UI)
    // SKIP if using server execution (server handles allowance verification/error)
    if (!useServerExecution && needsApproval && evmSwapTyped?.approveToken) {
      const result = await evmSwapTyped.approveToken();
      if (result?.error) {
        onSwapError?.(result.error);
      }
      return;
    }

    // Enforce upfront confirmation showing spender / chain / amount for SWAPS
    const spender = !isSolana
      ? (swapState?.quote as any)?.allowanceTarget || (swapState?.quote as any)?.to || ''
      : '';

    // SKIP confirmation if Auto-Execute (AI) OR Fast Swap Mode (User Setting) is enabled
    const shouldSkipConfirm = autoExecute || (fastSwapMode && chainId === 8453);

    if (!confirmReady && !shouldSkipConfirm) {
      setConfirmOpen(true);
      return;
    }
    if (!isSolana && !spender && !shouldSkipConfirm) {
      // Note: Fast swap backend handles spender internally or doesn't need it (server signing)
      // But if we are client side we need it.
      if (!fastSwapMode) {
        onSwapError?.('Missing spender address in quote');
        return;
      }
    }

    await executeSwapNow();
  };

  // Extract values from displayInfo with safe defaults
  const tokenInSymbol = swapState?.tokenIn?.symbol || displayInfo?.tokenInSymbol || 'Select';
  const tokenOutSymbol = swapState?.tokenOut?.symbol || displayInfo?.tokenOutSymbol || 'Select';
  const tokenInEmoji = swapState?.tokenIn?.emoji || displayInfo?.tokenInEmoji || '🔄';
  const tokenOutEmoji = swapState?.tokenOut?.emoji || displayInfo?.tokenOutEmoji || '🔄';
  const amountIn = swapState?.amountIn || displayInfo?.amountIn || '0';
  const amountOut = swapState?.amountOut || displayInfo?.amountOut || '0';
  const amountInUSD = displayInfo?.amountInUSD || '0';
  const amountOutUSD = displayInfo?.amountOutUSD || '0';
  const isLoading = swapState?.isLoading || displayInfo?.isLoading || false;
  const isExecuting = swapState?.isExecuting || displayInfo?.isExecuting || false;
  const error = swapState?.error || displayInfo?.error || null;
  const priceImpact = displayInfo?.priceImpact || 0;
  const dexName = displayInfo?.dexName || 'N/A';

  const hasEnoughBalance = displayInfo?.hasEnoughBalance || false;
  const availableQuotes = (displayInfo as any)?.availableQuotes || [];
  const selectedDex = (displayInfo as any)?.selectedDex || dexName;



  const canExecute =
    amountIn !== '0' &&
    parseFloat(amountIn) > 0 &&
    amountOut !== '0' &&
    parseFloat(amountOut) > 0 &&
    !isLoading &&
    !isExecuting &&
    hasEnoughBalance &&
    !error;

  // Check if approval is needed (only for EVM chains, Solana doesn't need approval)
  const needsApproval = !isSolana &&
    swapState?.tokenIn?.address &&
    swapState.tokenIn.address !== '0x0000000000000000000000000000000000000000' &&
    swapState.tokenIn.address !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' &&
    !(evmSwapTyped?.state?.isApproved) &&
    parseFloat(amountIn) > 0;

  // Auto-execution logic
  useEffect(() => {
    // Only proceed if autoExecute is true and we haven't executed yet (or reset)
    if (!autoExecute || isExecuting || isLoading) return;

    if (canExecute && !hasAutoExecutedRef.current) {
      // Special handling for approval
      // SKIP if using server execution
      if (!useServerExecution && needsApproval && evmSwapTyped?.approveToken) {
        if (import.meta.env.DEV) {
          console.log('[SwapCard] Auto-triggering approval...');
        }
        hasAutoExecutedRef.current = true; // Prevent loop
        evmSwapTyped.approveToken().then((res: any) => {
          if (!res?.error) {
            // Reset flag so we can execute swap in next pass
            hasAutoExecutedRef.current = false;
          }
        });
        return;
      }

      if (import.meta.env.DEV) {
        console.log('[SwapCard] Auto-executing swap...');
      }
      hasAutoExecutedRef.current = true;
      // Bypassing confirmation modal for auto execution
      executeSwapNow();
    }
  }, [autoExecute, canExecute, isExecuting, isLoading, needsApproval, useServerExecution, evmSwapTyped]);

  // Normalize Solana native token addresses (both So11111111111111111111111111111111111111111 and So11111111111111111111111111111111111111112 represent SOL)
  const normalizeAddress = React.useCallback((address: string): string => {
    // For Solana native SOL, normalize both variants to the Wrapped SOL address
    if (address === 'So11111111111111111111111111111111111111111' ||
      address === 'So11111111111111111111111111111111111111112') {
      return 'So11111111111111111111111111111111111111112';
    }
    return address.toLowerCase();
  }, []);

  // Get available tokens - prioritize user holdings (value > $1), then common tokens
  const availableTokens = React.useMemo(() => {
    // Get base tokens from hooks
    let baseTokens: Token[] = [];
    if (isSolana && solanaSwapTyped) {
      baseTokens = solanaSwapTyped.getAvailableTokens();
    } else {
      baseTokens = evmSwapTyped?.getAvailableTokens() || [];
    }

    // Convert user holdings to Token format and filter by value > $1
    const userTokens: Token[] = userHoldings
      .filter(h => (h.usdValueNum ?? 0) >= 1) // Only tokens with value >= $1
      .map(h => ({
        address: h.address,
        symbol: h.symbol,
        name: h.name,
        decimals: h.decimals,
        chainId: chainId,
        logoUrl: h.logo,
      }));

    const tokenMap = new Map<string, Token>();

    // First add base tokens to the map (for logo reference)
    baseTokens.forEach(token => {
      const normalizedKey = normalizeAddress(token.address);
      if (!tokenMap.has(normalizedKey)) {
        tokenMap.set(normalizedKey, {
          ...token,
          address: normalizedKey === 'So11111111111111111111111111111111111111112'
            ? 'So11111111111111111111111111111111111111112'
            : token.address
        });
      }
    });

    // Then add/update with user tokens (prioritized, but merge logo if missing)
    userTokens.forEach(token => {
      const normalizedKey = normalizeAddress(token.address);
      const existing = tokenMap.get(normalizedKey);

      if (existing) {
        // Merge: keep user token data but use base token's logoUrl if user token's logo is missing
        tokenMap.set(normalizedKey, {
          ...token,
          logoUrl: token.logoUrl || existing.logoUrl, // Use user logo if available, otherwise use base token logo
          address: normalizedKey === 'So11111111111111111111111111111111111111112'
            ? 'So11111111111111111111111111111111111111112'
            : token.address
        });
      } else {
        // New user token, add it
        tokenMap.set(normalizedKey, {
          ...token,
          address: normalizedKey === 'So11111111111111111111111111111111111111112'
            ? 'So11111111111111111111111111111111111111112'
            : token.address
        });
      }
    });

    // Return as array, user tokens first
    const result = Array.from(tokenMap.values());
    // Sort: user tokens first (by USD value desc), then base tokens
    // Use normalized addresses for comparison
    result.sort((a, b) => {
      const aNormalized = normalizeAddress(a.address);
      const bNormalized = normalizeAddress(b.address);
      const aIsUser = userTokens.some(ut => normalizeAddress(ut.address) === aNormalized);
      const bIsUser = userTokens.some(ut => normalizeAddress(ut.address) === bNormalized);

      if (aIsUser && !bIsUser) return -1;
      if (!aIsUser && bIsUser) return 1;

      if (aIsUser && bIsUser) {
        const aHolding = userHoldings.find(h => normalizeAddress(h.address) === aNormalized);
        const bHolding = userHoldings.find(h => normalizeAddress(h.address) === bNormalized);
        return (bHolding?.usdValueNum ?? 0) - (aHolding?.usdValueNum ?? 0);
      }

      return 0;
    });

    return result;
  }, [chainId, isSolana, evmSwapTyped, solanaSwapTyped, userHoldings, normalizeAddress]); // Include normalizeAddress in deps

  // Filter tokens based on search query
  const filteredTokens = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return availableTokens;
    }
    const query = searchQuery.toLowerCase();
    const filtered = availableTokens.filter(token =>
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query)
    );
    if (import.meta.env.DEV) {
      console.log('[SwapCard] Filtered tokens:', filtered.length, 'for query:', searchQuery);
    }
    return filtered;
  }, [availableTokens, searchQuery]);

  // Handle token selection
  const handleTokenSelect = (token: Token, type: 'in' | 'out') => {
    if (import.meta.env.DEV) {
      console.log('[SwapCard] Selecting token:', token.symbol, 'for', type);
    }
    if (type === 'in') {
      if (isSolana && solanaSwapTyped) {
        solanaSwapTyped.setTokenIn(token);
      } else if (evmSwapTyped) {
        evmSwapTyped.setTokenIn(token);
      }
    } else {
      if (isSolana && solanaSwapTyped) {
        solanaSwapTyped.setTokenOut(token);
      } else if (evmSwapTyped) {
        evmSwapTyped.setTokenOut(token);
      }
    }
    setShowTokenSelector(null);
    setSearchQuery('');
  };

  // Close selector when clicking outside
  React.useEffect(() => {
    if (!showTokenSelector) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-token-selector]')) {
        setShowTokenSelector(null);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTokenSelector]);

  const [showRouteSelector, setShowRouteSelector] = useState(false);

  const handleSelectRoute = (dex: string) => {
    if (isSolana && solanaSwapTyped?.selectQuote) {
      solanaSwapTyped.selectQuote(dex);
    } else if (evmSwapTyped?.selectQuote) {
      evmSwapTyped.selectQuote(dex);
    }
    setShowRouteSelector(false);
  };

  // Check if we are still initializing (props provided but state not yet matching)
  const isInitializing = React.useMemo(() => {
    if (!initialTokenIn && !initialTokenOut) return false;

    // Safety check: if state is completely missing, we are initializing
    if (!swapState) return true;

    const currentIn = swapState.tokenIn?.address;
    const currentOut = swapState.tokenOut?.address;

    let initializing = false;

    // Check if we expect a token but current state doesn't match yet
    if (initialTokenIn && currentIn?.toLowerCase() !== initialTokenIn.address.toLowerCase()) {
      if (import.meta.env.DEV) {
        console.log('[SwapCard] Initializing mismatch IN:', { expected: initialTokenIn.address, actual: currentIn });
      }
      initializing = true;
    }
    if (initialTokenOut && currentOut?.toLowerCase() !== initialTokenOut.address.toLowerCase()) {
      if (import.meta.env.DEV) {
        console.log('[SwapCard] Initializing mismatch OUT:', { expected: initialTokenOut.address, actual: currentOut });
      }
      initializing = true;
    }

    return initializing;
  }, [initialTokenIn, initialTokenOut, swapState]);

  // Force exit initialization after 3 seconds safety timeout
  const [forceShow, setForceShow] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setForceShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (isInitializing && !forceShow) {
    return (
      <CardWrapper>
        <div style={{ padding: '20px' }}>
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-24 bg-zinc-200 dark:bg-white/10 rounded"></div>
            <div className="space-y-2">
              <div className="h-20 bg-zinc-100 dark:bg-white/5 rounded-xl"></div>
              <div className="h-8 w-8 mx-auto bg-zinc-200 dark:bg-white/10 rounded-full"></div>
              <div className="h-20 bg-zinc-100 dark:bg-white/5 rounded-xl"></div>
            </div>
            <div className="h-10 bg-zinc-200 dark:bg-white/10 rounded-xl mt-4"></div>
          </div>
        </div>
      </CardWrapper>
    );
  }

  return (
    <CardWrapper>



      {/* Main Content (Always Clear underneath) */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div className={styles.swapHeader}>
          <span className={styles.swapTitle}>Swap</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {onClose && (
              <button
                className={styles.swapSettings}
                onClick={onClose}
                title="Close"
              >
                <X size={16} />
              </button>
            )}
            <button
              className={styles.swapSettings}
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className={styles.settingsDropdown}>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Max Price Impact</span>
              <div className={styles.settingsOptions}>
                {[1, 3, 5].map((val) => (
                  <button
                    key={val}
                    className={`${styles.settingsOption} ${maxPriceImpact === val ? styles.settingsOptionActive : ''}`}
                    onClick={() => setMaxPriceImpact(val)}
                  >
                    {val}%
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  className={styles.settingsInput}
                  type="number"
                  placeholder="Custom"
                  value={maxPriceImpact}
                  onChange={(e) => setMaxPriceImpact(parseFloat(e.target.value) || 0)}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>%</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Area */}
        <div className={styles.swapMain}>

          {/* From - Input */}
          <div className={styles.swapFrom}>
            <div className={styles.swapLabelRow}>
              <span>You pay</span>
              <div className={styles.tokenBalance}>
                Bal: {displayInfo.userBalance}
                {parseFloat(displayInfo.userBalance) > 0 && (
                  <button
                    className={styles.maxButton}
                    onClick={() => {
                      // IMPROVED MAX LOGIC:
                      // 1. For Native Tokens (ETH, SOL): Subtract gas buffer
                      // 2. For ERC20/SPL Tokens: Use EXACT balance string to avoid precision loss

                      const isNative = isSolana
                        ? displayInfo.tokenInSymbol === 'SOL'
                        : (swapState?.tokenIn?.address === '0x0000000000000000000000000000000000000000' ||
                          swapState?.tokenIn?.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');

                      let maxAmountStr = displayInfo.userBalance;

                      if (isNative) {
                        // For native tokens, we must subtract gas
                        // Use float math here (acceptable for gas buffer calculation)
                        const balance = parseFloat(displayInfo.userBalance);
                        const gasBuffer = 0.01; // Reserve 0.01 ETH/SOL for gas
                        const maxAmount = Math.max(0, balance - gasBuffer);

                        // Format back to string, respecting decimals
                        const decimals = isSolana ? 9 : 18; // Native decimals
                        maxAmountStr = maxAmount.toFixed(decimals).replace(/\.?0+$/, '');
                      } else {
                        // For Tokens: Use the exact balance string directly!
                        // This avoids any float precision loss (e.g. 0.321099 -> 0.3210989999)
                        // No subtraction needed for tokens
                        maxAmountStr = displayInfo.userBalance;
                      }

                      if (isSolana && solanaSwapTyped) {
                        solanaSwapTyped.setAmountIn(maxAmountStr);
                      } else if (evmSwapTyped) {
                        evmSwapTyped.setAmountIn(maxAmountStr);
                      }
                    }}
                  >
                    Max
                  </button>
                )}
              </div>
            </div>
            <div className={styles.swapAmountRow}>
              <input
                type="text"
                value={amountIn}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isSolana && solanaSwapTyped) {
                    solanaSwapTyped.setAmountIn(value);
                  } else if (evmSwapTyped) {
                    evmSwapTyped.setAmountIn(value);
                  }
                }}
                placeholder="0.0"
                className={styles.swapAmountInput}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTokenSelector('in');
                }}
                className={styles.swapToken}
              >
                {swapState?.tokenIn?.logoUrl ? (
                  <img
                    src={swapState.tokenIn.logoUrl}
                    alt={swapState.tokenIn.symbol}
                    className={styles.tokenImage}
                  />
                ) : (
                  <span className={styles.tokenEmoji}>{tokenInEmoji}</span>
                )}
                <span className={styles.tokenName}>{tokenInSymbol}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>

            <div className={styles.swapUsd}>≈ ${amountInUSD}</div>
          </div>

          {/* Arrow - Block Level between cards */}
          <div className={styles.swapArrow}>
            <div className={styles.arrowContainer}>
              <button
                onClick={() => {
                  if (isSolana && solanaSwapTyped) {
                    solanaSwapTyped.swapTokens();
                  } else if (evmSwapTyped) {
                    evmSwapTyped.swapTokens();
                  }
                }}
                className={styles.arrowButton}
              >
                <div className={styles.arrowInner}>
                  <ArrowDown size={16} strokeWidth={3} />
                </div>
              </button>
            </div>
          </div>

          {/* To - Output */}
          <div className={styles.swapTo}>
            <div className={styles.swapLabelRow}>
              <span>You receive</span>
              {!isLoading && dexName && dexName !== 'N/A' && (
                <span style={{ color: 'var(--text-tertiary)' }}>from {dexName}</span>
              )}
            </div>

            <div className={styles.swapAmountRow}>
              <span className={styles.swapAmountOutput}>
                {isLoading ? '...' : amountOut || '0.000000'}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTokenSelector('out');
                }}
                className={styles.swapToken}
              >
                {swapState?.tokenOut?.logoUrl ? (
                  <img
                    src={swapState.tokenOut.logoUrl}
                    alt={swapState.tokenOut.symbol}
                    className={styles.tokenImage}
                  />
                ) : (
                  <span className={styles.tokenEmoji}>{tokenOutEmoji}</span>
                )}
                <span className={styles.tokenName}>{tokenOutSymbol}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>

            <div className={styles.swapBottomRow}>
              <div className={styles.swapUsd}>≈ ${amountOutUSD}</div>
              {priceImpact > 0 && priceImpact < 100 && (
                <div className={`${styles.swapChange} ${priceImpact > 2 ? styles.swapChangeHighImpact : ''}`}>
                  {priceImpact.toFixed(2)}% impact
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className={styles.errorBox}>
              {error}
            </div>
          )}
        </div>

        {/* MEV Protection Badge */}
        {displayInfo?.mevProtection && (
          <MEVProtectionBadge
            mevProtection={displayInfo.mevProtection}
            onToggle={(enabled) => {
              if (evmSwapTyped?.setMevProtectionEnabled) {
                evmSwapTyped.setMevProtectionEnabled(enabled);
              }
            }}
          />
        )}

        {/* Buttons */}
        <div className={styles.swapButtons}>
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowRouteSelector(!showRouteSelector);
            }}
            className={styles.swapRouteBtn}
          >
            <span className={styles.routeBtnLabel}>
              <ChevronDown size={14} />
              <span className={styles.routeBtnText}>{selectedDex || 'Route'}</span>
            </span>
          </button>

          <button
            onClick={handleExecuteSwap}
            disabled={!canExecute}
            className={styles.swapConfirmBtn}
          >
            {isExecuting ? (
              <>
                <Zap size={16} />
                <span>{needsApproval ? 'Approving...' : 'Swapping...'}</span>
              </>
            ) : needsApproval ? (
              <span>Approve {tokenInSymbol}</span>
            ) : (
              <span>Swap</span>
            )}
          </button>
        </div>

        {/* Safety confirmation modal */}
        {confirmOpen && typeof document !== 'undefined' && createPortal(
          <div className={styles.modalOverlay} onClick={() => setConfirmOpen(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Review & Confirm</h3>
                <button className={styles.modalCloseButton} onClick={() => setConfirmOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className={styles.confirmBody}>
                {!isSolana && (
                  <div className={styles.confirmRow}>
                    <span>Spender</span>
                    <code className={styles.confirmCode}>
                      {(swapState?.quote as any)?.allowanceTarget || (swapState?.quote as any)?.to || 'N/A'}
                    </code>
                  </div>
                )}
                <div className={styles.confirmRow}>
                  <span>Chain</span>
                  <span>{swapState?.tokenIn?.chainId || chainId}</span>
                </div>
                <div className={styles.confirmRow}>
                  <span>Pay</span>
                  <span>{amountIn} {tokenInSymbol}</span>
                </div>
                <div className={styles.confirmRow}>
                  <span>Receive</span>
                  <span>{amountOut} {tokenOutSymbol}</span>
                </div>
                <div className={styles.confirmNote}>
                  仅本次授权金额（+5%缓冲）。请确认链、代币与 Spender 地址，陌生地址请取消。
                </div>
                <label className={styles.confirmCheck}>
                  <input
                    type="checkbox"
                    checked={confirmReady}
                    onChange={(e) => setConfirmReady(e.target.checked)}
                  />
                  <span>我已核对上述信息，愿意继续</span>
                </label>
                <div className={styles.confirmActions}>
                  <button onClick={() => setConfirmOpen(false)} className={styles.cancelBtn}>取消</button>
                  <button
                    disabled={!confirmReady}
                    className={styles.swapConfirmBtn}
                    onClick={async () => {
                      setConfirmOpen(false);
                      await handleExecuteSwap();
                    }}
                  >
                    确认并继续
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {showRouteSelector && (
          <div className={styles.routeDropdown}>
            {availableQuotes.length === 0 ? (
              <div className={styles.routeItem} style={{ opacity: 0.6 }}>
                No routes yet
              </div>
            ) : availableQuotes.map((q: any) => (
              <button
                key={q.dex || q.dexName}
                className={styles.routeItem}
                onClick={() => handleSelectRoute(q.dex || q.dexName)}
              >
                <div className={styles.routeItemHeader}>
                  <span>{q.dexName || q.dex}</span>
                  {(() => {
                    // Calculate how much you get compared to best quote
                    const bestQuote = availableQuotes[0];
                    const currentAmount = parseFloat(q.amountOut || '0');
                    const bestAmount = parseFloat(bestQuote?.amountOut || '0');

                    let percentage = 0;
                    if (bestAmount > 0 && currentAmount > 0) {
                      // Show what percentage of the best quote you're getting
                      percentage = (currentAmount / bestAmount) * 100;
                    }

                    const impactClass = percentage >= 100
                      ? styles.routeImpactGood
                      : percentage < 98
                        ? styles.routeImpactHigh
                        : styles.routeImpactNormal;

                    return (
                      <span className={impactClass}>
                        {percentage.toFixed(2)}%
                      </span>
                    );
                  })()}
                </div>
                <div className={styles.routeAmount}>
                  ≈ {q.amountOut}
                  {q.amountOutBase && q.amountOutBase !== q.amountOut ? (
                    <span className={styles.routeRaw}>&nbsp;(raw)</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Token Selector Modal - Using Portal */}
        {showTokenSelector && typeof document !== 'undefined' && createPortal(
          <div
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowTokenSelector(null);
                setSearchQuery('');
              }
            }}
          >
            <div
              data-token-selector
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  Select {showTokenSelector === 'in' ? 'Token In' : 'Token Out'}
                </h3>
                <button
                  className={styles.modalCloseButton}
                  onClick={() => {
                    setShowTokenSelector(null);
                    setSearchQuery('');
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search */}
              <div className={styles.searchContainer}>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-tertiary)',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search tokens..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                    style={{ paddingLeft: '44px' }}
                    autoFocus
                  />
                </div>
              </div>

              {/* Token List */}
              <div className={styles.tokenList}>
                <div className={styles.tokenBalance}>
                  Bal: {displayInfo.userBalance}
                  {parseFloat(displayInfo.userBalance) > 0 && (
                    <button
                      className={styles.maxButton}
                      onClick={() => {
                        // Reserve some SOL for gas fees
                        const balance = parseFloat(displayInfo.userBalance);
                        let maxAmount = balance;

                        // For SOL, reserve 0.01 SOL for transaction fees
                        if (displayInfo.tokenInSymbol === 'SOL') {
                          maxAmount = Math.max(0, balance - 0.01);
                        }

                        const maxAmountStr = maxAmount.toFixed(6).replace(/\.?0+$/, '');

                        if (isSolana && solanaSwapTyped) {
                          solanaSwapTyped.setAmountIn(maxAmountStr);
                        } else if (evmSwapTyped) {
                          evmSwapTyped.setAmountIn(maxAmountStr);
                        }
                      }}
                    >
                      Max
                    </button>
                  )}
                </div>
                {filteredTokens.length === 0 ? (
                  <div style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    fontSize: '14px',
                  }}>
                    No tokens found
                  </div>
                ) : (
                  filteredTokens.map((token) => {
                    const isSelected = showTokenSelector === 'in'
                      ? swapState?.tokenIn?.address === token.address
                      : swapState?.tokenOut?.address === token.address;

                    // Find user holding for this token (use normalized address for matching)
                    const userHolding = userHoldings.find(
                      h => normalizeAddress(h.address) === normalizeAddress(token.address)
                    );

                    return (
                      <button
                        key={token.address}
                        className={styles.tokenItem}
                        style={isSelected ? { backgroundColor: 'rgba(74, 222, 128, 0.1)' } : {}}
                        onClick={() => handleTokenSelect(token, showTokenSelector)}
                      >
                        {token.logoUrl ? (
                          <img
                            src={token.logoUrl}
                            alt={token.symbol}
                            className={styles.tokenImage}
                          />
                        ) : (
                          <span className={styles.tokenEmoji}>{token.emoji || '🪙'}</span>
                        )}
                        <div className={styles.tokenItemInfo} style={{ flex: 1, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className={styles.tokenItemSymbol}>{token.symbol}</span>
                            {userHolding && (
                              <span style={{
                                fontSize: '11px',
                                color: 'rgba(74, 222, 128, 0.8)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(74, 222, 128, 0.1)',
                              }}>
                                Owned
                              </span>
                            )}
                          </div>
                          <span className={styles.tokenItemName}>{token.name}</span>
                          {userHolding && (
                            <div style={{
                              fontSize: '12px',
                              color: 'var(--text-tertiary)',
                              marginTop: '2px',
                            }}>
                              {parseFloat(userHolding.balance).toFixed(6)} {token.symbol} • {userHolding.value}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#4ade80',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Check size={12} color="#000" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </CardWrapper>
  );
};

export default SwapCardIntegrated;
