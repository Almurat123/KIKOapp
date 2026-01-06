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

export const TradePage: React.FC = () => {
  const { resolvedTheme } = useThemeContext();
  const {
    strategies,
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
      await updateStrategy(editingStrategy.id, { copyTradeConfig: updates });
      setEditingStrategy(null);
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
          <div className={styles.topBar}>
            <div className={styles.topBarLeft}>
              {/* No Title text as requested, just stats or minimal info */}
              <div className={styles.statBadge}>
                <span className={styles.statLabel}>Total Strategies</span>
                <span className={styles.statValue}>{strategies.length}</span>
              </div>
              <div className={styles.statBadge}>
                <span className={styles.statLabel}>Active</span>
                <span className={clsx(styles.statValue, styles.statActive)}>
                  {strategies.filter(s => s.status === 'active').length}
                </span>
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
            title="编辑策略"
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
