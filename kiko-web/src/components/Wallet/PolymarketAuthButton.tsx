import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import styles from './SessionSignerButton.module.css'; // Reuse same styles

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface PolymarketAuthButtonProps {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

interface ReadinessData {
    isReady: boolean;
    hasCredentials: boolean;
    needsUsdcApproval?: boolean;
    needsCtfApproval?: boolean;
    usdcBalance?: string;
}

/**
 * PolymarketAuthButton - Enable Polymarket trading
 * 
 * Allows user to authorize and set up Polymarket trading credentials and approvals
 */
export const PolymarketAuthButton: React.FC<PolymarketAuthButtonProps> = ({
    onSuccess,
    onError
}) => {
    const { ready, authenticated, getAccessToken } = usePrivy();
    const [isLoading, setIsLoading] = useState(false);
    const [readiness, setReadiness] = useState<ReadinessData | null>(null);
    const [showWarning, setShowWarning] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Check trading readiness on mount
    useEffect(() => {
        if (!ready || !authenticated) return;

        const checkReadiness = async () => {
            try {
                const token = await getAccessToken();
                if (!token) return;

                const response = await fetch(`${API_URL}/api/polymarket/trading/readiness`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        setReadiness(data.data);
                    }
                }
            } catch (err) {
                console.error('[PolymarketAuth] Failed to check readiness:', err);
            }
        };

        checkReadiness();
    }, [ready, authenticated, getAccessToken]);

    const executeAuthorize = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const token = await getAccessToken();
            if (!token) {
                throw new Error('No access token');
            }

            // Step 1: Create credentials
            const credResponse = await fetch(`${API_URL}/api/polymarket/trading/credentials`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (!credResponse.ok) {
                const errData = await credResponse.json();
                throw new Error(errData.error || 'Failed to create credentials');
            }

            // Step 2: Get required approvals
            const approvalResponse = await fetch(`${API_URL}/api/polymarket/trading/approvals`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!approvalResponse.ok) {
                const errData = await approvalResponse.json();
                throw new Error(errData.error || 'Failed to get approvals');
            }

            const approvalData = await approvalResponse.json();

            // Update readiness state
            setReadiness({
                isReady: true,
                hasCredentials: true,
                needsUsdcApproval: approvalData.data?.needsUsdcApproval,
                needsCtfApproval: approvalData.data?.needsCtfApproval,
                usdcBalance: approvalData.data?.usdcBalance
            });

            onSuccess?.();
        } catch (err: any) {
            console.error('[PolymarketAuth] Authorization failed:', err);
            setError(err.message);
            onError?.(err);
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

    // Not ready or not authenticated
    if (!ready || !authenticated) {
        return null;
    }

    const isAuthorized = readiness?.hasCredentials === true;

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

    // Keyframes animation for spinner (inline styles don't support @keyframes)
    const spinnerKeyframes = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;

    return (
        <>
            <style>{spinnerKeyframes}</style>
            <div className={styles.container}>
                <div className={styles.header}>
                    <span className={styles.title}>
                        Polymarket Trading
                    </span>
                    <span className={styles.chainBadge}>
                        POLYGON
                    </span>
                </div>

                <p className={styles.description}>
                    {isAuthorized
                        ? 'Polymarket trading is enabled. You can place prediction market orders.'
                        : 'Enable Polymarket trading to place bets on prediction markets. Requires USDC on Polygon.'
                    }
                </p>

                {readiness?.usdcBalance && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>
                        USDC Balance: {readiness.usdcBalance}
                    </p>
                )}

                {error && (
                    <p className={styles.error}>
                        {error}
                    </p>
                )}

                <button
                    className={`${styles.button} ${isAuthorized ? styles.revokeButton : styles.authorizeButton} ${isLoading ? styles.loading : ''}`}
                    onClick={isAuthorized ? undefined : handleAuthorizeClick}
                    disabled={isLoading || isAuthorized}
                    style={isAuthorized ? { opacity: 0.6, cursor: 'default' } : undefined}
                >
                    {isLoading
                        ? 'Enabling'
                        : isAuthorized
                            ? 'Trading Enabled'
                            : 'Enable Polymarket Trading'
                    }
                </button>

                {showWarning && (
                    <div style={warningModalStyle} onClick={() => setShowWarning(false)}>
                        <div style={warningContentStyle} onClick={(e) => e.stopPropagation()}>
                            <div style={{ fontSize: '24px', marginBottom: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Polymarket</div>
                            <h3 style={{ color: 'var(--text-primary)', margin: '0 0 12px 0', fontSize: '18px' }}>
                                Enable Polymarket Trading
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px 0', lineHeight: 1.5, fontSize: '14px' }}>
                                This will create API credentials for Polymarket trading on Polygon network.<br /><br />
                                <strong>Requirements:</strong><br />
                                • USDC on Polygon for trading<br />
                                • Token approvals will be required
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
                                        background: '#3f3f46',
                                        color: '#f4f4f5',
                                        cursor: isLoading ? 'not-allowed' : 'pointer',
                                        fontWeight: 500,
                                        flex: 1,
                                        opacity: isLoading ? 0.5 : 1,
                                    }}
                                    onClick={() => setShowWarning(false)}
                                    disabled={isLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: confirmText === 'Confirm' ? '#52525b' : '#3f3f46',
                                        color: confirmText === 'Confirm' ? '#f4f4f5' : 'rgba(244, 244, 245, 0.5)',
                                        cursor: (confirmText === 'Confirm' && !isLoading) ? 'pointer' : 'not-allowed',
                                        fontWeight: 500,
                                        flex: 1,
                                        opacity: isLoading ? 0.7 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                    }}
                                    onClick={handleConfirmAuthorize}
                                    disabled={confirmText !== 'Confirm' || isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <span style={{
                                                width: '14px',
                                                height: '14px',
                                                border: '2px solid transparent',
                                                borderTopColor: 'currentColor',
                                                borderRadius: '50%',
                                                animation: 'spin 0.8s linear infinite',
                                            }} />
                                            Enabling...
                                        </>
                                    ) : 'Enable'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default PolymarketAuthButton;
