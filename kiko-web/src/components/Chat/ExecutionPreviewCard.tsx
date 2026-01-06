import React from 'react';
import { CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import styles from './Chat.module.css';
import clsx from 'clsx';

interface ExecutionPreviewCardProps {
    steps: { name: string; status: 'pending' | 'completed' | 'active' }[];
    estimatedOutput: string;
    slippage: string;
    riskWarnings: string[];
    riskId: string;
}

export const ExecutionPreviewCard: React.FC<ExecutionPreviewCardProps> = ({
    steps,
    estimatedOutput,
    slippage,
    riskWarnings,
    riskId
}) => {
    return (
        <div className={styles.executionCard}>
            <div className={styles.cardHeader}>
                <div className={styles.titleGroup}>
                    <div className={styles.executionIcon}>
                        <ArrowRight size={18} />
                    </div>
                    <span className={styles.cardTitle}>Execution Preview</span>
                </div>
                <div className={styles.riskId}>ID: {riskId}</div>
            </div>

            <div className={styles.cardBody}>
                <div className={styles.stepsContainer}>
                    {steps.map((step, i) => (
                        <div key={i} className={clsx(styles.stepItem, styles[step.status])}>
                            <div className={styles.stepIndicator}>
                                {step.status === 'completed' ? (
                                    <CheckCircle2 size={14} />
                                ) : (
                                    <div className={styles.stepDot} />
                                )}
                            </div>
                            <span className={styles.stepName}>{step.name}</span>
                            {i < steps.length - 1 && <div className={styles.stepLine} />}
                        </div>
                    ))}
                </div>

                <div className={styles.detailsBox}>
                    <div className={styles.detailRow}>
                        <span>Est. Output</span>
                        <span className={styles.highlightValue}>{estimatedOutput}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span>Slippage</span>
                        <span>{slippage}</span>
                    </div>
                </div>

                {riskWarnings.length > 0 && (
                    <div className={styles.riskWarningBox}>
                        <div className={styles.warningHeader}>
                            <AlertTriangle size={14} className={styles.warningIcon} />
                            <span>Risk Check</span>
                        </div>
                        <ul className={styles.warningList}>
                            {riskWarnings.map((w, i) => (
                                <li key={i}>{w}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className={styles.cardFooter}>
                <div className={styles.auditBadge}>
                    <ShieldCheck size={14} />
                    <span>Audited</span>
                </div>
                <button className={styles.primaryBtn}>Confirm Execution</button>
            </div>
        </div>
    );
};
