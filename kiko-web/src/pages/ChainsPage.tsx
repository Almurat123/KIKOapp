import React, { useState, useEffect } from 'react';
import { Layers, Zap, Globe } from 'lucide-react';
import { PageContainer } from '../components/Layout/PageContainer';
import { marketApi } from '../services/api';
import type { ChainData } from '../services/api';
import { Skeleton } from '../components/Skeleton';
import styles from './ChainsPage.module.css';
import { useThemeContext } from '../contexts/ThemeContext';
import { getLocalChainIcon } from '../utils/chainIcons';

// Get chain icon URL (using local assets)
function getChainIcon(chainName: string): string {
  return getLocalChainIcon(chainName);
}



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

  const [chainsData, setChainsData] = useState<ChainData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalTVL, setTotalTVL] = useState(0);
  const [total24hTxns, setTotal24hTxns] = useState(0);
  const [totalActiveWallets, setTotalActiveWallets] = useState(0);
  const [avgTvlChange, setAvgTvlChange] = useState(0);

  useEffect(() => {

  }, []);

  useEffect(() => {
    loadChainsData();
  }, []);

  const loadChainsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const allChains = await marketApi.getChains();

      // Backend should handle proper name mapping
      // Frontend filter ensures clean display (keeps only chains with valid TVL)
      const chains = allChains
        .filter(chain => chain.tvl > 0)
        .sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
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

  const { resolvedTheme } = useThemeContext();

  if (loading) {
    return (
      <PageContainer fullWidth>
        <div className={`${styles.container} ${styles[resolvedTheme]}`}>
          {/* Chain Highlights Skeleton */}
          <div className={styles.highlightsGrid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.highlightCard}>
                <Skeleton variant="text" width={80} height={12} />
                <div style={{ marginTop: '12px' }}>
                  <Skeleton variant="text" width={100} height={28} />
                </div>
              </div>
            ))}
          </div>

          {/* Chain List Skeleton */}
          <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <Skeleton variant="text" width={180} height={24} />
            </div>
            <div className={styles.listContainer}>
              <div className={styles.listHeader}>
                <div className={styles.headerCell}>Chain</div>
                <div className={styles.headerCell}>TVL</div>
                <div className={styles.headerCell}>Vol / Txns</div>
                <div className={styles.headerCell}>Contracts</div>
                <div className={styles.headerCell}>Users</div>
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={styles.listItem}>
                  <div className={styles.tokenInfo}>
                    <Skeleton variant="circular" width={32} height={32} />
                    <Skeleton variant="text" width={80} height={18} />
                  </div>
                  <div className={styles.cell}>
                    <Skeleton variant="text" width={60} height={16} />
                  </div>
                  <div className={styles.cell}>
                    <Skeleton variant="text" width={60} height={16} />
                  </div>
                  <div className={styles.cell}>
                    <Skeleton variant="text" width={60} height={16} />
                  </div>
                  <div className={styles.cell}>
                    <Skeleton variant="text" width={40} height={16} />
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
                <div className={styles.rateLimitDetail}>
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
    <PageContainer fullWidth>
      <div className={`${styles.container} ${styles[resolvedTheme]}`}>
        {/* Chain Highlights */}
        <div className={styles.highlightsGrid}>
          <div className={styles.highlightCard}>
            <div className={styles.highlightRow}>
              <div className={styles.highlightIcon} style={{ color: '#5B8DEF' }}>
                <Layers size={16} />
              </div>
              <div className={styles.label}>Total TVL</div>
            </div>
            <div className={styles.value}>
              {formatCurrency(totalTVL)} <span className={avgTvlChange >= 0 ? styles.changePositive : styles.changeNegative}>{formatChange(avgTvlChange)}</span>
            </div>
          </div>
          <div className={styles.highlightCard}>
            <div className={styles.highlightRow}>
              <div className={styles.highlightIcon} style={{ color: '#f59e0b' }}>
                <Zap size={16} />
              </div>
              <div className={styles.label}>Total 24h Txns</div>
            </div>
            <div className={styles.value}>{formatNumber(total24hTxns)}</div>
          </div>
          <div className={styles.highlightCard}>
            <div className={styles.highlightRow}>
              <div className={styles.highlightIcon} style={{ color: '#10b981' }}>
                <Globe size={16} />
              </div>
              <div className={styles.label}>Active Wallets</div>
            </div>
            <div className={styles.value}>{formatNumber(totalActiveWallets)}</div>
          </div>
        </div>

        {/* Chain List */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h3 className={styles.tableTitle}>
              Top Chains by 24h Transactions
            </h3>
          </div>

          <div className={styles.listContainer}>
            <div className={styles.listHeader}>
              <div className={styles.headerCell}>Chain</div>
              <div className={styles.headerCell}>TVL</div>
              <div className={styles.headerCell}>Vol / Txns</div>
              <div className={styles.headerCell}>Contracts</div>
              <div className={styles.headerCell}>Users</div>
            </div>

            {chainsData.map((c) => {
              const iconUrl = getChainIcon(c.name);
              return (
                <div key={c.name} className={styles.listItem}>
                  <div className={styles.tokenInfo}>
                    <div className={styles.iconWrapper}>
                      <img
                        src={iconUrl}
                        alt={c.name}
                        className={styles.tokenIcon}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.classList.remove(styles.hidden);
                        }}
                      />
                      <div className={`${styles.fallbackIcon} ${styles.hidden}`} style={{ background: 'linear-gradient(135deg, #5B8DEF, #3861fb)' }}>
                        {c.name[0]}
                      </div>
                      <span className={styles.rankBadge}>{chainsData.indexOf(c) + 1}</span>
                    </div>
                    <div className={styles.flexColumn}>
                      <span className={styles.tokenName}>{c.name}</span>
                      <span className={styles.indicatorDesc}>{c.gasPrice || '-'}</span>
                    </div>
                  </div>

                  {/* TVL */}
                  <div className={styles.cell}>
                    <span className={styles.metricValueSmall}>{formatCurrency(c.tvl)}</span>
                    <span className={`${styles.metricChange} ${c.tvlChange24h >= 0 ? styles.metricChangeUp : styles.metricChangeDown}`}>
                      {formatChange(c.tvlChange24h)}
                    </span>
                  </div>

                  {/* Vol / Txns */}
                  <div className={styles.cell}>
                    <span className={styles.metricValueSmall}>{c.volume24h ? formatCurrency(c.volume24h) : '-'}</span>
                    <span className={styles.indicatorDesc}>{c.txns24h ? formatNumber(c.txns24h) + ' txns' : '-'}</span>
                  </div>

                  {/* Contracts */}
                  <div className={styles.cell}>
                    <span className={styles.metricValueSmall}>{formatNumber(c.contracts24h || c.poolsCount || 0)} <span className={styles.indicatorDesc} style={{ fontSize: '8px' }}>24H</span></span>
                    <span className={styles.indicatorDesc}>{formatNumber(c.contracts7d || c.tokensCount || 0)} <span className={styles.indicatorDesc} style={{ fontSize: '8px' }}>7D</span></span>
                  </div>

                  {/* Users / Gas */}
                  <div className={styles.cell}>
                    <span className={styles.metricValueSmall}>{formatNumber(c.activeWallets || 0)}</span>
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

