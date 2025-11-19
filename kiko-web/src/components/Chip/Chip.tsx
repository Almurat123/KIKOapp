import React from 'react';
import clsx from 'clsx';
import styles from './Chip.module.css';

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  onRemove?: () => void;
}

export const Chip: React.FC<ChipProps> = ({
  variant = 'default',
  size = 'md',
  className,
  children,
  onRemove,
  ...props
}) => {
  return (
    <div
      className={clsx(
        styles.chip,
        styles[variant],
        styles[size],
        className
      )}
      {...props}
    >
      <span className={styles.label}>{children}</span>
      {onRemove && (
        <button
          className={styles.removeBtn}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </div>
  );
};

