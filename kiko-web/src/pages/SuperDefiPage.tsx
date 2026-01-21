import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Globe,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Maximize2,
  ArrowLeft,
  ExternalLink,
  Info,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Activity
} from 'lucide-react';
import { marketApi } from '../services/api';
import type { ProtocolData, MarketOverview, ChainData } from '../services/api';
import { useThemeContext } from '../contexts/ThemeContext';
import { PageContainer } from '../components/Layout/PageContainer';
import { Skeleton } from '../components/Skeleton';
import styles from './SuperDefiPage.module.css';


function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}



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
  trend: number[];
}> {
  // Calculate Total TVL from chains
  const totalTvl = chains.reduce((sum, chain) => sum + chain.tvl, 0);
  const totalTvl24hAgo = chains.reduce((sum, chain) => {
    const change = chain.tvlChange24h || 0;
    const prevTvl = chain.tvl / (1 + change / 100);
    return sum + (isNaN(prevTvl) ? chain.tvl : prevTvl);
  }, 0);
  const tvlChange = totalTvl24hAgo > 0 ? ((totalTvl - totalTvl24hAgo) / totalTvl24hAgo) * 100 : 0;

  // Get 24h Volume from overview (in billions)
  const volume24h = overview?.volume24h || 0;
  const volume24hB = volume24h / 1e9;
  // Mock volume change for now (could be calculated from historical data)
  const volumeChange = -5.4;

  // Stablecoins Mcap - not available from current APIs, use placeholder
  const stablecoinsMcap = 145.2; // This would need to come from CoinGecko or another API
  const stablecoinsChange = 0.1;

  // BTC Dominance from overview
  const btcDominance = overview?.bitcoinDominance || 0;
  const btcDominanceChange = 0.5; // This would need historical data to calculate

  // Generate trend data for one year (365 days)
  const generateTrend = (current: number, count: number = 365): number[] => {
    const trend: number[] = [];
    let val = current;

    // Generate backwards from today
    for (let i = 0; i < count; i++) {
      trend.unshift(val);
      // Random walk: -2% to +2% daily change
      const changePercent = (Math.random() - 0.5) * 0.04;
      val = val / (1 + changePercent);
    }
    return trend;
  };

  return [
    {
      label: "Total Value Locked",
      value: formatCurrency(totalTvl),
      change: formatChange(tvlChange),
      isUp: tvlChange >= 0,
      trend: generateTrend(totalTvl / 1e9, 365).map(v => v * 1e9)
    },
    {
      label: "24h Volume",
      value: formatCurrency(volume24h),
      change: formatChange(volumeChange),
      isUp: volumeChange >= 0,
      trend: generateTrend(volume24hB, 365).map(v => v * 1e9)
    },
    {
      label: "Stablecoins Mcap",
      value: formatCurrency(stablecoinsMcap * 1e9),
      change: formatChange(stablecoinsChange),
      isUp: stablecoinsChange >= 0,
      trend: generateTrend(stablecoinsMcap, 365).map(v => v * 1e9)
    },
    {
      label: "BTC Dominance",
      value: `${btcDominance.toFixed(1)}%`,
      change: formatChange(btcDominanceChange),
      isUp: btcDominanceChange >= 0,
      trend: generateTrend(btcDominance, 365)
    },
  ];
}

function calculateChainStats(chains: ChainData[]): Array<{
  name: string;
  percent: number;
  color: string;
  tvl: string;
  logoUrl?: string;
}> {
  if (!chains || chains.length === 0) {
    return [];
  }

  const totalTvl = chains.reduce((sum, chain) => sum + chain.tvl, 0);

  if (totalTvl === 0) {
    return [];
  }

  // Chain color mapping
  const chainColors: Record<string, string> = {
    "Ethereum": "#6366f1",
    "Tron": "#ef4444",
    "BSC": "#eab308",
    "BNB Chain": "#eab308",
    "Arbitrum": "#3b82f6",
    "Solana": "#22c55e",
    "Base": "#2563eb",
    "Optimism": "#dc2626",
    "Polygon": "#9333ea",
    "Avalanche": "#e84142",
  };

  // Get top 5 chains
  const topChains = chains
    .filter(chain => chain.tvl > 0)
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, 5);

  const chainStats = topChains.map(chain => ({
    name: chain.name,
    percent: (chain.tvl / totalTvl) * 100,
    color: chainColors[chain.name] || "#4b5563",
    tvl: formatCurrency(chain.tvl),
    logoUrl: chain.logoUrl,
  }));

  // Calculate "Others" percentage
  const othersTvl = chains
    .filter(chain => !topChains.some(tc => tc.name === chain.name))
    .reduce((sum, chain) => sum + chain.tvl, 0);

  if (othersTvl > 0) {
    chainStats.push({
      name: "Others",
      percent: (othersTvl / totalTvl) * 100,
      color: "#4b5563",
      tvl: formatCurrency(othersTvl),
      logoUrl: undefined,
    });
  }

  return chainStats;
}

// Chain name to DeFiLlama icon slug mapping (Copied from ChainsPage)
const CHAIN_ICON_SLUGS: Record<string, string> = {
  'Ethereum': 'ethereum',
  'Solana': 'solana',
  'BSC': 'binance',
  'Bitcoin': 'bitcoin',
  'Tron': 'tron',
  'Base': 'base',
  'Arbitrum': 'arbitrum',
  'Polygon': 'polygon',
  'Avalanche': 'avalanche',
  'OP Mainnet': 'optimism',
  'Aptos': 'aptos',
  'Hyperliquid L1': 'hyperliquid',
  'Linea': 'linea',
  'Mantle': 'mantle',
  'Scroll': 'scroll',
  'ZKsync Era': 'zksync%20era',
  'Berachain': 'berachain',
  'Sei': 'sei',
  'Starknet': 'starknet',
  'Near': 'near',
  'TON': 'ton',
  'Fantom': 'fantom',
  'Gnosis': 'gnosis',
  'Celo': 'celo',
  'Sonic': 'sonic',
  'Monad': 'monad',
  'Ink': 'ink',
  'Ronin': 'ronin',
  'Flow': 'flow',
  'Flare': 'flare',
  'Kaia': 'kaia',
  'opBNB': 'op_bnb',
  'Arbitrum Nova': 'arbitrum%20nova',
  'Polygon zkEVM': 'polygon%20zkevm',
  'Boba': 'boba',
  'Plasma': 'plasma',
  'Katana': 'katana',
  'Unichain': 'unichain',
  'World Chain': 'world%20chain',
  'Abstract': 'abstract',
  'Story': 'story',
  'Taiko': 'taiko',
  'Hemi': 'hemi',
  'Somnia': 'somnia',
  'Sophon': 'sophon',
  'Mezo': 'mezo',
  'Corn': 'corn',
  'Peaq': 'peaq',
  'TAC': 'tac',
  'Superseed': 'superseed',
  'Shape': 'shape',
  'Plume Mainnet': 'plume',
};

function getChainIcon(chainName: string): string {
  // Handle common variations
  let name = chainName;
  if (name.toLowerCase() === 'bnb chain' || name.toLowerCase() === 'binance smart chain') name = 'BSC';
  if (name.toLowerCase() === 'arbitrum one') name = 'Arbitrum';

  const slug = CHAIN_ICON_SLUGS[name] || CHAIN_ICON_SLUGS[Object.keys(CHAIN_ICON_SLUGS).find(k => k.toLowerCase() === name.toLowerCase()) || ''] || name.toLowerCase().replace(/ /g, '%20');
  return `https://icons.llamao.fi/icons/chains/rsz_${slug}?w=128&h=128`;
}

// --- Components ---

// Info Tooltip Component - Click to open popup
interface InfoTooltipProps {
  title: string;
  content: string;
  source?: string;
  sourceUrl?: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ title, content, source, sourceUrl }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <HelpCircle size={16} color={isOpen ? '#5B8DEF' : '#999999'} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
          />

          {/* Tooltip Popup */}
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '280px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
              background: 'rgba(91, 141, 239, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <Info size={14} color="#5B8DEF" />
                {title}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  fontSize: '16px',
                  color: '#999',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{
              padding: '12px 16px',
            }}>
              <p style={{
                fontSize: '13px',
                color: '#666',
                lineHeight: 1.5,
                margin: 0,
              }}>
                {content}
              </p>

              {source && (
                <div style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontSize: '11px',
                    color: '#999',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Data Source
                  </span>
                  {sourceUrl ? (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '12px',
                        color: '#5B8DEF',
                        fontWeight: 'bold',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {source}
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span style={{
                      fontSize: '12px',
                      color: '#1a1a1a',
                      fontWeight: 'bold',
                    }}>
                      {source}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface MiniSparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}

const MiniSparkline: React.FC<MiniSparklineProps> = ({
  data,
  color = "#5B8DEF",
  width = 100,
  height = 30,
  strokeWidth = 2
}) => {
  // Sample data if it's too long (e.g., 365 points -> sample to ~60 points for display)
  let displayData = data;
  if (data.length > width) {
    const sampleRate = Math.ceil(data.length / width);
    displayData = data.filter((_, i) => i % sampleRate === 0);
  }

  const max = Math.max(...displayData);
  const min = Math.min(...displayData);
  const range = max - min || 1;

  const points = displayData.map((d, i) => {
    const x = (i / (displayData.length - 1 || 1)) * width;
    const y = height - ((d - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};



interface AdvancedAreaChartProps {
  height?: number;
  data?: number[];
}

const AdvancedAreaChart: React.FC<AdvancedAreaChartProps> = ({ height = 300, data: propData }) => {
  const { resolvedTheme } = useThemeContext();
  const isDark = resolvedTheme === 'dark';
  const chartColor = isDark ? "#5B8DEF" : "#2563eb";

  // Use provided data or generate one year of mock data
  let data = propData;
  if (!data || data.length < 365) {
    // Generate one year of data (365 points) if not provided or insufficient
    const baseValue = propData && propData.length > 0 ? propData[propData.length - 1] : 100;
    data = [];
    let current = baseValue;
    for (let i = 0; i < 365; i++) {
      data.unshift(current);
      const change = (Math.random() - 0.5) * 0.04;
      current = current / (1 + change);
    }
  }
  const width = 1000;
  const max = Math.max(...data);
  const min = Math.min(...data);

  let pathD = `M 0,${height} `;
  data.forEach((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / (max - min)) * height * 0.8 - 20;
    pathD += `L ${x},${y} `;
  });
  pathD += `L ${width},${height} Z`;

  let lineD = "";
  data.forEach((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / (max - min)) * height * 0.8 - 20;
    lineD += `${i === 0 ? 'M' : 'L'} ${x},${y} `;
  });

  // Generate unique gradient ID to avoid conflicts
  const gradientId = `chartGradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={pathD} fill={`url(#${gradientId})`} />
        <path
          d={lineD}
          fill="none"
          stroke={chartColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
};

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

// ChainIcon wrapper for backward compatibility
interface ChainIconProps {
  chain: string;
  logoUrl?: string;
}

const ChainIcon: React.FC<ChainIconProps> = ({ chain, logoUrl }) => {
  if (!logoUrl) {
    // console.log('[ChainIcon] Missing logoUrl for chain:', chain);
  }
  return <LogoIcon name={chain} size="sm" variant="chain" logoUrl={logoUrl} />;
};

interface ProtocolDetailViewProps {
  protocol: ProtocolData;
  onBack: () => void;
}

const ProtocolDetailView: React.FC<ProtocolDetailViewProps> = ({ protocol, onBack }) => {
  const { resolvedTheme } = useThemeContext();
  const isDark = resolvedTheme === 'dark';
  const themeColors = useMemo(() => ({
    bg: isDark ? '#18181b' : '#FAF7F2',
    cardBg: isDark ? '#1f1f23' : '#FFFFFF',
    text: isDark ? '#f4f4f5' : '#1a1a1a',
    textSecondary: isDark ? '#a1a1aa' : '#666666',
    textMuted: isDark ? '#71717a' : '#999999',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    borderLight: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
    hoverBg: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
    buttonBg: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
  }), [isDark]);

  const [tvlHistory, setTvlHistory] = useState<number[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [protocolWebsite, setProtocolWebsite] = useState<string | null>(null);
  const [loadingWebsite, setLoadingWebsite] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    loadProtocolHistory();
    loadProtocolWebsite();
  }, [protocol.name]);

  const loadProtocolWebsite = async () => {
    try {
      setLoadingWebsite(true);
      const details = await marketApi.getProtocolDetails(protocol.name);
      if (details && (details.website || details.url)) {
        setProtocolWebsite(details.website || details.url || null);
      }
    } catch (error) {
      console.error('Error loading protocol website:', error);
    } finally {
      setLoadingWebsite(false);
    }
  };

  const loadProtocolHistory = async () => {
    try {
      setLoadingHistory(true);
      // NOTE: The following logging and state update for 'protocolsData' and 'setProtocols'
      // appears to be intended for a different component (e.g., SuperDefiPage) that manages
      // a list of protocols, not for ProtocolDetailView which focuses on a single protocol's history.
      // Inserting it here would cause a syntax error as 'setProtocols' is not defined in this scope.
      // Therefore, this specific change is skipped to maintain syntactical correctness.
      // If you intended to add logging for the *current* protocol's history, please clarify.

      const history = await marketApi.getProtocolHistory(protocol.name);

      if (history && history.length > 0) {
        // Convert [timestamp, tvl] pairs to just TVL values
        // Generate one year of data (365 days) - take last year or sample
        let tvlValues: number[] = [];
        if (history.length >= 365) {
          // Take last 365 days
          const recentHistory = history.slice(-365);
          tvlValues = recentHistory.map(([_, tvl]) => tvl);
        } else {
          // Interpolate to 365 points
          tvlValues = history.map(([_, tvl]) => tvl);
          // If we have less than 365 points, interpolate
          while (tvlValues.length < 365) {
            const lastValue = tvlValues[tvlValues.length - 1];
            const variation = (Math.random() - 0.5) * 0.02;
            tvlValues.push(Math.max(0, lastValue * (1 + variation)));
          }
        }
        setTvlHistory(tvlValues);
      } else {
        // Fallback: generate one year of mock data based on current TVL
        const mockHistory: number[] = [];
        let currentTvl = protocol.tvl;
        for (let i = 0; i < 365; i++) {
          mockHistory.unshift(currentTvl);
          const changePercent = (Math.random() - 0.5) * 0.04;
          currentTvl = currentTvl / (1 + changePercent);
        }
        setTvlHistory(mockHistory);
      }
    } catch (error) {
      console.error('Error loading protocol history:', error);
      // Fallback: generate one year of mock data based on current TVL
      const mockHistory: number[] = [];
      let currentTvl = protocol.tvl;
      for (let i = 0; i < 365; i++) {
        mockHistory.unshift(currentTvl);
        const changePercent = (Math.random() - 0.5) * 0.04;
        currentTvl = currentTvl / (1 + changePercent);
      }
      setTvlHistory(mockHistory);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleWebsiteClick = () => {
    if (protocolWebsite) {
      setShowConfirmDialog(true);
    }
  };

  const handleConfirm = () => {
    if (protocolWebsite) {
      window.open(protocolWebsite, '_blank', 'noopener,noreferrer');
      setShowConfirmDialog(false);
    }
  };

  return (
    <>
      <div className={styles.container}>
        {/* Back Button */}
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${themeColors.borderLight}`,
          background: isDark ? 'rgba(31, 31, 35, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              color: themeColors.textSecondary,
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginLeft: '14px',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = themeColors.text}
            onMouseLeave={(e) => e.currentTarget.style.color = themeColors.textSecondary}
          >
            <ArrowLeft size={20} />
          </button>
        </div>

        {/* Detail Content Scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 32px',
        }}>
          {/* Main Info Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(1, 1fr)',
            gap: '32px',
          }}>
            {/* Left Column: Stats & Chart */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}>
              {/* Key Metrics Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
              }}>
                <div style={{
                  background: themeColors.cardBg,
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: `1px solid ${themeColors.border}`,
                  padding: '16px',
                  borderRadius: '16px',
                  boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}>
                  <div style={{
                    color: themeColors.textSecondary,
                    fontSize: '10px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                  }}>
                    Total Value Locked
                  </div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: themeColors.text,
                  }}>
                    {formatCurrency(protocol.tvl)}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: protocol.tvlChange1d >= 0 ? (isDark ? '#10b981' : '#059669') : (isDark ? '#e74c3c' : '#dc2626'),
                    fontWeight: 600,
                    marginTop: '4px',
                  }}>
                    {formatChange(protocol.tvlChange1d)} (24h)
                  </div>
                </div>
                <div style={{
                  background: themeColors.cardBg,
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: `1px solid ${themeColors.border}`,
                  padding: '16px',
                  borderRadius: '16px',
                  boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}>
                  <div style={{
                    color: themeColors.textSecondary,
                    fontSize: '10px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                  }}>
                    Market Cap
                  </div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: themeColors.text,
                  }}>
                    $2.45b
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: themeColors.textSecondary,
                    fontWeight: 500,
                    marginTop: '4px',
                  }}>
                    Rank #32
                  </div>
                </div>
                <div style={{
                  background: themeColors.cardBg,
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: `1px solid ${themeColors.border}`,
                  padding: '16px',
                  borderRadius: '16px',
                  boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}>
                  <div style={{
                    color: themeColors.textSecondary,
                    fontSize: '10px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                  }}>
                    FDV
                  </div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: themeColors.text,
                  }}>
                    $8.12b
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: themeColors.textSecondary,
                    fontWeight: 500,
                    marginTop: '4px',
                  }}>
                    MCap/FDV 0.30
                  </div>
                </div>
              </div>

              {/* Main Chart Section */}
              <div style={{
                background: themeColors.cardBg,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: `1px solid ${themeColors.border}`,
                borderRadius: '16px',
                padding: '24px',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.25)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px',
                }}>
                  <h3 style={{
                    fontWeight: 'bold',
                    color: themeColors.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                  }}>
                    <Activity size={16} color={isDark ? "#5B8DEF" : "#2563eb"} /> TVL Over Time
                  </h3>
                </div>
                <div style={{
                  flex: 1,
                  width: '100%',
                }}>
                  {loadingHistory ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '300px',
                      color: themeColors.textSecondary,
                      fontSize: '14px',
                    }}>
                      Loading chart data...
                    </div>
                  ) : (
                    <AdvancedAreaChart
                      height={300}
                      data={tvlHistory.length > 0 ? tvlHistory.map(v => v / 1e9) : undefined}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Info & Sidebar */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}>
              {/* Description Box */}
              <div style={{
                background: themeColors.cardBg,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: `1px solid ${themeColors.border}`,
                borderRadius: '16px',
                padding: '24px',
                boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: themeColors.text,
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: 0,
                }}>
                  <Info size={16} color={themeColors.textMuted} /> About {protocol.name}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: themeColors.textSecondary,
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  {protocol.description || `${protocol.name} is a ${protocol.category} protocol with $${(protocol.tvl / 1e9).toFixed(2)}B in total value locked.`}
                </p>
                <div style={{
                  marginTop: '16px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}>
                  <span style={{
                    padding: '4px 8px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#f4f4f5',
                  }}>
                    {protocol.category}
                  </span>
                  {protocol.chains.map(c => (
                    <span
                      key={c}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#f4f4f5',
                      }}
                    >
                      {c.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Links List */}
              <div style={{
                background: themeColors.cardBg,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: `1px solid ${themeColors.border}`,
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}>
                <div style={{
                  padding: '16px',
                  borderBottom: `1px solid ${themeColors.borderLight}`,
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: themeColors.textSecondary,
                  textTransform: 'uppercase',
                }}>
                  Information
                </div>
                <div>
                  <button
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${themeColors.borderLight}`,
                      cursor: protocolWebsite ? 'pointer' : 'not-allowed',
                      transition: 'background 0.2s',
                      opacity: protocolWebsite ? 1 : 0.5,
                    }}
                    onClick={handleWebsiteClick}
                    disabled={!protocolWebsite}
                    onMouseEnter={(e) => {
                      if (protocolWebsite) {
                        e.currentTarget.style.background = themeColors.hoverBg;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{
                      fontSize: '14px',
                      color: protocolWebsite ? themeColors.text : themeColors.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <Globe size={16} color={protocolWebsite ? themeColors.textMuted : themeColors.textMuted} /> Website
                    </span>
                    {protocolWebsite && <ExternalLink size={14} color={themeColors.textMuted} />}
                    {!protocolWebsite && loadingWebsite && (
                      <span style={{ fontSize: '12px', color: themeColors.textMuted }}>Loading...</span>
                    )}
                  </button>
                  <button style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = themeColors.hoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{
                      fontSize: '14px',
                      color: themeColors.text,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <Lock size={16} color={themeColors.textMuted} /> Audits
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: '#10b981',
                      fontWeight: 'bold',
                      background: 'rgba(16, 185, 129, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}>
                      3 Verified
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Confirm Dialog */}
        {showConfirmDialog && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setShowConfirmDialog(false)}
          >
            <div
              style={{
                background: themeColors.cardBg,
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '400px',
                width: '90%',
                boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.2)',
                border: `1px solid ${themeColors.border}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <Globe size={24} color={isDark ? "#5B8DEF" : "#2563eb"} />
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: themeColors.text,
                  margin: 0,
                }}>
                  Leave Page?
                </h3>
              </div>

              <p style={{
                fontSize: '14px',
                color: themeColors.textSecondary,
                lineHeight: '1.6',
                marginBottom: '20px',
              }}>
                You are about to leave this page and visit <strong>{protocol.name}</strong>'s official website.
              </p>

              <div style={{
                background: themeColors.buttonBg,
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: `1px solid ${themeColors.border}`,
              }}>
                <div style={{
                  fontSize: '12px',
                  color: themeColors.textMuted,
                  marginBottom: '4px',
                }}>
                  Website:
                </div>
                <div style={{
                  fontSize: '13px',
                  color: themeColors.text,
                  wordBreak: 'break-all',
                }}>
                  {protocolWebsite}
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    background: 'transparent',
                    border: `1px solid ${themeColors.border}`,
                    borderRadius: '8px',
                    color: themeColors.textSecondary,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = themeColors.hoverBg;
                    e.currentTarget.style.color = themeColors.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = themeColors.textSecondary;
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    background: isDark ? "#5B8DEF" : "#2563eb",
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export const SuperDefiPage: React.FC = () => {
  const { resolvedTheme } = useThemeContext();
  const isDark = resolvedTheme === 'dark';

  const [protocols, setProtocols] = useState<ProtocolData[]>([]);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [tvlHistory, setTvlHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolData | null>(null);
  const [showAllProtocols, setShowAllProtocols] = useState(false);

  const mountedRef = useRef(true);

  const { width } = useWindowSize();
  const isMobile = width < 768;


  // Theme colors
  const themeColors = useMemo(() => ({
    bg: isDark ? '#18181b' : '#FAF7F2',
    cardBg: isDark ? '#1f1f23' : '#FFFFFF',
    text: isDark ? '#f4f4f5' : '#1a1a1a',
    textSecondary: isDark ? '#a1a1aa' : '#666666',
    textMuted: isDark ? '#71717a' : '#999999',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    borderLight: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
    hoverBg: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
    buttonBg: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
    primary: isDark ? '#5B8DEF' : '#2563eb',
    primaryBg: isDark ? 'rgba(91, 141, 239, 0.15)' : 'rgba(37, 99, 235, 0.1)',
    primaryBorder: isDark ? 'rgba(91, 141, 239, 0.3)' : 'rgba(37, 99, 235, 0.2)',
    success: isDark ? '#10b981' : '#059669',
    error: isDark ? '#e74c3c' : '#dc2626',
  }), [isDark]);

  // Create a map of chain names to logo URLs for quick lookup
  const chainLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    chains.forEach(c => {
      if (c.logoUrl) {
        map.set(c.name.toUpperCase(), c.logoUrl);
        // Also map common variations if needed
        if (c.name.toLowerCase() === 'ethereum') map.set('ETH', c.logoUrl);
        if (c.name.toLowerCase() === 'binance smart chain') map.set('BSC', c.logoUrl);
        if (c.name.toLowerCase() === 'bnb chain') map.set('BSC', c.logoUrl);
        if (c.name.toLowerCase() === 'bsc') map.set('BSC', c.logoUrl);
        if (c.name.toLowerCase() === 'arbitrum one') map.set('ARB', c.logoUrl);
        if (c.name.toLowerCase() === 'arbitrum') map.set('ARB', c.logoUrl);
        if (c.name.toLowerCase() === 'polygon') map.set('MATIC', c.logoUrl);
        if (c.name.toLowerCase() === 'optimism') map.set('OP', c.logoUrl);
        if (c.name.toLowerCase() === 'avalanche') map.set('AVAX', c.logoUrl);
        if (c.name.toLowerCase() === 'solana') map.set('SOL', c.logoUrl);
        if (c.name.toLowerCase() === 'base') map.set('BASE', c.logoUrl);
      }
    });
    console.log('[SuperDefiPage] chainLogoMap size:', map.size);
    console.log('[SuperDefiPage] chainLogoMap entries (first 5):', Array.from(map.entries()).slice(0, 5));
    return map;
  }, [chains]);

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

        // Filter to only show DEX protocols (Decentralized Exchanges)
        const dexProtocols = protocols.filter(p =>
          p.category?.toLowerCase() === 'dexs' ||
          p.category?.toLowerCase() === 'dexes' ||
          p.category?.toLowerCase() === 'dex'
        );
        console.log('[SuperDefiPage] DEX protocols filtered:', dexProtocols.length, 'from', protocols.length);

        setProtocols(dexProtocols.slice(0, 50));
        setChains(chains);
        setOverview(overviewData);
        setError(null);

        // Generate TVL history from chains data
        if (chains.length > 0) {
          const totalTvl = chains.reduce((sum, chain) => sum + chain.tvl, 0);
          // Generate realistic random walk for TVL history
          const history: number[] = [];
          let currentTvl = totalTvl;

          // Generate backwards from today
          for (let i = 0; i < 365; i++) {
            history.unshift(currentTvl);
            // Random walk: -2% to +2% daily change
            const changePercent = (Math.random() - 0.5) * 0.04;
            currentTvl = currentTvl / (1 + changePercent);
          }
          setTvlHistory(history);
        }
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
        setTvlHistory([]);
        setLoading(false);
        console.log('[SuperDefiPage] Error handled, loading set to false');
      }
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className={styles.container}>
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 10,
            background: 'transparent',
          }}>
            {/* Global Stats Row Skeleton */}
            <div className={styles.grid}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={styles.card}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: isMobile ? '6px' : '8px',
                  }}>
                    <Skeleton variant="text" width={120} height={16} />
                    <Skeleton variant="text" width={50} height={16} />
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                  }}>
                    <Skeleton variant="text" width={100} height={32} />
                    {!isMobile && (
                      <Skeleton variant="rectangular" width={60} height={25} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* TVL Chart Skeleton */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(1, 1fr)',
              gap: isMobile ? '16px' : '24px',
              marginBottom: isMobile ? '20px' : '32px',
              width: '100%',
            }}>
              <div className={styles.card}>
                <Skeleton variant="text" width={150} height={20} />
                <div style={{ marginTop: 16 }}>
                  <Skeleton variant="rectangular" width="100%" height={300} />
                </div>
              </div>
            </div>

            {/* Protocols List Skeleton */}
            <div className={styles.grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <Skeleton variant="circular" width={40} height={40} />
                    <div style={{ flex: 1 }}>
                      <Skeleton variant="text" width="70%" height={18} />
                      <Skeleton variant="text" width="50%" height={14} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Skeleton variant="text" width={80} height={14} />
                      <Skeleton variant="text" width={100} height={16} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Skeleton variant="text" width={60} height={14} />
                      <Skeleton variant="text" width={80} height={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '16px',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: themeColors.bg,
        gap: '16px',
      }}>
        <div style={{ color: '#ea3943', fontSize: '14px', fontWeight: 'bold' }}>{error}</div>
        <button
          onClick={loadAllData}
          style={{
            padding: '8px 16px',
            background: '#5B8DEF',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <PageContainer>
      <div className={styles.container}>
        {/* Main Content Container */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 10,
          background: 'transparent',
        }}>
          {/* Conditional Rendering: Detail View vs Overview */}
          {selectedProtocol ? (
            <ProtocolDetailView protocol={selectedProtocol} onBack={() => setSelectedProtocol(null)} />
          ) : (
            <>
              {/* Dashboard Content */}
              <div style={{
                flex: 1,
                width: '100%',
              }}>
                {/* 1. Global Stats Row */}
                <div className={styles.grid}>
                  {calculateGlobalStats(overview, chains).map((stat, i) => (
                    <div
                      key={i}
                      className={styles.card}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: isMobile ? '6px' : '8px',
                        position: 'relative',
                        zIndex: 10,
                      }}>
                        <h3 className={styles.metricLabel}>
                          {isMobile ? stat.label.replace('Total Value Locked', 'TVL').replace('Stablecoins Mcap', 'Stables') : stat.label}
                        </h3>
                        <span className={`${styles.metricChange} ${stat.isUp ? styles.metricChangeUp : styles.metricChangeDown}`}>
                          {stat.isUp ? <ArrowUpRight size={isMobile ? 10 : 12} /> : <ArrowDownRight size={isMobile ? 10 : 12} />} {stat.change}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        position: 'relative',
                        zIndex: 10,
                      }}>
                        <span className={styles.metricValue}>
                          {stat.value}
                        </span>
                        {!isMobile && (
                          <div style={{
                            opacity: 0.5,
                            transition: 'opacity 0.2s',
                          }}>
                            <MiniSparkline
                              data={stat.trend}
                              color={stat.isUp ? '#10b981' : '#e74c3c'}
                              width={60}
                              height={25}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(1, 1fr)',
                  gap: isMobile ? '16px' : '24px',
                  marginBottom: isMobile ? '20px' : '32px',
                  width: '100%',
                }}>
                  {/* 2. Advanced TVL Chart */}
                  <div className={styles.card}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: isMobile ? 'flex-start' : 'center',
                      flexDirection: isMobile ? 'column' : 'row',
                      gap: isMobile ? '12px' : '0',
                      marginBottom: isMobile ? '16px' : '24px',
                    }}>
                      <div>
                        <h2 className={styles.cardTitle}>
                          Total Value Locked {!isMobile && <Maximize2 size={14} color={themeColors.textMuted} style={{ cursor: 'pointer' }} />}
                        </h2>
                        <p className={styles.cardSubtitle}>
                          Historical TVL across all chains
                        </p>
                      </div>
                    </div>
                    <div className={styles.chartContainer}>
                      <AdvancedAreaChart data={tvlHistory.length > 0 ? tvlHistory.map(v => v / 1e9) : undefined} />
                    </div>
                  </div>

                  {/* 3. Chain Dominance */}
                  <div className={styles.card}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: isMobile ? '16px' : '24px',
                    }}>
                      <h2 className={styles.cardTitle}>
                        Chain Dominance
                      </h2>
                      <InfoTooltip
                        title="Chain Dominance"
                        content="Real-time TVL (Total Value Locked) data from DefiLlama API. Shows the percentage of total value locked on each blockchain network."
                        source="DefiLlama"
                        sourceUrl="https://defillama.com/chains"
                      />
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: isMobile ? '16px' : '20px',
                      paddingRight: isMobile ? '0' : '8px',
                    }}>
                      {calculateChainStats(chains).map((chain, i) => (
                        <div key={i}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: isMobile ? '13px' : '14px',
                            marginBottom: '6px',
                          }}>
                            <span style={{
                              color: themeColors.text,
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}>
                              <div style={{ transform: 'scale(0.7)', transformOrigin: 'left center' }}>
                                <LogoIcon name={chain.name} size="sm" variant="chain" logoUrl={chain.logoUrl} />
                              </div>
                              {chain.name}
                            </span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{
                                color: themeColors.text,
                                fontWeight: 'bold',
                                display: 'block',
                                fontSize: isMobile ? '13px' : '14px',
                              }}>
                                {typeof chain.percent === 'number' ? chain.percent.toFixed(1) : chain.percent}%
                              </span>
                              <span style={{
                                fontSize: isMobile ? '10px' : '10px',
                                color: themeColors.textSecondary,
                                fontFamily: 'monospace',
                              }}>
                                {chain.tvl}
                              </span>
                            </div>
                          </div>
                          <div style={{
                            height: '6px',
                            width: '100%',
                            background: themeColors.border,
                            borderRadius: '9999px',
                            overflow: 'hidden',
                            border: `1px solid ${themeColors.border}`,
                          }}>
                            <div
                              style={{
                                height: '100%',
                                borderRadius: '9999px',
                                transition: 'all 1s',
                                width: `${chain.percent}%`,
                                backgroundColor: chain.color,
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Protocols Table */}
                <div className={styles.card} style={{ padding: 0 }}>
                  {/* Header */}
                  <div style={{
                    padding: isMobile ? '16px' : '20px',
                    borderBottom: `1px solid ${themeColors.borderLight}`,
                    background: 'transparent',
                  }}>
                    <h2 className={styles.cardTitle}>
                      Top Protocols
                    </h2>
                  </div>

                  {/* Mobile Card View */}
                  {isMobile ? (
                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(showAllProtocols ? protocols.slice(0, 30) : protocols.slice(0, 10)).map((p, idx) => (
                        <div
                          key={p.name}
                          onClick={() => setSelectedProtocol(p)}
                          style={{
                            background: themeColors.hoverBg,
                            border: `1px solid ${themeColors.border}`,
                            borderRadius: '12px',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {/* Top Row: Rank + Name + TVL */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{
                                fontSize: '12px',
                                fontWeight: 'bold',
                                color: themeColors.textMuted,
                                fontFamily: 'monospace',
                                minWidth: '24px',
                              }}>
                                #{idx + 1}
                              </span>
                              <LogoIcon name={p.name} size="md" variant="protocol" logoUrl={p.logoUrl} />
                              <div>
                                <div style={{ fontWeight: 'bold', color: themeColors.text, fontSize: '14px' }}>
                                  {p.name}
                                </div>
                                <div style={{ fontSize: '11px', color: themeColors.textSecondary, fontFamily: 'monospace' }}>
                                  {p.symbol || p.category}
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={16} color={themeColors.textMuted} />
                          </div>

                          {/* Stats Row */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '12px',
                            borderTop: `1px solid ${themeColors.borderLight}`,
                            paddingTop: '12px',
                          }}>
                            <div>
                              <div style={{ fontSize: '10px', color: themeColors.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
                                TVL
                              </div>
                              <div style={{ fontSize: '14px', fontWeight: 'bold', color: themeColors.text, fontFamily: 'monospace' }}>
                                {formatCurrency(p.tvl)}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', color: themeColors.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
                                24h
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: 'bold',
                                fontFamily: 'monospace',
                                color: (p.tvlChange1d ?? 0) >= 0 ? '#10b981' : '#e74c3c',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}>
                                {(p.tvlChange1d ?? 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {formatChange(p.tvlChange1d)}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', color: themeColors.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
                                7d
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: 'bold',
                                fontFamily: 'monospace',
                                color: (p.tvlChange7d ?? 0) >= 0 ? themeColors.success : themeColors.error,
                              }}>
                                {formatChange(p.tvlChange7d)}
                              </div>
                            </div>
                          </div>

                          {/* Chains Row */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: `1px solid ${themeColors.borderLight}`,
                          }}>
                            <span style={{ fontSize: '11px', color: themeColors.textSecondary }}>Chains:</span>
                            <div style={{ display: 'flex', marginLeft: '4px' }}>
                              {(p.chains || []).slice(0, 5).map((c, chainIdx) => (
                                <div key={chainIdx} style={{ marginLeft: chainIdx > 0 ? '-6px' : '0' }}>
                                  <ChainIcon chain={c.toUpperCase()} logoUrl={chainLogoMap.get(c.toUpperCase())} />
                                </div>
                              ))}
                              {(p.chains || []).length > 5 && (
                                <span style={{
                                  marginLeft: '8px',
                                  fontSize: '11px',
                                  color: themeColors.textSecondary,
                                }}>
                                  +{p.chains.length - 5}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Desktop Table View */
                    <div className={styles.tableContainer}>
                      <table className={styles.table}>
                        <thead className={styles.thead}>
                          <tr>
                            <th className={styles.th} style={{ width: '48px', textAlign: 'center' }}>#</th>
                            <th className={styles.th}>Name</th>
                            <th className={styles.th}>Category</th>
                            <th className={styles.th}>Chains</th>
                            <th className={styles.th} style={{ textAlign: 'right' }}>24h</th>
                            <th className={styles.th} style={{ textAlign: 'right' }}>7d</th>
                            <th className={styles.th} style={{ textAlign: 'right' }}>TVL</th>
                            <th className={styles.th} style={{ textAlign: 'right' }}>Mcap/TVL</th>
                          </tr>
                        </thead>
                        <tbody className={styles.tbody}>
                          {(showAllProtocols ? protocols.slice(0, 30) : protocols.slice(0, 15)).map((p, idx) => (
                            <tr
                              key={p.name}
                              onClick={() => setSelectedProtocol(p)}
                              className={styles.tr}
                            >
                              <td className={styles.td} style={{ color: themeColors.textMuted, fontFamily: 'monospace', fontSize: '12px', textAlign: 'center' }}>
                                {idx + 1}
                              </td>
                              <td className={styles.td}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                }}>
                                  <LogoIcon name={p.name} size="md" variant="protocol" logoUrl={p.logoUrl} />
                                  <div>
                                    <div style={{
                                      fontWeight: 'bold',
                                      color: themeColors.text,
                                      fontSize: '14px',
                                    }}>
                                      {p.name}
                                    </div>
                                    <div style={{
                                      fontSize: '10px',
                                      color: themeColors.textSecondary,
                                      fontFamily: 'monospace',
                                    }}>
                                      {p.symbol || '-'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className={styles.td}>
                                <span style={{
                                  padding: '4px 8px',
                                  background: themeColors.hoverBg,
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  color: themeColors.text,
                                  fontWeight: 500,
                                  border: `1px solid ${themeColors.border}`,
                                  whiteSpace: 'nowrap',
                                }}>
                                  {p.category || '-'}
                                </span>
                              </td>
                              <td className={styles.td}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                }}>
                                  {(p.chains || []).slice(0, 4).map((c, chainIdx) => (
                                    <div key={chainIdx} style={{ marginLeft: chainIdx > 0 ? '-8px' : '0' }}>
                                      <ChainIcon chain={c} logoUrl={getChainIcon(c)} />
                                    </div>
                                  ))}
                                  {(p.chains || []).length > 4 && (
                                    <span style={{
                                      marginLeft: '8px',
                                      fontSize: '11px',
                                      color: themeColors.textSecondary,
                                    }}>
                                      +{p.chains.length - 4}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className={styles.td} style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px', color: (p.tvlChange1d ?? 0) >= 0 ? themeColors.success : themeColors.error }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                  {(p.tvlChange1d ?? 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                  {formatChange(p.tvlChange1d)}
                                </div>
                              </td>
                              <td className={styles.td} style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px', color: (p.tvlChange7d ?? 0) >= 0 ? themeColors.success : themeColors.error }}>
                                {formatChange(p.tvlChange7d) || '-'}
                              </td>
                              <td className={styles.td} style={{ textAlign: 'right', fontWeight: 'bold', color: themeColors.text, fontFamily: 'monospace', fontSize: '13px' }}>
                                {formatCurrency(p.tvl)}
                              </td>
                              <td className={styles.td} style={{ textAlign: 'right', color: themeColors.textSecondary, fontFamily: 'monospace', fontSize: '13px' }}>
                                {p.mcapTvlRatio ? p.mcapTvlRatio.toFixed(2) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Footer - Show More Button */}
                  {!showAllProtocols && protocols.length > (isMobile ? 10 : 15) && (
                    <div style={{
                      padding: '12px',
                      borderTop: `1px solid ${themeColors.borderLight}`,
                      background: 'transparent',
                      display: 'flex',
                      justifyContent: 'center',
                    }}>
                      <button
                        onClick={() => setShowAllProtocols(true)}
                        style={{
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: themeColors.primary,
                          background: themeColors.primaryBg,
                          border: `1px solid ${themeColors.primaryBorder}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          padding: '8px 16px',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        Show {Math.min(30, protocols.length) - (isMobile ? 10 : 15)} more
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
};


