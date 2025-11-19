import React from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={clsx(
        styles.card,
        styles[variant],
        styles[`padding-${padding}`],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

