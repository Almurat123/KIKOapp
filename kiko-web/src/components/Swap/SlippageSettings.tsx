/**
 * Slippage Settings Component
 * Allows users to toggle between auto and custom slippage
 */

import { useState } from 'react';
import styles from './SlippageSettings.module.css';
import type { SlippageMode } from '@/config/slippageConfig';

interface SlippageSettingsProps {
    mode: SlippageMode;
    customValue: number;
    autoValue?: number;
    onModeChange: (mode: SlippageMode) => void;
    onCustomValueChange: (value: number) => void;
}

export function SlippageSettings({
    mode,
    customValue,
    autoValue,
    onModeChange,
    onCustomValueChange,
}: SlippageSettingsProps) {
    const [inputValue, setInputValue] = useState(customValue.toString());

    const handleCustomInput = (value: string) => {
        setInputValue(value);
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0.1 && num <= 50) {
            onCustomValueChange(num);
        }
    };

    const presetValues = [0.1, 0.5, 1.0, 3.0];

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>Slippage Tolerance</h3>
                <div className={styles.modeToggle}>
                    <button
                        className={`${styles.modeButton} ${mode === 'auto' ? styles.active : ''}`}
                        onClick={() => onModeChange('auto')}
                    >
                        Auto
                    </button>
                    <button
                        className={`${styles.modeButton} ${mode === 'custom' ? styles.active : ''}`}
                        onClick={() => onModeChange('custom')}
                    >
                        Custom
                    </button>
                </div>
            </div>

            {mode === 'auto' && (
                <div className={styles.autoMode}>
                    <div className={styles.autoValue}>
                        <span className={styles.autoIcon}>🎯</span>
                        <span className={styles.autoText}>
                            Auto: {autoValue?.toFixed(1) || '0.5'}%
                        </span>
                    </div>
                    <p className={styles.autoDescription}>
                        Automatically adjusts based on market conditions, liquidity, and token risk
                    </p>
                </div>
            )}

            {mode === 'custom' && (
                <div className={styles.customMode}>
                    <div className={styles.presets}>
                        {presetValues.map((value) => (
                            <button
                                key={value}
                                className={`${styles.presetButton} ${customValue === value ? styles.presetActive : ''
                                    }`}
                                onClick={() => {
                                    onCustomValueChange(value);
                                    setInputValue(value.toString());
                                }}
                            >
                                {value}%
                            </button>
                        ))}
                    </div>

                    <div className={styles.customInput}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => handleCustomInput(e.target.value)}
                            placeholder="0.5"
                            className={styles.input}
                        />
                        <span className={styles.inputSuffix}>%</span>
                    </div>

                    {parseFloat(inputValue) > 5 && (
                        <div className={styles.warning}>
                            ⚠️ High slippage may result in unfavorable trade
                        </div>
                    )}
                </div>
            )}

            <div className={styles.info}>
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Your transaction will revert if price changes by more than</span>
                    <span className={styles.infoValue}>
                        {mode === 'auto' ? (autoValue?.toFixed(1) || '0.5') : customValue.toFixed(1)}%
                    </span>
                </div>
            </div>
        </div>
    );
}
