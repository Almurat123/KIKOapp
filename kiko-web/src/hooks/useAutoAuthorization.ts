/**
 * useAutoAuthorization Hook
 * 
 * 用户登录后自动请求服务器端签名授权
 * 这确保 AutoTrade 和 Copy Trade 功能能够正常工作
 */

import { useEffect, useCallback, useState } from 'react';
import { usePrivy, useSessionSigners } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Storage key for tracking authorization status
const AUTH_STATUS_KEY = 'kiko_auto_auth_status';

interface AuthStatus {
    ethereum?: boolean;
    solana?: boolean;
    lastChecked?: number;
}

export function useAutoAuthorization() {
    const { ready, authenticated, user } = usePrivy();
    const { addSessionSigners } = useSessionSigners();
    const [authKeyId, setAuthKeyId] = useState<string | null>(null);
    const [isAuthorizing, setIsAuthorizing] = useState(false);
    const [authStatus, setAuthStatus] = useState<AuthStatus>({});

    // Get user's embedded wallets
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

    // Fetch auth key ID from backend
    useEffect(() => {
        const fetchAuthKeyId = async () => {
            try {
                console.log('[AutoAuth] Fetching auth key ID from backend...');
                const response = await fetch(`${API_URL}/api/config/auth-key-id`);
                if (response.ok) {
                    const data = await response.json();
                    console.log('[AutoAuth] Got auth key ID:', data.authKeyId?.slice(0, 15) + '...');
                    setAuthKeyId(data.authKeyId);
                } else {
                    console.error('[AutoAuth] Failed to fetch auth key ID, status:', response.status);
                }
            } catch (error) {
                console.error('[AutoAuth] Failed to fetch auth key ID:', error);
            }
        };

        if (authenticated) {
            fetchAuthKeyId();
        }
    }, [authenticated]);

    // Debug: Log wallet status when user changes
    useEffect(() => {
        if (user) {
            console.log('[AutoAuth] User wallets status:', {
                evmWallet: evmWallet ? {
                    address: evmWallet.address?.slice(0, 10) + '...',
                    delegated: 'delegated' in evmWallet ? evmWallet.delegated : 'N/A',
                } : null,
                solanaWallet: solanaWallet ? {
                    address: solanaWallet.address?.slice(0, 10) + '...',
                    delegated: 'delegated' in solanaWallet ? solanaWallet.delegated : 'N/A',
                } : null,
            });
        }
    }, [user, evmWallet, solanaWallet]);

    // Load saved auth status
    useEffect(() => {
        try {
            const saved = localStorage.getItem(AUTH_STATUS_KEY);
            if (saved) {
                setAuthStatus(JSON.parse(saved));
            }
        } catch (e) {
            // Ignore parse errors
        }
    }, []);

    // NOTE: Privy's 'delegated' property on wallets does NOT mean our auth key is added!
    // It just means the wallet supports delegation. We need to track our own auth status.
    // Check our localStorage to see if we've successfully authorized before
    const hasAuthorizedBefore = useCallback((chainType: 'ethereum' | 'solana'): boolean => {
        try {
            const saved = localStorage.getItem(AUTH_STATUS_KEY);
            if (saved) {
                const status = JSON.parse(saved);
                return status[chainType] === true;
            }
        } catch (e) {
            // Ignore
        }
        return false;
    }, []);

    // Authorize a specific wallet
    const authorizeWallet = useCallback(async (
        wallet: WalletWithMetadata,
        chainType: 'ethereum' | 'solana'
    ): Promise<boolean> => {
        if (!authKeyId || !wallet?.address) return false;

        try {
            console.log(`[AutoAuth] Authorizing ${chainType} wallet:`, wallet.address.slice(0, 10) + '...');

            await addSessionSigners({
                address: wallet.address,
                signers: [{
                    signerId: authKeyId,
                    policyIds: [] // No restrictions
                }]
            });

            console.log(`[AutoAuth] ${chainType} wallet authorized successfully`);
            return true;
        } catch (error: any) {
            console.error(`[AutoAuth] Failed to authorize ${chainType} wallet:`, error);
            return false;
        }
    }, [authKeyId, addSessionSigners]);

    // Main auto-authorization effect
    useEffect(() => {
        if (!ready || !authenticated || !authKeyId || isAuthorizing) return;

        // Helper to check if wallet needs authorization
        // We need to authorize if:
        // 1. We haven't authorized before (localStorage says false)
        // 2. OR user has revoked (Privy returns delegated: false)
        const needsAuthorization = (
            wallet: WalletWithMetadata | undefined,
            chainType: 'ethereum' | 'solana'
        ): boolean => {
            if (!wallet) return false;
            const privyDelegated = 'delegated' in wallet ? wallet.delegated : false;
            const localStorageAuthorized = hasAuthorizedBefore(chainType);

            // If Privy says NOT delegated, we definitely need to authorize
            if (!privyDelegated) {
                console.log(`[AutoAuth] ${chainType} wallet needs auth (Privy delegated: false)`);
                return true;
            }

            // If Privy says delegated but we don't have localStorage record, we might need to authorize
            // (user could have cleared localStorage but still be authorized, so skip in this case)
            if (privyDelegated && !localStorageAuthorized) {
                console.log(`[AutoAuth] ${chainType} wallet: Privy delegated but no localStorage record - assuming authorized`);
                return false; // Trust Privy's status
            }

            return false;
        };

        const performAutoAuth = async () => {
            const now = Date.now();

            // Check if any wallet needs authorization
            const evmNeedsAuth = needsAuthorization(evmWallet, 'ethereum');
            const solanaNeedsAuth = needsAuthorization(solanaWallet, 'solana');

            if (!evmNeedsAuth && !solanaNeedsAuth) {
                console.log('[AutoAuth] All wallets properly authorized, skipping');
                return;
            }

            setIsAuthorizing(true);
            const results: AuthStatus = { lastChecked: now };

            try {
                // Authorize EVM wallet if needed
                if (evmWallet && evmNeedsAuth) {
                    console.log('[AutoAuth] Attempting to authorize EVM wallet...');
                    results.ethereum = await authorizeWallet(evmWallet, 'ethereum');
                } else if (evmWallet) {
                    results.ethereum = true;
                }

                // Authorize Solana wallet if needed
                if (solanaWallet && solanaNeedsAuth) {
                    console.log('[AutoAuth] Attempting to authorize Solana wallet...');
                    results.solana = await authorizeWallet(solanaWallet, 'solana');
                } else if (solanaWallet) {
                    results.solana = true;
                }

                // Save status
                setAuthStatus(results);
                localStorage.setItem(AUTH_STATUS_KEY, JSON.stringify(results));

            } catch (error) {
                console.error('[AutoAuth] Error during auto-authorization:', error);
            } finally {
                setIsAuthorizing(false);
            }
        };

        // Small delay to ensure Privy is fully ready
        const timer = setTimeout(performAutoAuth, 2000);
        return () => clearTimeout(timer);
    }, [ready, authenticated, authKeyId, evmWallet, solanaWallet, isAuthorizing, authStatus.lastChecked, authorizeWallet, hasAuthorizedBefore]);

    return {
        isAuthorizing,
        authStatus,
        evmAuthorized: hasAuthorizedBefore('ethereum'),
        solanaAuthorized: hasAuthorizedBefore('solana'),
        // Manual trigger for re-authorization
        reauthorize: useCallback(async () => {
            if (!evmWallet && !solanaWallet) return;
            setIsAuthorizing(true);
            try {
                if (evmWallet) await authorizeWallet(evmWallet, 'ethereum');
                if (solanaWallet) await authorizeWallet(solanaWallet, 'solana');
            } finally {
                setIsAuthorizing(false);
            }
        }, [evmWallet, solanaWallet, authorizeWallet])
    };
}
