import React from 'react';
import { Play, Pause, Edit, Trash2, Eye, Target, Check, RefreshCw } from 'lucide-react';
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

export const StrategyCard: React.FC<StrategyCardProps> = ({
  strategy,
  onEdit,
  onDelete,
  onToggleStatus,
  variant = 'card',
}) => {
  const { resolvedTheme } = useThemeContext();
  const [isWalletCopied, setIsWalletCopied] = React.useState(false);

  // Default config if missing (supporting legacy/other strategies as best effort)
  const config = strategy.copyTradeConfig || {
    targetWallet: '0x0000000000000000000000000000000000000000',
    minTargetValueUsd: 0,
    buyAmountUsd: 0,
    stopLossPct: 0,
    takeProfitPct: 0,
    mirrorSell: false
  };

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
          <div className={styles.rowIcon}>
            <RefreshCw size={18} />
          </div>
          <div>
            <div className={styles.rowName}>Copy Trading</div>
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
              {isWalletCopied ? <Check size={10} color="#4ade80" /> : null}
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
            <Edit size={14} />
          </button>

          <button
            onClick={() => onToggleStatus(strategy.id)}
            className={styles.rowBtn}
            title={isActive ? 'Pause' : 'Resume'}
            disabled={status === 'DELETED'}
          >
            {isActive ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <button
            onClick={() => onDelete(strategy.id)}
            className={clsx(styles.rowBtn, styles.rowBtnDelete)}
            title="Delete"
            disabled={status === 'DELETED'}
          >
            <Trash2 size={14} />
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
          <div className={styles.uintaIcon}>
            <RefreshCw size={16} />
          </div>
          <div>
            <div className={styles.strategyName}>Copy Trading</div>
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
              <Target size={12} /> Target Wallet
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
                {isWalletCopied ? <Check size={10} color="#4ade80" /> : null}
                <span className={styles.walletAddressText}>{config.targetWallet}</span>
              </div>
            </div>
          </div>

          <div className={styles.strategyDivider}></div>

          {/* Item 2: Trigger Condition */}
          <div className={styles.strategyItem}>
            <div className={styles.strategyItemLabel}>
              <Eye size={12} /> Trigger
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
              className={styles.strategyDeleteBtn}
              onClick={() => onDelete(strategy.id)}
              disabled={status === 'DELETED'}
            >
              Delete
            </button>
            <button
              className={styles.strategyPauseBtn}
              onClick={() => onToggleStatus(strategy.id)}
              disabled={status === 'DELETED'}
            >
              {status === 'PAUSED' ? 'Resume' : 'Pause'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

