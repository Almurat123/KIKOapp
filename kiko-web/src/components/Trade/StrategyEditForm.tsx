
import React, { useState } from 'react';
import type { CopyTradeConfig } from '../../services/copyTradeApi';
import { CustomSelect } from '../Chat/CustomSelect';
import styles from './StrategyEditForm.module.css';

interface StrategyEditFormProps {
    config: CopyTradeConfig;
    onSave: (updates: Partial<CopyTradeConfig>) => Promise<void>;
    onCancel: () => void;
}

const AI_ANALYSIS_OPTIONS = [
    { value: 'disabled', label: 'Disabled (Fastest)' },
    { value: 'analyze_only', label: 'Analyze Only (Chat Notify)' },
    { value: 'auto_decide', label: 'AI Auto Decide' },
];

export const StrategyEditForm: React.FC<StrategyEditFormProps> = ({ config, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Partial<CopyTradeConfig>>({
        targetWallet: config.targetWallet,
        minTargetValueUsd: config.minTargetValueUsd ?? undefined,
        minMarketCapUsd: config.minMarketCapUsd ?? undefined,
        minLiquidityUsd: config.minLiquidityUsd ?? undefined,
        copyTradeTokenCooldownMinutes: config.copyTradeTokenCooldownMinutes ?? undefined,
        disableTokenInfo: config.disableTokenInfo ?? false,
        buyAmountUsd: config.buyAmountUsd,
        takeProfitPct: config.takeProfitPct || 100,
        stopLossPct: config.stopLossPct || 20,
        aiAnalysisMode: config.aiAnalysisMode || 'disabled',
        mirrorSell: config.mirrorSell,
        enableDynamicTP: config.enableDynamicTP || false,
        dynamicTPMinProfitPct: config.dynamicTPMinProfitPct || 100
    });

    const [isSaving, setIsSaving] = useState(false);
    const isBase = config.chainId === 8453;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(formData);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={styles.container}>
            {/* Header removed as parent Dialog handles it */}

            {/* Target Wallet - Read Only */}
            <div className={styles.section}>
                <div className={styles.inputGroup}>
                    <label className={styles.label}>Target Wallet</label>
                    <input
                        type="text"
                        value={formData.targetWallet}
                        onChange={e => setFormData({ ...formData, targetWallet: e.target.value })}
                        className={styles.input}
                        disabled
                    />
                </div>
            </div>

            {/* AI Analysis Mode */}
            <div className={styles.section}>
                <div className={styles.inputGroup}>
                    <label className={`${styles.label} ${styles.labelAi}`}>Analysis Power by Grok</label>
                    <CustomSelect
                        value={formData.aiAnalysisMode || 'disabled'}
                        onChange={(val: string) => setFormData({ ...formData, aiAnalysisMode: val as any })}
                        options={AI_ANALYSIS_OPTIONS}
                    />
                    <p className={`${styles.helperText} ${styles.helperTextAi}`}>
                        {formData.aiAnalysisMode === 'auto_decide' && "AI will analyze token security, liquidity, and community sentiment, then decide whether to copy trade."}
                        {formData.aiAnalysisMode === 'analyze_only' && "AI only analyzes token risk and sends a report in chat, won't block automatic copy trading."}
                        {formData.aiAnalysisMode === 'disabled' && "No AI analysis, copy trade immediately upon detection (fastest)."}
                    </p>
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.grid}>
                    {/* Trigger Value */}
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Min Follow Amount ($)</label>
                        <input
                            type="number"
                            value={formData.minTargetValueUsd ?? ''}
                            onChange={e => {
                                const val = e.target.value;
                                setFormData({ ...formData, minTargetValueUsd: val === '' ? undefined : parseFloat(val) });
                            }}
                            className={styles.input}
                            placeholder="0"
                        />
                    </div>

                    {/* Buy Amount */}
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>My Buy Amount ($)</label>
                        <input
                            type="number"
                            value={formData.buyAmountUsd}
                            onChange={e => setFormData({ ...formData, buyAmountUsd: parseFloat(e.target.value) })}
                            className={styles.input}
                            placeholder="100"
                        />
                    </div>
                </div>
            </div>

            {/* Copy Trade Safety */}
            <div className={styles.section}>
                <div className={styles.grid}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Repeat Buy Cooldown (minutes)</label>
                        <input
                            type="number"
                            min={0}
                            value={formData.copyTradeTokenCooldownMinutes ?? ''}
                            onChange={e => {
                                const val = e.target.value;
                                setFormData({
                                    ...formData,
                                    copyTradeTokenCooldownMinutes: val === '' ? undefined : parseFloat(val)
                                });
                            }}
                            className={styles.input}
                            placeholder="60"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Min Market Cap (USD)</label>
                        <input
                            type="number"
                            min={0}
                            value={formData.minMarketCapUsd ?? ''}
                            onChange={e => {
                                const val = e.target.value;
                                setFormData({ ...formData, minMarketCapUsd: val === '' ? undefined : parseFloat(val) });
                            }}
                            className={styles.input}
                            placeholder="Optional"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Min Liquidity (USD)</label>
                        <input
                            type="number"
                            min={0}
                            value={formData.minLiquidityUsd ?? ''}
                            onChange={e => {
                                const val = e.target.value;
                                setFormData({ ...formData, minLiquidityUsd: val === '' ? undefined : parseFloat(val) });
                            }}
                            className={styles.input}
                            placeholder="Optional"
                        />
                    </div>
                </div>

                <div className={styles.inputGroup} style={{ marginTop: '12px' }}>
                    <div
                        className={styles.toggleRow}
                        onClick={() => {
                            if (!isBase) return;
                            setFormData({ ...formData, disableTokenInfo: !formData.disableTokenInfo });
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={!!formData.disableTokenInfo}
                            onChange={() => { }}
                            className={styles.checkbox}
                            disabled={!isBase}
                        />
                        <span className={styles.label} style={{ marginBottom: 0 }}>
                            Disable Token Info (Base V4 Fast)
                        </span>
                    </div>
                    <p className={styles.helperText}>
                        {isBase
                            ? 'Skips token info checks to execute Base V4 fast swaps. BSC still uses price comparison.'
                            : 'Only available on Base.'}
                    </p>
                </div>
            </div>

            {/* TP/SL */}
            <div className={styles.section}>
                <div className={styles.grid}>
                    <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelTp}`}>TAKE PROFIT (%)</label>
                        <input
                            type="number"
                            value={formData.takeProfitPct ?? ''}
                            onChange={e => setFormData({ ...formData, takeProfitPct: parseFloat(e.target.value) })}
                            className={styles.input}
                            placeholder="100"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelSl}`}>Stop Loss (%)</label>
                        <input
                            type="number"
                            value={formData.stopLossPct ?? ''}
                            onChange={e => setFormData({ ...formData, stopLossPct: parseFloat(e.target.value) })}
                            className={styles.input}
                            placeholder="20"
                        />
                    </div>
                </div>
            </div>

            {/* Mirror Sell */}
            <div className={styles.section}>
                <div className={styles.inputGroup}>
                    <label className={styles.label}>Execution Logic</label>
                    <div
                        className={styles.toggleRow}
                        onClick={() => setFormData({ ...formData, mirrorSell: !formData.mirrorSell })}
                    >
                        <input
                            type="checkbox"
                            checked={formData.mirrorSell}
                            onChange={() => { }} // Handled by div for better hit area
                            className={styles.checkbox}
                        />
                        <span className={styles.helperText} style={{ marginTop: 0 }}>
                            <strong>Mirror Sell:</strong> Follow the target wallet's sell actions immediately.
                        </span>
                    </div>
                </div>
            </div>

            {/* Dynamic Take Profit */}
            <div className={styles.section}>
                <div className={styles.inputGroup}>
                    <div
                        className={styles.toggleRow}
                        onClick={() => setFormData({ ...formData, enableDynamicTP: !formData.enableDynamicTP })}
                    >
                        <input
                            type="checkbox"
                            checked={formData.enableDynamicTP}
                            onChange={() => { }}
                            className={styles.checkbox}
                        />
                        <span className={styles.label} style={{ marginBottom: 0 }}>Enable Dynamic Take Profit (ATR)</span>
                    </div>
                    <p className={styles.helperText}>
                        Protect your gains using Chandelier Exit & Rapid Decline detection.
                    </p>

                    {formData.enableDynamicTP && (
                        <div className={styles.inputGroup} style={{ marginTop: '12px' }}>
                            <label className={styles.label}>Activate Dynamic TP at Profit (%)</label>
                            <input
                                type="number"
                                value={formData.dynamicTPMinProfitPct ?? ''}
                                onChange={e => setFormData({ ...formData, dynamicTPMinProfitPct: parseFloat(e.target.value) })}
                                className={styles.input}
                                placeholder="100"
                            />
                            <p className={styles.helperText} style={{ fontSize: '11px', color: '#10b981' }}>
                                Strategy will start tracking peaks and calculating ATR trailing stops once profit exceeds this level.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
                <button
                    type="button"
                    onClick={onCancel}
                    className={styles.cancelBtn}
                    disabled={isSaving}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className={styles.saveBtn}
                    disabled={isSaving}
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
    );
};
