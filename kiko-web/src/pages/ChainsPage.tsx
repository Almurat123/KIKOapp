import React, { useState, useEffect } from 'react';
import { Layers, Zap, Globe } from 'lucide-react';
import { PageContainer } from '../components/Layout/PageContainer';
import { marketApi } from '../services/api';
import type { ChainData } from '../services/api';
import { Skeleton } from '../components/Skeleton';
import styles from './ChainsPage.module.css';

// --- Chain name to DeFiLlama icon slug mapping ---
// Using DeFiLlama's icon API: https://icons.llamao.fi/icons/chains/rsz_{slug}?w=48&h=48
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

// Get chain icon URL using DeFiLlama API (high resolution)
function getChainIcon(chainName: string): string {
  const slug = CHAIN_ICON_SLUGS[chainName] || chainName.toLowerCase().replace(/ /g, '%20');
  // Use higher resolution (128x128) for better quality
  return `https://icons.llamao.fi/icons/chains/rsz_${slug}?w=128&h=128`;
}

// Chains with Dune data (52 chains)
const CHAINS_WITH_DUNE_DATA = new Set([
  'Ethereum', 'Solana', 'BSC', 'Bitcoin', 'Tron', 'Base', 'Arbitrum', 'Plasma',
  'Hyperliquid L1', 'Avalanche', 'Polygon', 'Aptos', 'Katana', 'Linea', 'Mantle',
  'Ink', 'OP Mainnet', 'Berachain', 'Starknet', 'Sei', 'Flare', 'Scroll',
  'Plume Mainnet', 'Gnosis', 'Near', 'Unichain', 'Monad', 'Flow', 'Sonic', 'TON',
  'Hemi', 'Celo', 'World Chain', 'ZKsync Era', 'Abstract', 'opBNB', 'Ronin',
  'Kaia', 'Story', 'Taiko', 'Sophon', 'Fantom', 'TAC', 'Boba', 'Somnia',
  'Polygon zkEVM', 'Mezo', 'Corn', 'Peaq', 'Arbitrum Nova', 'Superseed', 'Shape'
]);

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

function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export const ChainsPage: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [chainsData, setChainsData] = useState<ChainData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalTVL, setTotalTVL] = useState(0);
  const [total24hTxns, setTotal24hTxns] = useState(0);
  const [totalActiveWallets, setTotalActiveWallets] = useState(0);
  const [avgTvlChange, setAvgTvlChange] = useState(0);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    loadChainsData();
  }, []);

  const loadChainsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const allChains = await marketApi.getChains();

      // Filter to only show chains with Dune data, then sort by txns24h (descending)
      const chains = allChains
        .filter(c => CHAINS_WITH_DUNE_DATA.has(c.name))
        .sort((a, b) => (b.txns24h || 0) - (a.txns24h || 0));
      setChainsData(chains);

      // Calculate totals from real data
      const total = chains.reduce((sum, chain) => sum + chain.tvl, 0);
      setTotalTVL(total);

      const txns = chains.reduce((sum, chain) => sum + (chain.txns24h || 0), 0);
      setTotal24hTxns(txns);

      const wallets = chains.reduce((sum, chain) => sum + (chain.activeWallets || 0), 0);
      setTotalActiveWallets(wallets);

      // Calculate average TVL change (weighted by TVL)
      const chainsWithChange = chains.filter(c => c.tvlChange24h !== undefined && c.tvl > 0);
      if (chainsWithChange.length > 0) {
        const weightedChange = chainsWithChange.reduce((sum, c) => sum + (c.tvlChange24h * c.tvl), 0);
        const totalWeight = chainsWithChange.reduce((sum, c) => sum + c.tvl, 0);
        setAvgTvlChange(totalWeight > 0 ? weightedChange / totalWeight : 0);
      }
    } catch (err: any) {
      console.error('[ChainsPage] Error loading chains data:', err);
      setError(err.message || 'Failed to load chains data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className={isMobile ? styles.containerMobile : styles.container}>
          {/* Chain Highlights Skeleton */}
          <div className={styles.highlightsGrid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.highlightCard}>
                <Skeleton variant="circular" width={48} height={48} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skeleton variant="text" width={100} height={16} />
                  <Skeleton variant="text" width={120} height={24} />
                </div>
              </div>
            ))}
          </div>

          {/* Chain List Skeleton */}
          <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <Skeleton variant="text" width={200} height={24} />
              <Skeleton variant="rectangular" width={120} height={36} />
            </div>
            <div className={styles.listContainer}>
              <div className={styles.listHeader}>
                <div className={styles.headerCell}>Chain</div>
                <div className={styles.headerCell}>TVL</div>
                <div className={styles.headerCell}>Vol / Txns</div>
                <div className={styles.headerCell}>Contracts</div>
                <div className={styles.headerCell}>Users / Gas</div>
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={styles.listRow}>
                  <div className={`${styles.cell} ${styles.cellFirst}`}>
                    <Skeleton variant="circular" width={20} height={20} />
                    <Skeleton variant="circular" width={32} height={32} />
                    <Skeleton variant="text" width={120} height={18} />
                  </div>
                  <div className={styles.cell}>
                    <Skeleton variant="text" width={80} height={16} />
                    <Skeleton variant="text" width={60} height={14} />
                  </div>
                  <div className={styles.cell}>
                    <Skeleton variant="text" width={80} height={16} />
                    <Skeleton variant="text" width={70} height={14} />
                  </div>
                  <div className={styles.cell}>
                    <Skeleton variant="text" width={70} height={16} />
                    <Skeleton variant="text" width={70} height={14} />
                  </div>
                  <div className={styles.cell}>
                    <Skeleton variant="text" width={60} height={16} />
                    <Skeleton variant="text" width={50} height={14} />
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
    const isRateLimit = error.includes('request limit') || error.includes('429');
    return (
      <PageContainer>
        <div className={styles.errorContainer}>
          <div className={styles.errorMessage}>
            {isRateLimit ? (
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
          <button
            onClick={(e) => {
              // Add delay for rate limit errors
              if (isRateLimit) {
                // Disable button and show countdown
                const btn = e.currentTarget;
                btn.disabled = true;
                let countdown = 5;
                btn.textContent = `Retry in ${countdown}s`;
                const interval = setInterval(() => {
                  countdown--;
                  if (countdown > 0) {
                    btn.textContent = `Retry in ${countdown}s`;
                  } else {
                    clearInterval(interval);
                    btn.disabled = false;
                    btn.textContent = 'Retry';
                    loadChainsData();
                  }
                }, 1000);
              } else {
                loadChainsData();
              }
            }}
            className={styles.retryBtn}
          >
            {isRateLimit ? 'Retry in 5s' : 'Retry'}
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className={isMobile ? styles.containerMobile : styles.container}>
        {/* Chain Highlights */}
        <div className={styles.highlightsGrid}>
          <div className={styles.highlightCard}>
            <div className={styles.iconWrapper} style={{ background: 'rgba(91, 141, 239, 0.15)', color: '#5B8DEF' }}>
              <Layers size={24} />
            </div>
            <div>
              <div className={styles.label}>
                Total TVL
              </div>
              <div className={styles.value}>
                {formatCurrency(totalTVL)} <span className={avgTvlChange >= 0 ? styles.changePositive : styles.changeNegative}>{formatChange(avgTvlChange)}</span>
              </div>
            </div>
          </div>
          <div className={styles.highlightCard}>
            <div className={styles.iconWrapper} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <Zap size={24} />
            </div>
            <div>
              <div className={styles.label}>
                Total 24h Txns
              </div>
              <div className={styles.value}>
                {formatNumber(total24hTxns)}
              </div>
            </div>
          </div>
          <div className={styles.highlightCard}>
            <div className={styles.iconWrapper} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <Globe size={24} />
            </div>
            <div>
              <div className={styles.label}>
                Active Wallets
              </div>
              <div className={styles.value}>
                {formatNumber(totalActiveWallets)}
              </div>
            </div>
          </div>
        </div>

        {/* Chain List */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h3 className={styles.tableTitle}>
              Top Chains by 24h Transactions
            </h3>
            <button
              className={styles.compareBtn}
            >
              Compare Chains
            </button>
          </div>
          <div className={styles.listContainer}>
            <div className={styles.listHeader}>
              <div className={styles.headerCell}>Chain</div>
              <div className={styles.headerCell}>TVL</div>
              <div className={styles.headerCell}>Vol / Txns</div>
              <div className={styles.headerCell}>Contracts</div>
              <div className={styles.headerCell}>Users / Gas</div>
            </div>

            {chainsData.map((c, idx) => {
              const iconUrl = getChainIcon(c.name);
              return (
                <div key={c.name} className={styles.listRow}>
                  <div className={`${styles.cell} ${styles.cellFirst}`}>
                    <span className={styles.rank}>{idx + 1}</span>
                    <img
                      src={iconUrl}
                      alt={c.name}
                      className={styles.chainIconImg}
                      onError={(e) => {
                        // Fallback to letter icon if image fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className={styles.chainIcon} style={{ display: 'none' }}>
                      {c.name[0]}
                    </div>
                    <span className={styles.chainName}>{c.name}</span>
                  </div>

                  <div className={styles.cell}>
                    <div className={styles.primaryValue}>{formatCurrency(c.tvl)}</div>
                    <div className={c.tvlChange24h >= 0 ? styles.changePositive : styles.changeNegative}>
                      {formatChange(c.tvlChange24h)}
                    </div>
                  </div>

                  {/* Vol / Txns */}
                  <div className={styles.cell}>
                    <div className={styles.primaryValue}>{c.volume24h ? formatCurrency(c.volume24h) : '-'}</div>
                    <div className={styles.subValue}>{c.txns24h ? formatNumber(c.txns24h) + ' txns' : '-'}</div>
                  </div>

                  {/* Contracts (24H / 7D) */}
                  <div className={styles.cell}>
                    <div className={styles.primaryValue}>{c.contracts24h ? formatNumber(c.contracts24h) : (c.poolsCount ? formatNumber(c.poolsCount) : '-')} <span className={styles.subLabel}>24H</span></div>
                    <div className={styles.subValue}>{c.contracts7d ? formatNumber(c.contracts7d) : (c.tokensCount ? formatNumber(c.tokensCount) : '-')} <span className={styles.subLabel}>7D</span></div>
                  </div>

                  {/* Users / Gas */}
                  <div className={styles.cell}>
                    <div className={styles.primaryValue}>{c.activeWallets ? formatNumber(c.activeWallets) : '-'}</div>
                    <div className={styles.subValue}>{c.gasPrice || '-'}</div>
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

