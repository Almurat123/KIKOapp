import React from 'react';
import { Play, Pause, Edit, Trash2, Eye, Target, Check } from 'lucide-react';
import { useThemeContext } from '../../contexts/ThemeContext';
import type { TradingStrategy } from '../../hooks/useStrategies';
import styles from './StrategyCard.module.css';
import clsx from 'clsx';


interface StrategyCardProps {
  strategy: TradingStrategy;
  onEdit: (strategy: TradingStrategy) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
  variant?: 'card' | 'row';
}

// Helper to get chain info
const getChainInfo = (chainId: number | undefined) => {
  switch (chainId) {
    case 8453: return { name: 'Base', icon: '/assets/tokens/base.png', color: '#0052FF' };
    case 1: return { name: 'Ethereum', icon: '/assets/tokens/eth.png', color: '#627EEA' };
    case 900: return { name: 'Solana', icon: '/assets/tokens/sol.png', color: '#14F195' }; // Using generic ID for Sol
    default: return { name: 'Unknown', icon: '/assets/tokens/eth.png', color: '#627EEA' };
  }
};

export const StrategyCard: React.FC<StrategyCardProps> = ({
  strategy,
  onEdit,
  onDelete,
  onToggleStatus,
  variant = 'card',
}) => {
  const { resolvedTheme } = useThemeContext();
  const [isWalletCopied, setIsWalletCopied] = React.useState(false);

  // CRITICAL: Only render copy_trade strategies
  // This component is specifically designed for CopyTradeConfig
  // Other strategy types (auto_buy, auto_sell, custom, dca) should use different components
  if (strategy.type !== 'copy_trade') {
    console.warn('[StrategyCard] Attempted to render non-copy-trade strategy:', strategy.type, strategy.id);
    return null;
  }

  // Validate that copyTradeConfig exists and is valid
  if (!strategy.copyTradeConfig || !strategy.copyTradeConfig.targetWallet ||
    strategy.copyTradeConfig.targetWallet === '0x0000000000000000000000000000000000000000') {
    console.warn('[StrategyCard] Invalid or missing copyTradeConfig:', strategy.id);
    return null;
  }

  const config = strategy.copyTradeConfig;

  const chainInfo = getChainInfo(config.chainId || strategy.chainId);

  const isActive = strategy.status === 'active';
  const status = (strategy.status || 'paused').toUpperCase() === 'PAUSED' ? 'PAUSED' :
    (strategy.status || '').toUpperCase() === 'DELETED' ? 'DELETED' : 'ACTIVE';
  const executionCount = (strategy.executionHistory || []).length;

  // --- ROW VARIANT (Single Line) ---
  if (variant === 'row') {
    return (
      <div className={clsx(styles.cardRow, resolvedTheme)}>
        {/* Identity */}
        <div className={styles.rowIdentity}>
          <div className={styles.rowIcon} style={{ borderColor: `${chainInfo.color}33`, background: `${chainInfo.color}11` }}>
            <img src={chainInfo.icon} alt={chainInfo.name} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
          </div>
          <div>
            <div className={styles.rowName}>Copy Trading <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>on {chainInfo.name}</span></div>
            <div style={{ marginTop: '4px', display: 'inline-block' }}>
              {status === 'DELETED' ? (
                <span className={styles.statusBadgeDeleted}>DELETED</span>
              ) : (
                <span className={status === 'ACTIVE' ? styles.statusBadgeActive : styles.statusBadgePaused}>
                  {status}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Configuration - Simplified for mobile */}
        <div className={styles.rowConfig}>
          {/* Target Wallet */}
          <div className={styles.rowItem}>
            <span className={styles.rowItemLabel}>Target</span>
            <div
              className={styles.walletAddress}
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(config.targetWallet);
                setIsWalletCopied(true);
                setTimeout(() => setIsWalletCopied(false), 2000);
              }}
              style={{ cursor: 'pointer' }}
            >
              {isWalletCopied ? (
                <div className={styles.iconWrapper}>
                  <Check size={16} color="#4ade80" />
                </div>
              ) : null}
              {config.targetWallet.slice(0, 6)}...{config.targetWallet.slice(-4)}
            </div>
          </div>

          {/* Trigger Value */}
          <div className={styles.rowItem}>
            <span className={styles.rowItemLabel}>Trigger</span>
            <span className={styles.rowItemValue}>${config.minTargetValueUsd || '0'}</span>
          </div>

          {/* TP/SL Compact */}
          <div className={styles.rowItem}>
            <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '12px' }}>TP +{config.takeProfitPct}%</span>
            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '12px', marginLeft: '8px' }}>SL -{config.stopLossPct}%</span>
          </div>

          {/* Buy Amount */}
          <div className={styles.rowItem}>
            <span className={styles.rowItemLabel}>Buy</span>
            <span className={styles.rowItemValue}>${config.buyAmountUsd}</span>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.rowActions}>
          <button
            onClick={() => onEdit(strategy)}
            className={styles.rowBtn}
            title="Edit"
            disabled={status === 'DELETED'}
          >
            <div className={styles.iconWrapper}>
              <Edit size={16} />
            </div>
          </button>

          <button
            onClick={() => onToggleStatus(strategy.id)}
            className={styles.rowBtn}
            title={isActive ? 'Pause' : 'Resume'}
            disabled={status === 'DELETED'}
          >
            <div className={styles.iconWrapper}>
              {isActive ? <Pause size={16} /> : <Play size={16} />}
            </div>
          </button>

          <button
            onClick={() => onDelete(strategy.id)}
            className={clsx(styles.rowBtn, styles.rowBtnDelete)}
            title="Delete"
            disabled={status === 'DELETED'}
          >
            <div className={styles.iconWrapper}>
              <Trash2 size={16} />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // --- CARD VARIANT (Original) ---
  return (
    <div className={clsx(styles.card, styles.copyCard, resolvedTheme)}>
      {/* Header: Title & Status */}
      <div className={styles.strategyHeader}>
        <div className={styles.strategyTitleSection}>
          <div className={styles.uintaIcon} style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', padding: 0, overflow: 'hidden' }}>
            <img src={chainInfo.icon} alt={chainInfo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div className={styles.strategyName}>Copy Trading</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500, marginTop: '2px' }}>on {chainInfo.name}</div>
          </div>
        </div>
        {status === 'DELETED' ? (
          <span className={styles.statusBadgeDeleted}>DELETED</span>
        ) : (
          <span className={status === 'ACTIVE' ? styles.statusBadgeActive : styles.statusBadgePaused}>
            {status}
          </span>
        )}
      </div>

      {/* Core Configuration */}
      <div className={styles.strategyContent}>

        {/* IF Block: Monitor Conditions */}
        <div className={styles.strategyBlock}>
          {/* Item 1: Target Wallet (Vertical for better readability) */}
          <div className={styles.strategyItemVertical}>
            <div className={styles.strategyItemLabel}>
              <div className={styles.iconWrapper}>
                <Target size={16} />
              </div>
              <span>Target Wallet</span>
            </div>
            <div className={styles.strategyItemValueVertical}>
              <div
                className={styles.walletAddress}
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(config.targetWallet);
                  setIsWalletCopied(true);
                  setTimeout(() => setIsWalletCopied(false), 2000);
                }}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isWalletCopied ? (
                  <div className={styles.iconWrapper}>
                    <Check size={16} color="var(--success-color)" />
                  </div>
                ) : null}
                <span className={styles.walletAddressText}>{config.targetWallet}</span>
              </div>
            </div>
          </div>

          <div className={styles.strategyDivider}></div>

          {/* Item 2: Trigger Condition */}
          <div className={styles.strategyItem}>
            <div className={styles.strategyItemLabel}>
              <div className={styles.iconWrapper}>
                <Eye size={16} />
              </div>
              <span>Trigger</span>
            </div>
            <div className={styles.strategyItemValue}>
              <div className={styles.triggerValue}>
                Tx Value {'>'} ${config.minTargetValueUsd?.toLocaleString() || '0'}
              </div>
            </div>
          </div>
        </div>

        {/* THEN Block: Execution Logic */}
        <div className={styles.strategyBlockThen}>

          <div className={styles.strategyItem}>
            <div className={styles.slTpCapsule}>
              <div className={styles.capsuleItem}>
                <span className={styles.capsuleLabel}>TP</span>
                <span className={styles.capsuleValueGreen}>+{config.takeProfitPct}%</span>
              </div>
              <div className={styles.capsuleDivider}></div>
              <div className={styles.capsuleItem}>
                <span className={styles.capsuleLabel}>SL</span>
                <span className={styles.capsuleValueRed}>-{config.stopLossPct}%</span>
              </div>
            </div>
          </div>

          <div className={styles.strategyDivider}></div>

          <div className={styles.strategyItem}>
            <span className={styles.buyAmountLabel}>Buy Amount</span>
            <span className={styles.buyAmountValue}>${config.buyAmountUsd?.toLocaleString() || strategy.executionAmount}</span>
          </div>

        </div>

      </div>

      {/* Footer: Info & Actions */}
      <div className={styles.strategyFooter}>
        <div className={styles.strategyCardFooter}>
          <div className={styles.strategyItemValue}>
            Executed {executionCount} trades
          </div>
          <div className={styles.strategyActions}>
            <button
              className={styles.strategyEditBtn}
              onClick={() => onEdit(strategy)}
              disabled={status === 'DELETED'}
              title="Edit"
            >
              <div className={styles.iconWrapper}>
                <Edit size={16} />
              </div>
              <span>Edit</span>
            </button>
            <button
              className={styles.strategyPauseBtn}
              onClick={() => onToggleStatus(strategy.id)}
              disabled={status === 'DELETED'}
              title={status === 'PAUSED' ? 'Resume' : 'Pause'}
            >
              <div className={styles.iconWrapper}>
                {status === 'PAUSED' ? <Play size={16} /> : <Pause size={16} />}
              </div>
              <span>{status === 'PAUSED' ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              className={styles.strategyDeleteBtn}
              onClick={() => onDelete(strategy.id)}
              disabled={status === 'DELETED'}
              title="Delete"
            >
              <div className={styles.iconWrapper}>
                <Trash2 size={16} />
              </div>
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

