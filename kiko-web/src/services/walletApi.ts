import { getAuthToken } from '../utils/authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${API_BASE_URL}/api/wallets`;

async function getAuthHeaders() {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    const token = await getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
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
    txType: 'BUY' | 'SELL' | 'SWAP' | 'TRANSFER_IN' | 'TRANSFER_OUT';
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

/**
 * Get real-time balance for a specific wallet
 */
export async function getWalletBalance(address: string, chain: string = 'eth'): Promise<any> {
    try {
        const url = `${API_URL}/${address}/balance?chain=${chain}`;
        const headers = await getAuthHeaders();
        const response = await fetch(url, { method: 'GET', headers });

        if (!response.ok) {
            const err = await response.text();
            console.error('[WalletApi] Balance API error:', err);
            return null;
        }

        const json = await response.json();
        return json;
    } catch (error) {
        console.error('[WalletApi] Error fetching balance:', error);
        return null;
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
        const response = await fetch(url, { method: 'GET', headers });

        if (!response.ok) {
            const err = await response.text();
            console.error('[WalletApi] Transactions API error:', err);
            return [];
        }

        const json = await response.json();
        return json;
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
        return json;
    },

    addWallet: async (params: { address: string; alias?: string; labels?: string[]; chain?: string }): Promise<MonitoredWallet> => {
        const headers = await getAuthHeaders();
        const response = await fetch(API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(params)
        });
        const json = await response.json();
        return json;
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
        return json;
    },

    getWalletTransactions,
    getWalletBalance
};

export default walletApi;
