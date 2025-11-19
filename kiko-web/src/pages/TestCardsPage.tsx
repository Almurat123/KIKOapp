import React from 'react';
import { TokenCard } from '../components/Chat/TokenCard';
import { StrategyCard } from '../components/Chat/StrategyCard';
import { ExecutionPreviewCard } from '../components/Chat/ExecutionPreviewCard';
import { AIReportCard } from '../components/Market/AIReportCard';

export const TestCardsPage: React.FC = () => {
    return (
        <div style={{ padding: '40px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
            <h1 style={{ marginBottom: '32px', color: 'var(--text-primary)' }}>Component Test Harness</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '32px' }}>

                {/* Token Card */}
                <section>
                    <h2 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-secondary)' }}>TokenCard</h2>
                    <TokenCard
                        symbol="ETH"
                        name="Ethereum"
                        price="3,450.25"
                        change24h={5.2}
                        riskScore={85}
                    />
                </section>

                {/* Strategy Card */}
                <section>
                    <h2 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-secondary)' }}>StrategyCard</h2>
                    <StrategyCard
                        type="DCA"
                        token="ETH"
                        triggerCondition="Price < $3,200"
                        executionAmount="$500 USDC"
                        limits={{
                            maxUsdPerDay: "2,000",
                            maxTradesPerDay: 4,
                            cooldown: "4h"
                        }}
                    />
                </section>

                {/* Execution Preview Card */}
                <section>
                    <h2 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-secondary)' }}>ExecutionPreviewCard</h2>
                    <ExecutionPreviewCard
                        steps={[
                            { name: 'Risk Check', status: 'completed' },
                            { name: 'Approve USDC', status: 'completed' },
                            { name: 'Swap USDC->ETH', status: 'active' },
                            { name: 'Confirm', status: 'pending' }
                        ]}
                        estimatedOutput="0.145 ETH"
                        slippage="0.5%"
                        riskWarnings={['Price impact > 1%', 'Low liquidity pool']}
                        riskId="R-29384"
                    />
                </section>

                {/* AI Report Card */}
                <section>
                    <h2 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-secondary)' }}>AIReportCard</h2>
                    <AIReportCard
                        title="Market Opportunity"
                        insight="Ethereum is showing strong accumulation patterns despite recent volatility. Whales are buying the dip."
                        metrics={[
                            { label: 'Sentiment', value: 'Bullish', trend: 'up' },
                            { label: 'Volume', value: '+15%', trend: 'up' },
                            { label: 'Volatility', value: 'Medium', trend: 'neutral' }
                        ]}
                        recommendation="Consider accumulating ETH near support levels."
                    />
                </section>
            </div>
        </div>
    );
};
