import axios from 'axios';
import { getAuthToken } from '../utils/authToken';

// Types matching the Prisma model and API response
export interface CopyTradeConfig {
    id: string;
    userId: string;
    targetWallet: string;
    chainId: number;
    buyAmountUsd: number;
    maxSlippageBps: number;
    minMarketCapUsd?: number | null;
    minLiquidityUsd?: number | null;
    minTargetValueUsd?: number | null;
    takeProfitPct?: number | null;
    stopLossPct?: number | null;
    mirrorSell: boolean;
    status: 'active' | 'paused';
    aiAnalysisMode: 'disabled' | 'analyze_only' | 'auto_decide';
    createdAt: string;
    updatedAt: string;
}

export interface CreateConfigParams {
    targetWallet: string;
    buyAmountUsd: number;
    maxSlippageBps?: number;
    minMarketCapUsd?: number;
    minLiquidityUsd?: number;
    minTargetValueUsd?: number;
    takeProfitPct?: number;
    stopLossPct?: number;
    mirrorSell?: boolean;
    aiAnalysisMode?: 'disabled' | 'analyze_only' | 'auto_decide';
}

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/copy-trade`;

// Helper to get auth headers
const getHeaders = async () => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('No authentication token available');
    }
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

/**
 * Fetch all copy trade configurations
 */
export const getConfigs = async (): Promise<CopyTradeConfig[]> => {
    try {
        const token = await getAuthToken();
        if (!token) {
            console.warn('[CopyTradeApi] No token available, skipping fetch.');
            return [];
        }

        const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
        const response = await axios.get(`${API_BASE_URL}/configs`, { headers });
        return response.data.configs;
    } catch (error: any) {
        if (error.message === 'No authentication token available') {
            return [];
        }
        console.error('[CopyTradeApi] Error fetching configs:', error);
        throw error;
    }
};

/**
 * Create a new copy trade configuration
 */
export const createConfig = async (params: CreateConfigParams): Promise<CopyTradeConfig> => {
    try {
        const headers = await getHeaders();
        const response = await axios.post(`${API_BASE_URL}/config`, params, { headers });
        return response.data.config;
    } catch (error) {
        console.error('[CopyTradeApi] Error creating config:', error);
        throw error;
    }
};

/**
 * Delete a configuration
 */
export const deleteConfig = async (id: string): Promise<void> => {
    try {
        const headers = await getHeaders();
        await axios.delete(`${API_BASE_URL}/config/${id}`, { headers });
    } catch (error) {
        console.error('[CopyTradeApi] Error deleting config:', error);
        throw error;
    }
};

/**
 * Update configuration status (active/paused)
 */
export const updateConfigStatus = async (id: string, status: 'active' | 'paused'): Promise<void> => {
    try {
        const headers = await getHeaders();
        await axios.patch(`${API_BASE_URL}/config/${id}/status`, { status }, { headers });
    } catch (error) {
        console.error('[CopyTradeApi] Error updating status:', error);
        throw error;
    }
};

/**
 * Update a copy trade config
 */
export const updateConfig = async (id: string, updates: Partial<CopyTradeConfig>): Promise<CopyTradeConfig> => {
    try {
        const headers = await getHeaders();
        const response = await axios.patch<{ success: boolean; config: CopyTradeConfig }>(
            `${API_BASE_URL}/config/${id}`,
            updates,
            { headers }
        );
        return response.data.config;
    } catch (error) {
        console.error('[CopyTradeApi] Error updating config:', error);
        throw error;
    }
};

/**
 * Fetch positions
 */
export const getPositions = async (): Promise<any[]> => {
    try {
        const headers = await getHeaders();
        const response = await axios.get(`${API_BASE_URL}/positions`, { headers });
        return response.data.positions;
    } catch (error) {
        console.error('[CopyTradeApi] Error fetching positions:', error);
        throw error;
    }
};
