import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Star,
  Check,
  Sparkles,
  Globe,
  Send,
  MessageSquare,
} from 'lucide-react';
import { favoriteApi } from '../services/favoriteService';
import { tokenApi } from '../services/api'; // Added tokenApi
import { usePrivy } from '@privy-io/react-auth';
import { useSidebar } from '../components/Layout/Layout';
import { proxyImageUrl } from '../utils/imageProxy';

import { GeckoTerminalChart } from '../components/Chart/GeckoTerminalChart';
import { useThemeContext } from '../contexts/ThemeContext';
import { Skeleton } from '../components/Skeleton';
import { agentAttrs } from '../agent/attrs';
import styles from './TokenDetailPage.module.css';

// --- Types ---

interface TokenInfo {
  name: string;
  symbol: string;
  pair: string;
  chain: string;
  price: string;
  priceChange24h: number;
  priceChange6h?: number;
  priceChange1h?: number;
  priceChange5m?: number;
  address: string;
  fdv: string;
  mcap: string;
  liquidity: string;
  volume24h: string;
  holders?: number | string;
  txns24h?: string;
  buys24h?: string;
  sells24h?: string;
  circulatingSupply?: string;
  totalSupply?: string;
  tokenAge?: string;
  poolCreatedAt?: string;
  riskScore: number;
  audit: {
    status: string;
    warnings: string[];
  };
  poolAddress?: string;
  poolFee?: string;
  socialLinks?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
  imageUrl?: string;
}

interface TokenDetailPageProps {
  token?: TokenInfo; // Made optional for routing
  onBack?: () => void; // Made optional for routing
}


// Subscript digits for displaying zero count
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

function toSubscript(num: number): string {
  return num.toString().split('').map(d => SUBSCRIPT_DIGITS[parseInt(d)]).join('');
}

/**
 * Format price with subscript zero count for very small numbers
 * Example: 0.00000464 -> $0.0₄464 (4 zeros between 0. and first non-zero digit)
 */
function formatPrice(value: number | undefined | null | string): string {
  // Convert to number if it's a string
  let numValue: number;
  if (typeof value === 'string') {
    if (value.startsWith('$')) return value; // ALREADY FORMATTED
    numValue = parseFloat(value);
    if (isNaN(numValue)) return '$0.00';
  } else if (typeof value === 'number') {
    numValue = value;
  } else {
    return '$0.00';
  }

  if (!numValue || numValue === 0 || isNaN(numValue)) return '$0.00';

  // For very small numbers, count leading zeros after decimal point
  if (numValue < 0.001 && numValue > 0) {
    const str = numValue.toFixed(20);
    const match = str.match(/^0\.0+/);
    if (match && match[0].length > 3) {
      const zeroCount = match[0].length - 2;
      const significantDigits = str.slice(match[0].length, match[0].length + 4);
      return `$0.0${toSubscript(zeroCount)}${significantDigits}`;
    }
  }

  if (numValue < 0.01) {
    return `$${numValue.toFixed(6)}`;
  } else if (numValue < 1) {
    return `$${numValue.toFixed(4)}`;
  } else if (numValue < 100) {
    return `$${numValue.toFixed(2)}`;
  } else {
    return `$${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

// Custom Twitter Icon for consistency
const TwitterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const TokenDetailPage: React.FC<TokenDetailPageProps> = ({ token: propToken, onBack: propOnBack }) => {
  const { authenticated } = usePrivy();
  const sidebar = useSidebar();
  const navigate = useNavigate();
  const { chain, address } = useParams<{ chain: string; address: string }>();
  const location = useLocation();

  // State
  const [fetchedToken, setFetchedToken] = useState<TokenInfo | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Derived state to use either prop or fetched token
  // Priority: Prop > Location State > Fetched
  const token = propToken || (location.state as any)?.token || fetchedToken;

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (propOnBack) {
      propOnBack();
    } else {
      // If we have history, go back, otherwise go to tokens list
      if (window.history.length > 2) {
        navigate(-1);
      } else {
        navigate('/tokens');
      }
    }
  }, [propOnBack, navigate]);

  const [copied, setCopied] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // ── Trade Sheet state ────────────────────────────────────────────────────
  const [tradeSheet, setTradeSheet] = useState<{
    open: boolean;
    action: 'buy' | 'sell';
    amount: string;
  }>({ open: false, action: 'buy', amount: '' });

  /** Native gas token for each chain */
  const nativeToken = (chain: string): string => {
    const c = chain.toLowerCase();
    if (c.includes('sol')) return 'SOL';
    if (c.includes('bsc') || c.includes('bnb') || c.includes('binance')) return 'BNB';
    if (c.includes('avax') || c.includes('avalanche')) return 'AVAX';
    if (c.includes('matic') || c.includes('polygon')) return 'MATIC';
    return 'ETH'; // base, ethereum, arbitrum, optimism, etc.
  };

  /** Preset quick-select amounts per action */
  const presets = (action: 'buy' | 'sell', chain: string): string[] => {
    if (action === 'sell') return ['25%', '50%', '75%', '100%'];
    const gas = nativeToken(chain);
    if (gas === 'SOL') return ['0.1', '0.5', '1', '2'];
    if (gas === 'BNB') return ['0.05', '0.1', '0.5', '1'];
    if (gas === 'AVAX' || gas === 'MATIC') return ['1', '5', '10', '25'];
    return ['0.01', '0.05', '0.1', '0.5']; // ETH
  };

  // Quick Trade Handler — opens the amount sheet instead of navigating directly
  const handleTradeAction = (action: 'buy' | 'sell') => {
    if (!token) return;
    setTradeSheet({ open: true, action, amount: '' });
  };

  /** Confirm trade — build the precise message and auto-send it to chat */
  const handleTradeConfirm = () => {
    if (!token || !tradeSheet.amount.trim()) return;
    const addr = token.address;
    const chain = token.chain;
    const gas = nativeToken(chain);
    const amt = tradeSheet.amount.trim();

    const query = tradeSheet.action === 'buy'
      ? `Buy ${addr} for ${amt} ${gas} on ${chain}`
      : `Sell ${addr} for ${amt} on ${chain}`;

    setTradeSheet(s => ({ ...s, open: false }));

    // Store in sessionStorage so ChatInterface reads it on mount (works even if lazy-loaded)
    sessionStorage.setItem('kiko-prefill-prompt', query);
    // Also fire event in case ChatInterface is already mounted
    window.dispatchEvent(new CustomEvent('kiko-prefill-input', { detail: { prompt: query } }));
    navigate('/');
  };

  // Favorites State
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const { resolvedTheme } = useThemeContext();
  const isDark = resolvedTheme === 'dark';
  const [loading, setLoading] = useState(true);

  /**
   * Helper to normalize network names (canonical form)
   * Consistent with TokensPage.tsx
   */
  const formatNetworkName = (network: string): string => {
    const networkMap: Record<string, string> = {
      'eth': 'ETH',
      'ethereum': 'ETH',
      'bsc': 'BSC',
      'solana': 'SOL',
      'sol': 'SOL',
      'base': 'BASE',
      'arbitrum': 'ARB',
      'arb': 'ARB',
      'optimism': 'OP',
      'op': 'OP',
      'polygon': 'MATIC',
      'matic': 'MATIC',
      'avax': 'AVAX',
      'avalanche': 'AVAX',
      'fantom': 'FTM',
    };
    return networkMap[network.toLowerCase()] || network.toUpperCase();
  };

  // Helper to convert API result to TokenInfo
  const mapApiToTokenInfo = useCallback((details: any, chainparam: string, addrparam: string): TokenInfo => {
    // Helper to safely get number
    const getNum = (v: any) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') return parseFloat(v) || 0;
      return 0;
    };

    return {
      name: details.name || 'Unknown',
      symbol: details.symbol || 'UNK',
      pair: `${details.symbol || 'UNK'} / -`, // We might not have pair info easily
      chain: formatNetworkName(details.network || chainparam),
      price: (details.price || 0).toString(),
      priceChange24h: getNum(details.priceChange24h),
      priceChange6h: getNum(details.priceChange6h),
      priceChange1h: getNum(details.priceChange1h),
      priceChange5m: getNum(details.priceChange5m),
      address: details.address || addrparam,
      fdv: (details.fdv || 0).toString(),
      mcap: (details.fdv || 0).toString(), // approx
      liquidity: (details.liquidity || 0).toString(),
      volume24h: (details.volume24h || 0).toString(),
      holders: details.holders,
      poolAddress: details.poolAddress,
      riskScore: 50, // default
      audit: {
        status: "Unverified",
        warnings: [],
      },
      imageUrl: details.imageUrl,
      socialLinks: {
        website: details.websites?.[0]?.url,
        twitter: details.socials?.find((s: any) => s.type === 'twitter')?.url,
        telegram: details.socials?.find((s: any) => s.type === 'telegram')?.url,
        discord: details.socials?.find((s: any) => s.type === 'discord')?.url,
      }
    };
  }, []);

  // Effect: Fetch data if no token provided but we have params
  useEffect(() => {
    let isMounted = true;
    const tokenFromState = (location.state as any)?.token;

    if (!propToken && !tokenFromState && chain && address) {
      const loadData = async () => {
        setFetchLoading(true);
        try {
          const data = await tokenApi.getDetails(chain, address);
          if (data && isMounted) {
            setFetchedToken(mapApiToTokenInfo(data, chain, address));
          } else if (isMounted) {
            setFetchError("Token not found");
          }
        } catch (err) {
          if (isMounted) {
            console.error("Failed to load token details route", err);
            setFetchError("Failed to load token details");
          }
        } finally {
          if (isMounted) setFetchLoading(false);
        }
      };
      loadData();
    }
    return () => { isMounted = false; };
  }, [chain, address, propToken, mapApiToTokenInfo, !!(location.state as any)?.token]); // Stabilize location.state dependency

  // Resolve loading state
  useEffect(() => {
    // If token came from props or navigation state (not API fetch), show immediately.
    const fromNavState = !propToken && !!(location.state as any)?.token;
    if (propToken || fromNavState) {
      // Data already available — no delay needed
      setLoading(false);
      return;
    }
    // Token came from API fetch — wait until fetch completes
    if (!fetchLoading && token) {
      setLoading(false);
    } else if (!fetchLoading && fetchError) {
      setLoading(false);
    } else if (!fetchLoading && !token && !chain) {
      setLoading(false);
    }
  }, [token, fetchLoading, fetchError, chain, propToken, location.state]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  // Register back handler with global mobile header
  useEffect(() => {
    if (sidebar?.setOnBackHandler) {
      // IMPORTANT: Since setOnBackHandler is a useState setter, passing a function directly
      // is treated as a functional update (prev => newValue).
      // We must wrap our function in another function to store the function itself.
      sidebar.setOnBackHandler(() => handleBack);
    }
    return () => {
      if (sidebar?.setOnBackHandler) {
        sidebar.setOnBackHandler(null);
      }
    };
  }, [handleBack, sidebar]);

  // Check Favorite status on mount (NO auto security scan - user triggers via Ask AI)
  useEffect(() => {
    if (token.chain && token.address) {
      const checkFav = async () => {
        if (!authenticated) return;

        try {
          const normalizedChain = token.chain.toLowerCase();
          const status = await favoriteApi.checkFavorite(normalizedChain, token.address);
          setIsFavorite(status);
        } catch (e) { console.error(e); }
      };

      checkFav();
    }
  }, [token.chain, token.address, authenticated]);

  // Handle Favorite Toggle
  const toggleFavorite = async () => {
    if (!authenticated || loadingFav) return;

    // Optimistic Update
    const previousState = isFavorite;
    setIsFavorite(!previousState);
    setLoadingFav(true);

    // Normalize chain to lowercase for API consistency
    const normalizedChain = token.chain.toLowerCase();

    try {
      let success: boolean;
      if (previousState) {
        // Was favorite, so remove
        success = await favoriteApi.removeFavorite(normalizedChain, token.address);
      } else {
        // Was not favorite, so add
        success = await favoriteApi.addFavorite(normalizedChain, token.address);
      }

      if (!success) {
        // Revert on failure
        setIsFavorite(previousState);
      }
    } catch (e) {
      console.error("[TokenDetailPage] Failed to toggle favorite", e);
      setIsFavorite(previousState);
    } finally {
      setLoadingFav(false);
    }
  };


  // Copy address function
  const copyAddress = () => {
    navigator.clipboard.writeText(token.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Navigate to Chat page with token context for AI queries
  const handleAskAI = () => {
    const query = `Check risk for token ${token.address} on ${token.chain}. Analyze security and potential issues for ${token.symbol} (${token.name}).`;
    sessionStorage.setItem('kiko-prefill-prompt', query);
    window.dispatchEvent(new CustomEvent('kiko-prefill-input', { detail: { prompt: query } }));
    navigate('/');
  };

  const getChainColor = (chain: string): string => {
    switch (chain?.toUpperCase()) {
      case 'SOL':
      case 'SOLANA': return '#9945FF';
      case 'ETH':
      case 'ETHEREUM': return '#627EEA';
      case 'BSC':
      case 'BINANCE': return '#F0B90B';
      case 'BASE': return '#0052FF';
      case 'ARB':
      case 'ARBITRUM': return '#28A0F0';
      case 'OP':
      case 'OPTIMISM': return '#FF0420';
      case 'AVAX':
      case 'AVALANCHE': return '#E84142';
      case 'MATIC':
      case 'POLYGON': return '#8247E5';
      default: return '#666666';
    }
  };

  const getChainLogo = (chain: string): string => {
    const c = chain?.toUpperCase();
    if (c === 'SOL' || c === 'SOLANA') return '/assets/tokens/sol.png';
    if (c === 'ETH' || c === 'ETHEREUM') return '/assets/tokens/eth.png';
    if (c === 'BSC' || c === 'BINANCE') return '/assets/tokens/bsc.png';
    if (c === 'BASE') return '/assets/tokens/base.png';
    if (c === 'ARB' || c === 'ARBITRUM') return '/assets/tokens/arbitrum.png';
    if (c === 'OP' || c === 'OPTIMISM') return '/assets/tokens/optimism.png';
    if (c === 'MATIC' || c === 'POLYGON') return '/assets/tokens/polygon.png';
    if (c === 'AVAX' || c === 'AVALANCHE') return 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png';
    return '';
  };

  const formatNumber = (val: string | number | undefined) => {
    if (val === undefined || val === null) return '-';
    // If it's already a formatted string like $1.2M, return it
    if (typeof val === 'string' && (val.includes('$') || val.includes('M') || val.includes('K'))) return val;

    const num = Number(val);
    if (isNaN(num)) return val;

    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatCompact = (val: number | string | undefined) => {
    if (val === undefined || val === null) return '-';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatPercentage = (val: number | undefined) => {
    if (val === undefined) return '-';
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'Website';
    }
  };

  if (loading) {
    return (
      <div className={`${styles.container} ${styles[resolvedTheme]}`}>
        <div className={styles.headerSection}>
          <div className={styles.tokenTitleRow}>
            <div className={styles.tokenIdentity}>
              <Skeleton variant="circular" width={48} height={48} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton variant="text" width={100} height={28} />
                <Skeleton variant="text" width={60} height={14} />
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Skeleton variant="text" width={80} height={24} />
              </div>
            </div>
          </div>
          <div className={styles.tokenInfoSection}>
            <Skeleton variant="text" width={150} height={36} />
          </div>
        </div>

        <div className={styles.marketGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.marketCard}>
              <Skeleton variant="text" width={60} height={12} />
              <Skeleton variant="text" width={100} height={24} />
            </div>
          ))}
        </div>

        <div className={styles.mainContent}>
          <Skeleton variant="rectangular" width="100%" height={500} style={{ borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.container} ${styles[resolvedTheme]}`}
      ref={containerRef}
      {...agentAttrs({ id: 'token_detail.page', role: 'card', page: 'token_detail' })}
    >
      {/* Header Section */}
      <div className={styles.headerSection}>
        <div className={styles.tokenTitleRow}>
          <div className={styles.tokenIdentity}>
            {/* Back Button - Visible only on desktop */}
            <button
              onClick={handleBack}
              className={styles.backButton}
              {...agentAttrs({ id: 'token_detail.back', role: 'button', action: 'navigate', page: 'token_detail' })}
            >
              <ArrowLeft size={18} />
            </button>

            <div
              className={styles.tokenIconWrapper}
              onClick={() => setImageModalOpen(true)}
              style={{ cursor: 'pointer' }}
              {...agentAttrs({ id: 'token_detail.image.open', role: 'button', action: 'open', page: 'token_detail' })}
            >
              <img
                src={proxyImageUrl(token.imageUrl) || proxyImageUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(token.symbol)}&background=random&color=fff`) || `https://ui-avatars.com/api/?name=${encodeURIComponent(token.symbol)}&background=random&color=fff`}
                alt={token.name}
                className={styles.tokenIcon}
                onError={(e) => {
                  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(token.symbol)}&background=random&color=fff`;
                  const stage = e.currentTarget.dataset.fallbackStage || '0';
                  if (stage === '0') {
                    e.currentTarget.dataset.fallbackStage = '1';
                    e.currentTarget.src = proxyImageUrl(fallbackUrl) || fallbackUrl;
                    return;
                  }
                  e.currentTarget.dataset.fallbackStage = '2';
                  e.currentTarget.src = fallbackUrl;
                }}
              />
              <img
                src={getChainLogo(token.chain)}
                alt={token.chain}
                className={styles.chainLogo}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.parentElement.style.background = getChainColor(token.chain);
                  }
                }}
              />
            </div>
            <div className={styles.tokenNameWrapper}>
              <h1 className={styles.tokenSymbol}>{token.symbol}</h1>
              <span className={styles.chainName}>/ {token.chain}</span>
            </div>

            <div className={styles.priceWrapper}>
              <span className={styles.mainPrice}>{formatPrice(token.price)}</span>
              <span className={`${styles.priceChangeBadge} ${token.priceChange24h >= 0 ? styles.positive : styles.negative}`}>
                {formatPercentage(token.priceChange24h)}
              </span>
            </div>

            {/* Star Button in Header */}
            <button
              className={styles.starButton}
              onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
              disabled={loadingFav}
              {...agentAttrs({ id: 'token_detail.favorite.toggle', role: 'toggle', action: 'toggle', page: 'token_detail' })}
            >
              <Star
                size={20}
                fill={isFavorite ? "#f59e0b" : "none"}
                color={isFavorite ? "#f59e0b" : "currentColor"}
              />
            </button>

          </div>

        </div>

        {/* Token Info Section */}
        <div className={styles.tokenInfoSection}>
          <h3 className={styles.sectionLabel}>TOKEN INFO</h3>
          <div className={styles.tokenInfoRow}>
            <div className={styles.addressBar}>
              <span className={styles.addressText}>
                {token.address.slice(0, 6)}...{token.address.slice(-4)}
              </span>
              <button
                className={styles.copyIconBtn}
                onClick={copyAddress}
                {...agentAttrs({ id: 'token_detail.copy_address', role: 'button', action: 'copy', page: 'token_detail', key: 'token_address' })}
              >
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Social Links moved here */}
            {token.socialLinks && (
              <div className={styles.socialLinks}>
                {token.socialLinks.website && (
                  <a
                    href={token.socialLinks.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialBtn}
                    {...agentAttrs({ id: 'token_detail.social.website', role: 'button', action: 'open', page: 'token_detail', key: 'website' })}
                  >
                    <Globe size={14} className={styles.socialIcon} />
                    <span className={styles.socialText}>{getHostname(token.socialLinks.website)}</span>
                  </a>
                )}
                {token.socialLinks.twitter && (
                  <a
                    href={token.socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialBtn}
                    {...agentAttrs({ id: 'token_detail.social.twitter', role: 'button', action: 'open', page: 'token_detail', key: 'twitter' })}
                  >
                    <div className={styles.socialIcon}><TwitterIcon /></div>
                    <span className={styles.socialText}>Twitter</span>
                  </a>
                )}
                {token.socialLinks.telegram && (
                  <a
                    href={token.socialLinks.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialBtn}
                    {...agentAttrs({ id: 'token_detail.social.telegram', role: 'button', action: 'open', page: 'token_detail', key: 'telegram' })}
                  >
                    <Send size={14} className={styles.socialIcon} />
                    <span className={styles.socialText}>Telegram</span>
                  </a>
                )}
                {token.socialLinks.discord && (
                  <a
                    href={token.socialLinks.discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialBtn}
                    {...agentAttrs({ id: 'token_detail.social.discord', role: 'button', action: 'open', page: 'token_detail', key: 'discord' })}
                  >
                    <MessageSquare size={14} className={styles.socialIcon} />
                    <span className={styles.socialText}>Discord</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Market Stats Grid */}
      <div className={styles.marketGrid} {...agentAttrs({ id: 'token_detail.stats', role: 'list', page: 'token_detail' })}>
        <div className={styles.marketCard} {...agentAttrs({ id: 'token_detail.stats.mcap', role: 'card', page: 'token_detail', key: 'mcap' })}>
          <span className={styles.statLabel}>MKT CAP</span>
          <span className={styles.statValue}>{formatNumber(token.mcap)}</span>
        </div>
        <div className={styles.marketCard} {...agentAttrs({ id: 'token_detail.stats.fdv', role: 'card', page: 'token_detail', key: 'fdv' })}>
          <span className={styles.statLabel}>FDV</span>
          <span className={styles.statValue}>{formatNumber(token.fdv)}</span>
        </div>
        <div className={styles.marketCard} {...agentAttrs({ id: 'token_detail.stats.liquidity', role: 'card', page: 'token_detail', key: 'liquidity' })}>
          <span className={styles.statLabel}>LIQUIDITY</span>
          <span className={styles.statValue}>{formatNumber(token.liquidity)}</span>
        </div>
        <div className={styles.marketCard} {...agentAttrs({ id: 'token_detail.stats.volume24h', role: 'card', page: 'token_detail', key: 'volume24h' })}>
          <span className={styles.statLabel}>24H VOL</span>
          <span className={styles.statValue}>{formatNumber(token.volume24h)}</span>
        </div>
      </div>

      {/* Quick Trade Actions */}
      <div className={styles.tradeGrid}>
        <button
          className={`${styles.tradeBtn} ${styles.buyBtn}`}
          onClick={() => handleTradeAction('buy')}
          {...agentAttrs({ id: 'token_detail.trade.buy', role: 'button', action: 'navigate', page: 'token_detail', key: 'trade_action' })}
        >
          BUY {token.symbol}
        </button>
        <button
          className={`${styles.tradeBtn} ${styles.sellBtn}`}
          onClick={() => handleTradeAction('sell')}
          {...agentAttrs({ id: 'token_detail.trade.sell', role: 'button', action: 'navigate', page: 'token_detail', key: 'trade_action' })}
        >
          SELL {token.symbol}
        </button>
      </div>

      {/* Security Section */}
      <div className={styles.sectionHeader} {...agentAttrs({ id: 'token_detail.section.security', role: 'card', page: 'token_detail' })}>
        <h3>SECURITY</h3>
      </div>

      <div className={styles.securitySectionCompact}>
        <div className={styles.securityInfo}>
          <p className={styles.securityTitle}>Smart Contract Analysis</p>
          <p className={styles.securityDesc}>Analyze honeypot, tax, and ownership via KIKO AI.</p>
        </div>

        <button
          className={styles.askAiActionBtn}
          onClick={handleAskAI}
          {...agentAttrs({ id: 'token_detail.ask_ai', role: 'button', action: 'navigate', page: 'token_detail' })}
        >
          <Sparkles size={14} /> Analyze with AI
        </button>

        <span className={styles.brandFooter}>Powered by KIKO</span>
      </div>

      {/* Holders Section */}
      <div className={styles.sectionHeader} {...agentAttrs({ id: 'token_detail.section.holders', role: 'card', page: 'token_detail' })}>
        <h3>HOLDERS</h3>
      </div>

      <div className={styles.holdersCard} {...agentAttrs({ id: 'token_detail.holders.total', role: 'card', page: 'token_detail', key: 'holders' })}>
        <div className={styles.holdersMainRow}>
          <span className={styles.holderCountLabel}>Total Holders</span>
          <span className={styles.holderCountValue}>
            {token.holders ? formatCompact(token.holders) : '-'}
          </span>
        </div>
      </div>

      {/* Chart Section */}
      <div className={styles.mainContent}>
        <div
          className={styles.chartCard}
          style={{ padding: 0, overflow: 'hidden' }}
          {...agentAttrs({ id: 'token_detail.chart.geckoterminal', role: 'card', page: 'token_detail' })}
        >
          <GeckoTerminalChart
            chain={token.chain}
            address={token.address}
            poolAddress={token.poolAddress}
            height={500}
          />
        </div>
      </div>

      {/* Image Modal */}
      {
        imageModalOpen && (
          <div
            className={styles.imageModal}
            onClick={() => setImageModalOpen(false)}
            {...agentAttrs({ id: 'token_detail.image.modal', role: 'dialog', action: 'close', page: 'token_detail' })}
          >
            <div className={styles.imageModalContent}>
              <img
                src={proxyImageUrl(token.imageUrl) || `https://ui-avatars.com/api/?name=${encodeURIComponent(token.symbol)}&background=random&color=fff&size=512`}
                alt={token.name}
                className={styles.imageModalImg}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )
      }

      {/* ── Trade Amount Sheet ─────────────────────────────────────────────── */}
      {tradeSheet.open && (
        <div
          onClick={() => setTradeSheet(s => ({ ...s, open: false }))}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '480px',
              background: isDark ? '#18181b' : '#ffffff',
              borderRadius: '24px 24px 0 0',
              padding: '24px 20px 36px',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column', gap: '16px',
            }}
          >
            {/* Handle bar */}
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: isDark ? '#3f3f46' : '#d4d4d8', margin: '0 auto 4px' }} />

            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden',
                background: isDark ? '#27272a' : '#f4f4f5', flexShrink: 0,
              }}>
                {token.imageUrl && <img src={proxyImageUrl(token.imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.target as HTMLImageElement).style.display = 'none'} />}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: isDark ? '#f4f4f5' : '#18181b' }}>
                  {tradeSheet.action === 'buy' ? 'Buy' : 'Sell'} {token.symbol}
                </div>
                <div style={{ fontSize: '12px', color: isDark ? '#71717a' : '#a1a1aa', fontFamily: 'monospace' }}>
                  {token.address.slice(0, 8)}...{token.address.slice(-6)} · {token.chain}
                </div>
              </div>
            </div>

            {/* Preset quick amounts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {presets(tradeSheet.action, token.chain).map(p => (
                <button
                  key={p}
                  onClick={() => setTradeSheet(s => ({ ...s, amount: p }))}
                  style={{
                    padding: '10px 0',
                    borderRadius: '12px',
                    border: tradeSheet.amount === p
                      ? '2px solid #0052FF'
                      : `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
                    background: tradeSheet.amount === p
                      ? (isDark ? 'rgba(0,82,255,0.15)' : 'rgba(0,82,255,0.08)')
                      : (isDark ? '#27272a' : '#f4f4f5'),
                    color: tradeSheet.amount === p ? '#0052FF' : (isDark ? '#f4f4f5' : '#18181b'),
                    fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {p}{tradeSheet.action === 'buy' ? ` ${nativeToken(token.chain)}` : ''}
                </button>
              ))}
            </div>

            {/* Custom amount input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder={tradeSheet.action === 'buy' ? `Custom ${nativeToken(token.chain)} amount` : 'Custom % e.g. 30%'}
                value={presets(tradeSheet.action, token.chain).includes(tradeSheet.amount) ? '' : tradeSheet.amount}
                onChange={e => setTradeSheet(s => ({ ...s, amount: e.target.value }))}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: '12px',
                  border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
                  background: isDark ? '#27272a' : '#f4f4f5',
                  color: isDark ? '#f4f4f5' : '#18181b',
                  fontSize: '15px', outline: 'none',
                }}
              />
              <span style={{ color: isDark ? '#71717a' : '#a1a1aa', fontWeight: 600, fontSize: '14px', flexShrink: 0 }}>
                {tradeSheet.action === 'buy' ? nativeToken(token.chain) : '%'}
              </span>
            </div>

            {/* Confirm button */}
            <button
              disabled={!tradeSheet.amount.trim()}
              onClick={handleTradeConfirm}
              style={{
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: tradeSheet.amount.trim()
                  ? (tradeSheet.action === 'buy' ? '#0052FF' : '#ef4444')
                  : (isDark ? '#3f3f46' : '#e4e4e7'),
                color: tradeSheet.amount.trim() ? '#fff' : (isDark ? '#71717a' : '#a1a1aa'),
                fontWeight: 700, fontSize: '16px', cursor: tradeSheet.amount.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {tradeSheet.action === 'buy' ? 'Buy' : 'Sell'}{tradeSheet.amount.trim() ? ` · ${tradeSheet.amount.trim()}${tradeSheet.action === 'buy' ? ` ${nativeToken(token.chain)}` : ''}` : ''}
            </button>
          </div>
        </div>
      )}
    </div >
  );
};
