import React from 'react';
import { Dialog } from '../Dialog/Dialog';
import styles from './ConfirmationModal.module.css';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'danger' | 'primary';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmVariant = 'primary',
}) => {
    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            showCloseButton={true}
        >
            <div className={styles.contentWrapper}>
                <p className={styles.message}>{message}</p>
                <div className={styles.buttons}>
                    <button type="button" className={styles.cancelBtn} onClick={onClose}>
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className={confirmVariant === 'danger' ? styles.dangerBtn : styles.confirmBtn}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </Dialog>
    );
};

export default ConfirmationModal;
