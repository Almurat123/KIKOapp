import React from 'react';
import styles from './News.module.css';

interface KOLItem {
    id: string;
    name: string;
    action: string;
    details: string;
    time: string;
    type: 'buy' | 'sell' | 'bridge' | 'stake';
}

const MOCK_KOL: KOLItem[] = [
    {
        id: '1',
        name: 'Vitalik.eth',
        action: 'Transferred',
        details: '500 ETH to Coinbase',
        time: '1h ago',
        type: 'sell'
    },
    {
        id: '2',
        name: 'Justin Sun',
        action: 'Staked',
        details: '10,000 ETH in Lido',
        time: '3h ago',
        type: 'stake'
    },
    {
        id: '3',
        name: 'Arthur Hayes',
        action: 'Bought',
        details: '$2M worth of GMX',
        time: '5h ago',
        type: 'buy'
    },
    {
        id: '4',
        name: 'a16z',
        action: 'Bridged',
        details: '5M USDC to Base',
        time: '12h ago',
        type: 'bridge'
    },
    {
        id: '5',
        name: 'Wintermute',
        action: 'Provided Liquidity',
        details: 'ETH/USDC on Uniswap V3',
        time: '1d ago',
        type: 'stake'
    }
];

export const KOLActivity: React.FC = () => {
    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>KOL Activity</h3>
            </div>
            <div className={styles.column}>
                {MOCK_KOL.map((item) => (
                    <div key={item.id} className={styles.kolItem}>
                        <div className={styles.kolAvatar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: '#fff', backgroundColor: '#6366f1' }}>
                            {item.name[0]}
                        </div>
                        <div className={styles.kolContent}>
                            <div className={styles.kolName}>{item.name}</div>
                            <div className={styles.kolAction}>
                                <span style={{
                                    color: item.type === 'buy' ? 'var(--color-success)' :
                                        item.type === 'sell' ? 'var(--color-danger)' :
                                            'var(--text-primary)'
                                }}>
                                    {item.action}
                                </span>
                                {' '}{item.details}
                            </div>
                            <div className={styles.kolTime}>{item.time}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
