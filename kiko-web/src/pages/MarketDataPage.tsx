import React, { useState } from 'react';
import { AIReportCard } from '../components/Market/AIReportCard';
import { MarketOverview } from '../components/Market/MarketOverview';
import { MarketChains } from '../components/Market/MarketChains';
import { MarketTokens } from '../components/Market/MarketTokens';
import { MarketActivity } from '../components/Market/MarketActivity';
import { MarketRisk } from '../components/Market/MarketRisk';
import styles from './MarketDataPage.module.css';
import clsx from 'clsx';

type Tab = 'overview' | 'chains' | 'tokens' | 'activity' | 'risk';

export const MarketDataPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return <MarketOverview />;
            case 'chains': return <MarketChains />;
            case 'tokens': return <MarketTokens />;
            case 'activity': return <MarketActivity />;
            case 'risk': return <MarketRisk />;
            default: return <MarketOverview />;
        }
    };

    const getAIReportProps = () => {
        switch (activeTab) {
            case 'chains':
                return {
                    title: 'Chain Analysis',
                    insight: 'L2 activity is surging with Arbitrum leading in TVL growth. Gas fees on Ethereum remain low, encouraging mainnet usage.',
                    metrics: [
                        { label: 'Top Chain', value: 'Arbitrum', trend: 'up' },
                        { label: 'Avg Gas', value: '15 Gwei', trend: 'down' },
                        { label: 'Bridge Vol', value: '$250M', trend: 'up' }
                    ],
                    recommendation: 'Monitor Arbitrum ecosystem tokens.'
                };
            case 'tokens':
                return {
                    title: 'Token Market',
                    insight: 'Altcoins are showing divergence. Meme tokens are cooling off while DeFi blue chips are accumulating.',
                    metrics: [
                        { label: 'Top Gainer', value: 'PEPE', trend: 'up' },
                        { label: 'Vol/Mcap', value: '0.05', trend: 'neutral' },
                        { label: 'New Pairs', value: '+120', trend: 'up' }
                    ],
                    recommendation: 'Look for entries in DeFi blue chips.'
                };
            case 'activity':
                return {
                    title: 'On-Chain Activity',
                    insight: 'Whale accumulation detected in ETH and LINK. Smart money is rotating out of stablecoins into risk assets.',
                    metrics: [
                        { label: 'Whale Buys', value: '$50M', trend: 'up' },
                        { label: 'Smart Money', value: 'Buying', trend: 'up' },
                        { label: 'Exchange Flow', value: '-$20M', trend: 'down' }
                    ],
                    recommendation: 'Follow smart money into ETH.'
                };
            case 'risk':
                return {
                    title: 'Risk Assessment',
                    insight: 'Market risk is moderate. Leverage is increasing but within healthy limits. No major protocol exploits detected.',
                    metrics: [
                        { label: 'Risk Level', value: 'Moderate', trend: 'neutral' },
                        { label: 'Liquidity', value: 'High', trend: 'up' },
                        { label: 'Volatility', value: 'Low', trend: 'down' }
                    ],
                    recommendation: 'Maintain standard risk management.'
                };
            default: // overview
                return {
                    title: 'Market Overview',
                    insight: 'Global crypto market cap is up 2.4% today, driven by strong ETH performance and renewed DeFi interest. Stablecoin inflows suggest accumulation.',
                    metrics: [
                        { label: 'Market Cap', value: '$2.45T', trend: 'up' },
                        { label: '24h Volume', value: '$86.2B', trend: 'up' },
                        { label: 'Sentiment', value: 'Greed (72)', trend: 'neutral' }
                    ],
                    recommendation: 'Accumulate L2 tokens'
                };
        }
    };

    const reportProps = getAIReportProps();

    return (
        <div className={styles.container}>
            {/* AI Report Header */}
            <div className={styles.aiReportSection}>
                <AIReportCard {...reportProps} />
            </div>

            {/* Tab Navigation */}
            <div className={styles.tabNav}>
                {['Overview', 'Chains', 'Tokens', 'Activity', 'Risk'].map((tab) => (
                    <button
                        key={tab}
                        className={clsx(styles.tabBtn, activeTab === tab.toLowerCase() && styles.activeTab)}
                        onClick={() => setActiveTab(tab.toLowerCase() as Tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className={styles.contentArea}>
                {renderContent()}
            </div>
        </div>
    );
};

