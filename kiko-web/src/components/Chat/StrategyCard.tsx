import React from 'react';
import type { TradingStrategy } from '../../hooks/useStrategies';
import { StrategyCard as TradeStrategyCard } from '../Trade/StrategyCard';

interface StrategyCardProps {
  strategy: TradingStrategy;
  onEdit?: (strategy: TradingStrategy) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string) => void;
}

export const StrategyCard: React.FC<StrategyCardProps> = ({
  strategy,
  onEdit,
  onDelete,
  onToggleStatus,
}) => {
  const noop = () => {};
  return (
    <TradeStrategyCard
      strategy={strategy}
      onEdit={onEdit || noop}
      onDelete={onDelete || noop}
      onToggleStatus={onToggleStatus || noop}
      variant="card"
      showActions={false}
    />
  );
};
