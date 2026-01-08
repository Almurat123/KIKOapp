import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Shield,
  Send,
  ArrowDownLeft,
  ArrowRightLeft,
  ExternalLink
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useBalance, useDisconnect, useChainId } from 'wagmi';
import { useChain } from '../contexts/ChainContext';
import { ChainSwitcher } from '../components/Chain/ChainSwitcher';
import { formatUnits, getAddress } from 'viem';
import type { Address } from 'viem';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { getWalletBalance, getWalletTransactions, type WalletTransaction } from '../services/walletApi';
import { WalletSettingsModal } from '../components/Wallet/WalletSettingsModal';
import { ReceiveModal } from '../components/Wallet/ReceiveModal';
import { SendModal } from '../components/Wallet/SendModal';
import { SwapCardIntegrated } from '../components/Swap/SwapCardIntegrated';
import { createPortal } from 'react-dom';
import { Settings } from 'lucide-react';
import { getTokensData } from '../services/tokenDataService';
import { Skeleton } from '../components/Skeleton';
import styles from './WalletPage.module.css';

// Common token addresses for different chains (Mock data for demo)


interface TokenHolding {
  address: Address;
  symbol: string;
  name: string;
  balance: string;
  value: string;
  change: string;
  decimals: number;
  logo?: string;
  usdValueNum?: number; // numeric USD value for sorting/filtering; undefined means unknown price
  isNative?: boolean;
}

// Fallback logo from TrustWallet assets if API did not return one
const getTokenLogoUrl = (address?: string, chainId?: number): string | undefined => {
  if (!address || !chainId) return undefined;

  // Handle Native Tokens
  // For Solana, both So11111111111111111111111111111111111111111 and So11111111111111111111111111111111111111112 represent native SOL
  // We normalize to So11111111111111111111111111111111111111112 (Wrapped SOL address) for consistency
  const isNative = address === '0x0000000000000000000000000000000000000000' ||
    address === 'So11111111111111111111111111111111111111111' ||
    address === 'So11111111111111111111111111111111111111112';

  const chainMap: Record<number, string> = {
    1: 'ethereum',
    56: 'smartchain',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base',
    900: 'solana'
  };

  const twChain = chainMap[chainId];
  if (!twChain) return undefined;

  let checksum = address;

  // NATIVE TOKEN LOGOS
  if (isNative) {
    if (chainId === 900) return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png';
    if (chainId === 1) return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png';
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${twChain}/info/logo.png`;
  }

  // Checksum address for EVM chains
  if (chainId !== 900) {
    try {
      checksum = getAddress(address);
    } catch (e) {
      // If native address or invalid, keep as is
    }
  }

  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${twChain}/assets/${checksum}/logo.png`;
};

// Component to handle image loading errors
const TokenIcon = ({ src, alt, symbol, className, fallbackClassName }: { src?: string, alt: string, symbol: string, className: string, fallbackClassName: string }) => {
  const [error, setError] = useState(false);

  // Reset error when src changes
  useEffect(() => {
    setError(false);
  }, [src]);

  if (!src || error) {
    return <div className={fallbackClassName}>{symbol?.[0] || '?'}</div>;
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={() => setError(true)}
    />
  );
};

export default function WalletPage() {
  const { authenticated, ready, logout, user, getAccessToken } = usePrivy();
  const { address: evmAddress } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { currentChain } = useChain();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isSwapOpen, setIsSwapOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenHolding | null>(null);

  // Unified disconnect: logout Privy session AND disconnect Wagmi
  const handleDisconnect = async () => {
    try {
      // Logout Privy first (this is the main session)
      await logout();
    } catch (error) {
      console.error('Privy logout failed:', error);
    }

    try {
      // Then disconnect Wagmi (cleans up EVM connection state)
      wagmiDisconnect();
    } catch (error) {
      console.error('Wagmi disconnect failed:', error);
    }
  };
  const chainId = currentChain.id;
  const isSolana = chainId === 900;

  // Resolve correct wallet address based on chain
  // Prioritize embedded Privy wallets for Solana
  const solanaWallet = useMemo(() => {
    return user?.linkedAccounts?.find(
      (account): account is WalletWithMetadata =>
        account.type === 'wallet' &&
        account.walletClientType === 'privy' &&
        account.chainType === 'solana'
    );
  }, [user]);

  const walletAddress = isSolana ? solanaWallet?.address : evmAddress;
  const isConnected = authenticated; // Trust session once authenticated

  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [cachedHoldings, setCachedHoldings] = useState<TokenHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [solanaBalance, setSolanaBalance] = useState<bigint>(BigInt(0));
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [cachedTransactions, setCachedTransactions] = useState<WalletTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  // New state for Assets/Orders Toggle
  const [viewMode, setViewMode] = useState<'assets' | 'orders'>('assets');
  const [orders, setOrders] = useState<any[]>([]); // These are actually POSITIONS
  const [pendingOrders, setPendingOrders] = useState<any[]>([]); // These are open limit orders
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const balanceReqId = useRef(0);
  const txReqId = useRef(0);
  const ordersReqId = useRef(0);

  // Fetch Polymarket Orders
  useEffect(() => {
    if (viewMode !== 'orders' || !authenticated) return;

    let cancelled = false;
    const reqId = ++ordersReqId.current;

    const fetchOrdersAndHistory = async () => {
      setOrdersLoading(true);
      setOrderHistoryLoading(true);
      try {
        const token = await getAccessToken();
        if (!token) {
          console.warn('No access token available');
          return;
        }

        const headers = { 'Authorization': `Bearer ${token}` };
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

        // 1. Fetch Positions
        console.log(`[WalletPage] Fetching positions from ${apiUrl}/api/polymarket/trading/positions`);
        const posResponse = await fetch(`${apiUrl}/api/polymarket/trading/positions`, { headers });
        console.log(`[WalletPage] Positions status: ${posResponse.status}`);
        if (posResponse.ok) {
          const res = await posResponse.json();
          if (res.success && !cancelled && reqId === ordersReqId.current) {
            setOrders(res.data);
          }
        } else {
          const errText = await posResponse.text();
          console.error(`[WalletPage] Positions fetch failed: ${posResponse.status}`, errText);
        }

        // 2. Fetch Pending Orders
        console.log(`[WalletPage] Fetching pending orders from ${apiUrl}/api/polymarket/trading/orders`);
        const pendingResponse = await fetch(`${apiUrl}/api/polymarket/trading/orders`, { headers });
        console.log(`[WalletPage] Pending orders status: ${pendingResponse.status}`);
        if (pendingResponse.ok) {
          const res = await pendingResponse.json();
          if (res.success && !cancelled && reqId === ordersReqId.current) {
            setPendingOrders(res.data);
          }
        } else {
          const errText = await pendingResponse.text();
          console.error(`[WalletPage] Pending orders fetch failed: ${pendingResponse.status}`, errText);
        }

        // 3. Fetch History
        console.log(`[WalletPage] Fetching history from ${apiUrl}/api/polymarket/trading/history`);
        const histResponse = await fetch(`${apiUrl}/api/polymarket/trading/history`, { headers });
        console.log(`[WalletPage] History status: ${histResponse.status}`);
        if (histResponse.ok) {
          const res = await histResponse.json();
          if (res.success && !cancelled && reqId === ordersReqId.current) {
            setOrderHistory(res.data);
          }
        } else {
          const errText = await histResponse.text();
          console.error(`[WalletPage] History fetch failed: ${histResponse.status}`, errText);
        }

      } catch (err) {
        console.error('Failed to fetch Polymarket data', err);
      } finally {
        if (reqId === ordersReqId.current) {
          setOrdersLoading(false);
          setOrderHistoryLoading(false);
        }
      }
    };

    fetchOrdersAndHistory();

    return () => { cancelled = true; };
  }, [viewMode, authenticated, getAccessToken]);

  const handleCancelOrder = async (orderId: string) => {
    try {
      const token = await getAccessToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/polymarket/trading/order/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId })
      });
      const res = await response.json();
      if (res.success) {
        // Refresh orders
        setPendingOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        alert(`Failed to cancel: ${res.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Cancel failed', e);
    }
  };

  const handleClosePosition = async (order: any) => {
    try {
      if (!confirm(`Are you sure you want to sell your ${order.size} shares of "${order.title}"?`)) return;

      const token = await getAccessToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/polymarket/trading/position/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          positionId: order.assetId,
          currentPrice: order.currentPrice,
          shares: order.size
        })
      });
      const res = await response.json();
      if (res.success) {
        alert('Position close order submitted successfully!');
        // Refresh positions
        setOrders(prev => prev.filter(o => o.assetId !== order.assetId));
      } else {
        alert(`Failed to close position: ${res.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Close position failed', e);
    }
  };


  // During loading, show empty to trigger skeleton; otherwise show holdings or cached
  const displayHoldings = loading ? [] : (holdings.length ? holdings : cachedHoldings);
  const displayTransactions = useMemo(() => {
    if (transactionsLoading) return [];
    if (Array.isArray(transactions) && transactions.length > 0) return transactions;
    if (Array.isArray(cachedTransactions)) return cachedTransactions;
    return [];
  }, [transactionsLoading, transactions, cachedTransactions]);



  // Reset state immediately when chain changes to prevent stale data
  useEffect(() => {
    console.log('[WalletPage] Chain changed to', chainId, '- resetting state');
    setHoldings([]);
    setCachedHoldings([]);
    setTransactions([]);
    setCachedTransactions([]);
    setLoading(true);
    setTransactionsLoading(true);
    setError(null);
  }, [chainId]);

  // Fetch Solana balance when on Solana and connected
  useEffect(() => {
    if (!isSolana || !solanaWallet?.address) {
      setSolanaBalance(BigInt(0));
      return;
    }

    const fetchSolBalance = async () => {
      try {
        // Import dynamically to avoid issues if not Solana
        const { Connection, PublicKey } = await import('@solana/web3.js');

        // Try multiple RPCs (free public nodes with CORS support)
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const endpoints = [
          `${API_BASE_URL}/api/rpc/solana`,                 // Backend Solana Proxy
          'https://solana-rpc.publicnode.com',              // PublicNode fallback
          'https://solana.drpc.org',                        // DRPC fallback
        ].filter(Boolean) as string[];

        let balance = 0;
        let success = false;

        for (const endpoint of endpoints) {
          try {
            const connection = new Connection(endpoint, 'confirmed');
            const pubKey = new PublicKey(solanaWallet.address);
            balance = await connection.getBalance(pubKey);
            success = true;
            break; // Exit loop on success
          } catch (e) {
            console.warn(`[WalletPage] RPC failed: ${endpoint}`, e);
          }
        }

        if (!success) throw new Error('All RPC endpoints failed');

        setSolanaBalance(BigInt(balance));
      } catch (error) {
        console.error('Failed to fetch Solana balance:', error);
        setSolanaBalance(BigInt(0));
      }
    };

    fetchSolBalance();
  }, [isSolana, solanaWallet?.address]);

  // Get native EVM balance (skip in test mode or if Solana)
  // Use Wagmi's useChainId for the actual connected chain, not our custom context
  const wagmiChainId = useChainId();
  const { data: ethBalance } = useBalance({
    address: (isSolana ? undefined : walletAddress) as Address | undefined,
    chainId: isSolana ? undefined : wagmiChainId,  // Use actual Wagmi chainId
    query: {
      enabled: !isSolana && !!walletAddress,
    },
  });

  // Unified Native Balance object for component consistency
  const nativeBalance = useMemo(() => {
    if (isSolana && isConnected) {
      return {
        symbol: 'SOL',
        decimals: 9,
        value: solanaBalance,
        formatted: (Number(solanaBalance) / 1e9).toFixed(4)
      };
    }
    return ethBalance;
  }, [ethBalance, isSolana, isConnected, solanaBalance]);

  // Ref to store latest nativeBalance without triggering re-fetches
  const nativeBalanceRef = useRef(nativeBalance);

  // Keep nativeBalance ref in sync
  useEffect(() => {
    nativeBalanceRef.current = nativeBalance;
  }, [nativeBalance]);

  // Chain name mapping for API calls
  const getChainName = (id: number): string => {
    const chainMap: Record<number, string> = {
      1: 'eth',
      8453: 'base',
      42161: 'arbitrum',
      10: 'optimism',
      137: 'polygon',
      56: 'bsc',
      900: 'solana',
    };
    return chainMap[id] || 'eth';
  };

  // Fetch token balances and build holdings
  useEffect(() => {
    console.log('[WalletPage] Balance useEffect triggered:', {
      ready,
      authenticated,
      isConnected,
      walletAddress,
      chainId,
      isSolana,
    });

    if (!ready) {
      setLoading(true);
      return;
    }

    if (!authenticated || !isConnected || !walletAddress) {
      console.log('[WalletPage] Early exit - missing auth/connection/wallet:', {
        authenticated,
        isConnected,
        walletAddress,
        chainId,
        isSolana,
      });
      setHoldings([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const reqId = ++balanceReqId.current;

    const fetchBalances = async () => {
      // Don't reset state here - handled by chain change effect
      // setLoading(true) is redundant if chain changed, but harmless if just refetching
      setLoading(true);
      setError(null);

      try {
        const chainName = getChainName(chainId);
        console.log('[WalletPage] Fetching balances for chain:', chainName, 'chainId:', chainId, 'walletAddress:', walletAddress);

        if (!walletAddress) {
          console.warn('[WalletPage] No wallet address available, skipping balance fetch');
          if (!cancelled) {
            setHoldings([]);
            setLoading(false);
          }
          return;
        }

        const balanceData = await getWalletBalance(walletAddress, chainName);
        console.log('[WalletPage] Balance API response:', balanceData ? 'Success' : 'Null/Empty');

        // Note: We DON'T early-exit here to allow processing to complete even for slightly stale requests
        // The final state update check (reqId === balanceReqId.current) ensures only the latest data is applied

        if (!balanceData) {
          console.warn('[WalletPage] No balance data returned from API');
          if (!cancelled) {
            setHoldings([]);
            setLoading(false);
            setError('Failed to fetch balance data. Please check your wallet connection and try again.');
          }
          return;
        }

        const tokenHoldings: TokenHolding[] = [];
        const minUsd = 1; // hide tiny dust positions

        // Add native token
        // Always use backend ethBalance as primary source (more reliable)
        // Only use wagmi nativeBalance if backend data is missing
        const currentNativeBalance = nativeBalanceRef.current;
        console.log('[WalletPage] Balance data:', {
          ethBalance: balanceData.ethBalance,
          ethBalanceFormatted: balanceData.ethBalanceFormatted,
          tokensCount: balanceData.tokens?.length || 0,
          tokens: balanceData.tokens, // Log full tokens array for debugging
          nativeBalance: currentNativeBalance ? {
            value: currentNativeBalance.value?.toString(),
            symbol: currentNativeBalance.symbol,
            decimals: currentNativeBalance.decimals,
          } : null,
        });

        // Build backend native balance from API response
        const backendNative = (() => {
          // backend provides ethBalance (hex) and ethBalanceFormatted (number)
          if (!balanceData.ethBalance && balanceData.ethBalanceFormatted === undefined) return null;
          try {
            if (isSolana) {
              const lamports = balanceData.ethBalance
                ? BigInt(balanceData.ethBalance)
                : BigInt(Math.floor((balanceData.ethBalanceFormatted || 0) * 1e9));
              return {
                value: lamports,
                decimals: 9,
                symbol: 'SOL',
              };
            }
            const wei = balanceData.ethBalance
              ? BigInt(balanceData.ethBalance)
              : BigInt(Math.floor((balanceData.ethBalanceFormatted || 0) * 1e18));
            return {
              value: wei,
              decimals: 18,
              symbol: 'ETH',
            };
          } catch (e) {
            console.error('[WalletPage] Error parsing backend native balance:', e);
            return null;
          }
        })();

        // Use backend native balance if available, otherwise fallback to wagmi
        // Backend data is more reliable and always available when API succeeds
        // Use backend native balance if available, otherwise fallback to wagmi
        const effectiveNative = backendNative || currentNativeBalance;

        // Helper: Is this a native token in the token list? (e.g. 0xeeee... or matching symbol)
        const isNativeTokenEntry = (t: any) => {
          if (isSolana && t.symbol === 'SOL') return true;
          if (!isSolana && t.symbol === 'ETH') return true;
          if (!isSolana && t.symbol === 'BNB') return true; // generic check
          return false;
        };

        // Chain-specific native token fallback prices (updated Dec 2024)
        const NATIVE_PRICE_FALLBACKS: Record<number, number> = {
          1: 3300,      // ETH
          8453: 3300,   // ETH on Base
          10: 3300,     // ETH on Optimism
          42161: 3300,  // ETH on Arbitrum
          56: 700,      // BNB
          137: 0.5,     // MATIC
          43114: 35,    // AVAX
          250: 0.5,     // FTM
          900: 200,     // SOL
        };
        let nativePrice = NATIVE_PRICE_FALLBACKS[chainId] || (isSolana ? 200 : 3300);
        let nativeLogo = undefined;

        // Wrapped native token addresses per chain for price lookup
        const WRAPPED_NATIVE_ADDRESSES: Record<number, string> = {
          1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',     // WETH
          8453: '0x4200000000000000000000000000000000000006',   // WETH on Base
          10: '0x4200000000000000000000000000000000000006',     // WETH on Optimism
          42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
          56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',    // WBNB
          137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',   // WMATIC
          900: 'So11111111111111111111111111111111111111112',  // WSOL
        };
        const wrappedNativeAddress = WRAPPED_NATIVE_ADDRESSES[chainId];

        if (balanceData.tokens) {
          const nativeInTokens = balanceData.tokens.find((t: any) => isNativeTokenEntry(t));
          if (nativeInTokens) {
            // Will be processed after token meta fetch
          }
        }

        // Collect all token addresses for metadata fetch
        let tokenMetaMap: Record<string, { price?: number; logo?: string }> = {};
        if (balanceData.tokens && balanceData.tokens.length > 0) {
          const addresses = balanceData.tokens
            .filter((t: any) => t.contractAddress)
            .map((t: any) => t.contractAddress!);

          // Include wrapped native token for dynamic price lookup
          if (wrappedNativeAddress && !addresses.includes(wrappedNativeAddress)) {
            addresses.push(wrappedNativeAddress);
          }

          // Pre-fetch logic - getTokensData already uses Promise.allSettled internally
          try {
            const metaList = await getTokensData(addresses, chainId);


            // Note: Don't early-exit here; final state update check handles staleness
            tokenMetaMap = metaList.reduce((acc, m) => {
              if (m && m.address) {
                acc[m.address.toLowerCase()] = {
                  price: m.price,
                  logo: m.logoURI,
                };
              }
              return acc;
            }, {} as Record<string, { price?: number; logo?: string }>);

            // Try to get native price from wrapped native token
            if (wrappedNativeAddress) {
              const nativeMeta = tokenMetaMap[wrappedNativeAddress.toLowerCase()];
              if (nativeMeta && nativeMeta.price && nativeMeta.price > 0) {
                nativePrice = nativeMeta.price;
                nativeLogo = nativeMeta.logo;
                console.log(`[WalletPage] Got dynamic native price for chain ${chainId}: $${nativePrice}`);
              }
            }
          } catch (e) {
            console.warn('[WalletPage] token meta fetch failed (non-critical, continuing anyway):', e);
            // Continue anyway - we'll show tokens without prices
          }
        } else if (wrappedNativeAddress) {
          // No tokens but still try to fetch native price
          try {
            const [nativeMeta] = await getTokensData([wrappedNativeAddress], chainId);
            if (nativeMeta && nativeMeta.price && nativeMeta.price > 0) {
              nativePrice = nativeMeta.price;
              nativeLogo = nativeMeta.logoURI;
              console.log(`[WalletPage] Got dynamic native price for chain ${chainId}: $${nativePrice}`);
            }
          } catch (e) {
            console.warn('[WalletPage] native price fetch failed:', e);
          }
        }

        // Now refine Native Price using the fetched map if we can find a matching entry
        // Usually native tokens in lists have specific addresses like 0xeeee... or So111...
        // If not, we rely on the symbol check.
        if (balanceData.tokens) {
          const nativeInTokens = balanceData.tokens.find((t: any) => isNativeTokenEntry(t));
          if (nativeInTokens && nativeInTokens.contractAddress) {
            const meta = tokenMetaMap[nativeInTokens.contractAddress.toLowerCase()];
            if (meta && meta.price) {
              nativePrice = meta.price;
              nativeLogo = meta.logo;
            }
          }
        }

        if (effectiveNative) {
          let balanceValue: string;
          let usdValue: number;

          if (isSolana) {
            const solBalanceNum = Number(effectiveNative.value) / 1e9;
            balanceValue = solBalanceNum.toFixed(4);
            usdValue = solBalanceNum * nativePrice;

            tokenHoldings.push({
              address: 'So11111111111111111111111111111111111111112' as Address, // Use Wrapped SOL address for consistency
              symbol: 'SOL',
              name: 'Solana',
              decimals: 9,
              balance: balanceValue,
              value: '$' + usdValue.toFixed(2),
              usdValueNum: usdValue,
              change: '+0.00%',
              isNative: true,
              logo: nativeLogo || getTokenLogoUrl('So11111111111111111111111111111111111111112', 900) || 'https://assets.coingecko.com/coins/images/4128/large/solana.png'
            });
          } else {
            balanceValue = formatUnits(effectiveNative.value, effectiveNative.decimals);
            usdValue = parseFloat(balanceValue) * nativePrice;

            // Chain-specific native token names
            const NATIVE_NAMES: Record<number, string> = {
              1: 'Ether',
              8453: 'Ether',
              10: 'Ether',
              42161: 'Ether',
              56: 'BNB',
              137: 'MATIC',
              43114: 'AVAX',
              250: 'FTM',
            };

            tokenHoldings.push({
              address: '0x0000000000000000000000000000000000000000' as Address,
              symbol: effectiveNative.symbol,
              name: NATIVE_NAMES[chainId] || effectiveNative.symbol,
              decimals: effectiveNative.decimals,
              balance: balanceValue,
              value: '$' + usdValue.toFixed(2),
              usdValueNum: usdValue,
              change: '+0.00%',
              isNative: true,
              logo: nativeLogo
            });
          }
        }

        // Add token balances from API
        if (balanceData.tokens && balanceData.tokens.length > 0) {
          // Meta map already fetched above

          balanceData.tokens.forEach((token: any) => {
            if (!token.contractAddress) return;

            // DEDUPLICATION: Skip if this token is actually the native token we already added
            if (isNativeTokenEntry(token)) {
              console.log('[WalletPage] Skipping duplicate native token from list:', token.symbol);
              return;
            }

            const balance = parseFloat(token.tokenBalance || '0');

            if (balance > 0) {
              const meta = tokenMetaMap[token.contractAddress.toLowerCase()] || {};
              let price = meta.price;

              // Fallback: For common stablecoins, use default price of $1 if API failed
              // This ensures legitimate tokens are not filtered out due to API issues
              if (!price) {
                const symbol = (token.symbol || '').toUpperCase();
                const isStablecoin = ['USDC', 'USDT', 'DAI', 'BUSD', 'FRAX', 'USDP', 'TUSD'].includes(symbol);
                if (isStablecoin) {
                  price = 1.0; // Default stablecoin price
                  console.log(`[WalletPage] Using fallback price $1.00 for stablecoin: ${symbol}`);
                }
              }

              const usdValue = price ? balance * price : undefined;

              tokenHoldings.push({
                address: token.contractAddress as Address,
                symbol: token.symbol || 'UNK',
                // ... rest of logic
                name: token.name || 'Unknown Token',
                decimals: token.decimals || 18,
                balance: balance.toFixed(6),
                value: usdValue !== undefined ? '$' + usdValue.toFixed(2) : '—',
                usdValueNum: usdValue,
                change: '+0.00%',
                logo: token.logo || meta.logo || getTokenLogoUrl(token.contractAddress, chainId),
              });
            }
          });
        }

        console.log('[WalletPage] Total token holdings after processing:', tokenHoldings.length);

        // Filter out dust < $1 and unknown price tokens (potential spam/scam)
        // This protects users from seeing scam tokens that have no legitimate price data
        const filtered = tokenHoldings.filter((h: any) => {
          if (h.isNative) return true;
          // Filter out unknown prices to hide scams/spam
          if (h.usdValueNum === undefined) return false;
          return h.usdValueNum >= minUsd;
        });

        // Sort by value desc (unknown price at bottom)
        filtered.sort((a: any, b: any) => {
          const va = a.usdValueNum;
          const vb = b.usdValueNum;
          if (va === undefined && vb === undefined) return 0;
          if (va === undefined) return 1;
          if (vb === undefined) return -1;
          return vb - va;
        });

        // Absolute fallback: ensure native shows even if filtered empty but backend had balance
        if (!filtered.length && (balanceData.ethBalance || balanceData.ethBalanceFormatted !== undefined)) {
          try {
            const isSol = isSolana;
            const decimals = isSol ? 9 : 18;
            const raw = balanceData.ethBalance
              ? BigInt(balanceData.ethBalance)
              : BigInt(Math.floor((balanceData.ethBalanceFormatted || 0) * (isSol ? 1e9 : 1e18)));
            const formatted = isSol
              ? Number(raw) / 1e9
              : Number(raw) / 1e18;
            const usdEstimate = isSol ? formatted * 150 : formatted * 2000;
            filtered.push({
              address: isSol
                ? ('So11111111111111111111111111111111111111112' as Address) // Use Wrapped SOL address for consistency
                : ('0x0000000000000000000000000000000000000000' as Address),
              symbol: isSol ? 'SOL' : 'ETH',
              name: isSol ? 'Solana' : 'ETH',
              decimals,
              balance: formatted.toFixed(6),
              value: `$${usdEstimate.toFixed(2)}`,
              usdValueNum: usdEstimate,
              change: '+0.00%',
              isNative: true,
            });
            console.log('[WalletPage] Added fallback native asset:', {
              symbol: isSol ? 'SOL' : 'ETH',
              balance: formatted.toFixed(6),
              usdValue: usdEstimate,
            });
          } catch (e) {
            console.error('[WalletPage] Fallback native asset error:', e);
          }
        }

        console.log('[WalletPage] Final holdings:', {
          count: filtered.length,
          holdings: filtered.map(h => ({
            symbol: h.symbol,
            balance: h.balance,
            value: h.value,
            isNative: h.isNative,
          })),
          reqId,
          currentReqId: balanceReqId.current,
          cancelled,
        });

        // Update state if this is the latest request, even if cancelled flag is set
        // The cancelled flag is set when useEffect cleanup runs, but if this request
        // is still the latest one, we should update the state
        if (reqId === balanceReqId.current) {
          setHoldings(filtered);
          setCachedHoldings(filtered);
          console.log('[WalletPage] Holdings updated, count:', filtered.length);
        } else {
          console.warn('[WalletPage] Request stale (newer request exists), ignoring update', {
            cancelled,
            reqId,
            currentReqId: balanceReqId.current,
          });
        }
      } catch (err) {
        console.error('[WalletPage] Error fetching balances:', err);
        // Only set error if this is still the latest request
        if (reqId === balanceReqId.current) {
          setError('Failed to load token balances. Please try again.');
          // Don't clear holdings on error - keep cached data
        }
      } finally {
        // Only update loading state if this is still the latest request
        if (reqId === balanceReqId.current) {
          setLoading(false);
        }
      }
    };

    fetchBalances();
    return () => {
      cancelled = true;
    };
    // Note: nativeBalance is NOT in deps - we use it inside the effect but don't want to refetch when it changes
    // We only refetch when chain/wallet/connection state changes
    // IMPORTANT: chainId is in deps to trigger refetch when network switches
  }, [ready, authenticated, isConnected, walletAddress, chainId, isSolana]);

  // Fetch transaction history
  useEffect(() => {
    if (!ready) {
      setTransactionsLoading(true);
      return;
    }

    if (!authenticated || !isConnected || !walletAddress) {
      setTransactions([]);
      setTransactionsLoading(false);
      return;
    }

    let cancelled = false;
    const reqId = ++txReqId.current;

    const fetchTransactions = async () => {
      setTransactionsLoading(true);
      try {
        const chainName = getChainName(chainId);
        console.log('[WalletPage] Fetching transactions:', { walletAddress, chainName, reqId });
        const txData = await getWalletTransactions(walletAddress, {
          chain: chainName,
          limit: 25,
        });
        console.log('[WalletPage] Transactions received:', {
          count: txData?.length || 0,
          reqId,
          currentReqId: txReqId.current,
          cancelled,
          sample: txData?.[0],
        });

        // Update state if this is the latest request, even if cancelled flag is set
        if (reqId === txReqId.current) {
          setTransactions(txData || []);
          setCachedTransactions(txData || []);
          console.log('[WalletPage] Transactions updated, count:', txData?.length || 0);
        } else {
          console.warn('[WalletPage] Transaction request stale (newer request exists), ignoring update', {
            cancelled,
            reqId,
            currentReqId: txReqId.current,
          });
        }
      } catch (err) {
        console.error('[WalletPage] Error fetching transactions:', err);
        // Only set error if this is still the latest request
        if (reqId === txReqId.current) {
          // Don't clear transactions on error - keep cached data
          setTransactionsLoading(false);
        }
      } finally {
        // Only update loading state if this is still the latest request
        if (reqId === txReqId.current) {
          setTransactionsLoading(false);
        }
      }
    };

    fetchTransactions();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, isConnected, walletAddress, chainId]);

  // Calculate total balance and PnL
  const portfolioStats = useMemo(() => {
    const list = displayHoldings;
    if (!list.length) return {
      totalValue: '$0.00',
      pnlValue: '+$0.00',
      pnlPercent: '0.00%',
      isPositive: true
    };

    let totalVal = 0;
    list.forEach(h => {
      const val = h.usdValueNum ?? parseFloat(h.value.replace('$', '').replace(',', '') || '0');
      totalVal += val;
    });

    return {
      totalValue: `$${totalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      pnlValue: '+$0.00',
      pnlPercent: '0.00%',
      isPositive: true
    };
  }, [displayHoldings]);

  // Skip wallet check if in test mode
  if (!authenticated) {
    return (
      <div className={styles.connectWalletContainer}>
        <div className={styles.connectWalletCard}>
          <Shield size={32} strokeWidth={2} className={styles.connectWalletIcon} />
          <h2 className={styles.connectWalletTitle}>
            Connect Wallet
          </h2>
          <p className={styles.connectWalletText}>
            Connect your wallet to view your portfolio and manage your assets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>

        {/* Header */}
        <div className={styles.headerSection}>
          <div className={styles.headerLeft}>
            <div className={styles.portfolioLabel}>Total Balance</div>
            {loading ? (
              <Skeleton variant="text" width={150} height={32} />
            ) : (
              <div className={styles.portfolioValue}>{portfolioStats.totalValue}</div>
            )}

          </div>
          <div className={styles.headerActions}>
            <ChainSwitcher />
            <button
              className={styles.settingsButton}
              onClick={() => setIsSettingsOpen(true)}
              title="Wallet Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Portfolio Header Section */}
        <div className={styles.portfolioHeader}>



          {/* Right: Network Card */}
          {/* Right Group: Network + Account Controls */}
          <div className={styles.actionsRow}>
            <button
              className={`${styles.actionButton} ${styles.actionBtnSecondary}`}
              onClick={() => {
                // Open send modal with native token by default
                const nativeToken = displayHoldings.find(h => h.isNative);
                setSelectedToken(nativeToken || null);
                setIsSendOpen(true);
              }}
              disabled={!isConnected || !walletAddress}
            >
              <Send size={18} />
              Send
            </button>
            <button
              className={`${styles.actionButton} ${styles.actionBtnSecondary}`}
              onClick={() => {
                if (!isConnected || !walletAddress) {
                  // Show error or prompt to connect wallet
                  setError('Please connect your wallet first');
                  return;
                }
                setIsReceiveOpen(true);
              }}
              disabled={!isConnected || !walletAddress}
            >
              <ArrowDownLeft size={18} />
              Receive
            </button>
            <button
              className={`${styles.actionButton} ${styles.actionBtnPrimary}`}
              onClick={() => setIsSwapOpen(true)}
              disabled={!isConnected || !walletAddress}
            >
              <ArrowRightLeft size={18} />
              Swap
            </button>
          </div>



        </div>

        {/* Assets/Orders Section */}
        <div className={styles.assetsSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.toggleContainer}>
              <button
                className={`${styles.toggleButton} ${viewMode === 'assets' ? styles.active : ''}`}
                onClick={() => setViewMode('assets')}
              >
                Assets
              </button>
              <button
                className={`${styles.toggleButton} ${viewMode === 'orders' ? styles.active : ''}`}
                onClick={() => setViewMode('orders')}
              >
                Orders
              </button>
            </div>
            <div className={styles.assetsActions}>
              {viewMode === 'assets' && displayHoldings.length > 10 && (
                <button
                  className={styles.ghostButton}
                  onClick={() => setShowAllAssets(prev => !prev)}
                >
                  {showAllAssets ? 'Show less' : 'Show all'}
                </button>
              )}
            </div>
          </div>

          {error && viewMode === 'assets' && (
            <div className={styles.emptyState} style={{ color: '#ef4444' }}>
              {error}
            </div>
          )}

          {viewMode === 'orders' ? (
            /* Orders View (Position Cards) */
            <div className={styles.ordersContainer}>
              {ordersLoading ? (
                <div className={styles.horizontalScroll}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={styles.orderCard} style={{ opacity: 0.6 }}>
                      <Skeleton variant="text" width="100%" height={80} />
                    </div>
                  ))}
                </div>
              ) : orders.length === 0 && pendingOrders.length === 0 ? (
                <div className={styles.emptyState}>
                  No active Polymarket positions.
                </div>
              ) : (
                <>
                  {orders.length > 0 && (
                    <div className={styles.horizontalScroll}>
                      {orders.map((order, index) => (
                        <PolymarketOrderCard
                          key={`${order.market}-${index}`}
                          order={order}
                          styles={styles}
                          onSell={() => handleClosePosition(order)}
                        />
                      ))}
                    </div>
                  )}

                  {pendingOrders.length > 0 && (
                    <div className={styles.pendingOrdersSection}>
                      <h4 className={styles.sectionTitleSmall}>Pending Orders</h4>
                      <div className={styles.historyList}>
                        {pendingOrders.map((pending, idx) => (
                          <div key={idx} className={styles.historyItemNew}>
                            <div className={styles.historyContent}>
                              <div className={styles.historyTitle}>{pending.title}</div>
                              <div className={styles.historyBadges}>
                                <span className={styles.badgePending}>PENDING</span>
                                <span className={styles.statusBadge}>{pending.side} {pending.outcome} @ ${pending.price}</span>
                              </div>
                            </div>
                            <button
                              className={styles.cancelButton}
                              onClick={() => handleCancelOrder(pending.id)}
                            >
                              Cancel
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Assets View */
            loading ? (
              <div className={styles.cardsGrid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={styles.assetCard}>
                    <div className={styles.assetTop}>
                      <div className={styles.tokenCell}>
                        <Skeleton variant="circular" width={40} height={40} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <Skeleton variant="text" width="70%" height={16} />
                          <Skeleton variant="text" width="50%" height={14} />
                          <Skeleton variant="text" width="60%" height={12} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.assetRight}>
                      <Skeleton variant="text" width={90} height={18} />
                      <Skeleton variant="text" width={70} height={14} />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? null : displayHoldings.length === 0 ? (
              <div className={styles.emptyState}>
                No assets found on this chain.
              </div>
            ) : (
              <div className={styles.cardsGrid}>
                {(showAllAssets ? displayHoldings : displayHoldings.slice(0, 10)).map((asset, index) => (
                  <div
                    className={styles.assetCard}
                    key={`${asset.address || 'asset'}-${index}`}
                  >
                    <div className={styles.assetTop}>
                      <div className={styles.tokenCell}>
                        <TokenIcon
                          src={asset.logo && asset.logo.startsWith('http') ? asset.logo : undefined}
                          alt={asset.symbol}
                          symbol={asset.symbol}
                          className={styles.tokenLogo}
                          fallbackClassName={styles.tokenIcon}
                        />
                        <div className={styles.tokenInfo}>
                          <div className={styles.tokenName}>{asset.name}</div>
                          <div className={styles.tokenSymbol}>{asset.symbol}</div>
                          <div className={styles.assetBalance}>{parseFloat(asset.balance).toFixed(6)} {asset.symbol}</div>
                        </div>
                      </div>
                    </div>
                    <div className={styles.assetRight}>
                      <div className={styles.assetValue}>{asset.value}</div>
                      <div className={styles.assetChange}>{asset.change}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className={styles.historySection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              {viewMode === 'orders' ? 'Order History' : 'Transaction History'}
            </div>
          </div>

          {viewMode === 'orders' ? (
            /* polymarket order history */
            orderHistoryLoading ? (
              <div className={styles.historyList}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={styles.historyItemNew} style={{ opacity: 0.6 }}>
                    <Skeleton variant="rectangular" width="100%" height={60} borderRadius={20} />
                  </div>
                ))}
              </div>
            ) : orderHistory.length === 0 ? (
              <div className={styles.emptyState}>
                No past orders found.
              </div>
            ) : (
              <div className={styles.historyList}>
                {orderHistory.map((trade, index) => (
                  <PolymarketHistoryItem
                    key={index}
                    trade={trade}
                    styles={styles}
                  />
                ))}
              </div>
            )
          ) : (
            /* regular transaction history */
            transactionsLoading ? (
              <div className={styles.historyList}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={styles.historyItemNew} style={{ opacity: 0.6 }}>
                    <Skeleton variant="rectangular" width="100%" height={60} borderRadius={20} />
                  </div>
                ))}
              </div>
            ) : displayTransactions.length === 0 ? (
              <div className={styles.emptyState}>
                No transactions found.
              </div>
            ) : (
              <div className={styles.historyList}>
                {displayTransactions.map((tx, index) => (
                  <TradingHistoryItem
                    key={index}
                    tx={tx}
                    styles={styles}
                  />
                ))}
              </div>
            )
          )}
        </div>

      </div>

      <WalletSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDisconnect={handleDisconnect}
      />

      <ReceiveModal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        walletAddress={isConnected && walletAddress ? walletAddress : ''}
        chainName={isSolana ? 'Solana' : (currentChain.name || 'Ethereum')}
      />

      <SendModal
        isOpen={isSendOpen}
        onClose={() => {
          setIsSendOpen(false);
          setSelectedToken(null);
        }}
        walletAddress={walletAddress || ''}
        tokenAddress={selectedToken?.address}
        tokenSymbol={selectedToken?.symbol || (isSolana ? 'SOL' : 'ETH')}
        tokenDecimals={selectedToken?.decimals || (isSolana ? 9 : 18)}
        tokenBalance={selectedToken?.balance || '0'}
        isNative={selectedToken?.isNative ?? true}
        isSolana={isSolana}
      />

      {/* Swap Card Modal */}
      {isSwapOpen && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
            padding: '20px',
          }}
          onClick={() => setIsSwapOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '500px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <SwapCardIntegrated
              userAddress={walletAddress || undefined}
              chainId={chainId}
              onSwapSuccess={(txHash) => {
                console.log('Swap successful:', txHash);
                // Refresh holdings after successful swap
                setTimeout(() => {
                  setIsSwapOpen(false);
                }, 2000);
              }}
              onSwapError={(error) => {
                console.error('Swap error:', error);
              }}
              onClose={() => setIsSwapOpen(false)}
              userHoldings={displayHoldings.map(h => ({
                address: h.address,
                symbol: h.symbol,
                name: h.name,
                balance: h.balance,
                value: h.value,
                decimals: h.decimals,
                logo: h.logo,
                usdValueNum: h.usdValueNum,
                isNative: h.isNative,
              }))}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Sub-components for Polymarket Orders
const PolymarketOrderCard = ({ order, styles, onSell }: { order: any; styles: any; onSell: () => void }) => {
  const isYes = order.outcome === 'Yes';
  return (
    <div className={styles.orderCard}>
      <div className={styles.orderCardTop}>
        <span className={`${styles.badge} ${isYes ? styles.badgeYes : styles.badgeNo}`}>
          {order.outcome}
        </span>
        <button
          className={styles.moreButton}
          onClick={() => window.open(`https://polymarket.com/event/${order.market}`, '_blank')}
          title="View on Polymarket"
        >
          <ExternalLink size={14} />
        </button>
      </div>
      <h3 className={styles.orderCardTitle}>{order.title}</h3>
      <div className={styles.orderCardStats}>
        <div className={styles.statRow}>
          <span className={styles.statKey}>Value</span>
          <span className={styles.statVal}>${(order.currentValue || 0).toFixed(2)}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statKey}>Avg</span>
          <span className={styles.statVal}>${(order.avgPrice || 0).toFixed(3)}</span>
        </div>
      </div>
      <div className={styles.orderCardFooter}>
        <div className={styles.currentPrice}>${(order.currentPrice || 0).toFixed(2)}</div>
        <div className={`${styles.pnlPercent} ${order.pnl >= 0 ? styles.positive : styles.negative}`}>
          {order.pnl >= 0 ? '+' : ''}{(order.pnlPercent || 0).toFixed(1)}%
        </div>
        <button
          className={styles.sellButton}
          onClick={onSell}
        >
          Sell
        </button>
      </div>
    </div>
  );
};

const PolymarketHistoryItem = ({ trade, styles }: { trade: any; styles: any }) => {
  const date = new Date(trade.timestamp);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const isProfit = trade.side === 'SELL' || (trade.status === 'WON');
  const isNeutral = !trade.status;

  const badgeClass = isNeutral ? styles.dateBadgeNeutral : (isProfit ? styles.dateBadge : styles.dateBadgeLoss);
  const statusBadgeClass = isNeutral ? "" : (isProfit ? styles.statusBadgeWin : styles.statusBadgeLoss);

  return (
    <div className={styles.historyItemNew}>
      <div className={`${styles.dateBadge} ${badgeClass}`}>
        <span className={styles.dateMonth}>{month}</span>
        <span className={styles.dateDay}>{day < 10 ? `0${day}` : day}</span>
      </div>
      <div className={styles.historyContent}>
        <div className={styles.historyTitle}>{trade.title}</div>
        <div className={styles.historyBadges}>
          {trade.status && (
            <span className={`${styles.statusBadge} ${statusBadgeClass}`}>
              {trade.status}
            </span>
          )}
          {trade.status && <div className={styles.dot} />}
          <span className={styles.statusBadge}>
            {trade.side} {trade.outcome}
          </span>
        </div>
      </div>
      <div className={styles.historyResult}>
        <div className={`${styles.resultAmount} ${isNeutral ? '' : (isProfit ? styles.positive : styles.negative)}`} style={{ background: 'none', border: 'none', padding: 0 }}>
          {isNeutral ? '' : (isProfit ? '+' : '-')}${(trade.size * trade.price).toFixed(2)}
        </div>
        <button
          className={styles.externalLink}
          onClick={() => window.open(`https://polymarket.com/event/${trade.market}`, '_blank')}
        >
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
};

const TradingHistoryItem = ({ tx, styles }: { tx: any; styles: any }) => {
  const date = new Date(tx.timestamp || Date.now());
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();

  const displaySymbol = tx.tokenSymbol || tx.tokenInSymbol || tx.tokenOutSymbol || 'Unknown';
  const displayAmount = tx.amount || '0';
  const isReceived = tx.method?.toLowerCase() === 'receive' || tx.type?.toLowerCase() === 'receive';
  const isProfit = isReceived;

  return (
    <div className={styles.historyItemNew}>
      <div className={`${styles.dateBadge} ${styles.dateBadgeNeutral}`}>
        <span className={styles.dateMonth}>{month}</span>
        <span className={styles.dateDay}>{day < 10 ? `0${day}` : day}</span>
      </div>
      <div className={styles.historyContent}>
        <div className={styles.historyTitle}>{tx.method || tx.type || 'Transaction'} {displaySymbol}</div>
        <div className={styles.historyBadges}>
          <span className={styles.statusBadge}>
            {tx.status?.toUpperCase() || 'SUCCESS'}
          </span>
          <div className={styles.dot} />
          <span className={styles.statusBadge}>
            {tx.txHash ? `${tx.txHash.slice(0, 6)}...${tx.txHash.slice(-4)}` : 'Internal'}
          </span>
        </div>
      </div>
      <div className={styles.historyResult}>
        <div className={`${styles.resultAmount} ${isProfit ? styles.positive : styles.negative}`} style={{ background: 'none', border: 'none', padding: 0 }}>
          {isProfit ? '+' : '-'}{parseFloat(displayAmount).toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </div>
        <div className={styles.statusBadge}>{displaySymbol}</div>
      </div>
    </div>
  );
};


