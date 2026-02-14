import { getAuthToken } from '../utils/authToken';

// Types matching the Prisma model and API response
export type CopyTradeExecutionMode = 'safe' | 'balanced' | 'turbo';

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
    copyTradeTokenCooldownMinutes?: number | null;
    executionMode?: CopyTradeExecutionMode | null;
    disableTokenInfo?: boolean | null;
    takeProfitPct?: number | null;
    stopLossPct?: number | null;
    mirrorSell: boolean;
    status: 'active' | 'paused';
    aiAnalysisMode: 'disabled' | 'analyze_only' | 'auto_decide';
    enableDynamicTP: boolean;
    dynamicTPMinProfitPct: number;
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
    copyTradeTokenCooldownMinutes?: number;
    executionMode?: CopyTradeExecutionMode;
    disableTokenInfo?: boolean;
    takeProfitPct?: number;
    stopLossPct?: number;
    mirrorSell?: boolean;
    aiAnalysisMode?: 'disabled' | 'analyze_only' | 'auto_decide';
}

export interface CopyTradeTargetStatusResponse {
    success: boolean;
    config: {
        id: string;
        targetWallet: string;
        chainId: number;
        createdAt: string;
        status: string;
    };
    aggregate: {
        windowStartAt: string;
        windowEndAt: string;
        windowDays: number;
        trackedTxCount: number;
        walletTxCount?: number;
        buyCount: number;
        sellCount: number;
        tokenSwapCount: number;
        buyVolumeUsd: number;
        sellVolumeUsd: number;
        netFlowUsd: number;
        targetRealizedPnlUsd: number;
        targetRealizedProfitUsd: number;
        targetRealizedLossUsd: number;
        targetUnrealizedPnlUsd: number;
        targetTotalPnlUsd: number;
        openPositionCostUsd: number;
        openPositionValueUsd: number;
        pricedOpenTokenCount: number;
        unpricedOpenTokenCount: number;
        copyPositionsCount: number;
        latestTxAt: string | null;
    };
}

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/copy-trade`;

// Helper to get auth headers
const getHeaders = async () => {
    const token = await getAuthToken();
    if (!token) {
        throw new Error('No authentication token available');
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
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

        const response = await fetch(`${API_BASE_URL}/configs`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.configs;
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
        const response = await fetch(`${API_BASE_URL}/config`, {
            method: 'POST',
            headers,
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.config;
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
        const response = await fetch(`${API_BASE_URL}/config/${id}`, {
            method: 'DELETE',
            headers
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
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
        const response = await fetch(`${API_BASE_URL}/config/${id}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
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
        const response = await fetch(`${API_BASE_URL}/config/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(updates)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.config;
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
        const response = await fetch(`${API_BASE_URL}/positions`, { headers });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.positions;
    } catch (error) {
        console.error('[CopyTradeApi] Error fetching positions:', error);
        throw error;
    }
};

/**
 * Fetch target wallet aggregate status for one config
 */
export const getTargetStatus = async (id: string): Promise<CopyTradeTargetStatusResponse> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/config/${id}/target-status`, { headers });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
};
