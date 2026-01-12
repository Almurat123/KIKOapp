import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Copy,
  TrendingUp,
  Star,
  Check,
  Zap,
  Sparkles,
  Globe,
  Send,
  MessageSquare,
} from 'lucide-react';
import { favoriteApi } from '../services/favoriteService';
import { useSidebar } from '../components/Layout/Layout';

import { GeckoTerminalChart } from '../components/Chart/GeckoTerminalChart';
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
  token: TokenInfo;
  onBack: () => void;
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

export const TokenDetailPage: React.FC<TokenDetailPageProps> = ({ token, onBack }) => {
  const sidebar = useSidebar();

  const [copied, setCopied] = useState(false);
  const [securityData] = useState<any>(null);
  const [loadingSecurity] = useState(false);

  // Favorites State
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to top on mount
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
      sidebar.setOnBackHandler(() => onBack);
    }
    return () => {
      if (sidebar?.setOnBackHandler) {
        sidebar.setOnBackHandler(null);
      }
    };
  }, [onBack, sidebar]);

  // Check Favorite status on mount (NO auto security scan - user triggers via Ask AI)
  useEffect(() => {
    if (token.chain && token.address) {
      const checkFav = async () => {
        try {
          const normalizedChain = token.chain.toLowerCase();
          const status = await favoriteApi.checkFavorite(normalizedChain, token.address);
          setIsFavorite(status);
        } catch (e) { console.error(e); }
      };

      checkFav();
    }
  }, [token.chain, token.address]);

  // Handle Favorite Toggle
  const toggleFavorite = async () => {
    if (loadingFav) return;

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
    // Navigate to Chat page with token info as context query
    const query = `Check risk for token ${token.address} on ${token.chain}. Analyze security and potential issues for ${token.symbol} (${token.name}).`;
    // Store in sessionStorage so ChatInterface can pick it up
    sessionStorage.setItem('ai_prefill_query', query);
    // Navigate to the Chat page
    window.location.href = '/';  // Or wherever your Chat tab is
  };

  const getChainColor = (chain: string): string => {
    switch (chain?.toUpperCase()) {
      case 'SOL': return '#9945FF';
      case 'ETH': return '#627EEA';
      case 'BSC': return '#F0B90B';
      case 'BASE': return '#0052FF';
      case 'ARB': return '#28A0F0';
      case 'OP': return '#FF0420';
      case 'AVAX': return '#E84142';
      case 'MATIC': return '#8247E5';
      default: return '#666666';
    }
  };

  const getChainLogo = (chain: string): string => {
    switch (chain?.toUpperCase()) {
      case 'SOL': return 'https://cryptologos.cc/logos/solana-sol-logo.png';
      case 'ETH': return 'https://cryptologos.cc/logos/ethereum-eth-logo.png';
      case 'BSC': return 'https://cryptologos.cc/logos/bnb-bnb-logo.png';
      case 'BASE': return 'https://avatars.githubusercontent.com/u/108554348?s=200&v=4';
      case 'ARB': return 'https://cryptologos.cc/logos/arbitrum-arb-logo.png';
      case 'OP': return 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png';
      case 'AVAX': return 'https://cryptologos.cc/logos/avalanche-avax-logo.png';
      case 'MATIC': return 'https://cryptologos.cc/logos/polygon-matic-logo.png';
      default: return '';
    }
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

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Header Section */}
      <div className={styles.headerSection}>
        <div className={styles.tokenTitleRow}>
          <div className={styles.tokenIdentity}>
            {/* Back Button - Visible only on desktop */}
            <button onClick={onBack} className={styles.backButton}>
              <ArrowLeft size={18} />
            </button>

            <div className={styles.tokenIconWrapper}>
              <img
                src={token.imageUrl || `https://ui-avatars.com/api/?name=${token.symbol}&background=random&color=fff`}
                alt={token.name}
                className={styles.tokenIcon}
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${token.symbol}&background=random&color=fff`;
                }}
              />
              <img
                src={getChainLogo(token.chain)}
                alt={token.chain}
                className={styles.chainLogo}
                onError={(e) => {
                  e.currentTarget.style.background = getChainColor(token.chain);
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
              <button className={styles.copyIconBtn} onClick={copyAddress}>
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Social Links moved here */}
            {token.socialLinks && (
              <div className={styles.socialLinks}>
                {token.socialLinks.website && (
                  <a href={token.socialLinks.website} target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>
                    <Globe size={14} className={styles.socialIcon} />
                    <span className={styles.socialText}>{getHostname(token.socialLinks.website)}</span>
                  </a>
                )}
                {token.socialLinks.twitter && (
                  <a href={token.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>
                    <div className={styles.socialIcon}><TwitterIcon /></div>
                    <span className={styles.socialText}>Twitter</span>
                  </a>
                )}
                {token.socialLinks.telegram && (
                  <a href={token.socialLinks.telegram} target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>
                    <Send size={14} className={styles.socialIcon} />
                    <span className={styles.socialText}>Telegram</span>
                  </a>
                )}
                {token.socialLinks.discord && (
                  <a href={token.socialLinks.discord} target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>
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
      <div className={styles.marketGrid}>
        <div className={styles.marketCard}>
          <span className={styles.statLabel}>MKT CAP</span>
          <span className={styles.statValue}>{formatNumber(token.mcap)}</span>
        </div>
        <div className={styles.marketCard}>
          <span className={styles.statLabel}>FDV</span>
          <span className={styles.statValue}>{formatNumber(token.fdv)}</span>
        </div>
        <div className={styles.marketCard}>
          <span className={styles.statLabel}>LIQUIDITY</span>
          <span className={styles.statValue}>{formatNumber(token.liquidity)}</span>
        </div>
        <div className={styles.marketCard}>
          <span className={styles.statLabel}>24H VOL</span>
          <span className={styles.statValue}>{formatNumber(token.volume24h)}</span>
        </div>
      </div>

      {/* Security Section */}
      <div className={styles.sectionHeader}>
        <h3>SECURITY</h3>
        {/* Ask AI Button */}
        <button className={styles.askAiButton} onClick={handleAskAI}>
          <Sparkles size={12} fill="currentColor" /> Ask AI
        </button>
      </div>

      <div className={styles.securityCard}>
        {/* Authority Row */}
        <div className={styles.securityRow}>
          <div className={styles.securityLabel}>
            <div className={styles.iconBox}><Zap size={12} /></div>
            <span>Authority</span>
          </div>
          <div className={styles.securityValue}>
            {loadingSecurity ? <span className={styles.loadingPulse}>...</span> : securityData ? (
              (securityData as any).hasRenouncedOwner ?
                <div className={styles.safeBadge}><Check size={10} /> Renounced</div> :
                <div className={styles.warnBadge}>Active</div>
            ) : '-'}
          </div>
        </div>

        {/* Mintable Row */}
        <div className={styles.securityRow}>
          <div className={styles.securityLabel}>
            <div className={styles.iconBox}><Copy size={12} /></div>
            <span>Mintable</span>
          </div>
          <div className={styles.securityValue}>
            {loadingSecurity ? <span className={styles.loadingPulse}>...</span> : securityData ? (
              (securityData as any).isMintable ? 'Yes' : 'No'
            ) : '-'}
          </div>
        </div>

        {/* Tax Row */}
        <div className={styles.securityRow}>
          <div className={styles.securityLabel}>
            <div className={styles.iconBox}><TrendingUp size={12} /></div>
            <span>Tax (B/S)</span>
          </div>
          <div className={styles.securityValue}>
            {loadingSecurity ? <span className={styles.loadingPulse}>...</span> : securityData ? (
              <span className={(securityData as any).buyTax > 5 || (securityData as any).sellTax > 5 ? styles.redText : styles.greenText}>
                {(securityData as any).buyTax}% / {(securityData as any).sellTax}%
              </span>
            ) : '0% / 0%'}
          </div>
        </div>
      </div>

      {/* Holders Section */}
      <div className={styles.sectionHeader}>
        <h3>HOLDERS</h3>
      </div>

      <div className={styles.holdersCard}>
        <div className={styles.holdersMainRow}>
          <span className={styles.holderCountLabel}>Total Holders</span>
          <span className={styles.holderCountValue}>
            {(securityData as any)?.holdersCount || (token.holders ? formatCompact(token.holders) : '-')}
          </span>
        </div>
        {/* Show Top 10 percentage if available, otherwise hide detail */}
        {(securityData as any)?.top10Percentage && (
          <div className={styles.holdersDetailRow}>
            <span>Top 10:</span>
            <span>{(securityData as any).top10Percentage}%</span>
          </div>
        )}
      </div>

      <div className={styles.mainContent}>
        {/* Chart Section */}
        <div className={styles.chartCard} style={{ padding: 0, overflow: 'hidden' }}>
          <GeckoTerminalChart
            chain={token.chain}
            address={token.address}
            poolAddress={token.poolAddress}
            height={500}
          />
        </div>
      </div>
    </div>
  );
};
