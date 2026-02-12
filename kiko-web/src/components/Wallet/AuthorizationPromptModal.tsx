/**
 * AuthorizationPromptModal
 * 
 * 用户登录后显示的授权提示弹窗
 * 让用户知道需要授权才能使用 AutoTrade/Copy Trade 功能
 */

import React, { useState, useEffect } from 'react';
import { usePrivy, useSessionSigners } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { ShieldCheck, AlertTriangle, Loader2, X } from 'lucide-react';
import styles from './AuthorizationPromptModal.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
const DISMISSED_KEY = 'kiko_auth_prompt_dismissed';

export const AuthorizationPromptModal: React.FC = () => {
    const { ready, authenticated, user } = usePrivy();
    const { addSessionSigners } = useSessionSigners();
    const [showModal, setShowModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [authKeyId, setAuthKeyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Get embedded wallets
    const evmWallet = user?.linkedAccounts?.find(
        (account): account is WalletWithMetadata =>
            account.type === 'wallet' &&
            account.walletClientType === 'privy' &&
            account.chainType === 'ethereum'
    );

    const solanaWallet = user?.linkedAccounts?.find(
        (account): account is WalletWithMetadata =>
            account.type === 'wallet' &&
            account.walletClientType === 'privy' &&
            account.chainType === 'solana'
    );

    // Check if wallets need authorization
    const evmNeedsAuth = evmWallet && !('delegated' in evmWallet && evmWallet.delegated);
    const solanaNeedsAuth = solanaWallet && !('delegated' in solanaWallet && solanaWallet.delegated);
    const needsAuth = evmNeedsAuth || solanaNeedsAuth;

    // Fetch auth key ID
    useEffect(() => {
        if (!authenticated) return;

        const fetchAuthKeyId = async () => {
            try {
                const response = await fetch(`${API_URL}/api/config/auth-key-id`);
                if (response.ok) {
                    const data = await response.json();
                    setAuthKeyId(data.authKeyId);
                }
            } catch (error) {
                console.error('Failed to fetch auth key ID:', error);
            }
        };
        fetchAuthKeyId();
    }, [authenticated]);

    // Get user-specific dismiss key
    const getDismissKey = () => {
        const userId = user?.id || 'anonymous';
        return `${DISMISSED_KEY}_${userId}`;
    };

    // Check if should show modal
    useEffect(() => {
        if (!ready || !authenticated || !user) {
            setShowModal(false);
            return;
        }

        if (!needsAuth) {
            setShowModal(false);
            return;
        }

        // Check if THIS USER dismissed before (within last 24 hours)
        try {
            const dismissKey = getDismissKey();
            const dismissed = localStorage.getItem(dismissKey);
            if (dismissed) {
                const dismissedTime = parseInt(dismissed, 10);
                if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
                    console.log('[AuthPrompt] User dismissed within 24h, skipping');
                    return; // Don't show for 24 hours
                }
            }
        } catch (e) {
            // Ignore
        }

        // Show modal after a short delay (let page load first)
        console.log('[AuthPrompt] Will show modal in 1.5s');
        const timer = setTimeout(() => {
            console.log('[AuthPrompt] Showing modal now');
            setShowModal(true);
        }, 1500);
        return () => clearTimeout(timer);
    }, [ready, authenticated, needsAuth, evmNeedsAuth, solanaNeedsAuth]);

    const handleAuthorize = async () => {
        if (!authKeyId) {
            setError('无法获取授权密钥，请稍后重试');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Authorize EVM wallet
            if (evmWallet && evmNeedsAuth) {
                await addSessionSigners({
                    address: evmWallet.address,
                    signers: [{ signerId: authKeyId, policyIds: [] }]
                });
            }

            // Authorize Solana wallet
            if (solanaWallet && solanaNeedsAuth) {
                await addSessionSigners({
                    address: solanaWallet.address,
                    signers: [{ signerId: authKeyId, policyIds: [] }]
                });
            }

            // Success - close modal
            setShowModal(false);
        } catch (err: any) {
            console.error('Authorization failed:', err);
            setError(err.message || '授权失败，请重试');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDismiss = () => {
        // Remember that THIS USER dismissed (for 24 hours)
        localStorage.setItem(getDismissKey(), Date.now().toString());
        setShowModal(false);
    };

    if (!showModal) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <button className={styles.closeButton} onClick={handleDismiss} aria-label="Close">
                    <X size={20} />
                </button>

                <div className={styles.iconWrapper}>
                    <ShieldCheck size={40} className={styles.icon} />
                </div>

                <h2 className={styles.title}>Enable Auto-Trading</h2>

                <p className={styles.description}>
                    To use <strong>Copy Trade</strong> and <strong>Auto-Trade</strong> features,
                    please authorize our server to execute trades on your behalf.
                </p>

                <div className={styles.securityNote}>
                    <AlertTriangle size={16} />
                    <span>Your private keys remain secure. Only trading operations are authorized.</span>
                </div>

                {error && (
                    <div className={styles.error}>
                        {error}
                    </div>
                )}

                <div className={styles.actions}>
                    <button
                        className={styles.authorizeButton}
                        onClick={handleAuthorize}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={18} className={styles.spinner} />
                                Authorizing...
                            </>
                        ) : (
                            'Enable Auto-Trading'
                        )}
                    </button>

                    <button
                        className={styles.skipButton}
                        onClick={handleDismiss}
                        disabled={isLoading}
                    >
                        Skip for now
                    </button>
                </div>

                <p className={styles.footer}>
                    You can always change this in Wallet Settings
                </p>
            </div>
        </div>
    );
};
