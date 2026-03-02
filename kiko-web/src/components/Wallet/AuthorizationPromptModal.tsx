/**
 * AuthorizationPromptModal
 * 
 * 用户登录后显示的授权提示弹窗
 * 让用户知道需要授权才能使用 AutoTrade/Copy Trade 功能
 */

import React, { useState, useEffect } from 'react';
import { usePrivy, useSessionSigners } from '@privy-io/react-auth';
import { ShieldCheck, AlertTriangle, Loader2, X } from 'lucide-react';
import { AutoTradingConfirmModal } from './AutoTradingConfirmModal';
import styles from './AuthorizationPromptModal.module.css';
import { usePrivyEmbeddedWallets } from '../../hooks/usePrivyEmbeddedWallets';
import { getPrivyAuthorizationConfig } from '../../services/privyAuthConfig';
const DISMISSED_KEY = 'kiko_auth_prompt_dismissed';

export const AuthorizationPromptModal: React.FC = () => {
    const { ready, authenticated, user } = usePrivy();
    const { addSessionSigners } = useSessionSigners();
    const [showModal, setShowModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [authKeyId, setAuthKeyId] = useState<string | null>(null);
    const [evmPolicyId, setEvmPolicyId] = useState<string | null>(null);
    const [solPolicyId, setSolPolicyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { evmWallet, solanaWallet } = usePrivyEmbeddedWallets();

    // Check if wallets need authorization
    const evmNeedsAuth = evmWallet && !('delegated' in evmWallet && evmWallet.delegated);
    const solanaNeedsAuth = solanaWallet && !('delegated' in solanaWallet && solanaWallet.delegated);
    const needsAuth = evmNeedsAuth || solanaNeedsAuth;

    // Fetch auth key ID
    useEffect(() => {
        if (!authenticated) return;

        const fetchAuthKeyId = async () => {
            try {
                const data = await getPrivyAuthorizationConfig();
                setAuthKeyId(data.authKeyId);
                setEvmPolicyId(data.policies.autoTrading.ethereum || null);
                setSolPolicyId(data.policies.autoTrading.solana || null);
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

    const handleAuthorizeClick = () => {
        setError(null);
        setShowConfirmModal(true);
    };

    const handleConfirmAuthorize = async () => {
        if (!authKeyId) {
            setError('Unable to get authorization key. Please try again later.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            if (evmWallet && evmNeedsAuth) {
                const evmSigner = evmPolicyId
                    ? { signerId: authKeyId, policyIds: [evmPolicyId] }
                    : { signerId: authKeyId };
                await addSessionSigners({
                    address: evmWallet.address,
                    signers: [evmSigner as any]
                });
            }
            if (solanaWallet && solanaNeedsAuth) {
                if (!solPolicyId) throw new Error('Missing Solana auto-trading policy configuration.');
                const solSigner = solPolicyId
                    ? { signerId: authKeyId, policyIds: [solPolicyId] }
                    : { signerId: authKeyId };
                await addSessionSigners({
                    address: solanaWallet.address,
                    signers: [solSigner as any]
                });
            }
            setShowConfirmModal(false);
            setShowModal(false);
        } catch (err: any) {
            console.error('Authorization failed:', err);
            setError(err.message || 'Authorization failed. Please try again.');
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
                        onClick={handleAuthorizeClick}
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

            <AutoTradingConfirmModal
                open={showConfirmModal}
                onConfirm={handleConfirmAuthorize}
                onCancel={() => setShowConfirmModal(false)}
                confirming={isLoading}
            />
        </div>
    );
};
