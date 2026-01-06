import React, { useState } from 'react';
import styles from './PreLoginWarningModal.module.css';

interface PreLoginWarningModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const PreLoginWarningModal: React.FC<PreLoginWarningModalProps> = ({
    isOpen,
    onConfirm,
    onCancel,
}) => {
    const [isChecked, setIsChecked] = useState(false);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <span className={styles.warningIcon}>⚠️</span>
                    <h2 className={styles.title}>Important Security Notice</h2>
                    <p className={styles.message}>
                        Before you proceed with wallet connection, please carefully read the following security warnings.
                    </p>
                </div>

                <div className={styles.warningBox}>
                    <ul className={styles.warningList}>
                        <li>Always double-check the URL and transaction details.</li>
                        <li>DYOR (Do Your Own Research) before trading or interacting with any contracts.</li>
                        <li>We are not responsible for any funds lost due to negligence or compromise.</li>
                    </ul>
                </div>

                <label className={styles.checkboxContainer}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={isChecked}
                        onChange={(e) => setIsChecked(e.target.checked)}
                    />
                    <span className={styles.checkboxLabel}>
                        I have read and acknowledged the warning notices and understand the risks involved.
                    </span>
                </label>

                <div className={styles.actions}>
                    <button className={`${styles.button} ${styles.cancelButton}`} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        className={`${styles.button} ${styles.confirmButton}`}
                        disabled={!isChecked}
                        onClick={onConfirm}
                    >
                        Continue to Login
                    </button>
                </div>
            </div>
        </div>
    );
};
