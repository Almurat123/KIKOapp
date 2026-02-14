import React, { useState } from 'react';
import { PageContainer } from '../components/Layout/PageContainer';
import { StrategyCard } from '../components/Trade/StrategyCard';
import { ConfirmationModal } from '../components/Common/ConfirmationModal';
import { useStrategies } from '../hooks/useStrategies';
import { useThemeContext } from '../contexts/ThemeContext';
import type { TradingStrategy } from '../hooks/useStrategies';
import styles from './TradePage.module.css';
import clsx from 'clsx';
import { Dialog } from '../components/Dialog/Dialog';
import { StrategyEditForm } from '../components/Trade/StrategyEditForm';
import { Activity, TrendingUp } from 'lucide-react';

export const TradePage: React.FC = () => {
  const { resolvedTheme } = useThemeContext();
  const {
    strategies,
    stats,
    isLoading,
    updateStrategy,
    deleteStrategy,
    toggleStrategyStatus,
  } = useStrategies();

  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; strategyId: string | null }>({ isOpen: false, strategyId: null });
  const [editingStrategy, setEditingStrategy] = useState<TradingStrategy | null>(null);

  const handleEdit = (strategy: TradingStrategy) => {
    setEditingStrategy(strategy);
  };

  const handleSaveStrategy = async (updates: any) => {
    if (editingStrategy) {
      const safePatch = {
        targetWallet: updates?.targetWallet,
        buyAmountUsd: updates?.buyAmountUsd,
        maxSlippageBps: updates?.maxSlippageBps,
        minMarketCapUsd: updates?.minMarketCapUsd,
        minLiquidityUsd: updates?.minLiquidityUsd,
        minTargetValueUsd: updates?.minTargetValueUsd,
        copyTradeTokenCooldownMinutes: updates?.copyTradeTokenCooldownMinutes,
        executionMode: updates?.executionMode,
        disableTokenInfo: updates?.disableTokenInfo,
        takeProfitPct: updates?.takeProfitPct,
        stopLossPct: updates?.stopLossPct,
        mirrorSell: updates?.mirrorSell,
        aiAnalysisMode: updates?.aiAnalysisMode,
        enableDynamicTP: updates?.enableDynamicTP,
        dynamicTPMinProfitPct: updates?.dynamicTPMinProfitPct,
      };
      await updateStrategy(editingStrategy.id, { copyTradeConfig: safePatch as any });
    }
  };


  const handleDelete = (id: string) => {
    setDeleteConfirmation({ isOpen: true, strategyId: id });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmation.strategyId) {
      const id = deleteConfirmation.strategyId;
      deleteStrategy(id);
      setDeleteConfirmation({ isOpen: false, strategyId: null });
    }
  };



  if (isLoading) {
    return (
      <PageContainer>
        <div className={styles.loading}>Loading strategies...</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className={clsx(styles.tradePage, resolvedTheme)}>
        <div className={styles.container}>
          {/* Unified Top Bar (Overview & Stats) */}
          {/* Unified Top Bar (Overview & Stats) */}
          <div className={styles.topBar}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statLabel}>Total Executed Trades</span>
                  <Activity size={20} className={styles.statIcon} />
                </div>
                <div>
                  <div className={styles.statValue}>{stats.totalExecutions}</div>
                  <div className={styles.statSubtext}>Across all active strategies</div>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statLabel}>Total PnL</span>
                  <TrendingUp size={20} className={styles.statIcon} />
                </div>
                <div>
                  <div className={clsx(styles.statValue, {
                    [styles.statValueGreen]: stats.totalPnL >= 0,
                    [styles.statValueRed]: stats.totalPnL < 0
                  })}>
                    {stats.totalPnL >= 0 ? '+' : ''}
                    {stats.totalPnL.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </div>
                  <div className={styles.statSubtext}>Realized Profit & Loss</div>
                </div>
              </div>
            </div>
          </div>

          {strategies.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📊</div>
              <h2 className={styles.emptyTitle}>No strategies yet</h2>
              <p className={styles.emptyText}>
                Create trading strategies in chat conversations and they will appear here.
              </p>
            </div>
          ) : (
            <div className={styles.strategiesList}>
              {strategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleStatus={toggleStrategyStatus}
                  variant="row"
                />
              ))}
            </div>
          )}
        </div>

        <ConfirmationModal
          isOpen={deleteConfirmation.isOpen}
          onClose={() => setDeleteConfirmation({ isOpen: false, strategyId: null })}
          onConfirm={handleConfirmDelete}
          title="Delete Strategy"
          message="Are you sure you want to delete this trading strategy? This action cannot be undone."
          confirmText="Delete"
          confirmVariant="danger"
        />

        {editingStrategy && editingStrategy.copyTradeConfig && (
          <Dialog
            isOpen={!!editingStrategy}
            onClose={() => setEditingStrategy(null)}
            title="Edit Strategy"
          >
            <StrategyEditForm
              config={editingStrategy.copyTradeConfig}
              onSave={handleSaveStrategy}
              onCancel={() => setEditingStrategy(null)}
            />
          </Dialog>
        )}
      </div>
    </PageContainer>
  );
};
