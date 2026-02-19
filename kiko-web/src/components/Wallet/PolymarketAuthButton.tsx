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
        }
    };


    // Not ready or not authenticated
    if (!ready || !authenticated) {
        return null;
    }

    const isAuthorized = readiness?.hasCredentials === true;

    return (
        <>
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
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>
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
                    onClick={isAuthorized ? undefined : executeAuthorize}
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
            </div>
        </>
    );
};

export default PolymarketAuthButton;
