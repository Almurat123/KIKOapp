import React from 'react';
import { Sparkles, ArrowRight, AlertTriangle, TrendingUp, ExternalLink, FileText } from 'lucide-react';
import styles from './AIReportCard.module.css';

interface AIReportCardProps {
    title: string;
    insight: string;
    metrics: { label: string; value: string; trend?: 'up' | 'down' | 'neutral' }[];
    recommendation: string;
    sourcePage?: string;
    relatedLinks?: Array<{ label: string; href: string }>;
    onLinkClick?: (href: string) => void;
}

export const AIReportCard: React.FC<AIReportCardProps> = ({ 
    title, 
    insight, 
    metrics, 
    recommendation,
    sourcePage,
    relatedLinks = [],
    onLinkClick
}) => {
    const handleLinkClick = (href: string) => {
        if (onLinkClick) {
            onLinkClick(href);
        } else {
            window.location.href = href;
        }
    };

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.titleGroup}>
                    <div className={styles.iconWrapper}>
                        <Sparkles size={18} className={styles.icon} />
                    </div>
                    <span className={styles.title}>{title}</span>
                </div>
                <span className={styles.timestamp}>Updated 2m ago</span>
            </div>

            <div className={styles.content}>
                {sourcePage && (
                    <div className={styles.sourcePage}>
                        <FileText size={14} />
                        <span>Source: {sourcePage}</span>
                    </div>
                )}

                <p className={styles.insight}>{insight}</p>

                <div className={styles.metricsGrid}>
                    {metrics.map((m, i) => (
                        <div key={i} className={styles.metricItem}>
                            <span className={styles.metricLabel}>{m.label}</span>
                            <span className={styles.metricValue}>{m.value}</span>
                        </div>
                    ))}
                </div>

                {relatedLinks.length > 0 && (
                    <div className={styles.relatedLinks}>
                        <div className={styles.relatedLinksHeader}>Related Links</div>
                        <div className={styles.relatedLinksList}>
                            {relatedLinks.map((link, i) => (
                                <button
                                    key={i}
                                    className={styles.relatedLink}
                                    onClick={() => handleLinkClick(link.href)}
                                >
                                    <span>{link.label}</span>
                                    <ExternalLink size={12} />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.footer}>
                    <div className={styles.recommendation}>
                        <TrendingUp size={16} className={styles.recIcon} />
                        <span>{recommendation}</span>
                    </div>
                    <button className={styles.actionBtn}>
                        View Analysis <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};
