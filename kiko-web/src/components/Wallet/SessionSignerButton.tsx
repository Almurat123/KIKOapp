import React, { useState, useEffect } from 'react';
import { usePrivy, useSessionSigners } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { AutoTradingConfirmModal } from './AutoTradingConfirmModal';
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
 * 点击按钮后直接调用 Privy 的 addSessionSigners
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
    const [showConfirmModal, setShowConfirmModal] = useState(false);

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
        } else {
            setIsDelegated(false);
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

    const handleAuthorizeClick = () => {
        setShowConfirmModal(true);
    };

    const handleConfirmAuthorize = async () => {
        if (!embeddedWallet?.address || !authKeyId) return;

        setIsLoading(true);
        try {
            await addSessionSigners({
                address: embeddedWallet.address,
                signers: [{
                    signerId: authKeyId,
                    policyIds: []
                }]
            });
            setShowConfirmModal(false);
            setIsDelegated(true);
            onSuccess?.();
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Failed to authorize session signer:', error);
            }
            onError?.(error as Error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevoke = async () => {
        if (!embeddedWallet?.address || !authKeyId) return;

        setIsLoading(true);
        try {
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

            <AutoTradingConfirmModal
                open={showConfirmModal}
                onConfirm={handleConfirmAuthorize}
                onCancel={() => setShowConfirmModal(false)}
                confirming={isLoading}
            />

            {!authKeyId && (
                <p className={styles.error}>
                    Unable to fetch authorization configuration. Please try again later.
                </p>
            )}
        </div>
    );
};

export default SessionSignerButton;
