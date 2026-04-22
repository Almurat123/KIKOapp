import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { History, X } from 'lucide-react';
import type { CreditRefundItem } from '../../services/billingApi';
import styles from './CreditRefundHistoryModal.module.css';

interface CreditRefundHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  refunds: CreditRefundItem[];
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function shortenHash(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.length <= 16 ? text : `${text.slice(0, 8)}...${text.slice(-6)}`;
}

export const CreditRefundHistoryModal: React.FC<CreditRefundHistoryModalProps> = ({
  isOpen,
  onClose,
  refunds,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Refund History</div>
            <h2 className={styles.title}>All refund requests tied to your deposits</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close refund history dialog">
            <X size={18} />
          </button>
        </div>

        <div className={styles.list}>
          {refunds.length === 0 ? (
            <div className={styles.emptyState}>
              <History size={18} />
              No refund requests yet.
            </div>
          ) : refunds.map((refund) => (
            <div key={refund.id} className={styles.row}>
              <div className={styles.rowBody}>
                <div className={styles.rowTitle}>
                  {refund.assetSymbol} refund {refund.refundAmountHuman.toFixed(2)}
                </div>
                <div className={styles.rowMeta}>
                  requested {formatDate(refund.requestedAt)} · status {refund.status}
                </div>
                <div className={styles.rowMeta}>
                  paid {refund.requestedPaidCredits.toFixed(2)} · reclaimed bonus {refund.reclaimedBonusCredits.toFixed(2)}
                </div>
                <div className={styles.rowMeta}>
                  payout tx {shortenHash(refund.payoutTxHash)}
                </div>
              </div>
              <div className={styles.statusBadge}>{refund.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CreditRefundHistoryModal;
