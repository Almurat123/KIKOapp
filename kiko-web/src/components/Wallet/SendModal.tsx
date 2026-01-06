import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, Wallet, AlertCircle, Loader2 } from 'lucide-react';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, isAddress } from 'viem';
import styles from './SendModal.module.css';

interface SendModalProps {
    isOpen: boolean;
    onClose: () => void;
    walletAddress?: string; // Senders address (optional context)
    chainId?: number;
    tokenAddress?: string; // If pre-selected
    tokenSymbol?: string;
    tokenDecimals?: number;
    tokenBalance?: string;
    isNative?: boolean;
    isSolana?: boolean;
}

export const SendModal: React.FC<SendModalProps> = ({
    isOpen,
    onClose,
    tokenSymbol = 'ETH',
    tokenBalance = '0.00',
    isNative = true,
    isSolana = false
}) => {
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'input' | 'confirm' | 'processing' | 'success'>('input');
    const [txHash, setTxHash] = useState<string | null>(null);

    const { sendTransaction, isPending: isSending, error: sendError, data: hash } = useSendTransaction();

    // For EVM confirmation
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash: hash,
    });

    useEffect(() => {
        if (hash) {
            setTxHash(hash);
            setStep('processing');
        }
    }, [hash]);

    useEffect(() => {
        if (isConfirmed) {
            setStep('success');
        }
    }, [isConfirmed]);

    useEffect(() => {
        if (sendError) {
            setError(sendError.message.split('\n')[0]); // Simple error message
            setStep('input');
        }
    }, [sendError]);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setRecipient('');
            setAmount('');
            setError(null);
            setStep('input');
            setTxHash(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleNext = () => {
        setError(null);

        // Validation
        if (!recipient) {
            setError('Please enter a recipient address');
            return;
        }
        if (!isSolana && !isAddress(recipient)) {
            setError('Invalid wallet address');
            return;
        }
        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }
        if (parseFloat(amount) > parseFloat(tokenBalance)) {
            setError('Insufficient balance');
            return;
        }

        setStep('confirm');
    };

    const handleSend = () => {
        if (isSolana) {
            // Solana sending implementation would go here (requires Solana implementation)
            setError('Solana sending is not yet implemented in this demo');
            return;
        }

        if (isNative) {
            try {
                sendTransaction({
                    to: recipient as `0x${string}`,
                    value: parseEther(amount)
                });
            } catch (err: any) {
                setError(err.message);
            }
        } else {
            // ERC20 sending implementation would go here (requires valid ABI/contract write)
            setError('Token sending is not yet fully implemented');
        }
    };

    const handleClose = () => {
        onClose();
    };

    return createPortal(
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Send {tokenSymbol}</h2>
                    <button className={styles.closeButton} onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    {step === 'input' && (
                        <>
                            <div className={styles.inputGroup}>
                                <label>Recipient Address</label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="text"
                                        placeholder="0x..."
                                        value={recipient}
                                        onChange={(e) => setRecipient(e.target.value)}
                                        className={styles.input}
                                    />
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Amount</label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className={styles.input}
                                    />
                                    <span className={styles.tokenSuffix}>{tokenSymbol}</span>
                                </div>
                                <div className={styles.balanceHint}>
                                    Available: {tokenBalance} {tokenSymbol}
                                    <button
                                        className={styles.maxButton}
                                        onClick={() => setAmount(tokenBalance)}
                                    >
                                        MAX
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className={styles.errorMessage}>
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button className={styles.primaryButton} onClick={handleNext}>
                                Review
                                <ArrowRight size={18} />
                            </button>
                        </>
                    )}

                    {step === 'confirm' && (
                        <div className={styles.confirmState}>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryRow}>
                                    <span>Sending</span>
                                    <span className={styles.amountValue}>{amount} {tokenSymbol}</span>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span>To</span>
                                    <span className={styles.addressValue}>
                                        {recipient.slice(0, 6)}...{recipient.slice(-4)}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.warningBox}>
                                This transaction cannot be undone. Please verify the address.
                            </div>

                            <div className={styles.buttonRow}>
                                <button className={styles.secondaryButton} onClick={() => setStep('input')}>
                                    Back
                                </button>
                                <button
                                    className={styles.primaryButton}
                                    onClick={handleSend}
                                    disabled={isSending}
                                >
                                    {isSending ? <Loader2 className={styles.spin} size={18} /> : 'Confirm Send'}
                                </button>
                            </div>
                        </div>
                    )}

                    {(step === 'processing' || step === 'success') && (
                        <div className={styles.statusState}>
                            {step === 'processing' ? (
                                <Loader2 className={styles.statusIconRaw} size={48} />
                            ) : (
                                <div className={styles.successIcon}>✓</div>
                            )}
                            <h3>
                                {step === 'processing' ? 'Transaction Submitted' : 'Sent Successfully!'}
                            </h3>
                            <p>
                                {step === 'processing'
                                    ? 'Waiting for network confirmation...'
                                    : `You successfully sent ${amount} ${tokenSymbol}`}
                            </p>

                            {txHash && (
                                <a
                                    href={`https://etherscan.io/tx/${txHash}`} // Naive explorer link
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.explorerLink}
                                >
                                    View on Explorer
                                </a>
                            )}

                            {step === 'success' && (
                                <button className={styles.primaryButton} onClick={handleClose}>
                                    Done
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
