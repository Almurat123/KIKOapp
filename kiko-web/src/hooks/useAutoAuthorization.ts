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

    // Check if wallet is already delegated (from Privy's data)
    const isWalletDelegated = useCallback((wallet: WalletWithMetadata | undefined): boolean => {
        if (!wallet) return false;
        // Privy adds 'delegated' property to wallets that have been delegated
        return 'delegated' in wallet && wallet.delegated === true;
    }, []);

    // Authorize a specific wallet
    const authorizeWallet = useCallback(async (
        wallet: WalletWithMetadata,
        chainType: 'ethereum' | 'solana'
    ): Promise<boolean> => {
        if (!authKeyId || !wallet?.address) return false;

        // Skip if already delegated
        if (isWalletDelegated(wallet)) {
            console.log(`[AutoAuth] ${chainType} wallet already delegated`);
            return true;
        }

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
    }, [authKeyId, addSessionSigners, isWalletDelegated]);

    // Main auto-authorization effect
    useEffect(() => {
        if (!ready || !authenticated || !authKeyId || isAuthorizing) return;

        const performAutoAuth = async () => {
            // Skip if we recently checked (within last hour)
            const now = Date.now();
            if (authStatus.lastChecked && now - authStatus.lastChecked < 3600000) {
                // But still check if wallets have changed
                const evmDelegated = isWalletDelegated(evmWallet);
                const solanaDelegated = isWalletDelegated(solanaWallet);

                if (evmDelegated && solanaDelegated) {
                    return; // All good, skip
                }
            }

            setIsAuthorizing(true);
            const results: AuthStatus = { lastChecked: now };

            try {
                // Authorize EVM wallet
                if (evmWallet && !isWalletDelegated(evmWallet)) {
                    results.ethereum = await authorizeWallet(evmWallet, 'ethereum');
                } else if (evmWallet) {
                    results.ethereum = true;
                }

                // Authorize Solana wallet
                if (solanaWallet && !isWalletDelegated(solanaWallet)) {
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
    }, [ready, authenticated, authKeyId, evmWallet, solanaWallet, isAuthorizing, authStatus.lastChecked, authorizeWallet, isWalletDelegated]);

    return {
        isAuthorizing,
        authStatus,
        evmDelegated: isWalletDelegated(evmWallet),
        solanaDelegated: isWalletDelegated(solanaWallet),
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
