import React from 'react';
import styles from './News.module.css';
import { Chip } from '../Chip/Chip';

interface NewsItem {
    id: string;
    source: string;
    title: string;
    time: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    tags: string[];
}

const MOCK_NEWS: NewsItem[] = [
    {
        id: '1',
        source: 'CoinDesk',
        title: 'Ethereum Layer 2 TVL Reaches All-Time High Amidst Market Recovery',
        time: '2h ago',
        sentiment: 'positive',
        tags: ['ETH', 'L2', 'DeFi']
    },
    {
        id: '2',
        source: 'The Block',
        title: 'Major Protocol Upgrade Proposal Passed by DAO Governance',
        time: '4h ago',
        sentiment: 'positive',
        tags: ['Governance', 'DAO']
    },
    {
        id: '3',
        source: 'Decrypt',
        title: 'Regulatory Uncertainty Continues to Impact Institutional Inflows',
        time: '5h ago',
        sentiment: 'negative',
        tags: ['Regulation', 'Institutional']
    },
    {
        id: '4',
        source: 'Protocol Labs',
        title: 'New Cross-Chain Bridge Vulnerability Discovered - Patch Incoming',
        time: '6h ago',
        sentiment: 'negative',
        tags: ['Security', 'Bridge']
    },
    {
        id: '5',
        source: 'Bankless',
        title: 'State of the Market: Stablecoin Supply Stabilizes',
        time: '8h ago',
        sentiment: 'neutral',
        tags: ['Market', 'Stablecoins']
    }
];

export const NewsFeed: React.FC = () => {
    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Latest News</h3>
            </div>
            <div className={styles.column}>
                {MOCK_NEWS.map((item) => (
                    <div key={item.id} className={styles.newsItem}>
                        <div className={styles.newsMeta}>
                            <span className={styles.newsSource}>{item.source}</span>
                            <span>{item.time}</span>
                        </div>
                        <div className={styles.newsHeadline}>{item.title}</div>
                        <div className={styles.newsTags}>
                            {item.tags.map((tag) => (
                                <Chip key={tag} size="sm" variant="default">
                                    {tag}
                                </Chip>
                            ))}
                            <span className={
                                item.sentiment === 'positive' ? styles.sentimentPositive :
                                    item.sentiment === 'negative' ? styles.sentimentNegative :
                                        styles.sentimentNeutral
                            } style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                                {item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
