
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
    { value: 'disabled', label: '禁用 (最快)' },
    { value: 'analyze_only', label: '仅分析 (Chat通知)' },
    { value: 'auto_decide', label: 'AI自动决策' },
];

export const StrategyEditForm: React.FC<StrategyEditFormProps> = ({ config, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Partial<CopyTradeConfig>>({
        targetWallet: config.targetWallet,
        minTargetValueUsd: config.minTargetValueUsd || 0,
        buyAmountUsd: config.buyAmountUsd,
        takeProfitPct: config.takeProfitPct || 100,
        stopLossPct: config.stopLossPct || 20,
        aiAnalysisMode: config.aiAnalysisMode || 'disabled',
        mirrorSell: config.mirrorSell
    });

    const [isSaving, setIsSaving] = useState(false);

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
                    <label className={styles.label}>目标钱包</label>
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
                    <label className={`${styles.label} ${styles.labelAi}`}>🤖 AI 智能分析</label>
                    <CustomSelect
                        value={formData.aiAnalysisMode || 'disabled'}
                        onChange={(val: string) => setFormData({ ...formData, aiAnalysisMode: val as any })}
                        options={AI_ANALYSIS_OPTIONS}
                    />
                    <p className={`${styles.helperText} ${styles.helperTextAi}`}>
                        {formData.aiAnalysisMode === 'auto_decide' && "AI将自动分析代币安全、流动性和社区情绪，然后决定是否跟单。"}
                        {formData.aiAnalysisMode === 'analyze_only' && "AI仅分析代币风险并在聊天中发送报告，不会阻止自动跟单。"}
                        {formData.aiAnalysisMode === 'disabled' && "不进行AI分析，监测到交易立即跟单 (速度最快)。"}
                    </p>
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.grid}>
                    {/* Trigger Value */}
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>最小跟单金额 ($)</label>
                        <input
                            type="number"
                            value={formData.minTargetValueUsd ?? 0}
                            onChange={e => setFormData({ ...formData, minTargetValueUsd: parseFloat(e.target.value) })}
                            className={styles.input}
                            placeholder="0"
                        />
                    </div>

                    {/* Buy Amount */}
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>我的买入金额 ($)</label>
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

            {/* TP/SL */}
            <div className={styles.section}>
                <div className={styles.grid}>
                    <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelTp}`}>止盈 Take Profit (%)</label>
                        <input
                            type="number"
                            value={formData.takeProfitPct ?? ''}
                            onChange={e => setFormData({ ...formData, takeProfitPct: parseFloat(e.target.value) })}
                            className={styles.input}
                            placeholder="100"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelSl}`}>止损 Stop Loss (%)</label>
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

            {/* Actions */}
            <div className={styles.actions}>
                <button
                    type="button"
                    onClick={onCancel}
                    className={styles.cancelBtn}
                    disabled={isSaving}
                >
                    取消
                </button>
                <button
                    type="submit"
                    className={styles.saveBtn}
                    disabled={isSaving}
                >
                    {isSaving ? '保存中...' : '保存修改'}
                </button>
            </div>
        </form>
    );
};
