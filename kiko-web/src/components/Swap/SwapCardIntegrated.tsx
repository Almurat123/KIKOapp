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
import { findTokenOnAnyChain, getTokenData, getCommonTokens, type TokenData } from '@/services/tokenDataService';
import { MEVProtectionBadge } from './MEVProtectionBadge';
import { executeSwapInstant, waitForSwapTradeSettlement } from '../../services/swapService';
import {
  emitImportedTokensUpdated,
  readImportedSwapTokensFromStorage,
  writeImportedSwapTokensToStorage
} from '@/utils/importedSwapTokens';
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
  chainId?: number;
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
  executionMode?: 'instant';
  // User holdings for token selector
  userHoldings?: UserHolding[];
  // Pre-calculated quote for instant display
  initialQuote?: any;
}

type SwapExecutionPhase =
  | 'idle'
  | 'submitting'
  | 'broadcast'
  | 'confirming'
  | 'success'
  | 'failed'
  | 'indeterminate';

interface SwapExecutionState {
  phase: SwapExecutionPhase;
  message: string | null;
  txHash?: string;
  tradeId?: string;
  error?: string;
}

const isSwapExecutionBusy = (phase: SwapExecutionPhase) =>
  phase === 'submitting' || phase === 'broadcast' || phase === 'confirming';

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
  maxPriceImpact: _initialMaxPriceImpact = 5,
  autoExecute = false,
  useServerExecution = true,
  executionMode = 'instant',
  userHoldings = [],
  initialQuote,
}) => {
  const mapTokenDataToToken = React.useCallback((tokenData: TokenData): Token => ({
    address: tokenData.address,
    symbol: tokenData.symbol,
    name: tokenData.name,
    decimals: tokenData.decimals,
    logoUrl: tokenData.logoURI,
    chainId: tokenData.chainId,
  }), []);

  // State for settings
  // State for settings
  // Load initial slippage from local storage
  const [slippage, setSlippage] = useState(() => {
    try {
      const saved = localStorage.getItem('kiko-swap-slippage');
      return saved ? parseFloat(saved) : 0.5;
    } catch {
      return 0.5;
    }
  });

  // Save slippage to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('kiko-swap-slippage', slippage.toString());
  }, [slippage]);

  const [showSettings, setShowSettings] = useState(false);
  const [fastSwapMode, setFastSwapMode] = useState(false);
  const [executionState, setExecutionState] = useState<SwapExecutionState>({
    phase: 'idle',
    message: null,
  });

  // Load Fast Swap setting
  useEffect(() => {
    // Initial load
    try {
      const saved = localStorage.getItem('kiko-custom-ai-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setFastSwapMode(!!parsed.fastSwapMode);
      }
    } catch (_e) { /* ignore */ }

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

  // Internal state for smooth blur transition
  // Show overlay if generating OR if we have initial data that hasn't been populated yet

  // Use Solana swap hook for Solana (chainId 900), otherwise use EVM swap hook
  const isSolana = chainId === 900;
  const serverExecutionEnabled = !isSolana && useServerExecution && executionMode === 'instant';

  const evmSwap = useSwap({
    chainId: isSolana ? 1 : chainId, // Fallback to Ethereum if Solana
    slippageBps: slippage * 100, // Dynamic slippage
    userAddress: isSolana ? undefined : userAddress, // Don't pass address to EVM hook on Solana chain
    // Pass initial tokens to avoid race condition where tokens are set
    // This ensures the hook initializes with correct tokens from the start
    initialTokenIn: !isSolana ? (initialTokenIn ?? undefined) : undefined,
    initialTokenOut: !isSolana ? (initialTokenOut ?? undefined) : undefined,
    initialQuote: !isSolana ? (initialQuote ?? undefined) : undefined,
    maxPriceImpact: 5, // Fixed safety max impact
  });

  const solanaSwap = useSolanaSwap({
    slippageBps: slippage * 100,
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

    // Only log in dev
    if (import.meta.env.DEV) {
      // console.log('[SwapCard] Initialization Check', { initKey });
    }

    let updates = 0;

    if (initialTokenIn && currentTokenIn?.address !== initialTokenIn.address) {
      if (isSolana && solanaSwap) {
        solanaSwap.setTokenIn(initialTokenIn);
      } else if (evmSwap) {
        evmSwap.setTokenIn(initialTokenIn);
      }
      updates++;
    }

    if (initialTokenOut && currentTokenOut?.address !== initialTokenOut.address) {
      if (isSolana && solanaSwap) {
        solanaSwap.setTokenOut(initialTokenOut);
      } else if (evmSwap) {
        evmSwap.setTokenOut(initialTokenOut);
      }
      updates++;
    }

    // Set amount after tokens are set
    // Check if amount is actually different to avoid loop
    const currentAmountIn = isSolana ? solanaSwap?.state.amountIn : evmSwap?.state.amountIn;
    if (initialAmountIn && initialAmountIn !== currentAmountIn) {
      if (isSolana && solanaSwap) {
        solanaSwap.setAmountIn(initialAmountIn);
      } else if (evmSwap) {
        evmSwap.setAmountIn(initialAmountIn);
      }
      updates++;
    }

    // Track that we handled this initKey
    if (updates > 0) {
      initializedRef.current = initKey;
    }
  }, [initialTokenIn, initialTokenOut, initialAmountIn, chainId, isSolana, hasAutoExecutedRef]); // Removed swap dependency to break loop

  // CONTEXT MEMORY
  // Updated: 2026-04-23
  // Status: verified
  // Why: The wallet swap card must only force chain default tokens on real chain-context changes. Running that reset on every render wipes a fresh quote back to 0.
  // Debug Goal: After the user types an amount and the quote API returns, amountOut must stay populated until the user changes tokens, amount, or chain.
  // Search Tags: swap quote resets to 0 after success default token effect rerender
  // Invariants:
  // - The card only reapplies default chain tokens when there are no AI-provided initial tokens and the active chain context actually changes.
  // - A rerender with the same chain must not call setTokenIn/setTokenOut again.
  // Failure Modes:
  // - Quote briefly appears and then returns to 0.
  // - Button oscillates between Getting Quote and Swap because token reset retriggers the quote effect.
  const lastDefaultedChainRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (initialTokenIn || initialTokenOut) {
      lastDefaultedChainRef.current = null;
      return;
    }

    if (lastDefaultedChainRef.current === chainId) return;

    const chainDefaults = getCommonTokens(chainId);
    if (!chainDefaults.length) return;

    const currentSwap = swapRef.current;
    const currentTokenIn = isSolana
      ? (currentSwap as ReturnType<typeof useSolanaSwap>).state.tokenIn
      : (currentSwap as ReturnType<typeof useSwap>).state.tokenIn;
    const currentTokenOut = isSolana
      ? (currentSwap as ReturnType<typeof useSolanaSwap>).state.tokenOut
      : (currentSwap as ReturnType<typeof useSwap>).state.tokenOut;

    const defaultTokenIn = mapTokenDataToToken(chainDefaults[0]);
    const defaultTokenOut = mapTokenDataToToken(chainDefaults[1] || chainDefaults[0]);

    const tokenInMatches = currentTokenIn?.address?.toLowerCase() === defaultTokenIn.address.toLowerCase();
    const tokenOutMatches = currentTokenOut?.address?.toLowerCase() === defaultTokenOut.address.toLowerCase();

    if (!tokenInMatches) {
      if (isSolana) {
        (currentSwap as ReturnType<typeof useSolanaSwap>).setTokenIn(defaultTokenIn);
      } else {
        (currentSwap as ReturnType<typeof useSwap>).setTokenIn(defaultTokenIn);
      }
    }

    if (!tokenOutMatches && defaultTokenOut.address.toLowerCase() !== defaultTokenIn.address.toLowerCase()) {
      if (isSolana) {
        (currentSwap as ReturnType<typeof useSolanaSwap>).setTokenOut(defaultTokenOut);
      } else {
        (currentSwap as ReturnType<typeof useSwap>).setTokenOut(defaultTokenOut);
      }
    }

    lastDefaultedChainRef.current = chainId;
  }, [chainId, isSolana, initialTokenIn, initialTokenOut, mapTokenDataToToken]);

  // Token selector state
  const [showTokenSelector, setShowTokenSelector] = useState<'in' | 'out' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [importedTokens, setImportedTokens] = useState<Token[]>([]);

  const { login, authenticated } = usePrivy();
  const getNativeGasBuffer = React.useCallback(() => {
    if (isSolana) return 0.01;
    // Keep frontend guard aligned with backend gasReserve.
    if (chainId === 8453) return 0.0003; // Base
    if (chainId === 42161 || chainId === 10) return 0.002; // Arbitrum / Optimism
    return 0.001;
  }, [chainId, isSolana]);

  // CONTEXT MEMORY
  // Updated: 2026-04-22
  // Status: mixed
  // Why: The wallet swap card previously mixed quote loading, submit loading, and order settlement into booleans/messages, which left pending transactions without a durable terminal state.
  // Debug Goal: After a user starts a swap, the card must move through submit/broadcast/confirming and then end in success, failed, or indeterminate.
  // Search Tags: wallet swap execution state machine pending order confirmation
  // Invariants:
  // - Transaction submission disables edits through terminal settlement.
  // - A backend tradeId must be polled until SUCCESS, FAILED, or timeout-indeterminate.
  // Failure Modes:
  // - Button stays on Getting Quote after a submitted order.
  // - A pending order never surfaces success or failed state in the card.
  useEffect(() => {
    setExecutionState(prev => {
      if (isSwapExecutionBusy(prev.phase)) return prev;
      if (prev.phase === 'idle') return prev;

      const amountNum = parseFloat(swapState?.amountIn || '0');
      const terminal = prev.phase === 'success' || prev.phase === 'failed' || prev.phase === 'indeterminate';
      if (terminal && (!Number.isFinite(amountNum) || amountNum <= 0)) {
        return prev;
      }

      return { phase: 'idle', message: null };
    });
  }, [
    chainId,
    swapState?.tokenIn?.address,
    swapState?.tokenOut?.address,
    swapState?.amountIn,
  ]);

  useEffect(() => {
    // Confirmation modal removed - no need to reset anything
  }, [
    (swapState?.quote as any)?.allowanceTarget,
    (swapState?.quote as any)?.to,
    swapState?.amountIn,
    swapState?.tokenIn?.address
  ]);

  const markSwapSuccess = React.useCallback(async (txHash: string, tradeId?: string) => {
    setExecutionState({
      phase: 'success',
      message: `Swap confirmed: ${txHash.slice(0, 10)}...`,
      txHash,
      tradeId,
    });

    if (isSolana && solanaSwapTyped) {
      solanaSwapTyped.setAmountIn('');
    } else if (evmSwapTyped) {
      evmSwapTyped.setAmountIn('');
      if (evmSwapTyped.refreshSwapState) {
        await evmSwapTyped.refreshSwapState();
      }
    }

    onSwapSuccess?.(txHash);
  }, [evmSwapTyped, isSolana, onSwapSuccess, solanaSwapTyped]);

  const markSwapFailure = React.useCallback((message: string, tradeId?: string, txHash?: string) => {
    setExecutionState({
      phase: 'failed',
      message,
      error: message,
      tradeId,
      txHash,
    });
    onSwapError?.(message);
  }, [onSwapError]);

  const executeSwapNow = async () => {
    // Always require auth for embedded wallet execution
    if (!authenticated) {
      login();
      return;
    }

    if (isSwapExecutionBusy(executionState.phase)) return;

    try {
      if (serverExecutionEnabled) {
        if (!userAddress || !swapState?.tokenIn || !swapState?.tokenOut) {
          markSwapFailure('Missing swap parameters');
          return;
        }

        setExecutionState({
          phase: 'submitting',
          message: 'Submitting swap to execution service...',
        });

        const result = await executeSwapInstant({
          tokenIn: swapState.tokenIn.address,
          tokenOut: swapState.tokenOut.address,
          amountIn: swapState.amountIn,
          chainId: chainId,
          slippageBps: Math.round(slippage * 100),
          userAddress,
        });

        if (result.success && result.txHash && result.status === 'SUCCESS') {
          await markSwapSuccess(result.txHash, result.tradeId);
          return;
        }

        if (result.success && result.txHash && result.status === 'PENDING' && result.tradeId) {
          setExecutionState({
            phase: 'broadcast',
            message: `Transaction broadcast: ${result.txHash.slice(0, 10)}...`,
            txHash: result.txHash,
            tradeId: result.tradeId,
          });

          setExecutionState({
            phase: 'confirming',
            message: 'Waiting for on-chain confirmation...',
            txHash: result.txHash,
            tradeId: result.tradeId,
          });

          const settled = await waitForSwapTradeSettlement(result.tradeId, {
            onStatus: (trade) => {
              if (trade.status === 'PENDING') {
                setExecutionState({
                  phase: 'confirming',
                  message: 'Transaction pending on-chain...',
                  txHash: trade.txHash || result.txHash,
                  tradeId: trade.id,
                });
              }
            },
          });

          if (settled.success && settled.txHash) {
            await markSwapSuccess(settled.txHash, settled.tradeId || result.tradeId);
            return;
          }

          if (settled.status === 'FAILED') {
            markSwapFailure(settled.error || 'Swap failed after submission.', settled.tradeId || result.tradeId, result.txHash);
            return;
          }

          setExecutionState({
            phase: 'indeterminate',
            message: settled.error || 'Transaction is still pending. Check recent transactions shortly.',
            txHash: result.txHash,
            tradeId: result.tradeId,
            error: settled.error,
          });
          onSwapError?.(settled.error || 'Swap status is still pending.');
          return;
        }

        if (result.success && result.txHash) {
          await markSwapSuccess(result.txHash, result.tradeId);
          return;
        }

        if (result.ambiguous && result.tradeId) {
          setExecutionState({
            phase: 'confirming',
            message: 'Execution response was ambiguous. Verifying order status...',
            tradeId: result.tradeId,
            txHash: result.txHash,
          });

          const settled = await waitForSwapTradeSettlement(result.tradeId);
          if (settled.success && settled.txHash) {
            await markSwapSuccess(settled.txHash, settled.tradeId || result.tradeId);
            return;
          }
          if (settled.status === 'FAILED') {
            markSwapFailure(settled.error || 'Swap failed after submission.', settled.tradeId || result.tradeId, result.txHash);
            return;
          }
          setExecutionState({
            phase: 'indeterminate',
            message: settled.error || 'Swap may still be processing. Check recent transactions.',
            tradeId: result.tradeId,
            txHash: result.txHash,
            error: settled.error,
          });
          onSwapError?.(settled.error || 'Swap status is still pending.');
          return;
        }

        markSwapFailure(result.error || 'Server execution failed', result.tradeId, result.txHash);
        return;
      }

      setExecutionState({
        phase: 'submitting',
        message: 'Submitting swap...',
      });

      const result = isSolana && solanaSwapTyped
        ? await solanaSwapTyped.executeSwap()
        : evmSwapTyped
          ? await evmSwapTyped.executeSwap()
          : { success: false, error: 'Swap not available' };

      if (result?.success && result?.txHash) {
        await markSwapSuccess(result.txHash);
      } else {
        markSwapFailure(result?.error || 'Swap execution failed');
      }
    } catch (e: any) {
      markSwapFailure(e?.message || 'Swap execution error');
    }
  };

  const handleExecuteSwap = async () => {
    if (executionState.phase === 'indeterminate' && executionState.tradeId) {
      setExecutionState(prev => ({
        ...prev,
        phase: 'confirming',
        message: 'Checking latest order status...',
      }));
      const settled = await waitForSwapTradeSettlement(executionState.tradeId);
      if (settled.success && settled.txHash) {
        await markSwapSuccess(settled.txHash, settled.tradeId || executionState.tradeId);
      } else if (settled.status === 'FAILED') {
        markSwapFailure(settled.error || 'Swap failed after submission.', settled.tradeId || executionState.tradeId, executionState.txHash);
      } else {
        setExecutionState(prev => ({
          ...prev,
          phase: 'indeterminate',
          message: settled.error || 'Order is still pending. Check again shortly.',
          error: settled.error,
        }));
      }
      return;
    }

    if (!authenticated) {
      await executeSwapNow();
      return;
    }

    // Enforce upfront confirmation showing spender / chain / amount for SWAPS
    const spender = !isSolana
      ? (swapState?.quote as any)?.allowanceTarget || (swapState?.quote as any)?.to || ''
      : '';

    // Execute swap directly without confirmation modal
    // (Confirmation modal removed per user request)
    if (!isSolana && !spender) {
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
  const amountIn = swapState?.amountIn ?? displayInfo?.amountIn ?? '';
  const amountOut = swapState?.amountOut || displayInfo?.amountOut || '0';
  const amountInUSD = displayInfo?.amountInUSD || '0';
  const amountOutUSD = displayInfo?.amountOutUSD || '0';
  const isLoading = swapState?.isLoading || displayInfo?.isLoading || false;
  const isExecuting = swapState?.isExecuting || displayInfo?.isExecuting || false;
  const isExecutionBusy = isSwapExecutionBusy(executionState.phase);
  const effectiveIsExecuting = isExecuting || isExecutionBusy;
  const error = swapState?.error || displayInfo?.error || null;
  const priceImpact = displayInfo?.priceImpact || 0;
  const dexName = displayInfo?.dexName || 'N/A';

  const hasEnoughBalance = displayInfo?.hasEnoughBalance || false;
  const availableQuotes = (displayInfo as any)?.availableQuotes || [];
  const selectedDex = (displayInfo as any)?.selectedDex || dexName;
  const isBalanceLoading = displayInfo?.isBalanceLoading || false;



  const canExecute =
    amountIn.trim() !== '' &&
    parseFloat(amountIn) > 0 &&
    amountOut !== '0' &&
    parseFloat(amountOut) > 0 &&
    !isLoading &&
    !effectiveIsExecuting &&
    hasEnoughBalance &&
    !error;
  const buttonDisabled = authenticated ? (!canExecute || isExecutionBusy) : false;

  // DEBUG: Diagnose why button is disabled
  if (!canExecute && !isLoading && !effectiveIsExecuting && amountIn.trim() !== '') {
    console.log('[SwapCard] Button disabled because:', {
      amountIn,
      amountOut,
      isLoading,
      isExecuting: effectiveIsExecuting,
      hasEnoughBalance,
      error,
      canExecute
    });
  }

  const needsApproval = displayInfo?.needsApproval || false;

  const actionButtonLabel = React.useMemo(() => {
    if (executionState.phase === 'submitting') return 'Submitting...';
    if (executionState.phase === 'broadcast') return 'Broadcasted';
    if (executionState.phase === 'confirming') return 'Confirming...';
    if (executionState.phase === 'success') return 'Swap Confirmed';
    if (executionState.phase === 'failed') return 'Try Again';
    if (executionState.phase === 'indeterminate') return 'Check Status';
    if (effectiveIsExecuting) return needsApproval ? 'Approving & Swapping...' : 'Swapping...';
    return displayInfo?.actionLabel || 'Swap';
  }, [displayInfo?.actionLabel, effectiveIsExecuting, executionState.phase, needsApproval]);

  // Auto-execution logic
  useEffect(() => {
    // Only proceed if autoExecute is true and we haven't executed yet (or reset)
    if (!autoExecute || effectiveIsExecuting || isLoading) return;

    const swapStatus = (displayInfo as any)?.status || (swapState as any)?.status;
    if (swapStatus === 'quote_ready' && canExecute && !hasAutoExecutedRef.current) {
      // Special handling for approval
      // SKIP if using server execution
      if (import.meta.env.DEV) {
        console.log('[SwapCard] Auto-executing swap...');
      }
      hasAutoExecutedRef.current = true;
      // Bypassing confirmation modal for auto execution
      executeSwapNow();
    }
  }, [autoExecute, canExecute, effectiveIsExecuting, isLoading, needsApproval, serverExecutionEnabled, evmSwapTyped, displayInfo, swapState]);

  // Normalize Solana native token addresses (both So11111111111111111111111111111111111111111 and So11111111111111111111111111111111111111112 represent SOL)
  const normalizeAddress = React.useCallback((address: string): string => {
    // For Solana native SOL, normalize both variants to the Wrapped SOL address
    if (address === 'So11111111111111111111111111111111111111111' ||
      address === 'So11111111111111111111111111111111111111112') {
      return 'So11111111111111111111111111111111111111112';
    }
    return address.toLowerCase();
  }, []);

  const chainScopedUserHoldings = React.useMemo(() => {
    return userHoldings.filter(h => {
      return typeof h.chainId === 'number' && h.chainId === chainId;
    });
  }, [userHoldings, chainId]);

  const isLowQualityLogoUrl = React.useCallback((logoUrl?: string) => {
    if (!logoUrl) return true;
    const lower = logoUrl.toLowerCase();
    return lower.includes('img-v1.raydium.io/icon/') ||
      lower.includes('placeholder') ||
      lower.includes('unknown') ||
      lower.includes('default');
  }, []);

  useEffect(() => {
    try {
      const parsed = readImportedSwapTokensFromStorage() as Record<string, Token[]>;
      const chainTokens = Array.isArray(parsed?.[String(chainId)]) ? parsed[String(chainId)] : [];
      setImportedTokens(chainTokens);
    } catch {
      setImportedTokens([]);
    }
  }, [chainId]);

  const persistImportedToken = React.useCallback((token: Token) => {
    if (!token?.address) return;
    setImportedTokens(prev => {
      const normalizedAddress = normalizeAddress(token.address);
      const filtered = prev.filter(t => normalizeAddress(t.address) !== normalizedAddress);
      const next = [
        {
          address: token.address,
          symbol: token.symbol || 'UNK',
          name: token.name || 'Unknown Token',
          decimals: typeof token.decimals === 'number' ? token.decimals : 18,
          chainId,
          logoUrl: token.logoUrl,
        } as Token,
        ...filtered,
      ].slice(0, 30);

      try {
        const parsed = readImportedSwapTokensFromStorage() as Record<string, Token[]>;
        parsed[String(chainId)] = next;
        writeImportedSwapTokensToStorage(parsed);
        emitImportedTokensUpdated(chainId);
      } catch {
        // Ignore persistence errors
      }
      return next;
    });
  }, [chainId, normalizeAddress]);

  // Get available tokens - prioritize user holdings, then imported whitelist, then common tokens
  const availableTokens = React.useMemo(() => {
    // Get base tokens from hooks
    let baseTokens: Token[] = [];
    if (isSolana && solanaSwapTyped) {
      baseTokens = solanaSwapTyped.getAvailableTokens();
    } else {
      baseTokens = evmSwapTyped?.getAvailableTokens() || [];
    }

    // Balance-first: any token with positive balance should be selectable.
    const userTokens: Token[] = chainScopedUserHoldings
      .filter(h => {
        const balance = parseFloat(String(h.balance || '0'));
        return Number.isFinite(balance) && balance > 0;
      })
      .map(h => ({
        address: h.address,
        symbol: h.symbol,
        name: h.name,
        decimals: h.decimals,
        chainId: chainId,
        logoUrl: h.logo,
      }));
    const chainImportedTokens = importedTokens
      .filter(t => t.chainId === chainId)
      .map(t => ({
        ...t,
        chainId,
      }));

    const tokenMap = new Map<string, Token>();

    // First add base tokens to the map (trusted metadata baseline).
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
    const baseTokenKeys = new Set(baseTokens.map(t => normalizeAddress(t.address)));

    // Then add/update with user tokens (prioritized, but merge logo if missing)
    chainImportedTokens.forEach(token => {
      const normalizedKey = normalizeAddress(token.address);
      if (!tokenMap.has(normalizedKey)) {
        tokenMap.set(normalizedKey, token);
      }
    });

    // Then add/update with user tokens (prioritized, but merge logo if missing)
    userTokens.forEach(token => {
      const normalizedKey = normalizeAddress(token.address);
      const existing = tokenMap.get(normalizedKey);

      if (existing) {
        const isNative = normalizedKey === '0x0000000000000000000000000000000000000000' ||
          normalizedKey === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
          normalizedKey === 'So11111111111111111111111111111111111111112'.toLowerCase();
        const isBaseToken = baseTokenKeys.has(normalizedKey);
        const preferExistingMetadata = isNative || isBaseToken;
        const mergedLogo = token.logoUrl && !isLowQualityLogoUrl(token.logoUrl)
          ? token.logoUrl
          : existing.logoUrl;

        // Merge: for native tokens, keep base token metadata to avoid cross-chain display pollution.
        // For ERC20/SPL, keep user token metadata and merge logo fallback.
        tokenMap.set(normalizedKey, {
          ...(preferExistingMetadata ? existing : token),
          logoUrl: mergedLogo || token.logoUrl || existing.logoUrl,
          address: normalizedKey === 'So11111111111111111111111111111111111111112'
            ? 'So11111111111111111111111111111111111111112'
            : (preferExistingMetadata ? existing.address : token.address)
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
      const aIsImported = chainImportedTokens.some(ut => normalizeAddress(ut.address) === aNormalized);
      const bIsImported = chainImportedTokens.some(ut => normalizeAddress(ut.address) === bNormalized);

      if (aIsUser && !bIsUser) return -1;
      if (!aIsUser && bIsUser) return 1;
      if (aIsImported && !bIsImported) return -1;
      if (!aIsImported && bIsImported) return 1;

      if (aIsUser && bIsUser) {
        const aHolding = chainScopedUserHoldings.find(h => normalizeAddress(h.address) === aNormalized);
        const bHolding = chainScopedUserHoldings.find(h => normalizeAddress(h.address) === bNormalized);
        return (bHolding?.usdValueNum ?? 0) - (aHolding?.usdValueNum ?? 0);
      }

      return 0;
    });

    return result;
  }, [chainId, isSolana, evmSwapTyped, solanaSwapTyped, chainScopedUserHoldings, importedTokens, normalizeAddress, isLowQualityLogoUrl]); // Include normalizeAddress in deps

  // Filter tokens based on search query
  const filteredTokens = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return availableTokens;
    }
    const query = searchQuery.toLowerCase();
    const filtered = availableTokens.filter(token =>
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
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
    const selectedResolvedToken = resolvedSearchToken &&
      normalizeAddress(resolvedSearchToken.address) === normalizeAddress(token.address);
    if (isAddressLikeQuery || selectedResolvedToken) {
      persistImportedToken(token);
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
  const [resolvedSearchToken, setResolvedSearchToken] = useState<Token | null>(null);
  const [isResolvingSearchToken, setIsResolvingSearchToken] = useState(false);

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

  const isAddressLikeQuery = React.useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return false;
    const evmAddress = /^0x[a-fA-F0-9]{40}$/.test(query);
    const solAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query);
    return evmAddress || (isSolana && solAddress);
  }, [searchQuery, isSolana]);

  React.useEffect(() => {
    const query = searchQuery.trim();
    if (!query || !isAddressLikeQuery) {
      setResolvedSearchToken(null);
      setIsResolvingSearchToken(false);
      return;
    }

    let cancelled = false;
    setIsResolvingSearchToken(true);

    const timer = setTimeout(async () => {
      try {
        let tokenData: any = null;
        if (isSolana) {
          tokenData = await getTokenData(query, chainId);
        } else {
          tokenData = await getTokenData(query, chainId);
          if (!tokenData || tokenData.symbol === 'UNK' || tokenData.symbol === 'UNKNOWN') {
            tokenData = await findTokenOnAnyChain(query);
          }
        }

        if (cancelled || !tokenData) return;

        const resolved: Token = {
          address: tokenData.address,
          symbol: tokenData.symbol || 'UNK',
          name: tokenData.name || 'Unknown Token',
          decimals: typeof tokenData.decimals === 'number' ? tokenData.decimals : 18,
          chainId: tokenData.chainId || chainId,
          logoUrl: tokenData.logoURI || undefined,
        };
        setResolvedSearchToken(resolved);
      } catch {
        if (!cancelled) {
          setResolvedSearchToken(null);
        }
      } finally {
        if (!cancelled) {
          setIsResolvingSearchToken(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, chainId, isAddressLikeQuery, isSolana]);

  const displayTokens = React.useMemo(() => {
    if (!resolvedSearchToken) return filteredTokens;
    const key = normalizeAddress(resolvedSearchToken.address);
    const hasToken = filteredTokens.some(t => normalizeAddress(t.address) === key);
    if (hasToken) return filteredTokens;
    return [resolvedSearchToken, ...filteredTokens];
  }, [filteredTokens, resolvedSearchToken, normalizeAddress]);

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
                <X size={20} />
              </button>
            )}
            <button
              className={styles.swapSettings}
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 size={20} />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className={styles.settingsDropdown}>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Slippage Tolerance</span>

              {/* Preset Options */}
              <div className={styles.settingsOptions}>
                {[0.5, 1, 3].map((val) => (
                  <button
                    key={val}
                    className={`${styles.settingsOption} ${slippage === val ? styles.settingsOptionActive : ''}`}
                    onClick={() => setSlippage(val)}
                  >
                    {val}%
                  </button>
                ))}
              </div>

              {/* Custom Input Row */}
              <div style={{ marginTop: '8px' }}>
                <span className={styles.settingsLabel} style={{ fontSize: '11px', marginBottom: '4px', display: 'block' }}>
                  Custom
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    className={styles.settingsInput}
                    type="number"
                    placeholder="Custom"
                    value={slippage}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setSlippage(isNaN(val) ? 0 : val);
                    }}
                    onBlur={() => {
                      if (slippage < 0.1) setSlippage(0.1);
                      if (slippage > 50) setSlippage(50);
                    }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>%</span>
                </div>
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
                Bal: {isBalanceLoading ? '...' : displayInfo.userBalance}
                {!isBalanceLoading && parseFloat(displayInfo.userBalance) > 0 && (
                  <button
                    className={styles.maxButton}
                    onClick={() => {
                      // IMPROVED MAX LOGIC:
                      // 1. For Native Tokens (ETH, SOL): Subtract gas buffer
                      // 2. For ERC20/SPL Tokens: Use EXACT balance string to avoid precision loss

                      const tokenInAddress = swapState?.tokenIn?.address?.toLowerCase();
                      const isNative = isSolana
                        ? displayInfo.tokenInSymbol === 'SOL'
                        : (tokenInAddress === '0x0000000000000000000000000000000000000000' ||
                          tokenInAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');

                      let maxAmountStr = displayInfo.userBalance;

                      if (isNative) {
                        // For native tokens, we must subtract gas
                        const balance = parseFloat(displayInfo.userBalance);
                        const gasBuffer = getNativeGasBuffer();
                        const maxAmount = Math.max(0, balance - gasBuffer);

                        // Use high precision (9 for Solana, 18 for EVM)
                        const precision = isSolana ? 9 : 18;
                        maxAmountStr = maxAmount.toFixed(precision).replace(/\.?0+$/, '');
                      } else {
                        // For Tokens: Use the full balance string directly to avoid precision loss
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
                disabled={isExecutionBusy}
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
                disabled={isExecutionBusy}
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
                <ChevronDown size={18} style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>

            <div className={styles.swapUsd}>≈ ${amountInUSD}</div>
          </div>

          {/* Arrow - Block Level between cards */}
          <div className={styles.swapArrow}>
            <div className={styles.arrowContainer}>
              <button
                disabled={isExecutionBusy}
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
                  <ArrowDown size={20} strokeWidth={3} />
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
                disabled={isExecutionBusy}
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
                <ChevronDown size={18} style={{ color: 'var(--text-tertiary)' }} />
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
              <ChevronDown size={18} />
              <span className={styles.routeBtnText}>{selectedDex || 'Route'}</span>
            </span>
          </button>

          <button
            onClick={handleExecuteSwap}
            disabled={buttonDisabled}
            className={styles.swapConfirmBtn}
          >
            {effectiveIsExecuting ? (
              <>
                <Zap size={18} />
                <span>{actionButtonLabel}</span>
              </>
            ) : (
              <span>{actionButtonLabel}</span>
            )}
          </button>
        </div>


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
                  <X size={24} />
                </button>
              </div>

              {/* Search */}
              <div className={styles.searchContainer}>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={20}
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
                {displayTokens.length === 0 ? (
                  isResolvingSearchToken ? (
                    <div style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: 'var(--text-tertiary)',
                      fontSize: '13px',
                    }}>
                      Resolving token contract...
                    </div>
                  ) : (
                    <div style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: 'var(--text-tertiary)',
                      fontSize: '14px',
                    }}>
                      No tokens found
                    </div>
                  )
                ) : (
                  displayTokens.map((token) => {
                    const isSelected = showTokenSelector === 'in'
                      ? swapState?.tokenIn?.address === token.address
                      : swapState?.tokenOut?.address === token.address;

                    // Find user holding for this token (use normalized address for matching)
                    const userHolding = chainScopedUserHoldings.find(
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
                          <span className={styles.tokenItemName} style={{ opacity: 0.7 }}>
                            {token.address.slice(0, 6)}...{token.address.slice(-4)}
                          </span>
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
                            <Check size={14} color="#000" />
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

        {executionState.message && (
          <div style={{
            marginTop: '10px',
            fontSize: '12px',
            color: executionState.phase === 'failed'
              ? 'var(--error-color, #ef4444)'
              : executionState.phase === 'success'
                ? 'var(--success-color, #16a34a)'
                : 'var(--text-secondary)',
            textAlign: 'center',
          }}>
            {executionState.message}
            {executionState.txHash && (
              <div style={{ marginTop: '4px', color: 'var(--text-tertiary)' }}>
                Tx: {executionState.txHash.slice(0, 10)}...{executionState.txHash.slice(-6)}
              </div>
            )}
            {executionState.tradeId && (
              <div style={{ marginTop: '2px', color: 'var(--text-tertiary)' }}>
                Order: {executionState.tradeId.slice(0, 8)}...
              </div>
            )}
          </div>
        )}
      </div>
    </CardWrapper>
  );
};

export default SwapCardIntegrated;
