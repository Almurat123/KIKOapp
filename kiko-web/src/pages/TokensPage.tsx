import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { TokenDetailPage } from './TokenDetailPage';
import { tokenApi, type TokenSearchResult } from '../services/api';
import { favoriteApi } from '../services/favoriteService';
import { PageContainer } from '../components/Layout/PageContainer';
import styles from './TokensPage.module.css';
import { usePageVisibility, useTabVisibility } from '../hooks/usePageVisibility';
import { requestManager } from '../utils/requestManager';
import {
  calculateTrendingScore,
  loadFromCache,
  saveToCache
} from '../services/trendingService';

// --- Types ---

interface Token {
  id: number;
  name: string;
  symbol: string;
  chain: string;
  imageUrl?: string; // Token logo/avatar URL
  poolCreatedAt?: string; // Pool creation timestamp
  isNew: boolean; // Is token less than 24h old
  isHot: boolean; // Is token hot (high volume/activity in 24h)
  price: string;
  age: string;
  txns: number;
  buys: number;
  sells: number;
  volume: string;
  makers: number;
  c5m: string;
  c1h: string;
  c6h: string;
  c24h: string;
  liquidity: string;
  fdv: string;
  holders?: number;
  address?: string; // Token address for API calls
  poolAddress?: string; // Pool address for GeckoTerminal charts
  network?: string; // Network for API calls
  trendingScore: number; // Calculated trending score (0-100)

  // Raw numeric fields for fast sorting
  priceRaw: number;
  volumeRaw: number;
  liquidityRaw: number;
  fdvRaw: number;
  c5mRaw: number;
  c1hRaw: number;
  c6hRaw: number;
  c24hRaw: number;
  ageRaw: number; // timestamp

  socialLinks?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
}

// --- Helper Functions ---

// Subscript digits for displaying zero count
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

function toSubscript(num: number): string {
  return num.toString().split('').map(d => SUBSCRIPT_DIGITS[parseInt(d)]).join('');
}

/**
 * Format price with subscript zero count for very small numbers
 * Example: 0.00000464 -> $0.0₄464 (4 zeros between 0. and first non-zero digit)
 * The first 0 after decimal point is the base, we count the additional zeros
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
  // Format: $0.0{n}xxxx where n is the count of additional zeros after "0.0"
  if (numValue < 0.001 && numValue > 0) {
    const str = numValue.toFixed(20); // Get enough precision
    const match = str.match(/^0\.0+/);
    if (match && match[0].length > 3) { // More than "0.0"
      // Subtract "0." (2 chars) to get the count of zeros after decimal point
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

/**
 * Calculate and format age from creation timestamp
 * Returns formatted string like "1h", "2d", "3mo", "1y"
 */
function formatAge(createdAt: string | undefined): string {
  if (!createdAt) return '-';

  try {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years}y`;
    if (months > 0) return `${months}mo`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  } catch {
    return '-';
  }
}

/**
 * Check if token is new (less than 24 hours old)
 */
function isNewToken(createdAt: string | undefined): boolean {
  if (!createdAt) return false;

  try {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    return hours < 24;
  } catch {
    return false;
  }
}

/**
 * Check if token is hot (high volume/activity in 24h)
 * Criteria: volume > $500K OR txns > 1000 OR price change > +50%
 */
function isHotToken(volume24h: number | undefined, txns24h: number | undefined, priceChange24h: number | undefined): boolean {
  // High volume (> $500K)
  if (volume24h && volume24h > 500000) return true;
  // High transaction count (> 1000)
  if (txns24h && txns24h > 1000) return true;
  // High price increase (> +50%)
  if (priceChange24h && priceChange24h > 50) return true;
  return false;
}

function formatCurrency(value: number | undefined | null | string): string {
  // Convert to number if it's a string
  let numValue: number;
  if (typeof value === 'string') {
    numValue = parseFloat(value);
    if (isNaN(numValue)) return '$0';
  } else if (typeof value === 'number') {
    numValue = value;
  } else {
    return '$0';
  }

  if (!numValue || numValue === 0 || isNaN(numValue)) return '$0';
  if (numValue >= 1e9) {
    return `$${(numValue / 1e9).toFixed(2)}B`;
  } else if (numValue >= 1e6) {
    return `$${(numValue / 1e6).toFixed(1)}M`;
  } else if (numValue >= 1e3) {
    return `$${(numValue / 1e3).toFixed(0)}K`;
  }
  return `$${numValue.toFixed(0)}`;
}

function formatChange(value: number | undefined | null | string): string {
  // Convert to number if it's a string
  let numValue: number;
  if (typeof value === 'string') {
    numValue = parseFloat(value);
    if (isNaN(numValue)) return '0%';
  } else if (typeof value === 'number') {
    numValue = value;
  } else {
    return '0%';
  }

  if (numValue === undefined || numValue === null || isNaN(numValue)) return '0%';
  const sign = numValue >= 0 ? '+' : '';
  return `${sign}${numValue.toFixed(1)}%`;
}

/**
 * Get native token symbol for a network
 */
function getNativeTokenSymbol(network: string): string {
  const networkLower = network.toLowerCase();
  if (networkLower === 'sol' || networkLower === 'solana') return 'SOL';
  if (networkLower === 'bsc' || networkLower === 'binance') return 'BNB';
  if (networkLower === 'eth' || networkLower === 'ethereum') return 'ETH';
  if (networkLower === 'base') return 'ETH';
  if (networkLower === 'arbitrum' || networkLower === 'arb') return 'ETH';
  if (networkLower === 'optimism' || networkLower === 'op') return 'ETH';
  if (networkLower === 'polygon' || networkLower === 'matic') return 'MATIC';
  if (networkLower === 'avax' || networkLower === 'avalanche') return 'AVAX';
  if (networkLower === 'fantom') return 'FTM';
  return 'ETH'; // Default to ETH
}

function formatNetworkName(network: string): string {
  const networkMap: Record<string, string> = {
    'eth': 'ETH',
    'ethereum': 'ETH',
    'bsc': 'BSC',
    'solana': 'SOL',
    'base': 'BASE',
    'arbitrum': 'ARB',
    'optimism': 'OP',
    'polygon': 'MATIC',
    'avax': 'AVAX',
    'avalanche': 'AVAX',
    'fantom': 'FTM',
  };
  return networkMap[network.toLowerCase()] || network.toUpperCase();
}

// Convert API TokenSearchResult to internal Token format
function convertApiTokenToToken(apiToken: TokenSearchResult, id: number): Token {
  const networkName = formatNetworkName(apiToken.network);

  // Ensure numeric values are properly converted (handle string, number, null, undefined)
  const price = typeof apiToken.price === 'number'
    ? apiToken.price
    : (apiToken.price ? parseFloat(String(apiToken.price)) : undefined);
  const priceChange5m = typeof apiToken.priceChange5m === 'number'
    ? apiToken.priceChange5m
    : (apiToken.priceChange5m ? parseFloat(String(apiToken.priceChange5m)) : undefined);
  const priceChange1h = typeof apiToken.priceChange1h === 'number'
    ? apiToken.priceChange1h
    : (apiToken.priceChange1h ? parseFloat(String(apiToken.priceChange1h)) : undefined);
  const priceChange6h = typeof apiToken.priceChange6h === 'number'
    ? apiToken.priceChange6h
    : (apiToken.priceChange6h ? parseFloat(String(apiToken.priceChange6h)) : undefined);
  const priceChange24h = typeof apiToken.priceChange24h === 'number'
    ? apiToken.priceChange24h
    : (apiToken.priceChange24h ? parseFloat(String(apiToken.priceChange24h)) : undefined);
  const volume24h = typeof apiToken.volume24h === 'number'
    ? apiToken.volume24h
    : (apiToken.volume24h ? parseFloat(String(apiToken.volume24h)) : undefined);
  const liquidity = typeof apiToken.liquidity === 'number'
    ? apiToken.liquidity
    : (apiToken.liquidity ? parseFloat(String(apiToken.liquidity)) : undefined);
  const fdv = typeof apiToken.fdv === 'number'
    ? apiToken.fdv
    : (apiToken.fdv ? parseFloat(String(apiToken.fdv)) : undefined);

  return {
    id,
    name: apiToken.name || 'Unknown',
    symbol: apiToken.symbol || 'UNKNOWN',
    chain: networkName,
    imageUrl: apiToken.imageUrl, // Token logo from API
    poolCreatedAt: apiToken.poolCreatedAt,
    isNew: isNewToken(apiToken.poolCreatedAt), // Check if less than 24h old
    isHot: isHotToken(volume24h, apiToken.txns24h, priceChange24h), // Check if hot (high activity)
    price: formatPrice(price),
    age: formatAge(apiToken.poolCreatedAt), // Calculate age from creation time
    txns: apiToken.txns24h || 0,
    buys: apiToken.buys24h || 0,
    sells: apiToken.sells24h || 0,
    volume: formatCurrency(volume24h),
    makers: apiToken.holders || 0, // Using holders count for makers display
    holders: apiToken.holders,
    c5m: formatChange(priceChange5m),  // 5 minutes change
    c1h: formatChange(priceChange1h),  // 1 hour change
    c6h: formatChange(priceChange6h), // 6 hours change
    c24h: formatChange(priceChange24h), // 24 hours change
    liquidity: formatCurrency(liquidity),
    fdv: formatCurrency(fdv),
    address: apiToken.address, // Store address for detail page
    poolAddress: apiToken.poolAddress, // Critical for charts
    network: apiToken.network, // Store network for detail page

    // Raw fields for fast sorting
    priceRaw: price || 0,
    volumeRaw: volume24h || 0,
    liquidityRaw: liquidity || 0,
    fdvRaw: fdv || 0,
    c5mRaw: priceChange5m || 0,
    c1hRaw: priceChange1h || 0,
    c6hRaw: priceChange6h || 0,
    c24hRaw: priceChange24h || 0,
    ageRaw: apiToken.poolCreatedAt ? new Date(apiToken.poolCreatedAt).getTime() : 0,
    socialLinks: {
      website: apiToken.websites?.[0]?.url || apiToken.socials?.find(s => s.type === 'website')?.url,
      twitter: apiToken.socials?.find(s => s.type === 'twitter')?.url,
      telegram: apiToken.socials?.find(s => s.type === 'telegram')?.url,
      discord: apiToken.socials?.find(s => s.type === 'discord')?.url,
    },
    trendingScore: calculateTrendingScore({
      volume24h: volume24h || 0,
      txns24h: apiToken.txns24h || 0,
      priceChange24h: priceChange24h || 0,
      liquidity: liquidity || 0,
      // Estimate makers if not available (approx 50% of txns as unique, capped)
      makers: apiToken.txns24h ? Math.floor(apiToken.txns24h * 0.5) : 0,
      // Note: uniqueHolders is not available in list API, only in details enrichment
    }),
  };
}

const getChainColor = (chain: string): string => {
  switch (chain) {
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
  const chainLower = chain.toLowerCase();
  if (chainLower === 'eth' || chainLower === 'ethereum') return 'https://assets.coingecko.com/coins/images/279/small/ethereum.png';
  if (chainLower === 'sol' || chainLower === 'solana') return 'https://assets.coingecko.com/coins/images/4128/small/solana.png';
  if (chainLower === 'base') return 'https://assets.coingecko.com/asset_platforms/images/131/small/base.png';
  if (chainLower === 'bsc' || chainLower === 'binance') return 'https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png';
  if (chainLower === 'arbitrum' || chainLower === 'arb') return 'https://assets.coingecko.com/asset_platforms/images/33/small/arbitrum-one.png';
  if (chainLower === 'optimism' || chainLower === 'op') return 'https://assets.coingecko.com/asset_platforms/images/41/small/optimism.png';
  if (chainLower === 'polygon' || chainLower === 'matic') return 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png';
  if (chainLower === 'avax' || chainLower === 'avalanche') return 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png';
  return '';
};

const TokenRow = React.memo(({
  token: t,
  index: i,
  isMobile,
  onTokenClick
}: {
  token: Token;
  index: number;
  isMobile: boolean;
  onTokenClick: (token: Token) => void;
}) => {
  const changeValue = t.c5m;
  const isPositive = changeValue.startsWith('+');
  const buyPct = t.buys + t.sells > 0 ? (t.buys / (t.buys + t.sells)) * 100 : 50;

  return (
    <tr
      onClick={() => onTokenClick(t)}
      className={styles.tr}
    >
      {/* Token Info */}
      <td
        className={styles.td}
        style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
      >
        <div className={styles.tokenInfo}>
          {!isMobile && (
            <span className={styles.rank}>
              {i + 1}
            </span>
          )}
          <div className={`${styles.tokenIconWrapper} ${isMobile ? styles.tokenIconWrapperMobile : ''}`}>
            {isMobile && (
              <span className={`${styles.avatarRankBadge} ${t.isNew ? styles.avatarRankNew : ''} ${t.isHot && !t.isNew ? styles.avatarRankHot : ''}`}>
                {t.isNew ? 'NEW' : t.isHot ? 'HOT' : i + 1}
              </span>
            )}
            <img
              src={t.imageUrl || `https://ui-avatars.com/api/?name=${t.symbol}&background=random&color=fff`}
              alt={t.name}
              className={styles.tokenIcon}
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${t.symbol}&background=random&color=fff`;
              }}
            />
            <img
              src={getChainLogo(t.chain)}
              alt={t.chain}
              className={styles.chainLogo}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.parentElement) {
                  e.currentTarget.parentElement.style.background = getChainColor(t.chain);
                }
              }}
            />
          </div>

          <div className={styles.tokenNameCol}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <span className={styles.tokenSymbol}>{t.symbol}</span>
              {t.isNew && !isMobile && (
                <span style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}>NEW</span>
              )}
              {t.isHot && !t.isNew && !isMobile && (
                <span style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}>HOT</span>
              )}
            </div>
            <span className={styles.tokenName}>{t.name}</span>
          </div>
        </div>
      </td>

      {/* Price */}
      <td
        className={`${styles.td} ${styles.tdRight}`}
        style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
      >
        <div className={styles.price}>
          {t.price}
        </div>
      </td>

      {/* Change (based on timeframe) */}
      <td
        className={`${styles.td} ${styles.tdRight} ${isPositive ? styles.changePositive : styles.changeNegative}`}
        style={{ padding: isMobile ? '10px 8px' : '12px 16px', fontSize: isMobile ? '11px' : '12px' }}
      >
        {changeValue}
      </td>

      {/* Age */}
      <td
        className={`${styles.td} ${styles.tdRight} ${styles.age} ${((t.age.toLowerCase().endsWith('h') || t.age.toLowerCase().endsWith('m')) || t.isNew) ? styles.ageRecent : ''}`}
        style={{ padding: isMobile ? '10px 8px' : '12px 16px', fontSize: isMobile ? '11px' : '12px' }}
      >
        {t.age}
      </td>

      {/* Volume / Liquidity */}
      <td
        className={`${styles.td} ${styles.tdRight}`}
        style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
      >
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className={styles.volume}>
            <span className={styles.volLabel} style={{ marginRight: '4px', fontSize: isMobile ? '9px' : '11px', fontWeight: 500 }}>VOL:</span>
            {t.volume}
          </div>
          <div className={styles.volume}>
            <span className={styles.liqLabel} style={{ marginRight: '4px', fontSize: isMobile ? '9px' : '11px', fontWeight: 500 }}>LIQ:</span>
            {t.liquidity}
          </div>
        </div>
      </td>

      {/* Txns (Buy/Sell Bar) */}
      {!isMobile && (
        <td
          className={`${styles.td} ${styles.tdCenter}`}
          style={{ padding: '12px 16px' }}
        >
          <div className={styles.buySellBar} style={{ flexDirection: 'column' }}>
            <div className={styles.buySellBar} style={{ justifyContent: 'space-between', marginBottom: '2px' }}>
              <span className={styles.changePositive} style={{ fontSize: '9px' }}>
                {t.buys}
              </span>
              <span className={styles.changeNegative} style={{ fontSize: '9px' }}>
                {t.sells}
              </span>
            </div>
            <div className={styles.barContainer} style={{ height: '6px' }}>
              <div
                className={styles.buyBar}
                style={{ width: `${buyPct}%` }}
              ></div>
              <div
                className={styles.sellBar}
                style={{ width: `${100 - buyPct}%` }}
              ></div>
            </div>
          </div>
        </td>
      )}
    </tr>
  );
});

interface TokensPageProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Available chains for filtering
const CHAIN_OPTIONS = [
  { id: 'all', name: 'All Chains', logo: '', apiKey: '' },
  { id: 'ETH', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', apiKey: 'eth' },
  { id: 'SOL', name: 'Solana', logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png', apiKey: 'solana' },
  { id: 'BSC', name: 'BNB Chain', logo: 'https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png', apiKey: 'bsc' },
  { id: 'BASE', name: 'Base', logo: 'https://assets.coingecko.com/asset_platforms/images/131/small/base.png', apiKey: 'base' },
  { id: 'ARB', name: 'Arbitrum', logo: 'https://assets.coingecko.com/asset_platforms/images/33/small/arbitrum-one.png', apiKey: 'arbitrum' },
  { id: 'OP', name: 'Optimism', logo: 'https://assets.coingecko.com/asset_platforms/images/41/small/optimism.png', apiKey: 'optimism' },
  { id: 'MATIC', name: 'Polygon', logo: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png', apiKey: 'polygon' },
];

// Chains to fetch data from
const FETCH_CHAINS = CHAIN_OPTIONS.filter(c => c.apiKey).map(c => c.apiKey);

export const TokensPage: React.FC<TokensPageProps> = ({
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
}) => {
  // Page visibility detection
  const { isVisible } = usePageVisibility();
  const isTabVisible = useTabVisibility();
  const isPageActive = isVisible && isTabVisible;

  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [allTokens, setAllTokens] = useState<Token[]>([]); // All chains cached data
  const [tokens, setTokens] = useState<Token[]>([]); // Currently displayed tokens (for search)
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // Initial multi-chain load
  const [error, setError] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<string>(
    localStorage.getItem('kiko-selected-chain') || 'all'
  );
  const [showChainDropdown, setShowChainDropdown] = useState(false); // Chain dropdown visibility
  const [visibleCount, setVisibleCount] = useState(30);
  const loadingRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'trending' | 'favorites'>('trending'); // Tab state

  // Use external search if provided, otherwise use internal
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = externalOnSearchChange || setInternalSearchQuery;
  const [sortBy, setSortBy] = useState<keyof Token | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isMobile, setIsMobile] = useState(false);

  // Refs for request management
  const chainRequestIdsRef = useRef<Map<string, string>>(new Map());
  const mountedRef = useRef(true);

  // Load all chains data on initial mount - with queue and batching
  useEffect(() => {
    // Reset mounted ref on each mount (important for StrictMode)
    mountedRef.current = true;

    const loadAllChains = async () => {
      setInitialLoading(true);
      setError(null);

      try {



        // Keep track of all loaded tokens
        let currentTokens: Token[] = [];
        let tokenId = 1;

        // 1. Load from Cache first (Instant display)
        FETCH_CHAINS.forEach((chain) => {
          const cached = loadFromCache(chain);
          if (cached && cached.length > 0) {
            const cachedTokens = cached.map((token) => convertApiTokenToToken(token, tokenId++));
            currentTokens = [...currentTokens, ...cachedTokens];
          }
        });

        if (currentTokens.length > 0) {
          // GLOBAL TRENDING SORT: Sort by trendingScore descending
          currentTokens.sort((a, b) => b.trendingScore - a.trendingScore);

          // Assign unique IDs for the table display AFTER sorting
          const displayTokens = currentTokens.map((t, idx) => ({ ...t, id: idx + 1 }));
          setAllTokens(displayTokens);
          // INSTANT LOAD: If we have cache, hide loading immediately
          setInitialLoading(false);
        }

        // 2. Fetch Fresh Data (Parallel)
        const fetchPromises = FETCH_CHAINS.map(async (chain) => {
          if (!mountedRef.current) return [];

          try {
            const data = await tokenApi.getTrendingLive(chain, '5m', 100);

            if (mountedRef.current && data && data.length > 0) {
              // Save to cache
              saveToCache(chain, data);

              // Convert to internal tokens
              // We'll assign IDs later after aggregation
              return data.map((token) => convertApiTokenToToken(token, 0));
            }
          } catch (err) {
            console.warn(`Failed to load ${chain} tokens:`, err);
          }
          return [];
        });

        const results = await Promise.all(fetchPromises);
        let freshTokens = results.flat();

        // GLOBAL TRENDING SORT: Rank tokens from all chains by popularity
        if (freshTokens.length > 0) {
          freshTokens.sort((a, b) => b.trendingScore - a.trendingScore);
        }

        // Batch update
        if (mountedRef.current && freshTokens.length > 0) {
          // Assign unique IDs for the table display AFTER global sorting
          const displayTokens = freshTokens.map((t, idx) => ({ ...t, id: idx + 1 }));
          setAllTokens(displayTokens);
        }

        if (mountedRef.current) {
          setInitialLoading(false);
          if (freshTokens.length === 0 && currentTokens.length === 0) {
            setError('No trending tokens available. The data may still be loading.');
          }
        }
      } catch (err) {
        if (mountedRef.current) {
          console.error('Error loading all chains:', err);
          setError(`Failed to load trending tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } finally {
        if (mountedRef.current) {
          setInitialLoading(false);
        }
      }
    };

    // Always load on mount, regardless of page visibility
    loadAllChains();

    // Cleanup on unmount
    return () => {
      chainRequestIdsRef.current.forEach((requestId) => {
        requestManager.cancel(requestId);
      });
      chainRequestIdsRef.current.clear();
    };
  }, []); // Empty dependency array - load only once on mount

  // 30-second polling for real-time updates
  useEffect(() => {
    if (!isPageActive) return;

    const POLL_INTERVAL = 30000; // 30 seconds

    const pollData = async () => {
      if (!mountedRef.current || !isPageActive) return;




      try {
        const promises = FETCH_CHAINS.map(async (chain) => {
          if (!mountedRef.current) return [];
          try {
            const data = await tokenApi.getTrendingLive(chain, '5m', 100);
            if (mountedRef.current && data && data.length > 0) {
              return data.map((token) => convertApiTokenToToken(token, 0));
            }
          } catch (err) {
            // Silently ignore poll errors
          }
          return [];
        });

        const results = await Promise.all(promises);
        let freshTokens = results.flat();

        if (mountedRef.current && freshTokens.length > 0) {
          // GLOBAL TRENDING SORT: Keep the list ranked by popularity across all chains
          freshTokens.sort((a, b) => b.trendingScore - a.trendingScore);

          const displayTokens = freshTokens.map((t, idx) => ({ ...t, id: idx + 1 }));
          setAllTokens(displayTokens);
        }
      } catch (e) {
        // Silently ignore
      }
    };

    // Trigger immediate poll on activation
    pollData();

    const intervalId = setInterval(pollData, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isPageActive]);

  // Cleanup on unmount
  useEffect(() => {
    // Reset mounted ref on each mount (important for StrictMode)
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      chainRequestIdsRef.current.forEach((requestId) => {
        requestManager.cancel(requestId);
      });
      chainRequestIdsRef.current.clear();
    };
  }, []);

  // Handle search
  const searchRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setTokens([]);
      return;
    }


    // NOTE: Removed isPageActive check - user-initiated search should always run

    // Cancel previous search request
    if (searchRequestIdRef.current) {
      requestManager.cancel(searchRequestIdRef.current);
    }

    const searchTokens = async () => {
      const requestId = `search-${searchQuery}-${Date.now()}`;
      searchRequestIdRef.current = requestId;

      setLoading(true);
      setError(null);

      try {
        console.log('[TokensPage Search] Starting search for:', searchQuery);
        const results = await requestManager.execute(
          requestId,
          () => tokenApi.search(searchQuery),
          { priority: 2, timeout: 30000 } // Higher priority for user-initiated search
        );
        console.log('[TokensPage Search] API returned results:', results?.length, results);

        if (mountedRef.current && searchRequestIdRef.current === requestId) {
          const convertedTokens = results.map((token, index) =>
            convertApiTokenToToken(token, index + 1)
          );
          console.log('[TokensPage Search] Converted tokens:', convertedTokens.length, convertedTokens);
          setTokens(convertedTokens);
        } else {
          console.log('[TokensPage Search] Skipped setTokens - conditions not met', {
            mounted: mountedRef.current,
            requestMatch: searchRequestIdRef.current === requestId
          });
        }
      } catch (err) {
        if (mountedRef.current && searchRequestIdRef.current === requestId) {
          console.error('Error searching tokens:', err);
          setError('Failed to search tokens. Please try again.');
          setTokens([]);
        }
      } finally {
        if (mountedRef.current && searchRequestIdRef.current === requestId) {
          setLoading(false);
          searchRequestIdRef.current = null;
        }
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchTokens, 500);
    return () => {
      clearTimeout(timeoutId);
      if (searchRequestIdRef.current) {
        requestManager.cancel(searchRequestIdRef.current);
        searchRequestIdRef.current = null;
      }
    };
  }, [searchQuery]);

  const selectedTokenRef = useRef<Token | null>(null);

  // Persist selected chain
  useEffect(() => {
    localStorage.setItem('kiko-selected-chain', selectedChain);
  }, [selectedChain]);

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Close chain dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.chainSelector}`)) {
        setShowChainDropdown(false);
      }
    };

    if (showChainDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showChainDropdown]);

  // Favorites state
  const [favoriteAddresses, setFavoriteAddresses] = useState<Set<string>>(new Set());

  // Fetch favorites when tab changes to favorites or on mount
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favs = await favoriteApi.getFavorites();
        console.log('[TokensPage] Loaded favorites:', favs);
        // Store addresses in lowercase for consistent comparison
        const addresses = new Set(favs.map(f => f.address.toLowerCase()));
        console.log('[TokensPage] Favorite addresses set:', addresses);
        setFavoriteAddresses(addresses);
      } catch (err) {
        console.error('Failed to load favorites', err);
      }
    };

    // Always load initially and when tab becomes favorites
    loadFavorites();
  }, [activeTab]);

  // Filter and sort tokens
  const filteredAndSortedTokens = useMemo(() => {
    // Use search results if searching, otherwise use cached allTokens
    const sourceTokens = searchQuery.trim() ? tokens : allTokens;
    let filtered = [...sourceTokens];

    // Chain filter
    if (selectedChain !== 'all') {
      filtered = filtered.filter(t => t.chain === selectedChain);
    }

    // Search filter (additional filter on already searched results)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.symbol.toLowerCase().includes(query) ||
        t.chain.toLowerCase().includes(query) ||
        t.address?.toLowerCase().includes(query) ||
        t.poolAddress?.toLowerCase().includes(query)
      );
    }

    // Tab Filter: Favorites - use lowercase comparison
    if (activeTab === 'favorites') {
      console.log('[TokensPage] Filtering for favorites, addresses:', favoriteAddresses.size);
      filtered = filtered.filter(t => t.address && favoriteAddresses.has(t.address.toLowerCase()));
      console.log('[TokensPage] Filtered to', filtered.length, 'favorite tokens');
    }

    // Sort
    if (sortBy) {
      filtered.sort((a, b) => {
        const aVal: any = a[sortBy];
        const bVal: any = b[sortBy];

        let aNum: number, bNum: number;
        const aToken = a as Token;
        const bToken = b as Token;

        // Use raw fields for sorting to avoid parsing strings
        if (sortBy === 'age') {
          aNum = aToken.ageRaw;
          bNum = bToken.ageRaw;
        } else if (sortBy === 'volume') {
          aNum = aToken.volumeRaw;
          bNum = bToken.volumeRaw;
        } else if (sortBy === 'liquidity') {
          aNum = aToken.liquidityRaw;
          bNum = bToken.liquidityRaw;
        } else if (sortBy === 'fdv') {
          aNum = aToken.fdvRaw;
          bNum = bToken.fdvRaw;
        } else if (sortBy === 'price') {
          aNum = aToken.priceRaw;
          bNum = bToken.priceRaw;
        } else if (sortBy === 'c5m') {
          aNum = aToken.c5mRaw;
          bNum = bToken.c5mRaw;
        } else if (sortBy === 'c1h') {
          aNum = aToken.c1hRaw;
          bNum = bToken.c1hRaw;
        } else if (sortBy === 'c6h') {
          aNum = aToken.c6hRaw;
          bNum = bToken.c6hRaw;
        } else if (sortBy === 'c24h') {
          aNum = aToken.c24hRaw;
          bNum = bToken.c24hRaw;
        } else if (sortBy === 'trendingScore') {
          aNum = aToken.trendingScore;
          bNum = bToken.trendingScore;
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          aNum = aVal;
          bNum = bVal;
        } else {
          // String comparison for symbol, name, chain
          return sortDirection === 'asc'
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
        }

        // Adjust for Age: smaller timestamp = older token
        // In "desc" mode for age, we want newest first, so higher timestamp first
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      });
    } else {
      // Default: Keep API order (DexScreener's trending rank)
      // Do NOT re-sort by trendingScore as it changes the original order
    }

    return filtered;
  }, [tokens, allTokens, searchQuery, sortBy, sortDirection, selectedChain, activeTab, favoriteAddresses]);

  const handleSort = (column: keyof Token) => {
    if (sortBy === column) {
      // Same column clicked: desc → asc → cancel
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        // Was asc, now cancel sorting
        setSortBy(null);
        setSortDirection('desc');
      }
    } else {
      // New column: start with desc
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  // Refresh favorites callback - called when returning from detail page
  const refreshFavorites = useCallback(async () => {
    try {
      const favs = await favoriteApi.getFavorites();
      console.log('[TokensPage] Refreshed favorites on return:', favs.length);
      const addresses = new Set(favs.map(f => f.address.toLowerCase()));
      setFavoriteAddresses(addresses);
    } catch (err) {
      console.error('Failed to refresh favorites', err);
    }
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadingRef.current || filteredAndSortedTokens.length <= visibleCount) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          console.log('[TokensPage] Infinite scroll triggered');
          setVisibleCount((prev) => prev + 30);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [filteredAndSortedTokens.length, visibleCount]);

  const SortIcon: React.FC<{ column: keyof Token }> = ({ column }) => {
    if (sortBy !== column) return null;
    return sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  // Convert token list data to detail page format
  const getFallbackDetail = (token: Token) => {
    const priceNum = parseFloat(token.price.replace('$', '').replace(',', '').replace(/\.\.\..*/, '') || '0');
    const priceChange = parseFloat(token.c24h.replace('%', '').replace('+', '') || '0');
    const symbol = token.symbol || token.name || 'UNKNOWN';

    return {
      name: token.name || 'Unknown Token',
      symbol: symbol,
      pair: `${symbol} / ${getNativeTokenSymbol(token.chain)}`,
      chain: token.chain,
      price: isNaN(priceNum) ? '0.000000' : priceNum.toFixed(18),
      priceChange24h: isNaN(priceChange) ? 0 : priceChange,
      address: token.address || '',
      fdv: token.fdv,
      mcap: token.fdv,
      liquidity: token.liquidity,
      volume24h: token.volume,
      holders: token.holders || token.makers || 0,
      imageUrl: token.imageUrl,
      poolAddress: token.poolAddress,
      riskScore: 50,
      audit: {
        status: "Unverified",
        warnings: [],
      },
      socialLinks: token.socialLinks,
    };
  };

  const convertTokenToDetail = async (token: Token) => {
    // Map chain display name to API network slug
    const apiNetwork = token.network || token.chain.toLowerCase();

    // If we have address and network, fetch full details
    if (token.address && apiNetwork) {
      try {
        const details = await tokenApi.getDetails(apiNetwork, token.address);

        // Use API data if available
        const symbol = details.symbol || token.symbol || details.name || token.name || 'UNKNOWN';
        const name = details.name || token.name || 'Unknown Token';

        // Ensure price is a number
        const priceNum = typeof details.price === 'number'
          ? details.price
          : typeof details.price === 'string'
            ? parseFloat(details.price) || 0
            : 0;
        const priceChange = typeof details.priceChange24h === 'number'
          ? details.priceChange24h
          : typeof details.priceChange24h === 'string'
            ? parseFloat(details.priceChange24h) || 0
            : 0;

        return {
          name: name,
          symbol: symbol,
          pair: `${symbol} / ${getNativeTokenSymbol(details.network || apiNetwork)}`,
          chain: formatNetworkName(details.network || apiNetwork),
          price: isNaN(priceNum) ? '0.000000' : priceNum.toFixed(18),
          priceChange24h: isNaN(priceChange) ? 0 : priceChange,
          address: details.address || token.address,
          fdv: formatCurrency(details.fdv),
          mcap: formatCurrency(details.fdv),
          liquidity: formatCurrency(details.liquidity),
          volume24h: formatCurrency(details.volume24h),
          holders: details.holders || token.holders || 0,
          imageUrl: details.imageUrl || token.imageUrl,
          poolAddress: details.poolAddress || token.poolAddress,
          riskScore: Math.floor(Math.random() * 50) + 50,
          audit: {
            status: "Unverified",
            warnings: (typeof details.liquidity === 'string' ? parseFloat(details.liquidity.replace(/[^0-9.]/g, '')) : (details.liquidity || 0)) < 10000 ? ["Low Liquidity"] : ["Mintable"],
          },
          socialLinks: {
            website: details.websites?.[0]?.url || details.socials?.find(s => s.type === 'website')?.url,
            twitter: details.socials?.find(s => s.type === 'twitter')?.url,
            telegram: details.socials?.find(s => s.type === 'telegram')?.url,
            discord: details.socials?.find(s => s.type === 'discord')?.url,
          },
        };
      } catch (err) {
        console.error('Error fetching token details, using fallback:', err);
      }
    }

    // Fallback to basic info from list
    return getFallbackDetail(token);
  };

  const [detailToken, setDetailToken] = useState<any>(null);


  const handleTokenClick = (token: Token) => {
    console.log('[TokensPage] Immediate redirect for:', token.symbol, token.address);

    // 1. Set fallback data immediately to trigger navigation
    const fallback = getFallbackDetail(token);
    selectedTokenRef.current = token;
    setDetailToken(fallback);
    setSelectedToken(token);

    // 2. Fetch full details in the background and update
    const updateDetails = async () => {
      try {
        const detail = await convertTokenToDetail(token);
        // Only update if the user hasn't switched to another token or closed details
        if (detail && selectedTokenRef.current?.address === token.address) {
          console.log('[TokensPage] Full details loaded, updating state');
          setDetailToken(detail);
        }
      } catch (err) {
        console.error('[TokensPage] Background update error:', err);
      }
    };

    updateDetails();
  };

  // useCallback to prevent infinite render loops when passed to child components affecting Layout state
  const handleBack = useCallback(() => {
    // Refresh favorites when returning from detail page (user may have toggled)
    refreshFavorites();
    selectedTokenRef.current = null;
    setSelectedToken(null);
    setDetailToken(null);
  }, [refreshFavorites]);

  if (selectedToken && detailToken) {
    return (
      <TokenDetailPage
        token={detailToken}
        onBack={handleBack}
      />
    );
  }

  // Fixed to 5m timeframe
  const getChangeColumn = () => 'c5m';

  return (
    <PageContainer fullWidth className={styles.container}>
      {/* Token Table */}
      <div className={`${styles.content} ${isMobile ? styles.contentMobile : ''}`}>
        <div className={styles.controlBar}>
          <div className={styles.filterGroup}>
            <button
              className={`${styles.filterBtn} ${activeTab === 'trending' ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveTab('trending')}
            >
              Trending
            </button>
            <button
              className={`${styles.filterBtn} ${activeTab === 'favorites' ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              Favorites
            </button>
          </div>

          <div className={styles.controlsRow}>
            <div className={styles.searchWrapper}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={styles.clearButton}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {
          (loading || initialLoading) && (
            <div className={styles.tableCard}>
              <table className={styles.table}>
                <colgroup>
                  <col style={{ width: isMobile ? '32%' : '28%' }} />
                  <col style={{ width: isMobile ? '18%' : '14%' }} />
                  <col style={{ width: isMobile ? '14%' : '12%' }} />
                  <col style={{ width: isMobile ? '12%' : '8%' }} />
                  <col style={{ width: isMobile ? '24%' : '20%' }} />
                  {!isMobile && <col style={{ width: '18%' }} />}
                </colgroup>
                <thead className={styles.thead}>
                  <tr>
                    <th className={styles.th} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                      <div className={styles.thContent}>Token Info</div>
                    </th>
                    <th className={`${styles.th} ${styles.thRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                      <div className={`${styles.thContent} ${styles.thContentRight}`}>Price</div>
                    </th>
                    <th className={`${styles.th} ${styles.thRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                      <div className={`${styles.thContent} ${styles.thContentRight}`}>5M</div>
                    </th>
                    <th className={`${styles.th} ${styles.thRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                      <div className={`${styles.thContent} ${styles.thContentRight}`}>Age</div>
                    </th>
                    <th className={`${styles.th} ${styles.thRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                      <div className={`${styles.thContent} ${styles.thContentRight}`}>Vol / Liq</div>
                    </th>
                    {!isMobile && (
                      <th className={`${styles.th} ${styles.thCenter}`} style={{ padding: '12px 16px' }}>
                        <div className={`${styles.thContent} ${styles.thContentCenter}`}>Txns</div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className={styles.tbody}>
                  {Array.from({ length: 15 }).map((_, i) => (
                    <tr key={i} className={styles.tr}>
                      <td className={styles.td} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                        <div className={styles.skeletonCell}>
                          {!isMobile && <div className={styles.skeletonText} style={{ width: '18px', marginRight: '4px' }} />}
                          <div className={`${styles.skeletonIconWrapper} ${isMobile ? styles.skeletonIconWrapperMobile : ''}`}>
                            {isMobile && <div className={styles.skeletonBadge} />}
                            <div className={styles.skeletonAvatar} />
                            <div className={styles.skeletonChainLogo} />
                          </div>
                          <div>
                            <div className={`${styles.skeletonText} ${styles.skeletonTextMedium}`} />
                            <div className={`${styles.skeletonText} ${styles.skeletonTextName}`} style={{ marginTop: 4 }} />
                          </div>
                        </div>
                      </td>
                      <td className={`${styles.td} ${styles.tdRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                        <div className={`${styles.skeletonText} ${styles.skeletonTextMedium}`} style={{ marginLeft: 'auto' }} />
                      </td>
                      <td className={`${styles.td} ${styles.tdRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                        <div className={`${styles.skeletonText} ${styles.skeletonTextShort}`} style={{ marginLeft: 'auto' }} />
                      </td>
                      <td className={`${styles.td} ${styles.tdRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                        <div className={`${styles.skeletonText} ${styles.skeletonTextShort}`} style={{ marginLeft: 'auto' }} />
                      </td>
                      <td className={`${styles.td} ${styles.tdRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                        <div className={styles.skeletonText} style={{ width: '80%', marginLeft: 'auto' }} />
                      </td>
                      {!isMobile && (
                        <td className={`${styles.td} ${styles.tdCenter}`} style={{ padding: '12px 16px' }}>
                          <div className={styles.skeletonBar} style={{ width: '80%', margin: '0 auto' }} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        {/* Error State - Only show if no data available */}
        {
          error && !loading && !initialLoading && allTokens.length === 0 && (
            <div className={styles.errorContainer}>
              <div className={styles.errorMessage}>
                {error && (error.includes('request limit') || error.includes('429')) ? (
                  <>
                    <div>⚠️ API Rate Limit Exceeded</div>
                    <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
                      Please wait a moment and try again, or refresh the page
                    </div>
                  </>
                ) : (
                  error
                )}
              </div>
              {error && (error.includes('request limit') || error.includes('429')) && (
                <button
                  onClick={() => {
                    setError(null);
                    setTimeout(() => {
                      // Reload the page to retry
                      window.location.reload();
                    }, 5000);
                  }}
                  className={styles.retryBtn}
                >
                  Auto refresh in 5s
                </button>
              )}
            </div>
          )
        }

        {/* Empty State - Search with no results */}
        {
          !loading && !initialLoading && !error && searchQuery.trim() && filteredAndSortedTokens.length === 0 && (
            <div className={styles.emptyState}>
              <p>No tokens found for "{searchQuery}"</p>
              <p className={styles.emptyStateSub}>Try searching with a different term</p>
            </div>
          )
        }

        {/* Empty State - Chain filter with no results */}
        {
          !loading && !initialLoading && !error && !searchQuery.trim() && selectedChain !== 'all' && filteredAndSortedTokens.length === 0 && allTokens.length > 0 && (
            <div className={styles.emptyState}>
              <p>No tokens found for {CHAIN_OPTIONS.find(c => c.id === selectedChain)?.name || selectedChain}</p>
              <p className={styles.emptyStateSub}>Try selecting a different chain</p>
            </div>
          )
        }

        {
          filteredAndSortedTokens.length > 0 && !loading && !initialLoading && (
            <>
              <div className={styles.tableCard}>
                <div className={styles.tableHeader} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 className={styles.tableTitle} style={{ margin: 0 }}>
                    {activeTab === 'favorites'
                      ? 'Favorites'
                      : 'Trending'}
                  </h2>

                  <div className={styles.chainSelector}>
                    <button
                      className={styles.chainSelectorBtn}
                      onClick={() => setShowChainDropdown(!showChainDropdown)}
                    >
                      {selectedChain === 'all' ? (
                        null
                      ) : (
                        <img
                          src={CHAIN_OPTIONS.find(c => c.id === selectedChain)?.logo}
                          alt={selectedChain}
                          className={styles.chainSelectorIcon}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <span>{selectedChain === 'all' ? 'All' : CHAIN_OPTIONS.find(c => c.id === selectedChain)?.id}</span>
                      <ChevronDown size={14} />
                    </button>
                    {showChainDropdown && (
                      <div className={styles.chainDropdown}>
                        {CHAIN_OPTIONS.map(chain => (
                          <button
                            key={chain.id}
                            className={`${styles.chainOption} ${selectedChain === chain.id ? styles.chainOptionActive : ''}`}
                            onClick={() => {
                              setSelectedChain(chain.id);
                              setShowChainDropdown(false);
                            }}
                          >
                            {chain.logo ? (
                              <img
                                src={chain.logo}
                                alt={chain.name}
                                className={styles.chainOptionIcon}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className={styles.allChainsIcon}>⛓</span>
                            )}
                            <span>{chain.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <table className={styles.table}>
                  <colgroup>
                    <col style={{ width: isMobile ? '32%' : '28%' }} />
                    <col style={{ width: isMobile ? '18%' : '14%' }} />
                    <col style={{ width: isMobile ? '14%' : '12%' }} />
                    <col style={{ width: isMobile ? '12%' : '8%' }} />
                    <col style={{ width: isMobile ? '24%' : '20%' }} />
                    {!isMobile && <col style={{ width: '18%' }} />}
                  </colgroup>
                  <thead className={styles.thead}>
                    <tr>
                      <th
                        className={styles.th}
                        style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
                        onClick={() => handleSort('symbol')}
                      >
                        <div className={styles.thContent}>
                          Token Info
                          <SortIcon column="symbol" />
                        </div>
                      </th>
                      <th
                        className={`${styles.th} ${styles.thRight}`}
                        style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
                        onClick={() => handleSort('price')}
                      >
                        <div className={`${styles.thContent} ${styles.thContentRight}`}>
                          Price
                          <SortIcon column="price" />
                        </div>
                      </th>
                      <th
                        className={`${styles.th} ${styles.thRight}`}
                        style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
                        onClick={() => handleSort(getChangeColumn() as keyof Token)}
                      >
                        <div className={`${styles.thContent} ${styles.thContentRight}`}>
                          5M
                          <SortIcon column={getChangeColumn() as keyof Token} />
                        </div>
                      </th>
                      <th
                        className={`${styles.th} ${styles.thRight}`}
                        style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
                        onClick={() => handleSort('age')}
                      >
                        <div className={`${styles.thContent} ${styles.thContentRight}`}>
                          Age
                          <SortIcon column="age" />
                        </div>
                      </th>
                      <th
                        className={`${styles.th} ${styles.thRight}`}
                        style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
                        onClick={() => handleSort('volume')}
                      >
                        <div className={`${styles.thContent} ${styles.thContentRight}`}>
                          Vol / Liq
                          <SortIcon column="volume" />
                        </div>
                      </th>
                      {!isMobile && (
                        <th
                          className={`${styles.th} ${styles.thCenter}`}
                          style={{ padding: '12px 16px' }}
                          onClick={() => handleSort('txns')}
                        >
                          <div className={`${styles.thContent} ${styles.thContentCenter}`}>
                            Txns
                            <SortIcon column="txns" />
                          </div>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className={styles.tbody}>
                    {filteredAndSortedTokens.slice(0, visibleCount).map((t, i) => (
                      <TokenRow
                        key={t.id}
                        token={t}
                        index={i}
                        isMobile={isMobile}
                        onTokenClick={handleTokenClick}
                      />
                    ))}
                  </tbody>
                </table>

                {filteredAndSortedTokens.length > visibleCount && (
                  <div ref={loadingRef} className={styles.infiniteScrollLoader}>
                    <div className={styles.loadingSpinnerSmall}></div>
                    <span>Loading more tokens...</span>
                  </div>
                )}
              </div>
            </>
          )
        }
      </div >
    </PageContainer >
  );
};
