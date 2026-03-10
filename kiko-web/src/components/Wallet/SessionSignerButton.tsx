import React, { useEffect, useState } from 'react';
import { usePrivy, useSessionSigners, useUser } from '@privy-io/react-auth';
import { AutoTradingConfirmModal } from './AutoTradingConfirmModal';
import styles from './SessionSignerButton.module.css';
import { agentAttrs } from '../../agent/attrs';
import { usePrivyEmbeddedWallets } from '../../hooks/usePrivyEmbeddedWallets';
import { getPrivyAuthorizationConfig } from '../../services/privyAuthConfig';
import { isWalletDelegated, waitForWalletDelegation } from './sessionSignerSync';

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
    const { refreshUser } = useUser();
    const [isLoading, setIsLoading] = useState(false);
    const [delegatedOverride, setDelegatedOverride] = useState<boolean | null>(null);
    const [authKeyId, setAuthKeyId] = useState<string | null>(null);
    const [policyId, setPolicyId] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const { evmWallet, solanaWallet } = usePrivyEmbeddedWallets();

    const embeddedWallet = chainType === 'ethereum' ? evmWallet : solanaWallet;
    const requiresPolicy = chainType === 'solana';
    const delegatedFromWallet = embeddedWallet?.delegated === true;
    const isDelegated = delegatedOverride ?? delegatedFromWallet;

    useEffect(() => {
        if (delegatedOverride !== null && delegatedOverride === delegatedFromWallet) {
            setDelegatedOverride(null);
        }
    }, [delegatedFromWallet, delegatedOverride]);

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
        setActionError(null);
        setShowConfirmModal(true);
    };

    const handleConfirmAuthorize = async () => {
        if (!embeddedWallet?.address || !authKeyId) {
            const error = new Error('Missing wallet or authorization configuration.');
            setActionError(error.message);
            onError?.(error);
            return;
        }
        if (requiresPolicy && !policyId) {
            const error = new Error('Missing Solana auto-trading policy configuration.');
            setActionError(error.message);
            onError?.(error);
            return;
        }

        setIsLoading(true);
        setActionError(null);
        try {
            const signer = policyId
                ? { signerId: authKeyId, policyIds: [policyId] }
                : { signerId: authKeyId };
            const result = await addSessionSigners({
                address: embeddedWallet.address,
                signers: [signer as any]
            });

            const delegatedFromResult = isWalletDelegated(result.user, embeddedWallet.address);
            if (delegatedFromResult !== true) {
                await waitForWalletDelegation({
                    address: embeddedWallet.address,
                    expected: true,
                    refreshUser
                });
            }

            setShowConfirmModal(false);
            setDelegatedOverride(true);
            onSuccess?.();
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Failed to authorize session signer:', error);
            }
            const nextError = error instanceof Error
                ? error
                : new Error('Authorization failed. Please try again.');
            setActionError(nextError.message);
            onError?.(nextError);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevoke = async () => {
        if (!embeddedWallet?.address || !authKeyId) {
            const error = new Error('Missing wallet or authorization key for revoke.');
            setActionError(error.message);
            onError?.(error);
            return;
        }

        setIsLoading(true);
        setActionError(null);
        try {
            await (removeSessionSigners as any)({
                address: embeddedWallet.address,
                signerIds: [authKeyId]
            });
            await waitForWalletDelegation({
                address: embeddedWallet.address,
                expected: false,
                refreshUser
            });
            setDelegatedOverride(false);
            onSuccess?.();
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Failed to revoke session signer:', error);
            }
            const nextError = error instanceof Error
                ? error
                : new Error('Failed to revoke authorization. Please try again.');
            setActionError(nextError.message);
            onError?.(nextError);
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
                    : (isLoading || !authKeyId || !embeddedWallet || (requiresPolicy && !policyId))
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

            {(actionError || configError || !authKeyId || (requiresPolicy && !policyId)) && (
                <p className={styles.error}>
                    {actionError || configError || ((requiresPolicy && !policyId)
                        ? 'Missing Solana auto-trading policy configuration.'
                        : 'Authorization configuration unavailable. Please try again later.')}
                </p>
            )}
        </div>
    );
};

export default SessionSignerButton;
