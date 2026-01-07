import React from 'react';
import clsx from 'clsx';
import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
    size?: number;
    color?: string;
}

/**
 * Simple, consistent loading spinner used across all pages
 * No text, just a clean animated spinner
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 32,
    color = 'currentColor',
}) => {
    return (
        <div className={styles.container}>
            <div
                className={clsx(styles.spinner, size !== 32 && styles.spinnerCustom)}
                style={{
                    width: size,
                    height: size,
                    borderColor: color,
                    borderTopColor: 'transparent',
                }}
            />
        </div>
    );
};

export default LoadingSpinner;
