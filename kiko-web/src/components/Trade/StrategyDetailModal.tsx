import React from 'react';
import { X, Clock, DollarSign, AlertCircle, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useThemeContext } from '../../contexts/ThemeContext';
import type { TradingStrategy } from '../../hooks/useStrategies';
import styles from './StrategyDetailModal.module.css';
import clsx from 'clsx';

interface StrategyDetailModalProps {
  strategy: TradingStrategy;
  onClose: () => void;
  onEdit?: () => void;
}

export const StrategyDetailModal: React.FC<StrategyDetailModalProps> = ({
  strategy,
  onClose,
}) => {
  const { resolvedTheme } = useThemeContext();

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={14} className={styles.successIcon} />;
      case 'failed':
        return <XCircle size={14} className={styles.failedIcon} />;
      case 'pending':
        return <Loader size={14} className={styles.pendingIcon} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={clsx(styles.modal, resolvedTheme)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Strategy Details</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Basic Information</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Name</span>
                <span className={styles.infoValue}>{strategy.name}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Type</span>
                <span className={styles.infoValue}>{strategy.type}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Status</span>
                <span className={clsx(styles.statusBadge, styles[`status${strategy.status.charAt(0).toUpperCase() + strategy.status.slice(1)}`])}>
                  {strategy.status}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Chain</span>
                <span className={styles.infoValue}>{strategy.chain}</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Trading Pair</h3>
            <div className={styles.tokenPair}>
              <span className={styles.token}>{strategy.tokenIn}</span>
              <span className={styles.arrow}>→</span>
              <span className={styles.token}>{strategy.tokenOut}</span>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Trigger Condition</h3>
            <div className={styles.triggerBox}>
              {strategy.triggerCondition}
            </div>
            {strategy.trigger && (
              <div className={styles.triggerDetails}>
                {strategy.trigger.type && (
                  <div className={styles.triggerItem}>
                    <span className={styles.triggerLabel}>Type:</span>
                    <span className={styles.triggerValue}>{strategy.trigger.type}</span>
                  </div>
                )}
                {strategy.trigger.value !== undefined && (
                  <div className={styles.triggerItem}>
                    <span className={styles.triggerLabel}>Value:</span>
                    <span className={styles.triggerValue}>{strategy.trigger.value}%</span>
                  </div>
                )}
                {strategy.trigger.target_price && (
                  <div className={styles.triggerItem}>
                    <span className={styles.triggerLabel}>Target Price:</span>
                    <span className={styles.triggerValue}>${strategy.trigger.target_price}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Execution Settings</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Amount</span>
                <span className={styles.infoValue}>
                  {strategy.executionAmount} {strategy.amountAsset}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Slippage</span>
                <span className={styles.infoValue}>
                  {strategy.slippage_bps ? (strategy.slippage_bps / 100).toFixed(2) : '0.50'}%
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Allowance Mode</span>
                <span className={styles.infoValue}>
                  {strategy.allowance_mode || 'one_shot'}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Limits</h3>
            <div className={styles.limitsGrid}>
              <div className={styles.limitCard}>
                <DollarSign size={16} className={styles.limitIcon} />
                <div className={styles.limitContent}>
                  <span className={styles.limitLabel}>Max USD/Day</span>
                  <span className={styles.limitValue}>${strategy.limits.maxUsdPerDay}</span>
                </div>
              </div>
              <div className={styles.limitCard}>
                <AlertCircle size={16} className={styles.limitIcon} />
                <div className={styles.limitContent}>
                  <span className={styles.limitLabel}>Max Trades/Day</span>
                  <span className={styles.limitValue}>{strategy.limits.maxTradesPerDay}</span>
                </div>
              </div>
              <div className={styles.limitCard}>
                <Clock size={16} className={styles.limitIcon} />
                <div className={styles.limitContent}>
                  <span className={styles.limitLabel}>Cooldown</span>
                  <span className={styles.limitValue}>{strategy.limits.cooldown}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Execution History</h3>
            {strategy.executionHistory.length === 0 ? (
              <div className={styles.emptyHistory}>No executions yet</div>
            ) : (
              <div className={styles.historyTable}>
                <div className={styles.historyHeader}>
                  <span>Date</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span>TX Hash</span>
                </div>
                {strategy.executionHistory.map((exec) => (
                  <div key={exec.id} className={styles.historyRow}>
                    <span>{formatDate(exec.timestamp)}</span>
                    <span>{exec.amount}</span>
                    <span className={styles.statusCell}>
                      {getStatusIcon(exec.status)}
                      {exec.status}
                    </span>
                    <span className={styles.txHash}>
                      {exec.transactionHash ? (
                        <a
                          href={`https://etherscan.io/tx/${exec.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.txLink}
                        >
                          {exec.transactionHash.slice(0, 10)}...
                        </a>
                      ) : (
                        '-'
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Metadata</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Created</span>
                <span className={styles.infoValue}>{formatDate(strategy.createdAt)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Last Updated</span>
                <span className={styles.infoValue}>{formatDate(strategy.updatedAt)}</span>
              </div>
              {strategy.conversationId && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Source Conversation</span>
                  <span className={styles.infoValue}>{strategy.conversationId.slice(0, 20)}...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.closeButtonSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


