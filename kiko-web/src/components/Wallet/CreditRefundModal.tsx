import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import type { CreditDepositItem } from '../../services/billingApi';
import styles from './CreditRefundModal.module.css';

interface CreditRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  deposit: CreditDepositItem | null;
  onConfirm: (depositId: string) => Promise<void> | void;
  isSubmitting?: boolean;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function shortenHash(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.length <= 14 ? text : `${text.slice(0, 8)}...${text.slice(-6)}`;
}

export const CreditRefundModal: React.FC<CreditRefundModalProps> = ({
  isOpen,
  onClose,
  deposit,
  onConfirm,
  isSubmitting = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !deposit) return null;

  const handleConfirm = async () => {
    await onConfirm(deposit.id);
  };

  return createPortal(
    <div className={styles.overlay} onClick={() => !isSubmitting && onClose()}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Refund Request</div>
            <h2 className={styles.title}>Reverse this deposit back to the original asset</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose} disabled={isSubmitting} aria-label="Close refund dialog">
            <X size={18} />
          </button>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryBlock}>
            <span className={styles.summaryLabel}>Deposit</span>
            <span className={styles.summaryValue}>{deposit.assetSymbol} {deposit.amountHuman.toFixed(2)}</span>
          </div>
          <div className={styles.summaryBlock}>
            <span className={styles.summaryLabel}>Refundable paid credits</span>
            <span className={styles.summaryValue}>{deposit.refundablePaidCredits.toFixed(2)}</span>
          </div>
          <div className={styles.summaryBlock}>
            <span className={styles.summaryLabel}>Window expires</span>
            <span className={styles.summaryValue}>{formatDate(deposit.refundWindowExpiresAt)}</span>
          </div>
        </div>

        <div className={styles.detailCard}>
          <div className={styles.detailRow}>
            <span>Transaction</span>
            <span>{shortenHash(deposit.txHash)}</span>
          </div>
          <div className={styles.detailRow}>
            <span>Status</span>
            <span>{deposit.status}</span>
          </div>
          <div className={styles.detailRow}>
            <span>Paid credits</span>
            <span>{deposit.paidCredits.toFixed(2)}</span>
          </div>
          <div className={styles.detailRow}>
            <span>Bonus credits</span>
            <span>{deposit.bonusCredits.toFixed(2)}</span>
          </div>
        </div>

        <div className={styles.warningPanel}>
          <div className={styles.warningTitle}>
            <AlertTriangle size={16} />
            Refund rules
          </div>
          <div className={styles.warningList}>
            <div>Only one refund request is allowed per deposit, within 24 hours.</div>
            <div>Refund goes back in the same asset and only covers unused paid credits.</div>
            <div>KIKO refunds reclaim the related bonus credits proportionally.</div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.secondaryButton} onClick={onClose} disabled={isSubmitting}>
            Keep Deposit
          </button>
          <button className={styles.primaryButton} onClick={handleConfirm} disabled={isSubmitting}>
            <RotateCcw size={16} />
            {isSubmitting ? 'Submitting...' : 'Request Refund'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CreditRefundModal;
