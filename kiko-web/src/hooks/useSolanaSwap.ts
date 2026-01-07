/**
 * Solana Swap Hook
 * Manages Solana swap state and logic using Privy Solana wallet
 * Supports both embedded Privy wallets and external wallets (Phantom, Solflare, etc.)
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignTransaction } from '@privy-io/react-auth/solana';
// Note: VersionedTransaction type will be provided by Privy wallet
// We'll use 'any' type for now until @solana/web3.js is installed
type VersionedTransaction = any;
import { getSolanaSwapQuote, executeSolanaSwap, type SolanaSwapQuote } from '@/services/solanaSwapService';
import { getCommonTokens } from '@/services/tokenDataService';
import type { Token } from '@/types/swap';


const SOLANA_CHAIN_ID = 900;

export interface UseSolanaSwapOptions {
  slippageBps?: number;
  userAddress?: string;
  aggregator?: 'jupiter' | 'raydium' | 'auto';
}

export interface SolanaSwapState {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  quote: SolanaSwapQuote | null;
  priceImpact: number;
  isLoading: boolean;
  isExecuting: boolean;
  error: string | null;
}

export interface UseSolanaSwapParams {
  slippageBps?: number;
  userAddress?: string;
  aggregator?: 'jupiter' | 'raydium' | 'auto';
}

export interface UseSolanaSwapReturn {
  state: SolanaSwapState;
  displayInfo: any; // Using any for now to avoid importing DisplayInfo type if not exported
  setTokenIn: (token: Token | null) => void;
  setTokenOut: (token: Token | null) => void;
  setAmountIn: (amount: string) => void;
  swapTokens: () => void;
  executeSwap: () => Promise<{ success: boolean; error?: string; txHash?: string }>;
  getAvailableTokens: () => Token[];
  isWalletConnected: boolean;
  walletAddress?: string;
  selectQuote: (dex: string) => void;
}

export function useSolanaSwap({
  slippageBps = 50,
  userAddress,
  aggregator = 'auto',
}: UseSolanaSwapParams): UseSolanaSwapReturn {
  const { user } = usePrivy();
  const { wallets: privyWallets } = useWallets();

  // Get Privy embedded Solana wallets using the Solana-specific hook
  const { wallets: embeddedSolanaWallets } = useSolanaWallets();
  const { signTransaction } = useSignTransaction();

  // Get all wallets from both useWallets() and user.linkedAccounts
  // Privy stores Solana wallets in linkedAccounts, not in the wallets array
  // Also include embedded Solana wallets from useSolanaWallets hook
  const allWallets = useMemo(() => {
    const walletsFromHook = privyWallets || [];
    const walletsFromLinkedAccounts = (user?.linkedAccounts || [])
      .filter((account: any) => account.type === 'wallet')
      .map((account: any) => ({
        address: account.address,
        chainType: account.chainType,
        walletClientType: account.walletClientType,
        connectorType: account.connectorType,
        isEmbedded: account.walletClientType === 'privy', // Mark embedded wallets
        ...account,
      }));

    // Add embedded Solana wallets from Privy's Solana hook
    const embeddedWallets = (embeddedSolanaWallets || []).map((wallet: any) => ({
      address: wallet.address,
      chainType: 'solana',
      walletClientType: 'privy',
      connectorType: 'solana',
      isEmbedded: true,
      walletInstance: wallet, // Store the actual wallet instance for signing
      signAndSendTransaction: wallet.signAndSendTransaction?.bind(wallet),
      signTransaction: wallet.signTransaction?.bind(wallet),
    }));

    // Combine and deduplicate by address, prioritizing embedded wallets
    const combined = [...embeddedWallets, ...walletsFromHook, ...walletsFromLinkedAccounts];
    const uniqueWallets = combined.filter((wallet, index, self) =>
      index === self.findIndex((w) => w.address === wallet.address)
    );

    console.log('[useSolanaSwap] Combined wallets:', uniqueWallets.length, {
      embedded: embeddedWallets.length,
      fromHook: walletsFromHook.length,
      fromLinked: walletsFromLinkedAccounts.length,
    });

    return uniqueWallets;
  }, [privyWallets, user, embeddedSolanaWallets]);

  // Filter Solana wallets from all wallets
  // Solana wallets have chainType === 'solana' or walletClientType includes 'solana'
  // Also check for address format (not starting with 0x) as a fallback
  const solanaWallets = useMemo(() => {
    console.log('[useSolanaSwap] ========== WALLET DETECTION DEBUG ==========');
    console.log('[useSolanaSwap] Total wallets from allWallets:', allWallets.length);

    // Log full wallet objects to understand structure
    allWallets.forEach((wallet, index) => {
      console.log(`[useSolanaSwap] Wallet ${index}:`, {
        fullObject: wallet,
        address: wallet.address,
        chainType: (wallet as any).chainType,
        walletClientType: (wallet as any).walletClientType,
        connectorType: (wallet as any).connectorType,
        walletClient: (wallet as any).walletClient,
        type: typeof wallet,
        keys: Object.keys(wallet),
      });
    });

    const filtered = allWallets.filter((wallet: any) => {
      // Check if wallet is a Solana wallet
      // Privy wallets have a chainType property or can be identified by walletClientType
      const isExplicitSolana = wallet.chainType === 'solana' ||
        wallet.walletClientType?.includes('solana') ||
        wallet.connectorType === 'solana' ||
        wallet.connectorType === 'solana_adapter';

      // Heuristic: If address exists and does NOT start with 0x, it's likely a Solana wallet
      // (assuming we only support EVM and Solana for now)
      const isSolanaAddress = wallet.address && !wallet.address.startsWith('0x');

      const isSolana = isExplicitSolana || isSolanaAddress;

      console.log(`[useSolanaSwap] Wallet ${wallet.address?.slice(0, 8)}... - isSolana:`, isSolana, {
        isExplicitSolana,
        isSolanaAddress,
      });

      return isSolana;
    });

    console.log('[useSolanaSwap] Solana wallets found:', filtered.length);
    console.log('[useSolanaSwap] ========================================');
    return filtered;
  }, [allWallets]);

  // Find the active Solana wallet
  // Prioritize embedded Privy wallets, then external wallets
  const activeWallet = useMemo(() => {
    console.log('[useSolanaSwap] ========== ACTIVE WALLET SELECTION ==========');
    console.log('[useSolanaSwap] solanaWallets count:', solanaWallets.length);

    if (solanaWallets.length === 0) {
      console.log('[useSolanaSwap] No Solana wallets found');
      return null;
    }

    // First, check for embedded Privy wallet (these have walletInstance directly attached)
    const embeddedWallet = solanaWallets.find((w: any) => w.isEmbedded && w.walletInstance);
    if (embeddedWallet) {
      console.log('[useSolanaSwap] ✅ Using embedded Privy Solana wallet:', embeddedWallet.address);
      return {
        ...embeddedWallet,
        isEmbedded: true,
      };
    }

    // Fallback to external wallet (Phantom, Solflare, etc.)
    const solanaWalletData = solanaWallets[0];
    const walletType = (solanaWalletData as any)?.walletClientType;
    console.log('[useSolanaSwap] Solana wallet type:', walletType);
    console.log('[useSolanaSwap] Solana wallet address:', solanaWalletData?.address);

    // Access the actual wallet from browser window object
    let walletInstance: any = null;

    if (typeof window !== 'undefined') {
      // Map wallet type to window object
      if (walletType?.toLowerCase().includes('okx')) {
        walletInstance = (window as any).okxwallet?.solana;
        console.log('[useSolanaSwap] Accessing OKX Wallet from window.okxwallet.solana');
      } else if (walletType?.toLowerCase().includes('phantom')) {
        walletInstance = (window as any).phantom?.solana;
        console.log('[useSolanaSwap] Accessing Phantom from window.phantom.solana');
      } else if (walletType?.toLowerCase().includes('solflare')) {
        walletInstance = (window as any).solflare;
        console.log('[useSolanaSwap] Accessing Solflare from window.solflare');
      } else {
        // Fallback: try common Solana wallet objects
        walletInstance = (window as any).solana || (window as any).phantom?.solana;
        console.log('[useSolanaSwap] Using fallback window.solana');
      }
    }

    if (walletInstance) {
      console.log('[useSolanaSwap] ✅ Found external wallet instance:', walletInstance);
      console.log('[useSolanaSwap] Wallet has signAndSendTransaction?', typeof walletInstance.signAndSendTransaction);
      console.log('[useSolanaSwap] Wallet has signTransaction?', typeof walletInstance.signTransaction);
      console.log('[useSolanaSwap] Wallet publicKey:', walletInstance.publicKey?.toString());

      // Return a combined object with both data and methods
      return {
        ...solanaWalletData,
        walletInstance,
        address: solanaWalletData.address,
        signAndSendTransaction: walletInstance.signAndSendTransaction?.bind(walletInstance),
        signTransaction: walletInstance.signTransaction?.bind(walletInstance),
        publicKey: walletInstance.publicKey,
        isEmbedded: false,
      };
    }

    console.error('[useSolanaSwap] ❌ Could not find wallet instance in window object');
    return null;
  }, [solanaWallets]);

  const [state, setState] = useState<SolanaSwapState>({
    tokenIn: null,
    tokenOut: null,
    amountIn: '',
    amountOut: '',
    quote: null,
    priceImpact: 0,
    isLoading: false,
    isExecuting: false,
    error: null,
  });

  // Initialize with common tokens - DISABLED to prevent overwriting parent-provided tokens
  // useEffect(() => {
  //   const commonTokens = getCommonTokens(SOLANA_CHAIN_ID);
  //   if (commonTokens.length >= 2 && !state.tokenIn && !state.tokenOut) {
  //     setState(prev => ({
  //       ...prev,
  //       tokenIn: {
  //         address: commonTokens[0].address,
  //         symbol: commonTokens[0].symbol,
  //         name: commonTokens[0].name,
  //         decimals: commonTokens[0].decimals,
  //         logoUrl: commonTokens[0].logoURI,
  //         chainId: SOLANA_CHAIN_ID,
  //       },
  //       tokenOut: {
  //         address: commonTokens[1].address,
  //         symbol: commonTokens[1].symbol,
  //         name: commonTokens[1].name,
  //         decimals: commonTokens[1].decimals,
  //         logoUrl: commonTokens[1].logoURI,
  //         chainId: SOLANA_CHAIN_ID,
  //       },
  //     }));
  //   }
  // }, []);

  // Fetch Solana balance (SOL and SPL tokens)
  const [solanaBalance, setSolanaBalance] = useState<string>('0');
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchBalance = async () => {
      if (!activeWallet?.walletInstance?.publicKey) {
        setSolanaBalance('0');
        setTokenBalances({});
        return;
      }

      try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const rpcUrl = `${API_BASE_URL}/api/rpc/solana`;

        const connection = new Connection(rpcUrl, 'confirmed');

        const publicKey = new PublicKey(activeWallet.walletInstance.publicKey.toString());

        // Fetch SOL balance
        const balance = await connection.getBalance(publicKey);
        const solBalance = (balance / 1e9).toFixed(4);
        setSolanaBalance(solBalance);

        // Fetch SPL token balances using parsed RPC method (no @solana/spl-token needed)
        try {
          const { PublicKey } = await import('@solana/web3.js');

          // Hardcode TOKEN_PROGRAM_ID to avoid importing @solana/spl-token (which causes Buffer issues)
          const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

          // Use getParsedTokenAccountsByOwner to get pre-parsed data
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
            programId: TOKEN_PROGRAM_ID,
          });

          const balances: Record<string, string> = {};

          for (const { account } of tokenAccounts.value) {
            try {
              // Access parsed data directly
              const parsedInfo = account.data.parsed.info;
              const mint = parsedInfo.mint;
              const amount = parsedInfo.tokenAmount.amount;
              const decimals = parsedInfo.tokenAmount.decimals;

              // Calculate balance using the decimals from the parsed data
              const balance = (Number(amount) / Math.pow(10, decimals)).toFixed(4);
              balances[mint] = balance;

              console.log(`[useSolanaSwap] Token ${mint.slice(0, 8)}...: ${balance} (decimals: ${decimals})`);
            } catch (parseError) {
              console.warn('[useSolanaSwap] Failed to parse token account:', parseError);
            }
          }

          setTokenBalances(balances);
          console.log('[useSolanaSwap] Total SPL tokens found:', Object.keys(balances).length);
        } catch (error) {
          console.warn('[useSolanaSwap] Error fetching SPL token balances:', error);
        }
      } catch (error) {
        console.error('[useSolanaSwap] Error fetching balance:', error);
        setSolanaBalance('0');
        setTokenBalances({});
      }
    };

    fetchBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [activeWallet?.walletInstance?.publicKey, state.tokenIn?.address, state.tokenIn?.decimals]);

  // Fetch quote when inputs change
  useEffect(() => {
    if (!state.tokenIn || !state.tokenOut || !state.amountIn || parseFloat(state.amountIn) <= 0) {
      setState(prev => ({ ...prev, quote: null, amountOut: '', priceImpact: 0 }));
      return;
    }

    const fetchQuote = async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        // IMPORTANT: Only use Solana wallet address, not EVM address
        // activeWallet should be a Solana wallet from our filtering logic
        const solanaWalletAddress = activeWallet?.address;

        // Validate it's a Solana address (not starting with 0x)
        const isSolanaAddress = solanaWalletAddress && !solanaWalletAddress.startsWith('0x');

        const quote = await getSolanaSwapQuote({
          tokenIn: state.tokenIn!.address,
          tokenOut: state.tokenOut!.address,
          amountIn: state.amountIn,
          slippageBps,
          // Only pass userAddress if it's a valid Solana address (not EVM 0x...)
          userAddress: isSolanaAddress ? solanaWalletAddress : undefined,
          // Use aggregator from options (default: 'auto' for best quote)
          aggregator: aggregator || 'auto',
        });

        if (quote) {
          setState(prev => ({
            ...prev,
            quote,
            amountOut: quote.amountOut,
            priceImpact: quote.priceImpact,
            isLoading: false,
          }));
        } else {
          setState(prev => ({
            ...prev,
            quote: null,
            amountOut: '',
            priceImpact: 0,
            isLoading: false,
            error: 'Failed to get quote. Please try again.',
          }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get quote';
        setState(prev => ({
          ...prev,
          quote: null,
          amountOut: '',
          priceImpact: 0,
          isLoading: false,
          error: message,
        }));
      }
    };

    const timeoutId = setTimeout(fetchQuote, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [state.tokenIn, state.tokenOut, state.amountIn, slippageBps, userAddress, activeWallet?.address, aggregator]);

  const setTokenIn = useCallback((token: Token | null) => {
    setState(prev => ({ ...prev, tokenIn: token, quote: null, amountOut: '', error: null }));
  }, []);

  const setTokenOut = useCallback((token: Token | null) => {
    setState(prev => ({ ...prev, tokenOut: token, quote: null, amountOut: '', error: null }));
  }, []);

  const setAmountIn = useCallback((amount: string) => {
    setState(prev => ({ ...prev, amountIn: amount, error: null }));
  }, []);

  const swapTokens = useCallback(() => {
    setState(prev => ({
      ...prev,
      tokenIn: prev.tokenOut,
      tokenOut: prev.tokenIn,
      amountIn: prev.amountOut,
      amountOut: prev.amountIn,
      quote: null,
      error: null,
    }));
  }, []);

  const executeSwap = useCallback(async () => {
    console.log('[useSolanaSwap] Execute swap called', {
      hasQuote: !!state.quote,
      hasWallet: !!activeWallet,
      walletAddress: activeWallet?.address,
      tokenIn: state.tokenIn?.symbol,
      tokenOut: state.tokenOut?.symbol,
    });

    if (!state.quote) {
      const error = 'No quote available';
      console.error('[useSolanaSwap]', error);
      setState(prev => ({
        ...prev,
        error,
        isExecuting: false,
      }));
      return { success: false, error };
    }

    if (!activeWallet) {
      // Check if we have other wallets (likely EVM)
      const hasEVMWallet = allWallets.some(w => w.address && w.address.startsWith('0x'));

      const error = hasEVMWallet
        ? 'Please connect a Solana wallet (e.g. Phantom, Solflare) to swap on Solana. Click the "Connect Solana Wallet" button.'
        : 'No Solana wallet connected';

      console.error('[useSolanaSwap]', error);
      console.log('[useSolanaSwap] Available wallets:', allWallets.map(w => ({
        type: (w as any).walletClientType,
        chainType: (w as any).chainType,
        connectorType: (w as any).connectorType,
        address: w.address
      })));
      setState(prev => ({
        ...prev,
        error,
        isExecuting: false,
      }));
      return { success: false, error };
    }

    if (!state.tokenIn || !state.tokenOut) {
      const error = 'Please select tokens';
      console.error('[useSolanaSwap]', error);
      setState(prev => ({
        ...prev,
        error,
        isExecuting: false,
      }));
      return { success: false, error };
    }

    setState(prev => ({ ...prev, isExecuting: true, error: null }));

    try {
      // Get the wallet instance
      const walletInstance = (activeWallet as any)?.walletInstance;

      if (!walletInstance) {
        throw new Error('Wallet instance not found');
      }

      // Check if wallet is connected (has publicKey)
      if (!walletInstance.publicKey) {
        console.log('[useSolanaSwap] Wallet not connected, connecting...');
        try {
          await walletInstance.connect();
          console.log('[useSolanaSwap] Wallet connected, publicKey:', walletInstance.publicKey?.toString());
        } catch (connectError) {
          console.error('[useSolanaSwap] Failed to connect wallet:', connectError);
          throw new Error('Failed to connect wallet. Please try connecting your wallet first.');
        }
      }

      // Check if wallet has sendTransaction method
      if (typeof walletInstance.signAndSendTransaction !== 'function') {
        throw new Error('Wallet does not support sending transactions');
      }

      console.log('[useSolanaSwap] Executing swap transaction...');

      const result = await executeSolanaSwap(
        state.quote,
        async (transaction: VersionedTransaction) => {
          {
            // Use signTransaction + sendRawTransaction for better compatibility
            console.log('[useSolanaSwap] Signing transaction...');
            console.log('[useSolanaSwap] Transaction:', transaction);
            console.log('[useSolanaSwap] Transaction version:', transaction.version);

            try {
              // Check if wallet supports signTransaction
              if (typeof walletInstance.signTransaction !== 'function') {
                throw new Error('Wallet does not support transaction signing. Please try a different wallet like Phantom or Solflare.');
              }

              // Sign the transaction (this will prompt user for approval)
              console.log('[useSolanaSwap] Calling signTransaction...');
              const signedTx = await walletInstance.signTransaction(transaction);
              console.log('[useSolanaSwap] Transaction signed successfully');

              // Send the signed transaction using Solana RPC
              const { Connection } = await import('@solana/web3.js');
              // Use Alchemy Solana API for better reliability
              // Use Alchemy Solana API for better reliability or fallback to public RPC
              const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
              const rpcUrl = `${API_BASE_URL}/api/rpc/solana`;

              const connection = new Connection(rpcUrl, 'confirmed');

              const signature = await connection.sendRawTransaction(signedTx.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3,
              });

              console.log('[useSolanaSwap] Transaction sent, signature:', signature);

              // Wait for confirmation using polling (Alchemy HTTP doesn't support WebSocket subscriptions)
              console.log('[useSolanaSwap] Waiting for confirmation...');
              let confirmed = false;
              for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                const status = await connection.getSignatureStatus(signature);
                if (status?.value?.confirmationStatus === 'confirmed' ||
                  status?.value?.confirmationStatus === 'finalized') {
                  confirmed = true;
                  console.log('[useSolanaSwap] Transaction confirmed');
                  break;
                }
              }

              if (!confirmed) {
                console.warn('[useSolanaSwap] Transaction confirmation timeout, but transaction was sent');
              }

              return signature;
            } catch (txError: any) {
              console.error('[useSolanaSwap] Transaction error:', txError);

              // Check if it's a VersionedTransaction compatibility issue
              if (txError.message?.includes('Unexpected error') || txError.message?.includes('Unknown')) {
                throw new Error(
                  'Your wallet may not support this type of Solana transaction. ' +
                  'Please try using Phantom or Solflare wallet instead. ' +
                  'OKX Wallet has known compatibility issues with Solana swaps.'
                );
              }

              throw txError;
            }
          }
        },
        activeWallet.address // Pass user address
      );

      if (result.success) {
        setState(prev => ({
          ...prev,
          isExecuting: false,
          error: null,
          amountIn: '',
          amountOut: '',
          quote: null,
        }));
        return { success: true, txHash: result.txHash };
      } else {
        console.error('[useSolanaSwap] Swap failed:', result.error);
        setState(prev => ({
          ...prev,
          isExecuting: false,
          error: result.error || 'Transaction failed',
        }));
        return { success: false, error: result.error || 'Transaction failed' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction failed';
      console.error('[useSolanaSwap] Error executing swap:', error);
      setState(prev => ({
        ...prev,
        isExecuting: false,
        error: message,
      }));
      return { success: false, error: message };
    }
  }, [state.quote, state.tokenIn, state.tokenOut, activeWallet]);

  // Get available tokens for Solana
  const getAvailableTokens = useCallback((): Token[] => {
    return getCommonTokens(SOLANA_CHAIN_ID);
  }, []);

  // Get display info for UI rendering
  const getDisplayInfo = useCallback(() => {
    // Ensure we have valid token symbols
    const tokenInSymbol = (state.tokenIn?.symbol && state.tokenIn.symbol !== 'UNKNOWN')
      ? state.tokenIn.symbol
      : 'Select';
    const tokenOutSymbol = (state.tokenOut?.symbol && state.tokenOut.symbol !== 'UNKNOWN')
      ? state.tokenOut.symbol
      : 'Select';

    // Calculate USD values (simplified for Solana - can be enhanced with price API)

    // For Solana, we don't have price data yet, so set to 0
    // TODO: Add price fetching for Solana tokens
    const amountInUSD = '0.00';
    const amountOutUSD = '0.00';

    // Get user balance based on tokenIn
    let userBalance = '0';
    if (state.tokenIn) {
      if (state.tokenIn.symbol === 'SOL' || state.tokenIn.address === 'So11111111111111111111111111111111111111112') {
        userBalance = solanaBalance;
      } else {
        // For SPL tokens, use the token balance from tokenBalances
        userBalance = tokenBalances[state.tokenIn.address] || '0';
      }
    }

    // Check if user has enough balance
    // CRITICAL: For native SOL, we must reserve transaction fees
    const amountInNum = parseFloat(state.amountIn || '0');
    const balanceNum = parseFloat(userBalance);

    const isNativeSOL = state.tokenIn?.symbol === 'SOL' ||
      state.tokenIn?.address === 'So11111111111111111111111111111111111111112';

    let hasEnoughBalance = false;
    if (isNativeSOL) {
      // For SOL, reserve 0.01 SOL for transaction fees (conservative)
      // Actual fees are ~0.000005 SOL, but we reserve more for safety
      const gasBuffer = 0.01;
      hasEnoughBalance = balanceNum >= (amountInNum + gasBuffer);
    } else {
      // For SPL tokens, no gas buffer needed (gas paid in SOL)
      hasEnoughBalance = balanceNum >= amountInNum;
    }

    // Solana transaction fees are very low (~0.000005 SOL)
    const gasEstimate = state.quote?.gasEstimate || 0.000005;
    const gasCostUSD = '0.00'; // Very low, can be ignored

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
      isApproved: true, // Solana doesn't need approval
      priceImpact: state.priceImpact || 0,
      gasEstimate,
      gasCostUSD,
      minAmountOut: state.quote?.amountOut || '0',
      dexName: state.quote?.dex || state.quote?.router || 'N/A',
      userBalance,
      hasEnoughBalance,
      availableQuotes: state.quote ? [state.quote as any] : [],
      selectedDex: state.quote?.dex || state.quote?.router,
    };
  }, [state, solanaBalance, tokenBalances]);

  return {
    state,
    displayInfo: getDisplayInfo(),
    setTokenIn,
    setTokenOut,
    setAmountIn,
    swapTokens,
    executeSwap,
    getAvailableTokens,
    isWalletConnected: !!activeWallet,
    walletAddress: activeWallet?.address,
    selectQuote: (_dex: string) => { /* no-op for Solana for now */ },
  };
}

