import React from 'react';
import styles from '../../components/Chat/WelcomeScreen.module.css';

interface HeroTitlesProps {
    opacity: number;
    y: number;
}

export const HeroTitles: React.FC<HeroTitlesProps> = ({ opacity, y }) => {
    return (
        <div
            className={styles.heroText}
            style={{
                opacity,
                transform: `translateY(${y}px)`,
                textAlign: 'center',
                marginBottom: '48px',
                // Force layout since it's absolute in the cinematic world
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}
        >
            <h1
                className={styles.heroTitle}
                style={{
                    fontSize: '4rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '-0.02em',
                    marginBottom: '8px'
                }}
            >
                I am <span className={styles.kikoWrapped} style={{ color: '#ffffff' }}>KIKO</span>.
            </h1>
            <h2
                className={styles.heroSubTitleSecondary}
                style={{
                    fontSize: '1.5rem',
                    color: '#a1a1aa',
                    fontWeight: 500
                }}
            >
                The best way to trade.
            </h2>
        </div>
    );
};
