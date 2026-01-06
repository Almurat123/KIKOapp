import React from 'react';
import styles from './News.module.css';

interface SocialItem {
    id: string;
    token: string;
    content: string;
    likes: number;
    retweets: number;
    sentiment: 'bullish' | 'bearish';
}

const MOCK_SOCIAL: SocialItem[] = [
    {
        id: '1',
        token: 'SOL',
        content: '$SOL breaking resistance at $150! The ecosystem growth is undeniable. 🚀',
        likes: 1240,
        retweets: 450,
        sentiment: 'bullish'
    },
    {
        id: '2',
        token: 'BTC',
        content: 'Bitcoin dominance hitting 55%. Altcoins might bleed a bit more before the real season starts.',
        likes: 3200,
        retweets: 890,
        sentiment: 'bullish'
    },
    {
        id: '3',
        token: 'ARB',
        content: 'Arbitrum incentives program is live. Expecting massive TVL inflow this week.',
        likes: 850,
        retweets: 210,
        sentiment: 'bullish'
    },
    {
        id: '4',
        token: 'PEPE',
        content: 'Meme coin mania cooling off? $PEPE volume dropping significantly.',
        likes: 560,
        retweets: 120,
        sentiment: 'bearish'
    }
];

export const SocialBuzz: React.FC = () => {
    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Social Buzz</h3>
            </div>
            <div className={styles.column}>
                {MOCK_SOCIAL.map((item) => (
                    <div key={item.id} className={styles.socialItem}>
                        <div className={styles.socialHeader}>
                            <div className={styles.tokenIcon}>{item.token[0]}</div>
                            <span className={styles.tokenName}>{item.token}</span>
                            <span style={{
                                marginLeft: 'auto',
                                fontSize: '0.75rem',
                                color: item.sentiment === 'bullish' ? 'var(--color-success)' : 'var(--color-danger)'
                            }}>
                                {item.sentiment.toUpperCase()}
                            </span>
                        </div>
                        <div className={styles.socialContent}>{item.content}</div>
                        <div className={styles.socialStats}>
                            <span>❤️ {item.likes}</span>
                            <span>🔁 {item.retweets}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
