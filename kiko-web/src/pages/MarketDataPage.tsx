import React from 'react';
import { AIFeatureIcon } from '../components/Market/AIFeatureIcon';
import { MarketOverview } from '../components/Market/MarketOverview';
import { MarketChains } from '../components/Market/MarketChains';
import { MarketTokens } from '../components/Market/MarketTokens';
import { MarketActivity } from '../components/Market/MarketActivity';
import { MarketRisk } from '../components/Market/MarketRisk';
import styles from './MarketDataPage.module.css';

type Tab = 'overview' | 'chains' | 'tokens' | 'activity' | 'risk';
type Trend = 'up' | 'down' | 'neutral';

interface MarketDataPageProps {
    activeTab: string;
    onAISummaryRequest?: (context: string) => void;
}

export const MarketDataPage: React.FC<MarketDataPageProps> = ({ activeTab, onAISummaryRequest }) => {
    // Parse sub-tab from activeTab string (e.g., 'market-chains' -> 'chains')
    // Default to 'overview' if just 'market' or invalid
    const currentTab = (activeTab.split('-')[1] || 'overview') as Tab;

    const renderContent = () => {
        switch (currentTab) {
            case 'overview': return <MarketOverview />;
            case 'chains': return <MarketChains />;
            case 'tokens': return <MarketTokens />;
            case 'activity': return <MarketActivity />;
            case 'risk': return <MarketRisk />;
            default: return <MarketOverview />;
        }
    };

    const getAIReportProps = () => {
        switch (currentTab) {
            case 'chains':
                return {
                    title: 'Chain Analysis',
                    insight: 'L2 activity is surging with Arbitrum leading in TVL growth. Gas fees on Ethereum remain low, encouraging mainnet usage.',
                    metrics: [
                        { label: 'Top Chain', value: 'Arbitrum', trend: 'up' as Trend },
                        { label: 'Avg Gas', value: '15 Gwei', trend: 'down' as Trend },
                        { label: 'Bridge Vol', value: '$250M', trend: 'up' as Trend }
                    ],
                    recommendation: 'Monitor Arbitrum ecosystem tokens.'
                };
            case 'tokens':
                return {
                    title: 'Token Market',
                    insight: 'Altcoins are showing divergence. Meme tokens are cooling off while DeFi blue chips are accumulating.',
                    metrics: [
                        { label: 'Top Gainer', value: 'PEPE', trend: 'up' as Trend },
                        { label: 'Vol/Mcap', value: '0.05', trend: 'neutral' as Trend },
                        { label: 'New Pairs', value: '+120', trend: 'up' as Trend }
                    ],
                    recommendation: 'Look for entries in DeFi blue chips.'
                };
            case 'activity':
                return {
                    title: 'On-Chain Activity',
                    insight: 'Whale accumulation detected in ETH and LINK. Smart money is rotating out of stablecoins into risk assets.',
                    metrics: [
                        { label: 'Whale Buys', value: '$50M', trend: 'up' as Trend },
                        { label: 'Smart Money', value: 'Buying', trend: 'up' as Trend },
                        { label: 'Exchange Flow', value: '-$20M', trend: 'down' as Trend }
                    ],
                    recommendation: 'Follow smart money into ETH.'
                };
            case 'risk':
                return {
                    title: 'Risk Assessment',
                    insight: 'Market risk is moderate. Leverage is increasing but within healthy limits. No major protocol exploits detected.',
                    metrics: [
                        { label: 'Risk Level', value: 'Moderate', trend: 'neutral' as Trend },
                        { label: 'Liquidity', value: 'High', trend: 'up' as Trend },
                        { label: 'Volatility', value: 'Low', trend: 'down' as Trend }
                    ],
                    recommendation: 'Maintain standard risk management.'
                };
            default: // overview
                return {
                    title: 'Market Overview',
                    insight: 'Global crypto market cap is up 2.4% today, driven by strong ETH performance and renewed DeFi interest. Stablecoin inflows suggest accumulation.',
                    metrics: [
                        { label: 'Market Cap', value: '$2.45T', trend: 'up' as Trend },
                        { label: '24h Volume', value: '$86.2B', trend: 'up' as Trend },
                        { label: 'Sentiment', value: 'Greed (72)', trend: 'neutral' as Trend }
                    ],
                    recommendation: 'Accumulate L2 tokens'
                };
        }
    };

    const reportProps = getAIReportProps();

    const handleSummarize = () => {
        // Generate a context string based on current view
        // In a real app, this would be the actual data. Here we use the mock report props as a proxy for data.
        const context = `
Title: ${reportProps.title}
Key Insight: ${reportProps.insight}
Metrics:
${reportProps.metrics.map(m => `- ${m.label}: ${m.value} (${m.trend})`).join('\n')}
Recommendation: ${reportProps.recommendation}
        `.trim();

        if (onAISummaryRequest) {
            onAISummaryRequest(context);
        }
    };

    return (
        <div className={styles.container}>
            {/* Content Area */}
            <div className={styles.contentArea}>
                {renderContent()}
            </div>

            {/* AI Feature Icon */}
            <AIFeatureIcon onSummarize={handleSummarize} />
        </div>
    );
};

