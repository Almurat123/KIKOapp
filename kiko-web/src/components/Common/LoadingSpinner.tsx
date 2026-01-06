import React from 'react';

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
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                minHeight: '200px',
                padding: '40px',
            }}
        >
            <div
                style={{
                    width: size,
                    height: size,
                    border: `3px solid ${color}`,
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    opacity: 0.6,
                }}
            />
            <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default LoadingSpinner;
