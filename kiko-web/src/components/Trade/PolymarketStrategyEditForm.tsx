import React, { useEffect, useRef, useState } from 'react';
import type { PolymarketCopyConfig } from '../../services/polymarketCopyApi';
import styles from './StrategyEditForm.module.css';
import clsx from 'clsx';
import { agentAttrs } from '../../agent/attrs';

interface PolymarketStrategyEditFormProps {
    config: PolymarketCopyConfig;
    onSave: (updates: Partial<PolymarketCopyConfig>) => Promise<void>;
    onCancel: () => void;
}

export const PolymarketStrategyEditForm: React.FC<PolymarketStrategyEditFormProps> = ({ config, onSave, onCancel: _onCancel }) => {
    const [formData, setFormData] = useState<Partial<PolymarketCopyConfig>>({
        betSizeUsd: config.betSizeUsd,
        maxOpenBets: config.maxOpenBets,
        mirrorSell: config.mirrorSell,
    });
    const [isReady, setIsReady] = useState(false);
    const formDataRef = useRef(formData);
    const hasChangedRef = useRef(false);

    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 50);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        return () => {
            if (hasChangedRef.current) {
                void onSave(formDataRef.current).catch(() => {
                    // Save errors are surfaced by the strategy hook; avoid unhandled rejections on unmount.
                });
            }
        };
    }, [onSave]);

    const updateFormData = (updates: Partial<PolymarketCopyConfig>) => {
        setFormData((prev) => ({ ...prev, ...updates }));
        hasChangedRef.current = true;
    };

    const handlePositiveNumber = (value: string, field: 'betSizeUsd' | 'maxOpenBets') => {
        const normalized = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
        if (normalized === '') {
            return;
        }
        const parsed = field === 'maxOpenBets' ? Math.floor(Number(normalized)) : Number(normalized);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return;
        }
        updateFormData({ [field]: parsed } as Partial<PolymarketCopyConfig>);
    };

    return (
        <div className={clsx(styles.container, isReady && styles.ready)} {...agentAttrs({ id: 'trade.polymarket.edit.dialog', role: 'dialog', page: 'trade' })}>
            <div className={styles.section}>
                <div className={styles.inputGroup}>
                    <label className={styles.label}>Target Wallet Address</label>
                    <input
                        type="text"
                        value={config.targetWallet}
                        className={styles.input}
                        disabled
                    />
                    <p className={styles.headerDesc}>This Polymarket trader is being monitored for new positions.</p>
                </div>
            </div>

            <div className={styles.section}>
                <div className={styles.inputGroup}>
                    <label className={styles.label}>Bet Size (USD)</label>
                    <input
                        type="text"
                        value={formData.betSizeUsd ?? ''}
                        onChange={(e) => handlePositiveNumber(e.target.value, 'betSizeUsd')}
                        className={styles.input}
                    />
                    <p className={styles.headerDesc}>Amount to mirror on each copied Polymarket position.</p>
                </div>

                <div className={styles.inputGroup}>
                    <label className={styles.label}>Max Open Bets</label>
                    <input
                        type="text"
                        value={formData.maxOpenBets ?? ''}
                        onChange={(e) => handlePositiveNumber(e.target.value, 'maxOpenBets')}
                        className={styles.input}
                    />
                    <p className={styles.headerDesc}>Maximum simultaneous copied positions allowed for this strategy.</p>
                </div>

                <div className={styles.inputGroup}>
                    <label className={styles.label}>Mirror Sell</label>
                    <label className={styles.toggleSwitch}>
                        <input
                            type="checkbox"
                            checked={Boolean(formData.mirrorSell)}
                            onChange={() => updateFormData({ mirrorSell: !formData.mirrorSell })}
                        />
                        <span className={styles.slider} />
                    </label>
                </div>
                <p className={styles.headerDesc}>When enabled, copied positions are also closed when the target trader exits.</p>
            </div>

        </div>
    );
};
