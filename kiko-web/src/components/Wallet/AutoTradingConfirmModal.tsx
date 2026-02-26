/**
 * AutoTradingConfirmModal
 *
 * Shown before granting auto-trading authorization.
 * Styled to match the AuthorizationPromptModal risk disclosure design.
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import styles from './AuthorizationPromptModal.module.css';

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
        <div className={styles.iconWrapper}>
          <ShieldCheck size={40} className={styles.icon} />
        </div>

        <h2 className={styles.title}>Enable Auto-Trading</h2>

        <p className={styles.description}>
          To use <strong>Copy Trade</strong> and <strong>Auto-Trade</strong> features,
          please authorize our server to execute trades on your behalf.
        </p>

        <div className={styles.securityNote}>
          <AlertTriangle size={16} />
          <span>Your private keys remain secure. Only trading operations are authorized.</span>
        </div>

        <label className={styles.checkboxLabel} style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color, rgba(255,255,255,0.1))', borderRadius: 12, marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            style={{ flexShrink: 0, width: 18, height: 18, marginTop: 2, accentColor: '#10b981', cursor: 'pointer' }}
            aria-label={CONFIRM_LABEL}
          />
          <span style={{ fontSize: 14, color: 'var(--text-secondary, #ccc)', lineHeight: 1.45 }}>
            {CONFIRM_LABEL} By continuing, you agree to our{' '}
            <a
              href="https://docs.kikoapp.app/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: '#10b981', textDecoration: 'underline' }}
            >
              Terms of Service
            </a>
            {' '}and{' '}
            <a
              href="https://docs.kikoapp.app/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: '#10b981', textDecoration: 'underline' }}
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.authorizeButton}
            onClick={handleConfirm}
            disabled={!checked || confirming}
          >
            {confirming ? (
              <><Loader2 size={18} className={styles.spinner} /> Authorizing...</>
            ) : (
              'I Confirm, Authorize'
            )}
          </button>
          <button
            type="button"
            className={styles.skipButton}
            onClick={onCancel}
            disabled={confirming}
          >
            Cancel
          </button>
        </div>

        <p className={styles.footer}>You can always change this in Wallet Settings</p>
      </div>
    </div>
  );
};

export default AutoTradingConfirmModal;
