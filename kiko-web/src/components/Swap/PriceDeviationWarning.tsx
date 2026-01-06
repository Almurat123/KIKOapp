/**
 * Price Deviation Warning Component
 * Shows warning when swap price deviates significantly from market
 */

import styles from './PriceDeviationWarning.module.css';
import type { PriceValidationResult } from '@/services/priceValidation';

interface PriceDeviationWarningProps {
    validation: PriceValidationResult;
    onProceed?: () => void;
    onCancel?: () => void;
}

export function PriceDeviationWarning({
    validation,
    onProceed,
    onCancel,
}: PriceDeviationWarningProps) {
    const { deviation, recommendation, swapPrice, averageExternalPrice, externalPrices } = validation;

    // Don't show if safe
    if (recommendation === 'safe') {
        return null;
    }

    const isBlocked = recommendation === 'blocked';

    return (
        <div className={`${styles.container} ${isBlocked ? styles.blocked : styles.warning}`}>
            <div className={styles.header}>
                <span className={styles.icon}>
                    {isBlocked ? '⛔' : '⚠️'}
                </span>
                <div className={styles.title}>
                    {isBlocked ? 'Trade Blocked' : 'Price Warning'}
                </div>
            </div>

            <div className={styles.content}>
                <div className={styles.deviationBox}>
                    <div className={styles.deviationLabel}>Price Deviation</div>
                    <div className={styles.deviationValue}>
                        {deviation.toFixed(1)}%
                    </div>
                </div>

                <div className={styles.priceComparison}>
                    <div className={styles.priceRow}>
                        <span className={styles.priceLabel}>Swap Quote:</span>
                        <span className={styles.priceValue}>${swapPrice.toFixed(6)}</span>
                    </div>
                    <div className={styles.priceRow}>
                        <span className={styles.priceLabel}>Market Average:</span>
                        <span className={styles.priceValue}>${averageExternalPrice.toFixed(6)}</span>
                    </div>
                </div>

                {externalPrices.length > 0 && (
                    <div className={styles.sources}>
                        <div className={styles.sourcesTitle}>Price Sources:</div>
                        {externalPrices.map((source, index) => (
                            <div key={index} className={styles.source}>
                                <span className={styles.sourceName}>{source.name}</span>
                                <span className={styles.sourcePrice}>${source.price.toFixed(6)}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className={styles.message}>
                    {isBlocked ? (
                        <>
                            <p>
                                This trade has been blocked because the price deviation exceeds 50%.
                                This could indicate:
                            </p>
                            <ul>
                                <li>Low liquidity pool</li>
                                <li>Price manipulation</li>
                                <li>Incorrect token pair</li>
                                <li>Market volatility</li>
                            </ul>
                            <p className={styles.recommendation}>
                                <strong>Recommendation:</strong> Do not proceed with this trade.
                            </p>
                        </>
                    ) : (
                        <>
                            <p>
                                The swap price differs significantly from market prices.
                                Please review carefully before proceeding.
                            </p>
                            <p className={styles.recommendation}>
                                <strong>Recommendation:</strong> Consider waiting or using a different DEX.
                            </p>
                        </>
                    )}
                </div>
            </div>

            <div className={styles.actions}>
                {!isBlocked && onProceed && (
                    <button className={styles.proceedButton} onClick={onProceed}>
                        Proceed Anyway
                    </button>
                )}
                {onCancel && (
                    <button className={styles.cancelButton} onClick={onCancel}>
                        {isBlocked ? 'Close' : 'Cancel Trade'}
                    </button>
                )}
            </div>
        </div>
    );
}
