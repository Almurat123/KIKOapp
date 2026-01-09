import React from 'react';
import { createPortal } from 'react-dom';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'info',
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    const icons: Record<string, string> = {
        danger: '⚠️',
        warning: '⚡',
        info: '💡'
    };

    return createPortal(
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                <div className={styles.icon}>{icons[type]}</div>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.message}>{message}</p>
                <div className={styles.actions}>
                    <button
                        className={styles.cancelBtn}
                        onClick={onCancel}
                    >
                        {cancelText}
                    </button>
                    <button
                        className={`${styles.confirmBtn} ${styles[type]}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmDialog;
