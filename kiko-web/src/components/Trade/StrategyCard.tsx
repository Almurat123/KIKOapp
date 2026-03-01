import React from 'react';
import { Play, Pause, Edit, Trash2, Target, Check, Copy, Info } from 'lucide-react';
import { useThemeContext } from '../../contexts/ThemeContext';
import type { TradingStrategy } from '../../hooks/useStrategies';
import styles from './StrategyCard.module.css';
import clsx from 'clsx';
import { useIsMobile } from '../../hooks/useIsMobile';
import { truncateAddress } from '../../utils/format';
import { getTargetStatus } from '../../services/copyTradeApi';
import { agentAttrs } from '../../agent/attrs';
import { resolveChainPresentation } from '../../utils/chainPresentation';

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
  const [targetTradeCount, setTargetTradeCount] = React.useState<number>(0);
  const [targetProfitUsd, setTargetProfitUsd] = React.useState<number>(0);
  const [targetLossUsd, setTargetLossUsd] = React.useState<number>(0);
  const isMobile = useIsMobile();

  const isCopyTrade = strategy.type === 'copy_trade';
  const isPolymarketCopy = strategy.type === 'polymarket_copy';

  const copyConfig = isCopyTrade ? strategy.copyTradeConfig : null;
  const polyConfig = isPolymarketCopy ? strategy.polymarketCopyConfig : null;
  const targetWallet = isCopyTrade ? copyConfig?.targetWallet : polyConfig?.targetWallet;

  const chainInfo = resolveChainPresentation(strategy.chainId ?? strategy.chain);
  const isActive = strategy.status === 'active';
  const status = (strategy.status || 'paused').toUpperCase();
  const isDeleted = status === 'DELETED';
  const executionCount = (strategy.executionHistory || []).length;
  const displayedTradeCount = isCopyTrade ? targetTradeCount : executionCount;

  const formatMoney = (val?: number) => val ? `$${val.toLocaleString()}` : '$0';
  const formatSignedUsdCompact = (val?: number) => {
    const n = Number(val || 0);
    const abs = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${n >= 0 ? '+' : '-'}$${abs}`;
  };

  React.useEffect(() => {
    let cancelled = false;
    const configId = copyConfig?.id;
    if (!isCopyTrade || !configId) return;

    const fetchWithRetry = async () => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const res = await getTargetStatus(configId);
          if (cancelled) return;
          const agg = res?.aggregate;
          const tracked = Number(agg?.trackedTxCount || 0);
          const walletTotal = Number((agg as any)?.walletTxCount || 0);
          setTargetTradeCount(tracked > 0 ? tracked : walletTotal);
          setTargetProfitUsd(Number(agg?.targetProfitUsd ?? agg?.targetRealizedProfitUsd ?? 0));
          setTargetLossUsd(Number(agg?.targetLossUsd ?? agg?.targetRealizedLossUsd ?? 0));
          return;
        } catch (err) {
          lastError = err;
          if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
        }
      }
      console.error('[StrategyCard] target-status fetch failed after retries', { configId, error: (lastError as any)?.message || String(lastError) });
      // Keep previous UI values on transient failure instead of forcing zeros.
    };

    void fetchWithRetry();

    return () => {
      cancelled = true;
    };
  }, [isCopyTrade, copyConfig?.id]);

  if (!isCopyTrade && !isPolymarketCopy) return null;
  if (!targetWallet) return null;

  const renderActions = () => (
    <div className={styles.footer}>
      <button
        className={styles.actionBtn}
        {...agentAttrs({ id: `trade.strategy.card.${strategy.id}.edit`, role: 'button', action: 'open', page: 'trade', key: 'strategy_id' })}
        onClick={() => onEdit(strategy)}
        disabled={isDeleted}
      >
        <Edit size={14} />
        <span>Edit</span>
      </button>
      <button
        className={styles.actionBtn}
        {...agentAttrs({ id: `trade.strategy.card.${strategy.id}.toggle`, role: 'button', action: 'toggle', page: 'trade', key: 'strategy_id' })}
        onClick={() => onToggleStatus(strategy.id)}
        disabled={isDeleted}
      >
        {isActive ? <Pause size={14} /> : <Play size={14} />}
        <span>{isActive ? 'Pause' : 'Resume'}</span>
      </button>
      <button
        className={clsx(styles.actionBtn, styles.deleteBtn)}
        {...agentAttrs({ id: `trade.strategy.card.${strategy.id}.delete`, role: 'button', action: 'confirm', page: 'trade', key: 'strategy_id' })}
        onClick={() => onDelete(strategy.id)}
        disabled={isDeleted}
      >
        <Trash2 size={14} />
        <span>Delete</span>
      </button>
    </div>
  );

  return (
    <div
      className={clsx(styles.strategyCard, styles[resolvedTheme], { [styles.rowVariant]: variant === 'row' })}
      {...agentAttrs({ id: `trade.strategy.card.${strategy.id}`, role: 'card', page: 'trade', key: 'strategy_id' })}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.chainIconWrapper}>
            <img src={chainInfo.icon} alt={chainInfo.displayName} className={styles.chainIcon} />
          </div>
          <div className={styles.titleColumn}>
            <div className={styles.title}>{isCopyTrade ? 'Copy Trading' : 'Polymarket Copy'}</div>
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
            {...agentAttrs({ id: `trade.strategy.card.${strategy.id}.target_wallet`, role: 'button', action: 'copy', page: 'trade', key: 'target_wallet' })}
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
        {isCopyTrade ? (
          <div className={styles.targetStatsRow}>
            <div className={clsx(styles.targetStat, styles.targetStatLeft)}>
              <span className={styles.targetStatLabel}>Trades (30D)</span>
              <span className={styles.targetStatValue}>{targetTradeCount}</span>
            </div>
            <div className={clsx(styles.targetStat, styles.targetStatCenter)}>
              <span className={styles.targetStatLabel}>Total Profit</span>
              <span
                className={clsx(
                  styles.targetStatValue,
                  styles.successText
                )}
              >
                {formatSignedUsdCompact(Math.abs(targetProfitUsd))}
              </span>
            </div>
            <div className={clsx(styles.targetStat, styles.targetStatRight)}>
              <span className={styles.targetStatLabel}>Total Loss</span>
              <span
                className={clsx(
                  styles.targetStatValue,
                  styles.dangerText
                )}
              >
                {formatSignedUsdCompact(-Math.abs(targetLossUsd))}
              </span>
            </div>
          </div>
        ) : null}

        <div className={styles.divider} />

        {isCopyTrade ? (
          <div className={styles.statsGrid}>
            {/* Top Left: Threshold */}
            <div className={styles.statItem}>
              <div className={styles.label}>MIN TRADE</div>
              <div className={styles.value}>Value {'>'} {formatMoney(copyConfig?.minTargetValueUsd ?? undefined)}</div>
            </div>

            {/* Top Right: Buy Amount */}
            <div className={clsx(styles.statItem, styles.alignRight)}>
              <div className={styles.label}>BUY AMOUNT</div>
              <div className={styles.value}>{formatMoney(copyConfig?.buyAmountUsd)}</div>
            </div>

            {/* Bottom Left: TP */}
            <div className={styles.statItem}>
              <div className={styles.label}>TAKE PROFIT</div>
              <div className={clsx(styles.value, styles.successText)}>+{copyConfig?.takeProfitPct}%</div>
            </div>

            {/* Bottom Right: SL */}
            <div className={clsx(styles.statItem, styles.alignRight)}>
              <div className={styles.label}>STOP LOSS</div>
              <div className={clsx(styles.value, styles.dangerText)}>-{copyConfig?.stopLossPct}%</div>
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

        <div className={styles.footerInfo}>
          <Info size={10} />
          <span>Executed {displayedTradeCount} trades</span>
        </div>
      </div>

      {renderActions()}
    </div>
  );
};
