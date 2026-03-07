import { getAuthToken } from '../utils/authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL
    || (import.meta.env.MODE === 'production' ? window.location.origin : 'http://localhost:3001');
const API_URL = `${API_BASE_URL}/api/wallets`;
const WALLET_API_TIMEOUT_MS = 15000;
const WALLET_ALL_BALANCES_TIMEOUT_MS = 25000;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

async function getAuthHeaders() {
    const headers: Record<string, string> = {};
    const token = await getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

async function buildHttpError(response: Response, fallback: string): Promise<Error> {
    let message = fallback;
    try {
        const text = await response.text();
        if (text) {
            try {
                const body = JSON.parse(text);
                message = body?.message || body?.error || fallback;
            } catch {
                message = text || fallback;
            }
        }
    } catch {
        // Keep fallback message.
    }

    if (response.status === 401 || response.status === 403) {
        return new Error('Session expired or insufficient permissions. Please log in again.');
    }
    if (response.status === 429) {
        return new Error('Too many requests. Please try again later.');
    }
    if (response.status >= 500) {
        return new Error('Service temporarily unavailable. Please try again later.');
    }
    return new Error(message || 'Service temporarily unavailable. Please try again later.');
}

export interface MonitoredWallet {
    id: number;
    address: string;
    alias?: string;
    labels?: string[];
    chain?: string;
    createdAt?: string;
    updatedAt?: string;
    stats?: {
        win_rate: number;
        total_pnl: number;
        total_value: number;
        sharpe_ratio: number;
        max_drawdown: number;
        last_updated: string;
    };
}

export interface WalletTransaction {
    txHash: string;
    txType: 'BUY' | 'SELL' | 'SWAP' | 'APPROVE' | 'TRANSFER_IN' | 'TRANSFER_OUT';
    fromAddress: string;
    toAddress: string;
    tokenSymbol: string | null;
    tokenAddress: string | null;
    tokenInSymbol?: string;
    tokenOutSymbol?: string;
    amount: string;
    valueUsd: number | null;
    blockNumber: number;
    blockTimestamp: string | Date;
    chain: string;
}

export interface WalletBalance {
    ethBalance: string;
    ethBalanceFormatted: number;
    tokens: any[];
}

/**
 * Get real-time balance for a specific wallet
 */
export async function getWalletBalance(address: string, chain: string = 'eth'): Promise<WalletBalance | null> {
    try {
        const url = `${API_URL}/${address}/balance?chain=${chain}`;
        const headers = await getAuthHeaders();
        const response = await fetchWithTimeout(url, { method: 'GET', headers }, WALLET_API_TIMEOUT_MS);

        if (!response.ok) {
            const err = await response.text();
            console.error('[WalletApi] Balance API error:', err);
            return null;
        }

        const json = await response.json();
        return json.success ? json.data : null;
    } catch (error) {
        console.error('[WalletApi] Error fetching balance:', error);
        return null;
    }
}

/**
 * Fetch wallet balance for all supported chains
 */
export async function getAllChainBalances(address: string, solanaAddress?: string, forceRefresh?: boolean): Promise<Record<string, WalletBalance>> {
    try {
        let url = `${API_URL}/${address}/all-balances`;
        const params = new URLSearchParams();
        if (solanaAddress) {
            params.set('solanaAddress', solanaAddress);
        }
        if (forceRefresh) {
            params.set('forceRefresh', '1');
        }
        const qs = params.toString();
        if (qs) {
            url += `?${qs}`;
        }
        const headers = await getAuthHeaders();
        const response = await fetchWithTimeout(url, { method: 'GET', headers }, WALLET_ALL_BALANCES_TIMEOUT_MS);

        if (!response.ok) {
            throw await buildHttpError(response, 'Failed to fetch wallet balances');
        }

        const json = await response.json();
        if (!json.success || !json.data) {
            throw new Error('Wallet assets API returned invalid data.');
        }
        return json.data;
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            console.warn('[WalletApi] All Balances request timed out');
            throw new Error('Asset request timed out. Please try again later.');
        }
        const msg = error?.message || 'Failed to fetch all-chain balances';
        console.error('[WalletApi] Error fetching all-chain balances:', msg);
        throw new Error(msg);
    }
}

/**
 * Get transaction history for a wallet
 */
export async function getWalletTransactions(address: string, options: { chain?: string, limit?: number } = {}): Promise<WalletTransaction[]> {
    try {
        const params = new URLSearchParams();
        if (options.chain) params.append('chain', options.chain);
        if (options.limit) params.append('limit', options.limit.toString());

        const url = `${API_URL}/${address}/transactions?${params.toString()}`;
        const headers = await getAuthHeaders();
        const response = await fetchWithTimeout(url, { method: 'GET', headers }, WALLET_API_TIMEOUT_MS);

        if (!response.ok) {
            const err = await response.text();
            console.error('[WalletApi] Transactions API error:', err);
            return [];
        }

        const json = await response.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (error) {
        console.error('[WalletApi] Error fetching transactions:', error);
        return [];
    }
}

export const walletApi = {
    getWallets: async (): Promise<MonitoredWallet[]> => {
        const headers = await getAuthHeaders();
        const response = await fetch(API_URL, { headers });
        const json = await response.json();
        return json.data || [];
    },

    addWallet: async (params: { address: string; alias?: string; labels?: string[]; chain?: string }): Promise<MonitoredWallet> => {
        const headers = await getAuthHeaders();
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        const json = await response.json();
        return json.data;
    },

    removeWallet: async (id: number): Promise<void> => {
        const headers = await getAuthHeaders();
        await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers
        });
    },

    getWalletDetails: async (address: string): Promise<{ wallet: MonitoredWallet, stats: any }> => {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/${address}`, { headers });
        const json = await response.json();
        return json.data;
    },

    getWalletTransactions,
    getWalletBalance,
    getAllChainBalances
};

export default walletApi;
