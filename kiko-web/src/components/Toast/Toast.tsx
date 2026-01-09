import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastProps {
    toast: ToastMessage;
    onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(toast.id);
        }, toast.duration || 3000);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onClose]);

    const icons: Record<ToastType, string> = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    return (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
            <span className={styles.icon}>{icons[toast.type]}</span>
            <span className={styles.message}>{toast.message}</span>
            <button className={styles.closeBtn} onClick={() => onClose(toast.id)}>
                ✕
            </button>
        </div>
    );
};

// Toast Container - renders all toasts
interface ToastContainerProps {
    toasts: ToastMessage[];
    onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
    if (toasts.length === 0) return null;

    return createPortal(
        <div className={styles.container}>
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onClose={onClose} />
            ))}
        </div>,
        document.body
    );
};

// Hook for managing toasts
let toastCounter = 0;
const toastListeners: Set<(toasts: ToastMessage[]) => void> = new Set();
let currentToasts: ToastMessage[] = [];

const notifyListeners = () => {
    toastListeners.forEach(listener => listener([...currentToasts]));
};

export const toast = {
    show: (type: ToastType, message: string, duration = 3000) => {
        const id = `toast-${++toastCounter}`;
        const newToast: ToastMessage = { id, type, message, duration };
        currentToasts = [...currentToasts, newToast];
        notifyListeners();
        return id;
    },
    success: (message: string, duration?: number) => toast.show('success', message, duration),
    error: (message: string, duration?: number) => toast.show('error', message, duration),
    warning: (message: string, duration?: number) => toast.show('warning', message, duration),
    info: (message: string, duration?: number) => toast.show('info', message, duration),
    dismiss: (id: string) => {
        currentToasts = currentToasts.filter(t => t.id !== id);
        notifyListeners();
    }
};

export const useToast = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>(currentToasts);

    useEffect(() => {
        toastListeners.add(setToasts);
        return () => {
            toastListeners.delete(setToasts);
        };
    }, []);

    const handleClose = useCallback((id: string) => {
        toast.dismiss(id);
    }, []);

    return { toasts, handleClose };
};

export default Toast;
