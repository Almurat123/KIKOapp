
import React, { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Dialog } from '../Dialog/Dialog';
import { CustomSelect } from './CustomSelect';
import { getUserSettings, saveUserSettings } from '../../services/userSettingsApi';
import { logger } from '../../utils/logger';
import clsx from 'clsx';
import styles from './CustomAISettingsModal.module.css';

export interface CustomAISettings {

    // User Role removed

    // Swap fields
    defaultSwapAmount: number;
    defaultSwapUnit: string;
    checkTokenBeforeSwap: boolean;
    showQuoteBeforeSwap: boolean;

    swapMethod: string;
    // Swap Protection fields
    slippageMode: 'auto' | 'custom';
    customSlippage: number | '';
    mevProtection: boolean;
    priceDeviationCheck: boolean;

    // Fast Swap
    fastSwapMode: boolean;
}

interface CustomAISettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DEFAULT_SETTINGS: CustomAISettings = {
    // userRole removed
    defaultSwapAmount: 100,
    defaultSwapUnit: 'native',
    checkTokenBeforeSwap: true,
    showQuoteBeforeSwap: true,

    swapMethod: 'allowance_trade',
    // Swap Protection defaults
    slippageMode: 'auto',
    customSlippage: 0.5,
    mevProtection: true,
    priceDeviationCheck: true,

    fastSwapMode: false,
};

// USER_ROLE_OPTIONS removed

const SWAP_UNIT_OPTIONS = [
    { value: 'native', label: 'Native Token' },
    { value: 'usdc', label: 'USDC' },
    { value: 'usdt', label: 'USDT' },
];

const SLIPPAGE_MODE_OPTIONS = [
    { value: 'auto', label: 'Auto (Dynamic)' },
    { value: 'custom', label: 'Custom' },
];



export const CustomAISettingsModal: React.FC<CustomAISettingsModalProps> = ({
    isOpen,
    onClose
}) => {
    const { getAccessToken, authenticated } = usePrivy();
    const [settings, setSettings] = useState<CustomAISettings>(DEFAULT_SETTINGS);
    const settingsRef = useRef(settings); // Keep track of latest settings for sync access

    // Update ref whenever settings change
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    const saveSettingsToApi = async (currentSettings: CustomAISettings) => {
        try {
            // Persist to localStorage immediately
            localStorage.setItem('kiko-custom-ai-settings', JSON.stringify(currentSettings));
            // Notify other components
            window.dispatchEvent(new CustomEvent('kiko-custom-ai-changed', { detail: currentSettings }));

            if (authenticated) {
                const token = await getAccessToken();
                if (token) {
                    await saveUserSettings(token, {
                        ...currentSettings,
                    });
                }
            }
            logger.log('Settings saved successfully');
        } catch (e) {
            logger.error('Failed to save settings:', e);
        }
    };

    // Wrapper for onClose to ensure save happens on explicit close
    const handleClose = () => {
        saveSettingsToApi(settingsRef.current);
        onClose();
    };

    // Load settings from API on mount
    useEffect(() => {
        if (isOpen && authenticated) {
            const loadSettings = async () => {
                try {
                    const token = await getAccessToken();
                    if (token) {
                        const savedSettings = await getUserSettings(token);
                        if (savedSettings) {
                            setSettings({ ...DEFAULT_SETTINGS, ...savedSettings } as CustomAISettings);
                        }
                    }
                } catch (e) {
                    logger.warn('Failed to load custom AI settings:', e);
                    // Fallback to localStorage for backwards compatibility
                    try {
                        const saved = localStorage.getItem('kiko-custom-ai-settings');
                        if (saved) {
                            setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
                        }
                    } catch { /* ignore */ }
                }
            };
            loadSettings();
        } else if (isOpen) {
            // Not authenticated, use localStorage
            try {
                const saved = localStorage.getItem('kiko-custom-ai-settings');
                if (saved) {
                    setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
                }
            } catch (e) {
                logger.warn('Failed to load custom AI settings:', e);
            }
        }
    }, [isOpen, authenticated, getAccessToken]);

    // Auto-save logic (Debounced for inputs)
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            saveSettingsToApi(settings);
        }, 800);
        return () => clearTimeout(timer);
    }, [settings, isOpen]);

    // Final save on unmount/close (backup)
    useEffect(() => {
        return () => {
            if (isOpen) {
                // Only necessary if component unmounts without handleClose
                // We just dump to localStorage to be safe
                localStorage.setItem('kiko-custom-ai-settings', JSON.stringify(settingsRef.current));
            }
        };
    }, []);

    const toggleFastSwapMode = () => {
        setSettings(prev => ({ ...prev, fastSwapMode: !prev.fastSwapMode }));
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={handleClose}
            title="Custom Reply"
            size="md"
            showCloseButton={false}
        >
            <div className={styles.container}>
                {/* User Role Section Removed */}

                {/* Fast Swap Section */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>Fast Swap Mode</div>
                    <div className={styles.headerRow}>
                        <div className={styles.headerTitle}>
                            Enable Fast Execution
                        </div>
                        <label className={styles.toggleSwitch}>
                            <input
                                type="checkbox"
                                checked={settings.fastSwapMode}
                                onChange={toggleFastSwapMode}
                            />
                            <span className={styles.slider}></span>
                        </label>
                    </div>
                    <p className={styles.headerDesc}>
                        High-speed transaction execution bypassing manual confirmations.
                    </p>
                </div>

                {/* Trading Preferences Section */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>Trading Preferences</div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Default Swap Amount</label>
                        <div className={styles.amountRow}>
                            <input
                                type="number"
                                className={styles.input}
                                placeholder="100"
                                value={settings.defaultSwapAmount}
                                onChange={e => {
                                    const val = e.target.value;
                                    setSettings(prev => ({
                                        ...prev,
                                        defaultSwapAmount: val === '' ? 0 : Number(val)
                                    }));
                                }}
                            />
                            <div className={styles.unitSelect}>
                                <CustomSelect
                                    value={settings.defaultSwapUnit || 'native'}
                                    onChange={val => setSettings(prev => ({ ...prev, defaultSwapUnit: val }))}
                                    options={SWAP_UNIT_OPTIONS}
                                />
                            </div>
                        </div>
                    </div>



                    <div className={styles.headerRow}>
                        <div className={styles.headerTitle}>Check token security before swap</div>
                        <label className={styles.toggleSwitch}>
                            <input
                                type="checkbox"
                                checked={settings.checkTokenBeforeSwap}
                                onChange={e => setSettings(prev => ({ ...prev, checkTokenBeforeSwap: e.target.checked }))}
                            />
                            <span className={styles.slider}></span>
                        </label>
                    </div>
                    <p className={clsx(styles.headerDesc, styles.headerDescWithMargin)}>
                        Let AI check token risk before swap
                    </p>

                    <div className={styles.headerRow}>
                        <div className={clsx(styles.headerTitle, settings.fastSwapMode && styles.disabledText)}>
                            Show quote before swap
                        </div>
                        <label className={clsx(styles.toggleSwitch, settings.fastSwapMode && styles.disabledToggle)}>
                            <input
                                type="checkbox"
                                checked={settings.showQuoteBeforeSwap && !settings.fastSwapMode}
                                onChange={e => setSettings(prev => ({ ...prev, showQuoteBeforeSwap: e.target.checked }))}
                                disabled={settings.fastSwapMode}
                            />
                            <span className={styles.slider}></span>
                        </label>
                    </div>
                    <p className={clsx(styles.headerDesc, styles.headerDescWithMargin)}>
                        Show estimated output price and ask for confirmation before trading (Disabled when Fast Swap is ON)
                    </p>




                </div>

                {/* Swap Protection Section */}
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>Swap Protection</div>

                    {/* Slippage */}
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Slippage Tolerance</label>
                        <CustomSelect
                            value={settings.slippageMode}
                            onChange={val => setSettings(prev => ({ ...prev, slippageMode: val as 'auto' | 'custom' }))}
                            options={SLIPPAGE_MODE_OPTIONS}
                        />
                        {settings.slippageMode === 'custom' && (
                            <div className={styles.slippageInputRow}>
                                <input
                                    type="number"
                                    className={clsx(styles.input, styles.slippageInput)}
                                    placeholder="0.5"
                                    step="0.1"
                                    min="0.1"
                                    max="50"
                                    value={settings.customSlippage}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setSettings(prev => ({
                                            ...prev,
                                            customSlippage: val === '' ? '' : Number(val)
                                        }));
                                    }}
                                />
                                <span className={styles.slippagePercent}>%</span>
                            </div>
                        )}
                        <p className={clsx(styles.headerDesc, styles.headerDescWithTopMargin)}>
                            {settings.slippageMode === 'auto'
                                ? 'Auto-adjusts based on liquidity, volatility, and trade size (0.1% - 5%)'
                                : `Custom slippage: ${settings.customSlippage}%`
                            }
                        </p>
                    </div>

                    {/* MEV Protection */}
                    <div className={clsx(styles.headerRow, styles.headerRowWithMargin)}>
                        <div className={styles.headerTitle}>MEV Protection</div>
                        <label className={styles.toggleSwitch}>
                            <input
                                type="checkbox"
                                checked={settings.mevProtection}
                                onChange={e => setSettings(prev => ({ ...prev, mevProtection: e.target.checked }))}
                            />
                            <span className={styles.slider}></span>
                        </label>
                    </div>
                    <p className={styles.headerDesc}>
                        Protect transactions from front-running (up to 90% MEV rebate on Ethereum)
                    </p>

                    {/* Price Deviation Check */}
                    <div className={clsx(styles.headerRow, styles.headerRowWithMargin)}>
                        <div className={styles.headerTitle}>Price Deviation Check</div>
                        <label className={styles.toggleSwitch}>
                            <input
                                type="checkbox"
                                checked={settings.priceDeviationCheck}
                                onChange={e => setSettings(prev => ({ ...prev, priceDeviationCheck: e.target.checked }))}
                            />
                            <span className={styles.slider}></span>
                        </label>
                    </div>
                    <p className={styles.headerDesc}>
                        Block trades with &gt;50% price deviation from DEX Screener / GeckoTerminal
                    </p>
                </div>


                {/* Action Buttons Removed - Auto-save enabled */}

            </div>
        </Dialog>
    );
};
