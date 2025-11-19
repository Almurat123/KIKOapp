import React from 'react';
import clsx from 'clsx';
import styles from './Skeleton.module.css';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
  className,
  style,
  ...props
}) => {
  return (
    <div
      className={clsx(
        styles.skeleton,
        styles[variant],
        styles[animation],
        className
      )}
      style={{
        width,
        height,
        ...style,
      }}
      {...props}
    />
  );
};

