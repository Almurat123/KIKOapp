import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Activity,
  Scale,
  Gauge,
  Coins,
  PieChart,
  BarChart2,
  Zap,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import { marketApi } from '../services/api';
import { PageContainer } from '../components/Layout/PageContainer';
import { Skeleton } from '../components/Skeleton';
import styles from './OverviewPage.module.css';
import type { MarketOverview } from '../services/api';
import { proxyImageUrl } from '../utils/imageProxy';
import { useThemeContext } from '../contexts/ThemeContext';

// --- Formatting Helpers ---

function formatCurrency(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatRelativeTime(date?: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString();
}

const generateTrend = (currentValue: number, points: number = 30): number[] => {
  const trend = [];
  let current = currentValue;
  for (let i = 0; i < points; i++) {
    trend.unshift(current);
    // Random walk with mean reversion
    const change = (Math.random() - 0.5) * (current * 0.05);
    current = current - change;
  }
  return trend;
};

const macroIndicatorsDefault = [
  {
    id: 1,
    name: "Fear & Greed Index",
    icon: Gauge,
    color: "#eab308",
    value: "74",
    unit: "100",
    status: "Greed",
    statusColor: "#16c784",
    statusBg: "rgba(22, 199, 132, 0.1)",
    statusBorder: "rgba(22, 199, 132, 0.2)",
    description: "Market is currently greedy.",
    rangeValue: 74,
    rangeLabels: ["Fear", "Neutral", "Greed"],
    trend: generateTrend(74)
  },
  {
    id: 2,
    name: "Altcoin Season Index",
    icon: Coins,
    color: "#3861fb",
    value: "35",
    unit: "100",
    status: "Bitcoin Season",
    statusColor: "#eab308",
    statusBg: "rgba(234, 179, 8, 0.1)",
    statusBorder: "rgba(234, 179, 8, 0.2)",
    description: "Money is flowing into BTC.",
    rangeValue: 35,
    rangeLabels: ["BTC Season", "Neutral", "Alt Season"],
    trend: generateTrend(35)
  },
  {
    id: 3,
    name: "Bitcoin Dominance",
    icon: PieChart,
    color: "#ea3943",
    value: "54.2%",
    unit: "",
    status: "High Dominance",
    statusColor: "#ea3943",
    statusBg: "rgba(234, 57, 67, 0.1)",
    statusBorder: "rgba(234, 57, 67, 0.2)",
    description: "BTC leading the market moves.",
    rangeValue: 54.2,
    rangeLabels: ["Low", "Avg", "High"],
    trend: generateTrend(54.2)
  },
  {
    id: 4,
    name: "Perp Open Interest",
    icon: BarChart2,
    color: "#16c784",
    value: "$42.5B",
    unit: "",
    status: "High Speculation",
    statusColor: "#ea3943",
    statusBg: "rgba(234, 57, 67, 0.1)",
    statusBorder: "rgba(234, 57, 67, 0.2)",
    description: "High speculation activity. New trends may be emerging.",
    rangeValue: 85,
    rangeLabels: ["Low", "Moderate", "High"],
    trend: generateTrend(42.5)
  },
  {
    id: 5,
    name: "Real-time Gas Level",
    icon: Zap,
    color: "#f59e0b",
    value: "45.2",
    unit: "100",
    status: "Moderate",
    statusColor: "#f59e0b",
    statusBg: "rgba(245, 158, 11, 0.1)",
    statusBorder: "rgba(245, 158, 11, 0.2)",
    description: "Network congestion level across major chains.",
    rangeValue: 45.2,
    rangeLabels: ["Low", "Moderate", "Very High"],
    trend: generateTrend(45.2)
  },
  {
    id: 6,
    name: "Volatility Index",
    icon: TrendingDown,
    color: "#8b5cf6",
    value: "BVIX: 32.5",
    unit: "EVIX: 28.3",
    status: "Moderate",
    statusColor: "#8b5cf6",
    statusBg: "rgba(139, 92, 246, 0.1)",
    statusBorder: "rgba(139, 92, 246, 0.2)",
    description: "Bitcoin and Ethereum volatility indices.",
    rangeValue: 30.4,
    rangeLabels: ["Low", "Moderate", "High"],
    trend: generateTrend(30.4)
  },
  {
    id: 7,
    name: "Market Liquidity Stress",
    icon: AlertTriangle,
    color: "#ea3943",
    value: "35.8",
    unit: "100",
    status: "Moderate",
    statusColor: "#f59e0b",
    statusBg: "rgba(245, 158, 11, 0.1)",
    statusBorder: "rgba(245, 158, 11, 0.2)",
    description: "Liquidity stress indicator. Higher = more slippage risk.",
    rangeValue: 35.8,
    rangeLabels: ["Low", "Moderate", "Very High"],
    trend: generateTrend(35.8)
  },
];

// --- Shared Components ---

const Sparkline: React.FC<{ data: number[]; isUp: boolean }> = ({ data, isUp }) => {
  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 60;
    const y = 20 - ((val - minVal) / range) * 20;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="60" height="20" className={styles.svgVisible}>
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? "#16c784" : "#ea3943"}
        strokeWidth="2"
      />
    </svg>
  );
};

export const OverviewPage: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketOverview | null>(null);
  const [trending, setTrending] = useState<any[]>([]);
  const [gainers, setGainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  // Load data on mount - simplified, no visibility check
  useEffect(() => {
    // Reset mounted ref on each mount (important for StrictMode)
    mountedRef.current = true;

    loadData();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cache configuration
  const CACHE_KEY = 'kiko_market_overview_cache_v3';
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes — survives normal sidebar navigation

  // Load from cache
  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const now = Date.now();

      if (now - data.timestamp < CACHE_DURATION) {
        console.log('[OverviewPage] Using cached data, age:', Math.round((now - data.timestamp) / 1000), 'seconds');
        return data;
      }

      console.log('[OverviewPage] Cache expired');
      localStorage.removeItem(CACHE_KEY);
      return null;
    } catch (err) {
      console.warn('[OverviewPage] Error reading cache:', err);
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  };

  // Save to cache
  const saveToCache = (overview: any, trending: any[], gainers: any[]) => {
    try {
      const data = {
        overview,
        trending,
        gainers,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      console.log('[OverviewPage] Data saved to cache');
    } catch (err) {
      console.warn('[OverviewPage] Error saving to cache:', err);
    }
  };

  const loadData = async () => {
    if (!mountedRef.current) return;

    try {
      setLoading(true);
      setError(null);

      // Try to load from cache first
      const cached = loadFromCache();
      if (cached && cached.overview) {
        console.log('[OverviewPage] Loaded from cache');
        setMarketData(cached.overview);
        setTrending(cached.trending || []);
        setGainers(cached.gainers || []);
        setLoading(false);
        return;
      }

      console.log('[OverviewPage] Fetching fresh data from API...');

      // Direct API calls - no requestManager to avoid queue issues
      const [overview, trendingData, gainersData] = await Promise.all([
        marketApi.getOverview().catch((err) => {
          console.warn('[OverviewPage] getOverview failed:', err);
          return null;
        }),
        marketApi.getTrending().catch((err) => {
          console.warn('[OverviewPage] getTrending failed:', err);
          return [];
        }),
        marketApi.getGainers().catch((err) => {
          console.warn('[OverviewPage] getGainers failed:', err);
          return [];
        }),
      ]);

      console.log('[OverviewPage] Data loaded:', {
        overview: overview !== null,
        trending: Array.isArray(trendingData) ? trendingData.length : 0,
        gainers: Array.isArray(gainersData) ? gainersData.length : 0,
      });

      // Always update state if component is still mounted
      console.log('[OverviewPage] mountedRef.current:', mountedRef.current);
      if (mountedRef.current) {
        setMarketData(overview);
        const trendingCoins = Array.isArray(trendingData) ? trendingData : [];
        setTrending(trendingCoins.slice(0, 3));
        const sortedGainers = Array.isArray(gainersData) ? gainersData
          .sort((a: any, b: any) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0))
          .slice(0, 10) : [];
        setGainers(sortedGainers);

        // Save to cache
        saveToCache(overview, trendingCoins.slice(0, 3), sortedGainers);

        setLoading(false);
        setError(null);
        console.log('[OverviewPage] State updated, loading set to false');
      } else {
        console.log('[OverviewPage] Component unmounted, skipping state update');
      }
    } catch (err: any) {
      console.error('[OverviewPage] Error loading market data:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to load market data');
        setMarketData(null);
        setTrending([]);
        setGainers([]);
        setLoading(false);
        console.log('[OverviewPage] Error handled, loading set to false');
      }
    }
  };

  // Generate global metrics from market data
  const globalMetrics = marketData ? [
    {
      label: "Global Market Cap",
      value: formatCurrency(marketData.globalMarketCap),
      change: marketData.mcapChange24h !== undefined ? `${marketData.mcapChange24h > 0 ? '+' : ''}${marketData.mcapChange24h.toFixed(1)}%` : "N/A",
      isUp: marketData.mcapChange24h !== undefined ? marketData.mcapChange24h >= 0 : true
    },
    {
      label: "24h Volume",
      value: formatCurrency(marketData.volume24h),
      change: "Live",
      isUp: true
    },
    {
      label: "Active Wallets (24h)",
      value: marketData.activeUsers ? formatNumber(marketData.activeUsers) : "N/A",
      change: "Active",
      isUp: true
    },
    {
      label: "ETH Gas",
      value: marketData.ethGasPrice || "N/A",
      change: marketData.ethGasPrice ? "Live" : "N/A",
      isUp: true,
      color: "#eab308"
    },
  ] : [];

  // Update macro indicators with real data
  const macroIndicatorsWithData = marketData ? [
    {
      id: 1,
      name: "Fear & Greed Index",
      icon: Gauge,
      color: "#eab308",
      value: marketData.fearGreedIndex.toString(),
      unit: "100",
      status: marketData.fearGreedClassification,
      statusColor: marketData.fearGreedIndex > 50 ? "#16c784" : "#ea3943",
      statusBg: marketData.fearGreedIndex > 50
        ? "rgba(22, 199, 132, 0.1)"
        : "rgba(234, 57, 67, 0.1)",
      statusBorder: marketData.fearGreedIndex > 50
        ? "rgba(22, 199, 132, 0.2)"
        : "rgba(234, 57, 67, 0.2)",
      description: `Market is currently ${marketData.fearGreedClassification.toLowerCase()}.`,
      rangeValue: marketData.fearGreedIndex,
      rangeLabels: ["Fear", "Neutral", "Greed"],
      trend: generateTrend(marketData.fearGreedIndex)
    },
    {
      id: 2,
      name: "Altcoin Season Index",
      icon: Coins,
      color: "#3861fb",
      value: marketData.altcoinSeasonIndex?.toFixed(0) || "35",
      unit: "100",
      status: (marketData.altcoinSeasonIndex || 0) > 75 ? "Alt Season" : (marketData.altcoinSeasonIndex || 0) < 25 ? "Bitcoin Season" : "Neutral",
      statusColor: (marketData.altcoinSeasonIndex || 0) > 75 ? "#16c784" : (marketData.altcoinSeasonIndex || 0) < 25 ? "#eab308" : "#5B8DEF",
      statusBg: (marketData.altcoinSeasonIndex || 0) > 75
        ? "rgba(22, 199, 132, 0.1)"
        : (marketData.altcoinSeasonIndex || 0) < 25
          ? "rgba(234, 179, 8, 0.1)"
          : "rgba(91, 141, 239, 0.1)",
      statusBorder: (marketData.altcoinSeasonIndex || 0) > 75
        ? "rgba(22, 199, 132, 0.2)"
        : (marketData.altcoinSeasonIndex || 0) < 25
          ? "rgba(234, 179, 8, 0.2)"
          : "rgba(91, 141, 239, 0.2)",
      description: (marketData.altcoinSeasonIndex || 0) > 75
        ? "Money is flowing into altcoins."
        : (marketData.altcoinSeasonIndex || 0) < 25
          ? "Money is flowing into BTC."
          : "Market is in a neutral state.",
      rangeValue: marketData.altcoinSeasonIndex || 35,
      rangeLabels: ["BTC Season", "Neutral", "Alt Season"],
      trend: generateTrend(marketData.altcoinSeasonIndex || 35)
    },
    {
      id: 3,
      name: "Bitcoin Dominance",
      icon: PieChart,
      color: "#ea3943",
      value: `${marketData.bitcoinDominance.toFixed(1)}%`,
      unit: "",
      status: marketData.bitcoinDominance > 60 ? "High Dominance" : marketData.bitcoinDominance < 40 ? "Low Dominance" : "Normal",
      statusColor: marketData.bitcoinDominance > 60 ? "#ea3943" : marketData.bitcoinDominance < 40 ? "#16c784" : "#5B8DEF",
      statusBg: marketData.bitcoinDominance > 60
        ? "rgba(234, 57, 67, 0.1)"
        : marketData.bitcoinDominance < 40
          ? "rgba(22, 199, 132, 0.1)"
          : "rgba(91, 141, 239, 0.1)",
      statusBorder: marketData.bitcoinDominance > 60
        ? "rgba(234, 57, 67, 0.2)"
        : marketData.bitcoinDominance < 40
          ? "rgba(22, 199, 132, 0.2)"
          : "rgba(91, 141, 239, 0.2)",
      description: marketData.bitcoinDominance > 60
        ? "BTC has high market dominance."
        : marketData.bitcoinDominance < 40
          ? "Altcoins are gaining market share."
          : "Market dominance is balanced.",
      rangeValue: marketData.bitcoinDominance,
      rangeLabels: ["Low", "Avg", "High"],
      trend: marketData.btcDomChange24h !== undefined ? (marketData.btcDomChange24h >= 0 ? 'up' : 'down') : generateTrend(marketData.bitcoinDominance)
    },
    {
      id: 4,
      name: "Perp Open Interest",
      icon: BarChart2,
      color: "#16c784",
      value: marketData.globalOpenInterest ? formatCurrency(marketData.globalOpenInterest) : "N/A",
      unit: "",
      status: marketData.globalOpenInterest ? (marketData.globalOpenInterest > 50e9 ? "High Speculation" : marketData.globalOpenInterest > 30e9 ? "Moderate" : "Low Activity") : "Data Unavailable",
      statusColor: marketData.globalOpenInterest ? (marketData.globalOpenInterest > 50e9 ? "#ea3943" : marketData.globalOpenInterest > 30e9 ? "#f59e0b" : "#16c784") : "#999999",
      statusBg: marketData.globalOpenInterest
        ? (marketData.globalOpenInterest > 50e9 ? "rgba(234, 57, 67, 0.1)" : marketData.globalOpenInterest > 30e9 ? "rgba(245, 158, 11, 0.1)" : "rgba(22, 199, 132, 0.1)")
        : "rgba(153, 153, 153, 0.1)",
      statusBorder: marketData.globalOpenInterest
        ? (marketData.globalOpenInterest > 50e9 ? "rgba(234, 57, 67, 0.2)" : marketData.globalOpenInterest > 30e9 ? "rgba(245, 158, 11, 0.2)" : "rgba(22, 199, 132, 0.2)")
        : "rgba(153, 153, 153, 0.2)",
      description: marketData.globalOpenInterest
        ? (marketData.globalOpenInterest > 50e9 ? "High speculation activity. New trends may be emerging." : marketData.globalOpenInterest > 30e9 ? "Moderate perpetual trading activity." : "Low perpetual trading activity.")
        : "Perpetual open interest data is not available.",
      rangeValue: marketData.globalOpenInterest ? Math.min(100, (marketData.globalOpenInterest / 100e9) * 100) : 0,
      rangeLabels: ["Low", "Moderate", "High"],
      trend: generateTrend(marketData.globalOpenInterest ? Math.min(100, (marketData.globalOpenInterest / 100e9) * 100) : 0)
    },
    {
      id: 5,
      name: "Real-time Gas Level",
      icon: Zap,
      color: "#f59e0b",
      value: (marketData.gasLevel !== undefined && marketData.gasLevel !== null) ? marketData.gasLevel.toFixed(1) : "N/A",
      unit: "100",
      status: marketData.gasLevelStatus || "Unknown",
      statusColor: (marketData.gasLevel !== undefined && marketData.gasLevel !== null)
        ? (marketData.gasLevel < 30 ? "#16c784" : marketData.gasLevel < 60 ? "#f59e0b" : marketData.gasLevel < 80 ? "#ea3943" : "#dc2626")
        : "#999999",
      statusBg: (marketData.gasLevel !== undefined && marketData.gasLevel !== null)
        ? (marketData.gasLevel < 30 ? "rgba(22, 199, 132, 0.1)" : marketData.gasLevel < 60 ? "rgba(245, 158, 11, 0.1)" : marketData.gasLevel < 80 ? "rgba(234, 57, 67, 0.1)" : "rgba(220, 38, 38, 0.1)")
        : "rgba(153, 153, 153, 0.1)",
      statusBorder: (marketData.gasLevel !== undefined && marketData.gasLevel !== null)
        ? (marketData.gasLevel < 30 ? "rgba(22, 199, 132, 0.2)" : marketData.gasLevel < 60 ? "rgba(245, 158, 11, 0.2)" : marketData.gasLevel < 80 ? "rgba(234, 57, 67, 0.2)" : "rgba(220, 38, 38, 0.2)")
        : "rgba(153, 153, 153, 0.2)",
      description: (marketData.gasLevel !== undefined && marketData.gasLevel !== null)
        ? `Network congestion level: ${marketData.gasLevelStatus || 'Unknown'}. ${marketData.gasLevel < 30 ? 'Chains are not congested.' : marketData.gasLevel < 60 ? 'Moderate network activity.' : 'High network congestion.'}`
        : "Gas level data is not available.",
      rangeValue: marketData.gasLevel || 0,
      rangeLabels: ["Low", "Moderate", "Very High"],
      trend: (marketData.gasLevel !== undefined && marketData.gasLevel !== null) ? [30, 35, 40, 42, 44, 45, marketData.gasLevel] : [0, 0, 0, 0, 0, 0, 0]
    },
    {
      id: 6,
      name: "Volatility Index",
      icon: TrendingDown,
      color: "#8b5cf6",
      value: marketData.bvix ? `BVIX: ${marketData.bvix.toFixed(1)}` : "N/A",
      unit: marketData.evix ? `EVIX: ${marketData.evix.toFixed(1)}` : "",
      status: marketData.bvix && marketData.evix
        ? ((marketData.bvix + marketData.evix) / 2 < 30 ? "Low" : (marketData.bvix + marketData.evix) / 2 < 60 ? "Moderate" : "High")
        : "Unknown",
      statusColor: marketData.bvix && marketData.evix
        ? ((marketData.bvix + marketData.evix) / 2 < 30 ? "#16c784" : (marketData.bvix + marketData.evix) / 2 < 60 ? "#8b5cf6" : "#ea3943")
        : "#999999",
      statusBg: marketData.bvix && marketData.evix
        ? ((marketData.bvix + marketData.evix) / 2 < 30 ? "rgba(22, 199, 132, 0.1)" : (marketData.bvix + marketData.evix) / 2 < 60 ? "rgba(139, 92, 246, 0.1)" : "rgba(234, 57, 67, 0.1)")
        : "rgba(153, 153, 153, 0.1)",
      statusBorder: marketData.bvix && marketData.evix
        ? ((marketData.bvix + marketData.evix) / 2 < 30 ? "rgba(22, 199, 132, 0.2)" : (marketData.bvix + marketData.evix) / 2 < 60 ? "rgba(139, 92, 246, 0.2)" : "rgba(234, 57, 67, 0.2)")
        : "rgba(153, 153, 153, 0.2)",
      description: marketData.bvix && marketData.evix
        ? `Bitcoin Volatility: ${marketData.bvix.toFixed(1)}, Ethereum Volatility: ${marketData.evix.toFixed(1)}.`
        : "Volatility index data is not available.",
      rangeValue: marketData.bvix && marketData.evix ? (marketData.bvix + marketData.evix) / 2 : 0,
      rangeLabels: ["Low", "Moderate", "High"],
      trend: marketData.bvix && marketData.evix ? [25, 27, 29, 30, 31, 30.5, (marketData.bvix + marketData.evix) / 2] : [0, 0, 0, 0, 0, 0, 0]
    },
    {
      id: 7,
      name: "Market Liquidity Stress",
      icon: AlertTriangle,
      color: "#ea3943",
      value: marketData.liquidityStressIndex ? marketData.liquidityStressIndex.toFixed(1) : "N/A",
      unit: "100",
      status: marketData.liquidityStressStatus || "Unknown",
      statusColor: marketData.liquidityStressIndex
        ? (marketData.liquidityStressIndex < 30 ? "#16c784" : marketData.liquidityStressIndex < 60 ? "#f59e0b" : marketData.liquidityStressIndex < 80 ? "#ea3943" : "#dc2626")
        : "#999999",
      statusBg: marketData.liquidityStressIndex
        ? (marketData.liquidityStressIndex < 30 ? "rgba(22, 199, 132, 0.1)" : marketData.liquidityStressIndex < 60 ? "rgba(245, 158, 11, 0.1)" : marketData.liquidityStressIndex < 80 ? "rgba(234, 57, 67, 0.1)" : "rgba(220, 38, 38, 0.1)")
        : "rgba(153, 153, 153, 0.1)",
      statusBorder: marketData.liquidityStressIndex
        ? (marketData.liquidityStressIndex < 30 ? "rgba(22, 199, 132, 0.2)" : marketData.liquidityStressIndex < 60 ? "rgba(245, 158, 11, 0.2)" : marketData.liquidityStressIndex < 80 ? "rgba(234, 57, 67, 0.2)" : "rgba(220, 38, 38, 0.2)")
        : "rgba(153, 153, 153, 0.2)",
      description: marketData.liquidityStressIndex
        ? `Liquidity stress: ${marketData.liquidityStressStatus || 'Unknown'}. ${marketData.liquidityStressIndex < 30 ? 'Low slippage expected.' : marketData.liquidityStressIndex < 60 ? 'Moderate slippage possible.' : 'High slippage likely.'}`
        : "Liquidity stress data is not available.",
      rangeValue: marketData.liquidityStressIndex || 0,
      rangeLabels: ["Low", "Moderate", "Very High"],
      trend: marketData.liquidityStressIndex ? [30, 32, 34, 35, 36, 35.5, marketData.liquidityStressIndex] : [0, 0, 0, 0, 0, 0, 0]
    },
  ] : macroIndicatorsDefault;

  const macroIndicators = macroIndicatorsWithData;

  const { resolvedTheme } = useThemeContext();

  if (loading) {
    return (
      <PageContainer fullWidth>
        <div className={`${styles.container} ${styles[resolvedTheme]}`}>
          {/* Global Metrics Cards Skeleton */}
          <div className={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.card}>
                <Skeleton variant="text" width={120} height={16} />
                <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 8 }}>
                  <Skeleton variant="text" width={100} height={28} />
                  <Skeleton variant="text" width={60} height={18} />
                </div>
              </div>
            ))}
          </div>

          {/* Market Highlights Row Skeleton */}
          <div className={styles.sectionGrid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.card}>
                <div className={styles.sectionHeader}>
                  <Skeleton variant="text" width={120} height={20} />
                  <Skeleton variant="rectangular" width={70} height={24} />
                </div>
                <div className={styles.listContainer}>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className={styles.listItem} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Skeleton variant="circular" width={20} height={20} />
                        <Skeleton variant="circular" width={28} height={28} />
                        <Skeleton variant="text" width={100} height={16} />
                      </div>
                      <Skeleton variant="text" width={60} height={16} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Macro Indicators Skeleton */}
          <div className={styles.sectionGrid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.card}>
                <div className={styles.sectionHeader}>
                  <Skeleton variant="text" width={150} height={20} />
                </div>
                <div style={{ marginTop: 16 }}>
                  <Skeleton variant="text" width="100%" height={200} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  // Show error state only if there's an actual error
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>
          {error}
        </div>
        <button
          onClick={loadData}
          className={styles.retryBtn}
        >
          Retry
        </button>
      </div>
    );
  }

  // Show empty state if no data but no error (data is still being fetched or not available)
  if (!loading && !marketData) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>
          Market data is not available yet. Data is being fetched. Please try again later.
        </div>
        <button
          onClick={loadData}
          className={styles.retryBtn}
        >
          Retry
        </button>
      </div>
    );
  }


  return (
    <PageContainer fullWidth>
      <div className={`${styles.container} ${styles[resolvedTheme]}`}>
        {/* Global Metrics Cards */}
        <div className={styles.grid}>
          {globalMetrics.map((m, i) => (
            <div
              key={i}
              className={styles.card}
            >
              <div className={styles.metricLabel}>
                {m.label}
              </div>
              <div className={styles.metricValueRow}>
                <span className={styles.metricValue} style={{ color: m.color }}>
                  {m.value}
                </span>
                <span className={`${styles.metricChange} ${m.isUp ? styles.metricChangeUp : styles.metricChangeDown}`}>
                  {m.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Market Highlights Row */}
        <div className={styles.sectionGrid}>
          {/* Top Gainers (Mini) */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <TrendingUp size={16} color="#10b981" /> Top Gainers
              </h3>
            </div>
            <div className={styles.listContainer}>
              {gainers.length > 0 ? gainers.slice(0, 3).map((token: any, i: number) => {
                const isUp = (token.price_change_percentage_24h || 0) > 0;
                const sparkData = token.sparkline_in_7d?.price?.slice(-7) || generateTrend(token.price_change_percentage_24h || 0);
                return (
                  <div
                    key={token.id || i}
                    className={styles.listItem}
                  >
                    <div className={styles.tokenInfo}>
                      <span className={styles.rank}>
                        #{i + 1}
                      </span>
                      {token.image ? (
                        <img
                          src={proxyImageUrl(token.image) || token.image}
                          data-original={token.image}
                          alt={token.name}
                          className={styles.tokenIcon}
                          onError={(e) => {
                            const img = e.currentTarget;
                            const originalUrl = img.getAttribute('data-original');
                            // First try direct URL if we were using proxy
                            if (originalUrl && img.src !== originalUrl) {
                              img.src = originalUrl;
                              return;
                            }
                            // If direct URL also fails, show fallback
                            img.style.display = 'none';
                            img.nextElementSibling?.classList.remove(styles.hidden);
                          }}
                        />
                      ) : null}
                      <div className={`${styles.fallbackIcon} ${token.image ? styles.hidden : ''}`} style={{ background: 'linear-gradient(135deg, #10b981, #3ba55d)' }}></div>
                      <span className={styles.tokenName}>
                        {token.name || `Token ${i + 1}`}
                      </span>
                    </div>
                    <div className={styles.tokenRight}>
                      <Sparkline data={sparkData} isUp={isUp} />
                      <span className={`${styles.metricChange} ${isUp ? styles.metricChangeUp : styles.metricChangeDown}`}>
                        {token.price_change_percentage_24h
                          ? `${isUp ? '+' : ''}${token.price_change_percentage_24h.toFixed(1)}%`
                          : `+0.0%`}
                      </span>
                    </div>
                  </div>
                );
              }) : (
                <div style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                }}>
                  No gainers data available
                </div>
              )}
            </div>
          </div>

          {/* Trending (Mini) */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <Activity size={16} color="#f59e0b" /> Trending
              </h3>
            </div>
            <div className={styles.listContainer}>
              {trending.length > 0 ? trending.slice(0, 3).map((coin: any, i: number) => {
                const token = coin.item || coin;
                const price = token.data?.price || token.price || 0;
                return (
                  <div
                    key={token.id || token.coin_id || i}
                    className={styles.listItem}
                  >
                    <div className={styles.tokenInfo}>
                      <span className={styles.rank}>
                        #{i + 1}
                      </span>
                      {token.image || token.thumb || token.small ? (
                        <img
                          src={proxyImageUrl(token.image || token.thumb || token.small) || (token.image || token.thumb || token.small)}
                          data-original={token.image || token.thumb || token.small}
                          alt={token.name}
                          className={styles.tokenIcon}
                          onError={(e) => {
                            const img = e.currentTarget;
                            const originalUrl = img.getAttribute('data-original');
                            // First try direct URL if we were using proxy
                            if (originalUrl && img.src !== originalUrl) {
                              img.src = originalUrl;
                              return;
                            }
                            // If direct URL also fails, show fallback
                            img.style.display = 'none';
                            img.nextElementSibling?.classList.remove(styles.hidden);
                          }}
                        />
                      ) : null}
                      <div className={`${styles.fallbackIcon} ${(token.image || token.thumb || token.small) ? styles.hidden : ''}`} style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}></div>

                      <span className={styles.tokenName}>
                        {token.name || `Token ${i + 1}`}
                      </span>
                    </div>
                    <div className={styles.tokenRight}>
                      {/* Generate sparkline data based on price (simplified trend) */}
                      {(() => {
                        const basePrice = price || 1;
                        const trendData = generateTrend(basePrice);
                        const isUp = trendData[trendData.length - 1] > trendData[0];
                        return <Sparkline data={trendData} isUp={isUp} />;
                      })()}
                      <span className={styles.tokenPrice}>
                        ${price > 0 ? price.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : `1.2${i}`}
                      </span>
                    </div>
                  </div>
                );
              }) : [1, 2, 3].map(i => (
                <div
                  key={i}
                  className={styles.listItem}
                >
                  <div className={styles.tokenInfo}>
                    <span className={styles.rank}>
                      #{i}
                    </span>
                    <div className={styles.fallbackIcon} style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}></div>
                    <span className={styles.tokenName}>Meme {i}</span>
                  </div>
                  <div className={styles.tokenRight}>
                    <span className={styles.tokenPrice}>$0.00</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Macro Market Indicators Table */}
        <div className={styles.macroContainer}>
          <div className={styles.macroHeader}>
            <h3 className={styles.macroTitle}>
              <Scale size={20} color="#5B8DEF" /> Macro Market Indicators
            </h3>
            {marketData?.updatedAt && (
              <div className={styles.lastUpdated}>
                Last Updated: {formatRelativeTime(marketData.updatedAt)}
              </div>
            )}
          </div>

          {/* Unified Card View (Grid on Desktop) */}
          <div className={styles.mobileCardContainer}>
            {macroIndicators.map((item) => {
              return (
                <div
                  key={item.id}
                  className={styles.mobileCard}
                >
                  <div className={styles.mobileCardHeader}>
                    <div className={styles.mobileCardContent}>
                      <div className={styles.mobileCardTitleRow}>
                        <div className={styles.indicatorName}>
                          {item.name}
                        </div>
                        <div className={styles.valueWrapper}>
                          <span className={styles.value}>
                            {item.value}
                          </span>
                          {item.unit && (
                            <span className={styles.unit}>
                              / {item.unit}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.indicatorDesc}>
                        {item.description}
                      </div>
                    </div>
                  </div>

                  <div className={styles.flexColumnGap}>
                    <div className={styles.statusRow}>
                      <span className={styles.statusBadge} style={{
                        color: item.statusColor,
                        borderColor: item.statusBorder,
                        background: item.statusBg
                      }}>
                        {item.status}
                      </span>
                    </div>

                    <div className={styles.flexColumnGap4}>
                      <div className={styles.progressBarContainer}>
                        <div
                          className={styles.progressBar}
                          style={{
                            left: `${item.rangeValue}%`,
                            backgroundColor: item.statusColor || '#f59e0b',
                            boxShadow: `0 0 10px ${item.statusColor || 'rgba(245, 158, 11, 0.5)'}`
                          }}
                        ></div>
                      </div>
                      <div className={styles.rangeLabels}>
                        <span>{item.rangeLabels[0]}</span>
                        <span>{item.rangeLabels[2]}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
