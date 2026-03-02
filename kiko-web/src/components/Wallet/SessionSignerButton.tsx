import React, { useState, useEffect } from 'react';
import { usePrivy, useSessionSigners } from '@privy-io/react-auth';
import { AutoTradingConfirmModal } from './AutoTradingConfirmModal';
import styles from './SessionSignerButton.module.css';
import { agentAttrs } from '../../agent/attrs';
import { usePrivyEmbeddedWallets } from '../../hooks/usePrivyEmbeddedWallets';
import { getPrivyAuthorizationConfig } from '../../services/privyAuthConfig';

interface SessionSignerButtonProps {
    chainType: 'ethereum' | 'solana';
    agentId?: string;
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
    agentId,
    onSuccess,
    onError
}) => {
    const { ready, authenticated } = usePrivy();
    const { addSessionSigners, removeSessionSigners } = useSessionSigners();
    const [isLoading, setIsLoading] = useState(false);
    const [isDelegated, setIsDelegated] = useState(false);
    const [authKeyId, setAuthKeyId] = useState<string | null>(null);
    const [policyId, setPolicyId] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);
    const { evmWallet, solanaWallet } = usePrivyEmbeddedWallets();

    const embeddedWallet = chainType === 'ethereum' ? evmWallet : solanaWallet;

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
                const data = await getPrivyAuthorizationConfig();
                setAuthKeyId(data.authKeyId);
                setPolicyId(chainType === 'ethereum' ? (data.policies.autoTrading.ethereum || null) : (data.policies.autoTrading.solana || null));
                setConfigError(null);
            } catch (error) {
                setConfigError('Unable to fetch authorization configuration. Please try again later.');
                if (import.meta.env.DEV) {
                    console.error('Failed to fetch auth key ID:', error);
                }
            }
        };
        fetchAuthKeyId();
    }, [chainType]);

    const handleAuthorizeClick = () => {
        setShowConfirmModal(true);
    };

    const handleConfirmAuthorize = async () => {
        if (!embeddedWallet?.address || !authKeyId || !policyId) {
            onError?.(new Error('Missing wallet or authorization configuration.'));
            return;
        }

        setIsLoading(true);
        try {
            await addSessionSigners({
                address: embeddedWallet.address,
                signers: [{
                    signerId: authKeyId,
                    policyIds: [policyId]
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
        if (!embeddedWallet?.address || !authKeyId) {
            onError?.(new Error('Missing wallet or authorization key for revoke.'));
            return;
        }

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

    if (!ready || !authenticated) {
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
                {!embeddedWallet
                    ? `No embedded ${chainType === 'ethereum' ? 'EVM' : 'Solana'} wallet detected in current Privy session.`
                    : isDelegated
                    ? '✅ Server authorized for signing. Copy Trading is active.'
                    : 'Authorize the server to execute Copy Trading transactions on your behalf. You can revoke this at any time.'
                }
            </p>

            <button
                className={`${styles.button} ${isDelegated ? styles.revokeButton : styles.authorizeButton}`}
                onClick={isDelegated ? handleRevoke : handleAuthorizeClick}
                disabled={isDelegated
                    ? (isLoading || !authKeyId || !embeddedWallet)
                    : (isLoading || !authKeyId || !policyId || !embeddedWallet)
                }
                {...(agentId ? agentAttrs({ id: agentId, role: 'toggle', action: 'toggle', page: 'settings', key: `session_signer_${chainType}` }) : {})}
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

            {(configError || !authKeyId || !policyId) && (
                <p className={styles.error}>
                    {configError || `Missing ${chainType === 'ethereum' ? 'EVM' : 'Solana'} auto-trading policy configuration.`}
                </p>
            )}
        </div>
    );
};

export default SessionSignerButton;
