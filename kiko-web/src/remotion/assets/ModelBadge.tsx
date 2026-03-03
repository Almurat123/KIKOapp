import React from 'react';
import { ChevronDown } from 'lucide-react';
import styles from '../../components/Chat/WelcomeScreen.module.css';

interface ModelBadgeProps {
    opacity: number;
    y: number;
}

export const ModelBadge: React.FC<ModelBadgeProps> = ({ opacity, y }) => {
    return (
        <div
            className={styles.modelButton}
            style={{
                opacity,
                transform: `translateY(${y}px)`,
                // Overrides for isolation
                position: 'absolute',
                left: '20px',
                bottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '0 8px',
                height: '28px',
                borderRadius: '14px',
                background: 'rgba(30, 30, 35, 0.2)',
                border: '0.5px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px) saturate(180%)',
                color: '#a1a1aa',
                fontSize: '12px',
            }}
        >
            <span className={styles.modelName} style={{ fontWeight: 500, fontSize: '10px', color: '#e4e4e7' }}>
                DeepSeek-V3.2
            </span>
            <span
                className={styles.modelMode}
                style={{
                    padding: '0 4px',
                    height: '15px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 600,
                    borderRadius: '4px'
                }}
            >
                fast
            </span>
            <ChevronDown size={12} style={{ color: '#71717a' }} />
        </div>
    );
};
