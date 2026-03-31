import React from 'react';
import { Target, Check, Copy, Info } from 'lucide-react';
import { useThemeContext } from '../../contexts/ThemeContext';
import type { TradingStrategy } from '../../hooks/useStrategies';
import styles from './StrategyCard.module.css';
import clsx from 'clsx';
import { useIsMobile } from '../../hooks/useIsMobile';
import { truncateAddress } from '../../utils/format';
import { getTargetStatus } from '../../services/copyTradeApi';
import { resolveChainPresentation } from '../../utils/chainPresentation';

interface StrategyCardProps {
  strategy: TradingStrategy;
  onEdit?: (strategy: TradingStrategy) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string) => void;
}

export const StrategyCard: React.FC<StrategyCardProps> = ({
  strategy,
}) => {
  const { resolvedTheme } = useThemeContext();
  const [isWalletCopied, setIsWalletCopied] = React.useState(false);
  const [targetTradeCount, setTargetTradeCount] = React.useState<number>(0);
  const isMobile = useIsMobile();

  const isCopyTrade = strategy.type === 'copy_trade';
  const copyConfig = isCopyTrade ? strategy.copyTradeConfig : null;
  const targetWallet = copyConfig?.targetWallet;

  const chainInfo = resolveChainPresentation(strategy.chainId ?? strategy.chain);
  const isActive = strategy.status === 'active';
  const status = (strategy.status || 'paused').toUpperCase();
  const isDeleted = status === 'DELETED';

  const formatMoney = (val?: number) => val ? `$${val.toLocaleString()}` : '$0';

  React.useEffect(() => {
    let cancelled = false;
    const configId = copyConfig?.id;
    if (!isCopyTrade || !configId) return;

    const fetchStatus = async () => {
      try {
        const res = await getTargetStatus(configId);
        if (cancelled) return;
        const agg = res?.aggregate;
        const tracked = Number(agg?.trackedTxCount || 0);
        const walletTotal = Number((agg as any)?.walletTxCount || 0);
        setTargetTradeCount(tracked > 0 ? tracked : walletTotal);
      } catch (err) {
        console.error('[Chat/StrategyCard] target-status fetch failed', err);
      }
    };

    void fetchStatus();
    return () => { cancelled = true; };
  }, [isCopyTrade, copyConfig?.id]);

  if (!isCopyTrade) return null;
  if (!targetWallet) return null;

  return (
    <div className={clsx(styles.strategyCard, resolvedTheme === 'light' && 'light')}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.chainIconWrapper}>
            <img src={chainInfo.icon} alt={chainInfo.displayName} className={styles.chainIcon} />
          </div>
          <div className={styles.titleColumn}>
            <div className={styles.title}>Copy Trading</div>
            <div className={styles.subtitle}>on {chainInfo.displayName}</div>
          </div>
        </div>
        <div className={clsx(styles.statusBadge, {
          [styles.statusActive]: isActive,
          [styles.statusPaused]: !isActive && !isDeleted,
          [styles.statusDeleted]: isDeleted
        })}>
          {status}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.row}>
          <div className={styles.label}>
            <Target size={12} />
            <span>TARGET</span>
          </div>
          <div 
            className={styles.walletBadge}
            onClick={() => {
              navigator.clipboard.writeText(targetWallet);
              setIsWalletCopied(true);
              setTimeout(() => setIsWalletCopied(false), 2000);
            }}
          >
            <span className={styles.fullAddress}>
              {isMobile ? truncateAddress(targetWallet) : targetWallet}
            </span>
            {isWalletCopied ? <Check size={10} color="#4ade80" /> : <Copy size={12} style={{ opacity: 0.5 }} />}
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.mainGrid}>
          <div className={styles.gridColumn}>
            <div className={styles.gridItem}>
              <div className={styles.label}>MIN TRADE</div>
              <div className={styles.value}>{formatMoney(copyConfig?.minTargetValueUsd ?? 0)}</div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.tpBox}>
                <span className={styles.boxLabel}>TP</span>
                <span className={styles.boxValue}>+{copyConfig?.takeProfitPct}%</span>
              </div>
            </div>
          </div>
          <div className={clsx(styles.gridColumn, styles.rightAlign)}>
            <div className={styles.gridItem}>
              <div className={styles.label}>BUY AMOUNT</div>
              <div className={styles.value}>{formatMoney(copyConfig?.buyAmountUsd)}</div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.slBox}>
                <span className={styles.boxLabel}>SL</span>
                <span className={styles.boxValue}>-{copyConfig?.stopLossPct}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footerInfo}>
          <Info size={10} style={{ opacity: 0.5 }} />
          <span style={{ opacity: 0.5 }}>Executed {targetTradeCount} trades</span>
        </div>
      </div>
    </div>
  );
};
