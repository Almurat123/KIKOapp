import React, { useState } from 'react';
import { Zap, Target, Eye, MousePointerClick, Clock, Activity, Check, RefreshCw } from 'lucide-react';
import { useThemeContext } from '../../contexts/ThemeContext';
import type { TradingStrategy } from '../../hooks/useStrategies';
import styles from './StrategyCard.module.css';
import clsx from 'clsx';

interface StrategyCardProps {
  strategy: TradingStrategy;
  onEdit?: (strategy: TradingStrategy) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string) => void;
  onViewDetails?: (strategy: TradingStrategy) => void;
}

export const StrategyCard: React.FC<StrategyCardProps> = ({
  strategy,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewDetails,
}) => {
  const { resolvedTheme } = useThemeContext();
  const [isActive, setIsActive] = React.useState(strategy.status === 'active');
  const [isWalletCopied, setIsWalletCopied] = React.useState(false);

  const handleToggle = () => {
    setIsActive(!isActive);
    if (onToggleStatus) {
      onToggleStatus(strategy.id);
    }
  };

  const formatStrategyId = (id: string) => {
    if (id.length > 12) {
      return `#${id.slice(0, 4)}...${id.slice(-4)}`;
    }
    return `#${id}`;
  };

  const formatWalletAddress = (address?: string) => {
    if (!address) return '-';
    if (address.length > 10) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address;
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const getStatusText = () => {
    if (strategy.status === 'active') {
      return 'Monitoring mempool...';
    } else if (strategy.status === 'paused') {
      return 'Paused';
    } else if (strategy.status === 'completed') {
      return 'Completed';
    } else if (strategy.status === 'cancelled') {
      return 'Cancelled';
    }
    return 'Inactive';
  };

  // Get config from strategy
  const config = strategy.copyTradeConfig || {
    targetWallet: strategy.trigger?.wallet_address || '0x000...000',
    minTargetValueUsd: 0,
    buyAmountUsd: 0,
    takeProfitPct: 0,
    stopLossPct: 0
  };

  // Determine target wallet
  const targetWallet = config.targetWallet || strategy.trigger?.wallet_address || '0x7a2...3f91';

  // Format trigger condition
  const triggerText = strategy.triggerCondition || `Tx Value > $${config.minTargetValueUsd?.toLocaleString() || '0'}`;

  // Format action type
  const actionType = strategy.type === 'auto_buy' ? 'Market Order' :
    strategy.type === 'auto_sell' ? 'Market Order' :
      'Market Order';

  // Format buy/sell amount
  const actionAmount = config.buyAmountUsd > 0
    ? `$${config.buyAmountUsd.toLocaleString()}`
    : `${strategy.executionAmount} ${strategy.tokenOut || strategy.tokenIn || 'ANY'}`;

  return (
    <div className={clsx(styles.strategyCard, styles[resolvedTheme])}>
      {/* Header: 标题与状态 */}
      <div className={styles.strategyHeader}>
        <div className={styles.strategyTitleSection}>
          <div className={styles.strategyIcon}>
            <Zap size={16} fill="currentColor" />
          </div>
          <div>
            <div className={styles.strategyName}>
              {strategy.type === 'auto_buy' ? 'Auto Buy' :
                strategy.type === 'auto_sell' ? 'Auto Sell' :
                  'Copy Trading'}
            </div>
            <div className={styles.strategyId}>ID: {formatStrategyId(strategy.id)}</div>
          </div>
        </div>
        <div className={clsx(styles.strategyStatus, isActive ? styles.statusActive : styles.statusPaused)}>
          {isActive ? 'ACTIVE' : 'PAUSED'}
        </div>
      </div>

      {/* 核心配置列表 */}
      <div className={styles.strategyContent}>

        {/* IF Block: 监控条件 */}
        <div className={styles.strategyBlock}>

          {/* Item 1: 监控对象 */}
          <div className={styles.strategyItem}>
            <div className={styles.strategyItemLabel}>
              <Target size={12} /> Target Wallet
            </div>
            <div className={styles.strategyItemValue}>
              <div
                className={styles.walletAddress}
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(targetWallet);
                  setIsWalletCopied(true);
                  setTimeout(() => setIsWalletCopied(false), 2000);
                }}
                className={styles.walletAddressButton}
              >
                {isWalletCopied && <Check size={10} color="#4ade80" />}
                {formatWalletAddress(targetWallet)}
              </div>
            </div>
          </div>

          <div className={styles.strategyDivider}></div>

          {/* Item 2: 触发条件 */}
          <div className={styles.strategyItem}>
            <div className={styles.strategyItemLabel}>
              <Eye size={12} /> Trigger
            </div>
            <div className={styles.strategyItemValue}>
              <div className={styles.triggerValue}>
                {triggerText}
              </div>
            </div>
          </div>
        </div>

        {/* THEN Block: 执行逻辑 */}
        <div className={styles.strategyBlockThen}>

          <div className={styles.strategyItem}>
            <div className={styles.strategyItemLabel}>
              <MousePointerClick size={12} /> My Action
            </div>
            {(config.takeProfitPct ?? 0) > 0 || (config.stopLossPct ?? 0) > 0 ? (
              <div className={styles.slTpCapsule}>
                <div className={styles.capsuleItem}>
                  <span className={styles.capsuleLabel}>TP</span>
                  <span className={styles.capsuleValueGreen}>+{(config.takeProfitPct ?? 0)}%</span>
                </div>
                <div className={styles.capsuleDivider}></div>
                <div className={styles.capsuleItem}>
                  <span className={styles.capsuleLabel}>SL</span>
                  <span className={styles.capsuleValueRed}>-{(config.stopLossPct ?? 0)}%</span>
                </div>
              </div>
            ) : (
              <div className={styles.strategyType}>
                {actionType}
              </div>
            )}
          </div>

          <div className={styles.strategyDivider}></div>

          <div className={styles.strategyItem}>
            <span className={styles.buyAmountLabel}>
              {strategy.type === 'auto_buy' ? 'Buy Amount' :
                strategy.type === 'auto_sell' ? 'Sell Amount' :
                  'Buy Amount'}
            </span>
            <span className={styles.buyAmountValue}>{actionAmount}</span>
          </div>

        </div>

      </div>

      {/* 底部详细信息与操作 */}
      <div className={styles.strategyFooter}>
        <div className={styles.strategyInfo}>
          <div className={styles.strategyInfoItem}>
            <Clock size={10} /> Created: <span>{formatTimeAgo(strategy.createdAt)}</span>
          </div>
          <div className={styles.strategyInfoItem}>
            <Activity size={10} /> Status: <span>{getStatusText()}</span>
          </div>
        </div>

        <button
          onClick={handleToggle}
          className={styles.strategyPauseBtn}
        >
          {isActive ? 'Pause' : 'Resume'}
        </button>
      </div>

    </div>
  );
};
