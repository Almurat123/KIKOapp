import React from 'react';
import { Play, Pause, Edit, Trash2, Target, Copy, Check } from 'lucide-react';
import { useThemeContext } from '../../contexts/ThemeContext';
import type { TradingStrategy } from '../../hooks/useStrategies';
import styles from './StrategyCard.module.css';
import clsx from 'clsx';

interface StrategyCardProps {
  strategy: TradingStrategy;
  onEdit?: (strategy: TradingStrategy) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string) => void;
}

const getChainInfo = (chainId: number | undefined) => {
  switch (chainId) {
    case 8453: return { name: 'Base', icon: '/assets/tokens/base.png', color: '#0052FF' };
    case 1: return { name: 'Ethereum', icon: '/assets/tokens/eth.png', color: '#627EEA' };
    case 900: return { name: 'Solana', icon: '/assets/tokens/sol.png', color: '#14F195' };
    case 137: return { name: 'Polygon', icon: '/assets/tokens/polygon.png', color: '#8247E5' };
    default: return { name: 'Unknown', icon: '/assets/tokens/eth.png', color: '#627EEA' };
  }
};

export const StrategyCard: React.FC<StrategyCardProps> = ({
  strategy,
  onEdit,
  onDelete,
  onToggleStatus,
}) => {
  const { resolvedTheme } = useThemeContext();
  const [isWalletCopied, setIsWalletCopied] = React.useState(false);

  const isCopyTrade = strategy.type === 'copy_trade';
  const isPolymarketCopy = strategy.type === 'polymarket_copy';

  if (!isCopyTrade && !isPolymarketCopy) return null;

  const copyConfig = isCopyTrade ? strategy.copyTradeConfig : null;
  const polyConfig = isPolymarketCopy ? strategy.polymarketCopyConfig : null;
  const targetWallet = isCopyTrade ? copyConfig?.targetWallet : polyConfig?.targetWallet;

  if (!targetWallet) return null;

  const chainInfo = getChainInfo(strategy.chainId);
  const isActive = strategy.status === 'active';
  const status = (strategy.status || 'paused').toUpperCase();
  const isDeleted = status === 'DELETED';

  const formatMoney = (val?: number) => val ? `$${val.toLocaleString()}` : '$0';

  return (
    <div className={clsx(styles.strategyCard, styles[resolvedTheme])}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.chainIconWrapper} style={{ borderColor: `${chainInfo.color}33`, background: `${chainInfo.color}11` }}>
            <img src={chainInfo.icon} alt={chainInfo.name} className={styles.chainIcon} />
          </div>
          <div className={styles.titleColumn}>
            <div className={styles.title}>{isCopyTrade ? 'Copy Trading' : 'Polymarket Copy'}</div>
            <div className={styles.subtitle}>on {chainInfo.name}</div>
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
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(targetWallet);
              setIsWalletCopied(true);
              setTimeout(() => setIsWalletCopied(false), 2000);
            }}
          >
            <span className={styles.fullAddress}>{targetWallet}</span>
            {isWalletCopied ? <Check size={10} color="#4ade80" /> : <Copy size={12} style={{ opacity: 0.5 }} />}
          </div>
        </div>

        <div className={styles.divider} />

        {isCopyTrade ? (
          <div className={styles.mainGrid}>
            <div className={styles.gridColumn}>
              <div className={styles.gridItem}>
                <div className={styles.label}>TRIGGER</div>
                <div className={styles.value}>Tx {'>'} {formatMoney(copyConfig?.minTargetValueUsd ?? undefined)}</div>
              </div>
              <div className={styles.tpBox}>
                <span className={styles.boxLabel}>TP</span>
                <span className={styles.boxValue}>+{copyConfig?.takeProfitPct}%</span>
              </div>
            </div>
            <div className={clsx(styles.gridColumn, styles.rightAlign)}>
              <div className={styles.gridItem}>
                <div className={styles.label}>BUY AMT</div>
                <div className={styles.value}>{formatMoney(copyConfig?.buyAmountUsd)}</div>
              </div>
              <div className={styles.slBox}>
                <span className={styles.boxLabel}>SL</span>
                <span className={styles.boxValue}>-{copyConfig?.stopLossPct}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.mainGrid}>
            <div className={styles.gridColumn}>
              <div className={styles.gridItem}>
                <div className={styles.label}>BET SIZE</div>
                <div className={styles.value}>{formatMoney(polyConfig?.betSizeUsd)}</div>
              </div>
              <div className={styles.gridItem}>
                <div className={styles.label}>MIRROR SELL</div>
                <div className={styles.value}>{polyConfig?.mirrorSell ? 'On' : 'Off'}</div>
              </div>
            </div>
            <div className={clsx(styles.gridColumn, styles.rightAlign)}>
              <div className={styles.gridItem}>
                <div className={styles.label}>MAX OPEN</div>
                <div className={styles.value}>{polyConfig?.maxOpenBets}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.actionBtn} onClick={() => onEdit?.(strategy)} disabled={isDeleted}>
          <Edit size={14} />
          <span>Edit</span>
        </button>
        <button className={styles.actionBtn} onClick={() => onToggleStatus?.(strategy.id)} disabled={isDeleted}>
          {isActive ? <Pause size={14} /> : <Play size={14} />}
          <span>{isActive ? 'Pause' : 'Resume'}</span>
        </button>
        <button className={clsx(styles.actionBtn, styles.deleteBtn)} onClick={() => onDelete?.(strategy.id)} disabled={isDeleted}>
          <Trash2 size={14} />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
};
