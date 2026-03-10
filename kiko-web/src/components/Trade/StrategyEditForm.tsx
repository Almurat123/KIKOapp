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

type NumericField =
    | 'minTargetValueUsd'
    | 'buyAmountUsd'
    | 'copyTradeTokenCooldownMinutes'
    | 'minMarketCapUsd'
    | 'minLiquidityUsd'
    | 'maxEntryDeviationBps'
    | 'takeProfitPct'
    | 'stopLossPct'
    | 'dynamicTPMinProfitPct';

const AI_ANALYSIS_OPTIONS = [
    { value: 'disabled', label: 'Disabled (Fastest)' },
    { value: 'analyze_only', label: 'Analyze Only (Chat Notify)' },
    { value: 'auto_decide', label: 'AI Auto Decide' },
];
type ExecutionMode = 'safe' | 'normal' | 'turbo';

const NORMAL_MIN_LIQUIDITY_USD = 1000;
const TURBO_MIN_LIQUIDITY_USD = 500;
const NORMAL_MIN_ENTRY_DEVIATION_BPS = 1500;
const TURBO_MIN_ENTRY_DEVIATION_BPS = 3000;

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

export const StrategyEditForm: React.FC<StrategyEditFormProps> = ({ config, onSave, onCancel }) => {
    const initialExecutionMode: ExecutionMode =
        (config.executionMode as ExecutionMode | undefined) ?? (config.disableTokenInfo ? 'turbo' : 'normal');
    const getLiquidityFloor = (mode: ExecutionMode) => mode === 'turbo' ? TURBO_MIN_LIQUIDITY_USD : NORMAL_MIN_LIQUIDITY_USD;
    const getEntryDeviationFloor = (mode: ExecutionMode) => mode === 'turbo' ? TURBO_MIN_ENTRY_DEVIATION_BPS : NORMAL_MIN_ENTRY_DEVIATION_BPS;
    const [formData, setFormData] = useState<Partial<CopyTradeConfig>>({
        targetWallet: config.targetWallet,
        minTargetValueUsd: config.minTargetValueUsd ?? undefined,
        minMarketCapUsd: config.minMarketCapUsd ?? undefined,
        minLiquidityUsd: Math.max(Number(config.minLiquidityUsd ?? 0), getLiquidityFloor(initialExecutionMode)),
        copyTradeTokenCooldownMinutes: config.copyTradeTokenCooldownMinutes ?? undefined,
        executionMode: initialExecutionMode,
        disableTokenInfo: initialExecutionMode === 'turbo',
        buyAmountUsd: config.buyAmountUsd,
        maxEntryDeviationBps: Math.max(Number(config.maxEntryDeviationBps ?? 0), getEntryDeviationFloor(initialExecutionMode)),
        takeProfitPct: config.takeProfitPct || 100,
        stopLossPct: config.stopLossPct || 20,
        aiAnalysisMode: config.aiAnalysisMode || 'disabled',
        mirrorSell: config.mirrorSell,
        enableDynamicTP: config.enableDynamicTP || false,
        dynamicTPMinProfitPct: config.dynamicTPMinProfitPct || 100
    });

    const formDataRef = useRef(formData);
    const [rawNumericInputs, setRawNumericInputs] = useState<Partial<Record<NumericField, string>>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // [Logic]: Sync ref with state for use in cleanup.
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    const updateFormData = (updates: Partial<CopyTradeConfig>) => {
        setFormData(prev => ({ ...prev, ...updates }));
        setSaveError(null);
    };
    const setRawNumericInput = (field: NumericField, value?: string) => {
        setRawNumericInputs((prev) => {
            if (value === undefined) {
                if (!(field in prev)) return prev;
                const next = { ...prev };
                delete next[field];
                return next;
            }

            return { ...prev, [field]: value };
        });
    };
    const clearRawNumericInputs = (...fields: NumericField[]) => {
        setRawNumericInputs((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const field of fields) {
                if (field in next) {
                    delete next[field];
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    };
    const getNumericInputValue = (field: NumericField) => {
        if (Object.prototype.hasOwnProperty.call(rawNumericInputs, field)) {
            return rawNumericInputs[field] ?? '';
        }

        return formData[field] ?? '';
    };
    const currentExecutionMode: ExecutionMode =
        (formData.executionMode as ExecutionMode | undefined) ?? (formData.disableTokenInfo ? 'turbo' : 'normal');
    const isTurboMode = currentExecutionMode === 'turbo';
    const currentLiquidityFloor = getLiquidityFloor(currentExecutionMode);
    const currentEntryDeviationFloor = getEntryDeviationFloor(currentExecutionMode);
    const updateExecutionMode = (mode: ExecutionMode) => {
        clearRawNumericInputs('minLiquidityUsd', 'maxEntryDeviationBps');
        updateFormData({
            executionMode: mode,
            disableTokenInfo: mode === 'turbo',
            minLiquidityUsd: Math.max(Number(formData.minLiquidityUsd ?? 0), getLiquidityFloor(mode)),
            maxEntryDeviationBps: Math.max(Number(formData.maxEntryDeviationBps ?? 0), getEntryDeviationFloor(mode)),
        });
    };

    const handleNumberChange = (
        value: string,
        field: NumericField,
        allowZero = true,
        isComposing = false
    ) => {
        const normalizedValue = isComposing
            ? value
            : value
                .replace(/[^\d.]/g, '')
                .replace(/(\..*)\./g, '$1');

        setRawNumericInput(field, normalizedValue);

        // [Safety]: Allow empty string to clear the value (set to undefined)
        if (normalizedValue === '') {
            if (field === 'minLiquidityUsd') {
                updateFormData({ [field]: currentLiquidityFloor });
                return;
            }
            if (field === 'maxEntryDeviationBps') {
                updateFormData({ [field]: currentEntryDeviationFloor });
                return;
            }
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

        let nextValue = num;
        if (field === 'minLiquidityUsd') {
            nextValue = Math.max(num, currentLiquidityFloor);
        }
        if (field === 'maxEntryDeviationBps') {
            nextValue = Math.max(num, currentEntryDeviationFloor);
        }

        updateFormData({ [field]: nextValue });
    };

    const handleNumericInputChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        field: NumericField,
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
        field: NumericField,
        allowZero = true
    ) => {
        handleNumberChange(e.currentTarget.value, field, allowZero, false);
    };
    const handleNumericBlur = (field: NumericField) => {
        const rawValue = rawNumericInputs[field];
        if (rawValue === undefined) return;

        if (rawValue === '' || rawValue === '.') {
            if (field === 'minLiquidityUsd') {
                updateFormData({ [field]: currentLiquidityFloor });
            } else if (field === 'maxEntryDeviationBps') {
                updateFormData({ [field]: currentEntryDeviationFloor });
            } else {
                updateFormData({ [field]: undefined });
            }
        }

        setRawNumericInput(field, undefined);
    };

    const [isReady, setIsReady] = useState(false);

    // [Fix]: Enable transitions only after initial mount to prevent "flicker"
    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 50);
        return () => clearTimeout(timer);
    }, []);

    const handleSaveClick = async () => {
        setIsSaving(true);
        setSaveError(null);
        try {
            await onSave(formDataRef.current);
            onCancel();
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to save strategy.');
        } finally {
            setIsSaving(false);
        }
    };

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
                            value={getNumericInputValue('minTargetValueUsd')}
                            onChange={e => handleNumericInputChange(e, 'minTargetValueUsd')}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'minTargetValueUsd')}
                            onBlur={() => handleNumericBlur('minTargetValueUsd')}
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
                            value={getNumericInputValue('buyAmountUsd')}
                            onChange={e => handleNumericInputChange(e, 'buyAmountUsd', false)}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'buyAmountUsd', false)}
                            onBlur={() => handleNumericBlur('buyAmountUsd')}
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
                        value={getNumericInputValue('copyTradeTokenCooldownMinutes')}
                        onChange={e => handleNumericInputChange(e, 'copyTradeTokenCooldownMinutes')}
                        onCompositionEnd={e => handleNumericCompositionEnd(e, 'copyTradeTokenCooldownMinutes')}
                        onBlur={() => handleNumericBlur('copyTradeTokenCooldownMinutes')}
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
                            value={getNumericInputValue('minMarketCapUsd')}
                            onChange={e => handleNumericInputChange(e, 'minMarketCapUsd')}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'minMarketCapUsd')}
                            onBlur={() => handleNumericBlur('minMarketCapUsd')}
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
                            value={getNumericInputValue('minLiquidityUsd')}
                            onChange={e => handleNumericInputChange(e, 'minLiquidityUsd')}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'minLiquidityUsd')}
                            onBlur={() => handleNumericBlur('minLiquidityUsd')}
                            className={styles.input}
                            placeholder={String(currentLiquidityFloor)}
                            disabled={isTurboMode}
                        />
                    </div>
                </div>
                <div className={styles.inputGroup} style={{ marginTop: '16px' }}>
                    <label className={styles.label}>Max Entry Deviation (BPS)</label>
                    <input
                        type="text"
                        inputMode="decimal"
                        {...agentAttrs({ id: 'trade.edit.max_entry_deviation_bps', role: 'input', action: 'select', page: 'trade', key: 'maxEntryDeviationBps' })}
                        value={getNumericInputValue('maxEntryDeviationBps')}
                        onChange={e => handleNumericInputChange(e, 'maxEntryDeviationBps')}
                        onCompositionEnd={e => handleNumericCompositionEnd(e, 'maxEntryDeviationBps')}
                        onBlur={() => handleNumericBlur('maxEntryDeviationBps')}
                        className={styles.input}
                        placeholder={String(currentEntryDeviationFloor)}
                    />
                    <p className={styles.headerDesc}>
                        Minimum allowed in {currentExecutionMode.toUpperCase()} mode: {currentEntryDeviationFloor} bps ({(currentEntryDeviationFloor / 100).toFixed(0)}%).
                    </p>
                </div>
                <p className={clsx(styles.headerDesc, styles.topMarginTwelve)}>
                    Min Liquidity cannot be set below the enforced system floor for the selected execution mode: ${currentLiquidityFloor}.
                </p>
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
                            value={getNumericInputValue('takeProfitPct')}
                            onChange={e => handleNumericInputChange(e, 'takeProfitPct', false)}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'takeProfitPct', false)}
                            onBlur={() => handleNumericBlur('takeProfitPct')}
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
                            value={getNumericInputValue('stopLossPct')}
                            onChange={e => handleNumericInputChange(e, 'stopLossPct', false)}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'stopLossPct', false)}
                            onBlur={() => handleNumericBlur('stopLossPct')}
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
                            value={getNumericInputValue('dynamicTPMinProfitPct')}
                            onChange={e => handleNumericInputChange(e, 'dynamicTPMinProfitPct', false)}
                            onCompositionEnd={e => handleNumericCompositionEnd(e, 'dynamicTPMinProfitPct', false)}
                            onBlur={() => handleNumericBlur('dynamicTPMinProfitPct')}
                            className={styles.input}
                            placeholder="100"
                        />
                        <p className={clsx(styles.headerDesc, styles.successText)}>
                            Trailing stop logic initiates once current profit exceeds this threshold.
                        </p>
                    </div>
                )}
            </div>

            <div className={styles.actions}>
                {saveError && <p className={styles.actionError}>{saveError}</p>}
                <div className={styles.actionRow}>
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleSaveClick}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Strategy'}
                    </button>
                </div>
            </div>
        </div>
    );
};
