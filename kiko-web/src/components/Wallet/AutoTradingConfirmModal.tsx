/**
 * AutoTradingConfirmModal
 *
 * Shown before granting auto-trading authorization. User must confirm in English
 * that they have read the service agreement and understand the risks.
 */

import React, { useState, useEffect } from 'react';
import styles from './AutoTradingConfirmModal.module.css';

export interface AutoTradingConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional: show loading state on confirm button (e.g. while addSessionSigners runs) */
  confirming?: boolean;
}

const CONFIRM_LABEL =
  'I have read the service agreement and understand the risks of auto-trading.';

export const AutoTradingConfirmModal: React.FC<AutoTradingConfirmModalProps> = ({
  open,
  onConfirm,
  onCancel,
  confirming = false,
}) => {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!open) setChecked(false);
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!checked || confirming) return;
    onConfirm();
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>Confirm Auto-Trading Authorization</h2>
        <p className={styles.description}>
          Before enabling auto-trading, you must confirm that you have read our
          service agreement and understand the risks of allowing the server to
          execute trades on your behalf.
        </p>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            className={styles.checkbox}
            aria-label={CONFIRM_LABEL}
          />
          <span className={styles.checkboxText}>{CONFIRM_LABEL}</span>
        </label>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={confirming}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={handleConfirm}
            disabled={!checked || confirming}
          >
            {confirming ? 'Authorizing...' : 'I Confirm, Authorize'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoTradingConfirmModal;
