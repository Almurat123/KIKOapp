import React from 'react';
import styles from '../../pages/MarketDataPage.module.css';
import { Shield, AlertTriangle, CheckCircle, XCircle, Activity, FileText } from 'lucide-react';

export const MarketRisk: React.FC = () => {
    return (
        <div className={styles.overviewContainer}>
            {/* Risk Radar & Assessment Row */}
            <div className={styles.listRow}>
                <div className={styles.chartSection} style={{ height: '100%' }}>
                    <div className={styles.sectionTitle}>
                        <Activity size={18} className={styles.icon} />
                        <span>Risk Radar Analysis</span>
                    </div>
                    <div className={styles.radarChart} style={{ height: '100%', minHeight: '300px' }}>
                        {/* SVG Radar Chart */}
                        <svg width="100%" height="100%" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet">
                            {/* Grid Webs */}
                            {[0.2, 0.4, 0.6, 0.8, 1].map((scale, i) => (
                                <polygon
                                    key={i}
                                    points="150,50 236.6,100 236.6,200 150,250 63.4,200 63.4,100"
                                    fill="none"
                                    stroke="var(--text-secondary)"
                                    strokeOpacity="0.1"
                                    transform={`translate(150, 150) scale(${scale}) translate(-150, -150)`}
                                />
                            ))}

                            {/* Data Shape (Mock Data) */}
                            <polygon
                                points="150,70 220,110 210,190 150,230 80,190 90,110"
                                fill="rgba(59, 165, 93, 0.2)"
                                stroke="var(--accent-success)"
                                strokeWidth="2"
                            />

                            {/* Labels */}
                            <text x="150" y="40" textAnchor="middle" fontSize="12" fill="var(--text-secondary)" fontWeight="600">Price</text>
                            <text x="250" y="90" textAnchor="start" fontSize="12" fill="var(--text-secondary)" fontWeight="600">Liq</text>
                            <text x="250" y="210" textAnchor="start" fontSize="12" fill="var(--text-secondary)" fontWeight="600">Vol</text>
                            <text x="150" y="270" textAnchor="middle" fontSize="12" fill="var(--text-secondary)" fontWeight="600">Tax</text>
                            <text x="50" y="210" textAnchor="end" fontSize="12" fill="var(--text-secondary)" fontWeight="600">Lock</text>
                            <text x="50" y="90" textAnchor="end" fontSize="12" fill="var(--text-secondary)" fontWeight="600">Audit</text>
                        </svg>
                    </div>
                </div>

                <div className={styles.metricCard} style={{ height: '100%' }}>
                    <div className={styles.sectionTitle}>
                        <FileText size={18} className={styles.icon} />
                        <span>Assessment Report</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div className={styles.riskScoreLarge}>
                                <span className={styles.scoreValue}>85</span>
                                <span className={styles.scoreLabel}>Low Risk</span>
                            </div>
                            <div className={styles.riskSummary}>
                                <div className={styles.summaryItem}>
                                    <CheckCircle size={16} className={styles.positive} />
                                    <span>Contract Verified</span>
                                </div>
                                <div className={styles.summaryItem}>
                                    <CheckCircle size={16} className={styles.positive} />
                                    <span>Liquidity Locked</span>
                                </div>
                                <div className={styles.summaryItem}>
                                    <AlertTriangle size={16} className={styles.warning} />
                                    <span>Mint Authority</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.recommendation}>
                            <span className={styles.recLabel}>Recommendation:</span>
                            <span className={styles.recText}>Safe to Trade (DYOR)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Automated Risk Checks */}
            <div className={styles.tableSection}>
                <div className={styles.sectionTitle}>
                    <Shield size={18} className={styles.icon} />
                    <span>Automated Risk Checks</span>
                </div>
                <div className={styles.checkGrid}>
                    {[
                        { name: 'Honeypot Check', status: 'Passed', desc: 'Token can be sold' },
                        { name: 'Buy/Sell Tax', status: 'Passed', desc: 'Tax < 5%' },
                        { name: 'Renounced Ownership', status: 'Warning', desc: 'Owner can modify contract' },
                        { name: 'Liquidity Lock', status: 'Passed', desc: 'Locked for 1 year' },
                        { name: 'Max Wallet', status: 'Passed', desc: 'No max wallet limit' },
                        { name: 'Suspicious Functions', status: 'Passed', desc: 'No blacklist/pause found' },
                    ].map((check, i) => (
                        <div key={i} className={styles.checkCard}>
                            <div className={styles.checkHeader}>
                                {check.status === 'Passed' ? <CheckCircle size={20} className={styles.positive} /> :
                                    check.status === 'Warning' ? <AlertTriangle size={20} className={styles.warning} /> :
                                        <XCircle size={20} className={styles.negative} />}
                                <span className={styles.checkName}>{check.name}</span>
                            </div>
                            <div className={styles.checkDesc}>{check.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
