import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock3, RotateCcw, X } from 'lucide-react';
import type { CreditDepositItem } from '../../services/billingApi';
import styles from './CreditDepositHistoryModal.module.css';

interface CreditDepositHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  deposits: CreditDepositItem[];
  loading?: boolean;
  onRefund: (deposit: CreditDepositItem) => void;
  eyebrow?: string;
  title?: string;
  emptyMessage?: string;
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

export const CreditDepositHistoryModal: React.FC<CreditDepositHistoryModalProps> = ({
  isOpen,
  onClose,
  deposits,
  loading = false,
  onRefund,
  eyebrow = 'Deposit History',
  title = 'Every treasury deposit that mints credits',
  emptyMessage = 'No credit deposits yet.',
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
            <div className={styles.eyebrow}>{eyebrow}</div>
            <h2 className={styles.title}>{title}</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close deposit history dialog">
            <X size={18} />
          </button>
        </div>

        <div className={styles.list}>
          {loading && deposits.length === 0 ? (
            <div className={styles.emptyState}>Loading deposits...</div>
          ) : deposits.length === 0 ? (
            <div className={styles.emptyState}>{emptyMessage}</div>
          ) : deposits.map((deposit) => (
            <div key={deposit.id} className={styles.row}>
              <div className={styles.rowBody}>
                <div className={styles.rowTitle}>
                  {deposit.assetSymbol} {deposit.amountHuman.toFixed(2)}
                </div>
                <div className={styles.rowMeta}>
                  {shortenHash(deposit.txHash)} · {deposit.status}
                </div>
                <div className={styles.rowMeta}>
                  paid {deposit.paidCredits.toFixed(2)} · bonus {deposit.bonusCredits.toFixed(2)} · refundable {deposit.refundablePaidCredits.toFixed(2)}
                </div>
                <div className={styles.rowMeta}>
                  <Clock3 size={13} />
                  refund window {formatDate(deposit.refundWindowExpiresAt)}
                </div>
              </div>
              <div className={styles.actions}>
                {deposit.refundEligible ? (
                  <button className={styles.primaryButton} onClick={() => onRefund(deposit)}>
                    <RotateCcw size={15} />
                    Refund
                  </button>
                ) : (
                  <span className={styles.statusBadge}>{deposit.refundRequestStatus || 'locked'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CreditDepositHistoryModal;
