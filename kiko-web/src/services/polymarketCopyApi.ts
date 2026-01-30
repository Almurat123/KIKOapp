import { getAuthToken } from '../utils/authToken';

export interface PolymarketCopyConfig {
    id: string;
    userId: string;
    targetWallet: string;
    betSizeUsd: number;
    maxOpenBets: number;
    status: 'active' | 'paused';
    mirrorSell: boolean;
    createdAt: string;
    updatedAt: string;
}

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/polymarket`;

export const getPolymarketCopyConfigs = async (): Promise<PolymarketCopyConfig[]> => {
    try {
        const token = await getAuthToken();
        if (!token) {
            console.warn('[PolymarketCopyApi] No token available, skipping fetch.');
            return [];
        }

        const response = await fetch(`${API_BASE_URL}/copy/configs`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.configs || [];
    } catch (error: any) {
        if (error.message === 'No authentication token available') {
            return [];
        }
        console.error('[PolymarketCopyApi] Error fetching configs:', error);
        throw error;
    }
};
