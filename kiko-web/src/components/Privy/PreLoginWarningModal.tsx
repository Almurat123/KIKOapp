import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
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
                    <h2 className={styles.title}>AI Security & Risk Notice</h2>
                    <p className={styles.message}>
                        <br ></br   >
                        KIKO uses advanced AI to assist with your trading.
                        <br />
                        Please understand the following risks before connecting your wallet
                        <br />
                        <br />
                        1.AI-generated data may contain inaccuracies; manually verify all transaction details.
                        <br />
                        <br />
                        2.You are responsible for all trades; KIKO is not liable for losses caused by AI errors.
                        <br />
                        <br />
                        3.Trading involves significant risk; proceed with extreme caution when using AI tools.
                        <br />
                    </p>
                </div>

                <label className={styles.checkboxContainer}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={isChecked}
                        onChange={(e) => setIsChecked(e.target.checked)}
                    />
                    <span className={styles.checkboxLabel}>
                        I have read and acknowledged the warning notices and understand the risks involved. By continuing, you agree to our <a href="#" target="_blank" rel="noopener noreferrer" className={styles.link} onClick={(e) => e.stopPropagation()}>Terms of Service</a> and <a href="#" target="_blank" rel="noopener noreferrer" className={styles.link} onClick={(e) => e.stopPropagation()}>Privacy Policy</a>.
                    </span>
                </label>

                <div className={styles.actions}>
                    <button
                        className={`${styles.button} ${styles.confirmButton}`}
                        disabled={!isChecked}
                        onClick={onConfirm}
                    >
                        Continue to Login
                    </button>
                    <button className={`${styles.button} ${styles.cancelButton}`} onClick={onCancel}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};
