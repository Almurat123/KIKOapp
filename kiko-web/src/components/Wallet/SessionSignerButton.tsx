import React, { useState, useEffect } from 'react';
import { usePrivy, useSessionSigners } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import styles from './SessionSignerButton.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface SessionSignerButtonProps {
    chainType: 'ethereum' | 'solana';
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

/**
 * SessionSignerButton - 允许用户授权服务器代签交易
 * 
 * 用于 Copy Trading 等需要后端自动签名的场景
 */
export const SessionSignerButton: React.FC<SessionSignerButtonProps> = ({
    chainType,
    onSuccess,
    onError
}) => {
    const { ready, authenticated, user } = usePrivy();
    const { addSessionSigners, removeSessionSigners } = useSessionSigners();
    const [isLoading, setIsLoading] = useState(false);
    const [isDelegated, setIsDelegated] = useState(false);
    const [authKeyId, setAuthKeyId] = useState<string | null>(null);
    const [showWarning, setShowWarning] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    // 获取用户的嵌入式钱包
    const embeddedWallet = user?.linkedAccounts?.find(
        (account): account is WalletWithMetadata =>
            account.type === 'wallet' &&
            account.walletClientType === 'privy' &&
            account.chainType === chainType
    );

    // 检查是否已授权
    useEffect(() => {
        if (embeddedWallet && 'delegated' in embeddedWallet) {
            setIsDelegated(embeddedWallet.delegated === true);
        }
    }, [embeddedWallet]);

    // 从后端获取 Authorization Key ID
    useEffect(() => {
        const fetchAuthKeyId = async () => {
            try {
                const response = await fetch(`${API_URL}/api/config/auth-key-id`);
                if (response.ok) {
                    const data = await response.json();
                    setAuthKeyId(data.authKeyId);
                }
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.error('Failed to fetch auth key ID:', error);
                }
            }
        };
        fetchAuthKeyId();
    }, []);

    const executeAuthorize = async () => {
        if (!embeddedWallet?.address || !authKeyId) return;

        setIsLoading(true);
        try {
            await addSessionSigners({
                address: embeddedWallet.address,
                signers: [{
                    signerId: authKeyId,
                    policyIds: [] // 无限制策略
                }]
            });
            setIsDelegated(true);
            onSuccess?.();
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Failed to authorize session signer:', error);
            }
            onError?.(error as Error);
        } finally {
            setIsLoading(false);
            setShowWarning(false);
            setConfirmText('');
        }
    };

    const handleAuthorizeClick = () => {
        setShowWarning(true);
    };

    const handleConfirmAuthorize = () => {
        if (confirmText === 'Confirm') {
            executeAuthorize();
        }
    };

    const handleRevoke = async () => {
        if (!embeddedWallet?.address || !authKeyId) return;

        setIsLoading(true);
        try {
            // removeSessionSigners takes the signer IDs to remove
            // Using type assertion as the SDK types may not be fully updated
            await (removeSessionSigners as any)({
                address: embeddedWallet.address,
                signerIds: [authKeyId]
            });
            setIsDelegated(false);
            onSuccess?.();
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Failed to revoke session signer:', error);
            }
            onError?.(error as Error);
        } finally {
            setIsLoading(false);
        }
    };

    // 未登录或无钱包时不显示
    if (!ready || !authenticated || !embeddedWallet) {
        return null;
    }

    const warningModalStyle: React.CSSProperties = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    };

    const warningContentStyle: React.CSSProperties = {
        background: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '400px',
        width: '90%',
        textAlign: 'center',
        border: '1px solid var(--border-color)',
        boxShadow: 'none',
        color: 'var(--text-primary)',
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px',
        margin: '16px 0',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        background: 'transparent',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.title}>
                    Auto-Trading
                </span>
                <span className={styles.chainBadge}>
                    {chainType === 'ethereum' ? 'EVM' : 'SOL'}
                </span>
            </div>

            <p className={styles.description}>
                {isDelegated
                    ? '✅ Server authorized for signing. Copy Trading is active.'
                    : 'Authorize the server to execute Copy Trading transactions on your behalf. You can revoke this at any time.'
                }
            </p>

            <button
                className={`${styles.button} ${isDelegated ? styles.revokeButton : styles.authorizeButton}`}
                onClick={isDelegated ? handleRevoke : handleAuthorizeClick}
                disabled={isLoading || !authKeyId}
            >
                {isLoading
                    ? 'Processing...'
                    : isDelegated
                        ? 'Revoke Authorization'
                        : 'Authorize Auto-Trading'
                }
            </button>

            {!authKeyId && (
                <p className={styles.error}>
                    Unable to fetch authorization configuration. Please try again later.
                </p>
            )}

            {showWarning && (
                <div style={warningModalStyle} onClick={() => setShowWarning(false)}>
                    <div style={warningContentStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                        <h3 style={{ color: 'var(--text-primary)', margin: '0 0 12px 0', fontSize: '18px' }}>
                            High Risk Warning
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px 0', lineHeight: 1.5, fontSize: '14px' }}>
                            You are about to authorize an automated system to sign transactions on your behalf.<br /><br />
                            <strong>This enables automatic trading.</strong><br />
                            Ensure you trust this platform and have reviewed the risks.
                        </p>

                        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                                Type "Confirm" to proceed:
                            </label>
                            <input
                                type="text"
                                style={inputStyle}
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="Confirm"
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    flex: 1,
                                }}
                                onClick={() => setShowWarning(false)}
                            >
                                Cancel
                            </button>
                            <button
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: confirmText === 'Confirm' ? '#ef4444' : 'rgba(239, 68, 68, 0.3)',
                                    color: confirmText === 'Confirm' ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                                    cursor: confirmText === 'Confirm' ? 'pointer' : 'not-allowed',
                                    fontWeight: 500,
                                    flex: 1,
                                }}
                                onClick={handleConfirmAuthorize}
                                disabled={confirmText !== 'Confirm'}
                            >
                                Authorize
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionSignerButton;
