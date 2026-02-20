import React, { useState, useEffect, useRef } from 'react';
import type { CopyTradeConfig } from '../../services/copyTradeApi';
import { CustomSelect } from '../Chat/CustomSelect';
import styles from './StrategyEditForm.module.css';
import clsx from 'clsx';
import { agentAttrs } from '../../agent/attrs';

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
type ExecutionMode = 'safe' | 'normal' | 'turbo';

const EXECUTION_MODE_OPTIONS: Array<{ value: ExecutionMode; label: string; desc: string }> = [
    {
        value: 'safe',
        label: 'SAFE',
        desc: 'Full checks first. Lowest risk, slower entries.'
    },
    {
        value: 'normal',
        label: 'NORMAL',
        desc: 'Finds pools and chooses the best executable path.'
    },
    {
        value: 'turbo',
        label: 'TURBO',
        desc: 'Fastest path. Skips token-info checks before buy.'
    }
];

export const StrategyEditForm: React.FC<StrategyEditFormProps> = ({ config, onSave }) => {
    const initialExecutionMode: ExecutionMode =
        (config.executionMode as ExecutionMode | undefined) ?? (config.disableTokenInfo ? 'turbo' : 'normal');
    const [formData, setFormData] = useState<Partial<CopyTradeConfig>>({
        targetWallet: config.targetWallet,
        minTargetValueUsd: config.minTargetValueUsd ?? undefined,
        minMarketCapUsd: config.minMarketCapUsd ?? undefined,
        minLiquidityUsd: config.minLiquidityUsd ?? undefined,
        copyTradeTokenCooldownMinutes: config.copyTradeTokenCooldownMinutes ?? undefined,
        executionMode: initialExecutionMode,
        disableTokenInfo: initialExecutionMode === 'turbo',
        buyAmountUsd: config.buyAmountUsd,
        takeProfitPct: config.takeProfitPct || 100,
        stopLossPct: config.stopLossPct || 20,
        aiAnalysisMode: config.aiAnalysisMode || 'disabled',
        mirrorSell: config.mirrorSell,
        enableDynamicTP: config.enableDynamicTP || false,
        dynamicTPMinProfitPct: config.dynamicTPMinProfitPct || 100
    });

    const formDataRef = useRef(formData);
    const hasChangedRef = useRef(false);

    // [Logic]: Sync ref with state for use in cleanup.
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    // [Logic]: Auto-save when the component is unmounted (modal closed).
    useEffect(() => {
        return () => {
            if (hasChangedRef.current) {
                onSave(formDataRef.current);
            }
        };
    }, [onSave]);

    const updateFormData = (updates: Partial<CopyTradeConfig>) => {
        setFormData(prev => ({ ...prev, ...updates }));
        hasChangedRef.current = true;
    };
    const currentExecutionMode: ExecutionMode =
        (formData.executionMode as ExecutionMode | undefined) ?? (formData.disableTokenInfo ? 'turbo' : 'normal');
    const isTurboMode = currentExecutionMode === 'turbo';
    const updateExecutionMode = (mode: ExecutionMode) => {
        updateFormData({
            executionMode: mode,
            disableTokenInfo: mode === 'turbo'
        });
    };

    const handleNumberChange = (
        value: string,
        field: keyof CopyTradeConfig,
        allowZero = true,
        isComposing = false
    ) => {
        const normalizedValue = isComposing
            ? value
            : value
                .replace(/[^\d.]/g, '')
                .replace(/(\..*)\./g, '$1');

        // [Safety]: Allow empty string to clear the value (set to undefined)
        if (normalizedValue === '') {
            updateFormData({ [field]: undefined });
            return;
        }

        // During IME composition, wait for composition end before parsing.
        if (isComposing) return;

        if (normalizedValue === '.') return;

        const num = parseFloat(normalizedValue);

        // [Safety]: strict NaN check
        if (isNaN(num)) return;

        // [Safety]: Prevent negative numbers
        if (num < 0) return;

        // [Safety]: Optional Zero check
        if (!allowZero && num === 0) return;

        updateFormData({ [field]: num });
    };

    const handleNumericInputChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        field: keyof CopyTradeConfig,
        allowZero = true
    ) => {
        handleNumberChange(
            e.target.value,
            field,
            allowZero,
            Boolean((e.nativeEvent as InputEvent).isComposing)
        );
    };

    const handleNumericCompositionEnd = (
        e: React.CompositionEvent<HTMLInputElement>,
        field: keyof CopyTradeConfig,
        allowZero = true
    ) => {
        handleNumberChange(e.currentTarget.value, field, allowZero, false);
    };

    const [isReady, setIsReady] = useState(false);

    // [Fix]: Enable transitions only after initial mount to prevent "flicker"
    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 50);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            className={clsx(styles.container, isReady && styles.ready)}
            {...agentAttrs({ id: 'trade.edit.dialog', role: 'dialog', page: 'trade' })}
        >
            {/* Section 1: Wallet Info */}
            <div className={styles.section}>
                <div className={styles.inputGroup}>
                    <label className={styles.label}>Target Wallet Address</label>
                    <input
                        type="text"
                        value={formData.targetWallet}
                        className={styles.input}
                        disabled
                    />
                    <p className={styles.headerDesc}>The specific wallet address this strategy is monitoring.</p>
                </div>
            </div>

            {/* Section 2: AI Intelligence */}
            <div className={clsx(styles.section, styles.sectionAi)}>
                <div className={styles.sectionTitle}>AI Intelligence Enhancement</div>
                <div className={styles.inputGroup}>
                    <label className={styles.label}>Analysis Power by Grok</label>
                    <CustomSelect
                        value={formData.aiAnalysisMode || 'disabled'}
                        onChange={(val: string) => updateFormData({ aiAnalysisMode: val as any })}
                        options={AI_ANALYSIS_OPTIONS}
                        triggerClassName={styles.fixedTrigger}
                    />
                    <p className={styles.headerDesc}>
                        {formData.aiAnalysisMode === 'auto_decide' && "AI will analyze token security, liquidity, and community sentiment, then decide whether to copy trade."}
                        {formData.aiAnalysisMode === 'analyze_only' && "AI only analyzes token risk and sends a report in chat, won't block automatic copy trading."}
                        {formData.aiAnalysisMode === 'disabled' && "No AI analysis, copy trade immediately upon detection (fastest)."}
                    </p>
                </div>
            </div>

            {/* Section 3: Trading Parameters */}
            <div className={clsx(styles.section, styles.sectionTrade)}>
                <div className={styles.sectionTitle}>Core Trading Parameters</div>
                <div className={styles.grid}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Min Follow Amount ($)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            {...agentAttrs({ id: 'trade.edit.min_follow_amount', role: 'input', action: 'select', page: 'trade', key: 'minTargetValueUsd' })}
                            value={formData.minTargetValueUsd ?? ''}
                            onChange={e => handleNumericInputChange(e, 'minTargetValueUsd')}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'minTargetValueUsd')}
                            className={styles.input}
                            placeholder="0"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>My Buy Amount ($)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            {...agentAttrs({ id: 'trade.edit.buy_amount', role: 'input', action: 'select', page: 'trade', key: 'buyAmountUsd' })}
                            value={formData.buyAmountUsd}
                            onChange={e => handleNumericInputChange(e, 'buyAmountUsd', false)}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'buyAmountUsd', false)}
                            className={styles.input}
                            placeholder="100"
                        />
                    </div>
                </div>
                <div className={styles.inputGroup} style={{ marginTop: '16px' }}>
                    <label className={styles.label}>Repeat Buy Cooldown (minutes)</label>
                    <input
                        type="text"
                        inputMode="decimal"
                        {...agentAttrs({ id: 'trade.edit.cooldown', role: 'input', action: 'select', page: 'trade', key: 'copyTradeTokenCooldownMinutes' })}
                        min={0}
                        value={formData.copyTradeTokenCooldownMinutes ?? ''}
                        onChange={e => handleNumericInputChange(e, 'copyTradeTokenCooldownMinutes')}
                        onCompositionEnd={e => handleNumericCompositionEnd(e, 'copyTradeTokenCooldownMinutes')}
                        className={styles.input}
                        placeholder="60"
                    />
                    <p className={styles.headerDesc}>Prevents re-buying the same token within the specified timeframe.</p>
                </div>
            </div>

            {/* Section 4: Safety Filters */}
            <div className={clsx(styles.section, styles.sectionSafety)}>
                <div className={styles.sectionTitle}>Safety & Speed Filters</div>
                <div className={styles.grid}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Min Market Cap (USD)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            {...agentAttrs({ id: 'trade.edit.min_market_cap', role: 'input', action: 'select', page: 'trade', key: 'minMarketCapUsd' })}
                            min={0}
                            value={formData.minMarketCapUsd ?? ''}
                            onChange={e => handleNumericInputChange(e, 'minMarketCapUsd')}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'minMarketCapUsd')}
                            className={styles.input}
                            placeholder="Optional"
                            disabled={isTurboMode}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Min Liquidity (USD)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            {...agentAttrs({ id: 'trade.edit.min_liquidity', role: 'input', action: 'select', page: 'trade', key: 'minLiquidityUsd' })}
                            min={0}
                            value={formData.minLiquidityUsd ?? ''}
                            onChange={e => handleNumericInputChange(e, 'minLiquidityUsd')}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'minLiquidityUsd')}
                            className={styles.input}
                            placeholder="Optional"
                            disabled={isTurboMode}
                        />
                    </div>
                </div>
                {isTurboMode && (
                    <p className={styles.headerDesc}>
                        Turbo mode ignores Market Cap and Liquidity filters to keep entry latency minimal.
                    </p>
                )}

                <div className={styles.inputGroup} style={{ marginTop: '20px' }}>
                    <div className={styles.headerTitle}>Execution Mode</div>
                    <div className={styles.modeSegment} role="radiogroup" aria-label="Execution Mode">
                        {EXECUTION_MODE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={clsx(styles.modeButton, currentExecutionMode === option.value && styles.modeButtonActive)}
                                {...agentAttrs({ id: `trade.edit.execution_mode.${option.value}`, role: 'tab', action: 'select', page: 'trade', key: 'executionMode' })}
                                onClick={() => updateExecutionMode(option.value)}
                                aria-pressed={currentExecutionMode === option.value}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <p className={styles.headerDesc}>
                        {EXECUTION_MODE_OPTIONS.find(v => v.value === currentExecutionMode)?.desc}
                    </p>
                    {isTurboMode && (
                        <p className={styles.headerDesc}>
                            In Turbo, Min Follow Amount and Repeat Buy Cooldown are still enforced.
                        </p>
                    )}
                </div>
            </div>

            {/* Section 5: Risk Management */}
            <div className={clsx(styles.section, styles.sectionRisk)}>
                <div className={styles.sectionTitle}>Risk & Exit Governance</div>
                <div className={styles.inputGroup}>
                    <div className={styles.headerRow}>
                        <div className={styles.headerTitle}>Mirror Sell Mode</div>
                        <label className={styles.toggleSwitch}>
                        <input
                            type="checkbox"
                            {...agentAttrs({ id: 'trade.edit.mirror_sell', role: 'toggle', action: 'toggle', page: 'trade', key: 'mirrorSell' })}
                            checked={!!formData.mirrorSell}
                                onChange={e => updateFormData({ mirrorSell: e.target.checked })}
                            />
                            <span className={styles.slider}></span>
                        </label>
                    </div>
                    <p className={styles.headerDesc}>
                        Automatically sell your position whenever the target wallet sells. Ensures perfect synchronization.
                    </p>
                </div>

                <div className={styles.grid} style={{ marginTop: '16px' }}>
                    <div className={styles.inputGroup}>
                        <label className={clsx(styles.label, styles.labelTp)}>TAKE PROFIT (%)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            {...agentAttrs({ id: 'trade.edit.take_profit_pct', role: 'input', action: 'select', page: 'trade', key: 'takeProfitPct' })}
                            value={formData.takeProfitPct ?? ''}
                            onChange={e => handleNumericInputChange(e, 'takeProfitPct', false)}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'takeProfitPct', false)}
                            className={styles.input}
                            placeholder="100"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={clsx(styles.label, styles.labelSl)}>STOP LOSS (%)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            {...agentAttrs({ id: 'trade.edit.stop_loss_pct', role: 'input', action: 'select', page: 'trade', key: 'stopLossPct' })}
                            value={formData.stopLossPct ?? ''}
                            onChange={e => handleNumericInputChange(e, 'stopLossPct', false)}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'stopLossPct', false)}
                            className={styles.input}
                            placeholder="20"
                        />
                    </div>
                </div>
            </div>

            {/* Section 6: Dynamic TP */}
            <div className={clsx(styles.section, styles.sectionRisk)}>
                <div className={styles.headerRow}>
                    <div className={styles.headerTitle}>Dynamic Take Profit (ATR Algorithm)</div>
                    <label className={styles.toggleSwitch}>
                        <input
                            type="checkbox"
                            {...agentAttrs({ id: 'trade.edit.dynamic_tp_enabled', role: 'toggle', action: 'toggle', page: 'trade', key: 'enableDynamicTP' })}
                            checked={!!formData.enableDynamicTP}
                            onChange={e => updateFormData({ enableDynamicTP: e.target.checked })}
                        />
                        <span className={styles.slider}></span>
                    </label>
                </div>
                <p className={styles.headerDesc}>
                    Advanced trailing stop using Chandelier Exit & Real-time peak tracking for maximum profit capture.
                </p>

                {formData.enableDynamicTP && (
                    <div className={styles.inputGroup} style={{ marginTop: '16px' }}>
                        <label className={styles.label}>Activate Dynamic TP at Profit (%)</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            {...agentAttrs({ id: 'trade.edit.dynamic_tp_profit_threshold', role: 'input', action: 'select', page: 'trade', key: 'dynamicTPMinProfitPct' })}
                            value={formData.dynamicTPMinProfitPct ?? ''}
                            onChange={e => handleNumericInputChange(e, 'dynamicTPMinProfitPct', false)}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'dynamicTPMinProfitPct', false)}
                            className={styles.input}
                            placeholder="100"
                        />
                        <p className={styles.headerDesc} style={{ color: '#10b981' }}>
                            Trailing stop logic initiates once current profit exceeds this threshold.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
