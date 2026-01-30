import React, { useState, useEffect, useRef } from 'react';
import {
  Activity
} from 'lucide-react';
import { marketApi } from '../services/api';
import type { ProtocolData, MarketOverview, ChainData } from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import { PageContainer } from '../components/Layout/PageContainer';
import { Skeleton } from '../components/Skeleton';
import styles from './SuperDefiPage.module.css';






// --- Formatting Helpers ---

function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '-';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatChange(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

// --- Helper Functions ---

function calculateGlobalStats(overview: MarketOverview | null, chains: ChainData[]): Array<{
  label: string;
  value: string;
  change: string;
  isUp: boolean;
  color: string;
}> {
  // Calculate Total TVL from chains
  const totalTvl = chains.reduce((sum, chain) => sum + chain.tvl, 0);
  const totalTvl24hAgo = chains.reduce((sum, chain) => {
    const change = chain.tvlChange24h || 0;
    const prevTvl = chain.tvl / (1 + change / 100);
    return sum + (isNaN(prevTvl) ? chain.tvl : prevTvl);
  }, 0);
  const tvlChange = totalTvl24hAgo > 0 ? ((totalTvl - totalTvl24hAgo) / totalTvl24hAgo) * 100 : 0;

  // Get 24h Volume from overview
  const volume24h = overview?.volume24h || 0;

  return [
    {
      label: "Total Value Locked",
      value: formatCurrency(totalTvl),
      change: formatChange(tvlChange),
      isUp: tvlChange >= 0,
      color: "#ffffff"
    },
    {
      label: "24h Volume",
      value: formatCurrency(volume24h),
      change: overview?.mcapChange24h !== undefined ? formatChange(overview.mcapChange24h) : "-5.4%",
      isUp: (overview?.mcapChange24h || 0) >= 0,
      color: "#ffffff"
    },
    {
      label: "Stablecoins Mcap",
      value: overview?.stablecoinsMcap ? formatCurrency(overview.stablecoinsMcap) : "$145.2B",
      change: "+0.1%",
      isUp: true,
      color: "#ffffff"
    },
    {
      label: "BTC Dominance",
      value: `${overview?.bitcoinDominance?.toFixed(1) || "52.4"}%`,
      change: overview?.btcDomChange24h !== undefined ? formatChange(overview.btcDomChange24h) : "+0.5%",
      isUp: (overview?.btcDomChange24h || 0) >= 0,
      color: "#ffffff"
    }
  ];
}





// --- Components ---

// Info Tooltip Component - Click to open popup




// Unified Logo Component for consistent styling across the page
interface LogoIconProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'chain' | 'protocol';
  logoUrl?: string;
}

const logoSizes = {
  sm: { container: 24, fontSize: 10, borderRadius: 6 },
  md: { container: 32, fontSize: 12, borderRadius: 8 },
  lg: { container: 36, fontSize: 14, borderRadius: 8 },
};

const chainColors: Record<string, string> = {
  ETH: "#6366f1",
  ETHEREUM: "#6366f1",
  SOL: "#22c55e",
  SOLANA: "#22c55e",
  TRON: "#ef4444",
  BSC: "#eab308",
  BNB: "#eab308",
  ARB: "#3b82f6",
  ARBITRUM: "#3b82f6",
  OP: "#dc2626",
  OPTIMISM: "#dc2626",
  MATIC: "#9333ea",
  POLYGON: "#9333ea",
  BASE: "#2563eb",
  POLY: "#9333ea",
  AVAX: "#e84142",
  AVALANCHE: "#e84142",
};

const LogoIcon: React.FC<LogoIconProps> = ({ name, size = 'md', logoUrl }) => {
  const { resolvedTheme } = useThemeContext();
  const isDark = resolvedTheme === 'dark';
  const sizeConfig = logoSizes[size];
  const upperName = name.toUpperCase();

  let bgColor = chainColors[upperName];

  // Generate a consistent color from protocol name if no chain color
  if (!bgColor) {
    // Hash the name to get a consistent color
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    bgColor = `hsl(${hue}, 65%, 55%)`;
  }

  const textColor = isDark ? '#ffffff' : '#ffffff';

  return (
    <div
      style={{
        width: `${sizeConfig.container}px`,
        height: `${sizeConfig.container}px`,
        minWidth: `${sizeConfig.container}px`,
        minHeight: `${sizeConfig.container}px`,
        borderRadius: `${sizeConfig.borderRadius}px`,
        background: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${sizeConfig.fontSize}px`,
        fontWeight: 'bold',
        color: textColor,
        border: 'none',
        boxShadow: isDark ? '0 1px 3px rgba(0, 0, 0, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
      title={name}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={(e) => {
            // Fallback to letter if image fails to load
            console.warn('[LogoIcon] Image failed to load:', logoUrl);
            const target = e.currentTarget;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.textContent = name[0]?.toUpperCase() || '?';
            }
          }}
        />
      ) : (
        name[0]?.toUpperCase() || '?'
      )}
    </div>
  );
};





export const SuperDefiPage: React.FC = () => {
  const { resolvedTheme } = useThemeContext();
  const mountedRef = useRef(false);

  const [protocols, setProtocols] = useState<ProtocolData[]>([]);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Load data on mount - simplified, no visibility check
  useEffect(() => {
    mountedRef.current = true; // Ensure it's true when component mounts
    loadAllData();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadAllData = async () => {
    if (!mountedRef.current) return;

    try {
      setLoading(true);
      setError(null);
      console.log('[SuperDefiPage] Starting to load data...');

      // Direct API calls - no requestManager
      const [protocolsData, chainsData, overviewData] = await Promise.all([
        marketApi.getProtocols().catch((err) => {
          console.warn('[SuperDefiPage] getProtocols failed:', err);
          return [];
        }),
        marketApi.getChains().catch((err) => {
          console.warn('[SuperDefiPage] getChains failed:', err);
          return [];
        }),
        marketApi.getOverview().catch((err) => {
          console.warn('[SuperDefiPage] getOverview failed:', err);
          return null;
        }),
      ]);

      console.log('[SuperDefiPage] Data loaded:', {
        protocols: Array.isArray(protocolsData) ? protocolsData.length : 0,
        chains: Array.isArray(chainsData) ? chainsData.length : 0,
        overview: overviewData !== null,
      });

      // Always update state if component is still mounted
      if (mountedRef.current) {
        const protocols = Array.isArray(protocolsData) ? protocolsData : [];
        if (protocols.length > 0) {
          console.log('[SuperDefiPage] First protocol:', protocols[0]);
          console.log('[SuperDefiPage] Has logoUrl?', 'logoUrl' in protocols[0], protocols[0].logoUrl);
        }
        const chains = Array.isArray(chainsData) ? chainsData : [];

        // Filter to only show top CEX protocols (Centralized Exchanges)
        // Only show legitimate, well-known exchanges with significant TVL
        const TOP_CEX_NAMES = [
          'Binance CEX', 'OKX', 'Bybit', 'Bitfinex', 'Robinhood',
          'Bitget', 'Gemini', 'HTX', 'Gate', 'Deribit',
          'MEXC', 'KuCoin', 'Crypto.com', 'Bitstamp', 'Kraken',
          'Coinbase', 'Coinbase Exchange', 'Upbit', 'Bithumb'
        ];

        const cexProtocols = protocols.filter(p => {
          const category = p.category?.toLowerCase() || '';
          // Must be CEX category AND in our whitelist of top exchanges
          return category === 'cex' && TOP_CEX_NAMES.includes(p.name);
        });
        console.log('[SuperDefiPage] Top CEX protocols filtered:', cexProtocols.length, 'from', protocols.length);
        setProtocols(cexProtocols.slice(0, 50));
        setChains(chains);
        setOverview(overviewData);
        setError(null);

        setLoading(false);
        console.log('[SuperDefiPage] State updated, loading set to false');
      }
    } catch (err: any) {
      console.error('[SuperDefiPage] Error loading data:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to load data');
        setProtocols([]);
        setChains([]);
        setOverview(null);
        setLoading(false);
        console.log('[SuperDefiPage] Error handled, loading set to false');
      }
    }
  };



  if (loading) {
    return (
      <PageContainer fullWidth>
        <div className={`${styles.container} ${styles[resolvedTheme]}`}>
          {/* Global Metrics Grid Skeleton */}
          <div className={styles.grid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.card}>
                <Skeleton variant="text" width={100} height={12} />
                <div style={{ marginTop: '12px' }}>
                  <Skeleton variant="text" width={140} height={32} />
                </div>
              </div>
            ))}
          </div>
          <div className={styles.sectionGrid}>
            {[1, 2].map(s => (
              <div key={s} className={styles.section}>
                <Skeleton variant="text" width={120} height={16} style={{ marginBottom: '16px' }} />
                <div className={styles.listContainer}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={styles.listItem}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <Skeleton variant="circular" width={28} height={28} />
                        <Skeleton variant="text" width="60%" height={20} />
                      </div>
                      <Skeleton variant="text" width={60} height={16} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (

      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>{error}</div>
        <button
          onClick={loadAllData}
          className={styles.retryButton}
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = calculateGlobalStats(overview, chains);

  return (
    <PageContainer fullWidth>
      <div className={`${styles.container} ${styles[resolvedTheme]}`}>
        {/* Global Metrics Grid (2x2) */}
        <div className={styles.grid}>
          {stats.map((stat, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.metricLabel}>{stat.label}</div>
              <div className={styles.metricValueRow}>
                <span className={styles.metricValue}>{stat.value}</span>
                <span className={`${styles.metricChange} ${stat.isUp ? styles.metricChangeUp : styles.metricChangeDown}`}>
                  {stat.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Section Grid for Lists */}
        <div className={styles.sectionGrid}>
          {/* Top Protocols */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <Activity size={16} color="#10b981" /> Top Protocols
              </h3>
            </div>
            <div className={styles.listContainer}>
              {protocols.slice(0, 10).map((protocol, i) => (
                <div
                  key={i}
                  className={styles.listItem}
                >
                  <div className={styles.tokenInfo}>
                    <span className={styles.rank}>#{i + 1}</span>
                    <LogoIcon name={protocol.name} size="sm" logoUrl={protocol.logoUrl} />
                    <span className={styles.tokenName}>{protocol.name}</span>
                  </div>
                  <div className={styles.tokenRight}>
                    <span className={styles.mcapTvl}>{formatCurrency(protocol.tvl)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
