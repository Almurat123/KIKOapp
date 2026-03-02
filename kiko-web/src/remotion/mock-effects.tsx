import React from 'react';

export const LiquidGlassEffect: React.FC<{ children: React.ReactNode; className?: string; enabled?: boolean }> = ({
    children,
    className = '',
}) => {
    return <div className={className}>{children}</div>;
};

export const StardustBackground: React.FC = () => {
    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 0,
                pointerEvents: 'none',
                backgroundColor: '#000103',
            }}
        />
    );
};

export default LiquidGlassEffect;
