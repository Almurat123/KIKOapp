import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import styles from './ReceiveModal.module.css';

interface ReceiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    walletAddress?: string;
    chainName?: string;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({
    isOpen,
    onClose,
    walletAddress = '',
    chainName = 'Ethereum'
}) => {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (copied) {
            const timer = setTimeout(() => setCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [copied]);

    // Handle body scroll lock and ESC key
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            
            const handleEscape = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            };
            
            document.addEventListener('keydown', handleEscape);
            return () => {
                document.body.style.overflow = '';
                document.removeEventListener('keydown', handleEscape);
            };
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(walletAddress);
        setCopied(true);
    };

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Receive Assets</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    <p className={styles.description}>
                        Scan this QR code or copy the address below to receive tokens on <strong>{chainName}</strong>.
                    </p>

                    <div className={styles.qrContainer}>
                        <QRCodeSVG
                            value={walletAddress}
                            size={180}
                            className={styles.qrCode}
                            bgColor="#ffffff"
                            fgColor="#000000"
                        />
                    </div>

                    <div className={styles.addressContainer}>
                        <span className={styles.label}>Wallet Address</span>
                        <div className={styles.addressBox} onClick={handleCopy}>
                            <code className={styles.address}>{walletAddress}</code>
                            <button className={styles.copyButton}>
                                {copied ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className={styles.warning}>
                        Only send {chainName} network assets to this address. Sending other assets may result in permanent loss.
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
