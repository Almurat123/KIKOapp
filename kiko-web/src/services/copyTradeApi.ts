import { getAuthToken } from '../utils/authToken';
import { fetchApi } from './api';

// CONTEXT MEMORY
// Updated: 2026-04-08
// Author: Codex
// Reason: Copy-trade read endpoints were repeatedly failing under burst traffic
//         and taking the strategy surface down with them.
// Goal: Keep copy-trade state visible even when the backend rate limits a refresh.
// Owns: Copy-trade GET/POST/PATCH/DELETE request shapes and auth envelope handling.
// Does Not Own: Global retry policy, page-level state merging, or cache invalidation.
// Design Language:
// - Prefer shared request plumbing for reads instead of per-hook ad hoc fetches.
// - Reads may fall back to stale data; mutations must still surface failures plainly.
// - Do not hide signature/auth errors behind rate-limit recovery.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-08-rate-limit-loading-stall.md

// Types matching the Prisma model and API response
export type CopyTradeExecutionMode = 'safe' | 'normal' | 'turbo';

export interface CopyTradeConfig {
    id: string;
    userId: string;
    targetWallet: string;
    chainId: number;
    buyAmountUsd: number;
    maxSlippageBps: number;
    maxEntryDeviationBps?: number | null;
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
    signedNonce?: number | null;
    signerAddress?: string | null;
    signatureScheme?: string | null;
    signatureVerifiedAt?: string | null;
    requiresResign?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CopyTradeSignedEnvelope {
    signedPayload: Record<string, unknown> | string;
    signature: string;
    signerAddress: string;
    nonce: number;
    expiresAt: string | number;
}

export interface CreateConfigParams {
    chainId?: number;
    targetWallet: string;
    buyAmountUsd: number;
    maxSlippageBps?: number;
    maxEntryDeviationBps?: number;
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
    enableDynamicTP?: boolean;
    dynamicTPMinProfitPct?: number;
}

export class CopyTradeApiError extends Error {
    code?: string;
    status?: number;

    constructor(message: string, code?: string, status?: number) {
        super(message);
        this.name = 'CopyTradeApiError';
        this.code = code;
        this.status = status;
    }
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
        targetProfitUsd?: number;
        targetLossUsd?: number;
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

const parseErrorResponse = async (response: Response): Promise<CopyTradeApiError> => {
    let payload: any = null;
    try {
        payload = await response.json();
    } catch {
        // ignore json parsing failures
    }

    const message = payload?.error || payload?.message || `HTTP ${response.status}: ${response.statusText}`;
    const code = payload?.code || payload?.errorCode;
    return new CopyTradeApiError(message, code, response.status);
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

        const data = await fetchApi<{ configs?: CopyTradeConfig[] }>('/api/copy-trade/configs');
        return data?.configs || [];
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
export const createConfig = async (
    params: CreateConfigParams,
    signed: CopyTradeSignedEnvelope
): Promise<CopyTradeConfig> => {
    try {
        const headers = await getHeaders();
        const response = await fetch(`${API_BASE_URL}/config`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ...signed,
                signedPayload: signed.signedPayload || params,
            })
        });

        if (!response.ok) {
            throw await parseErrorResponse(response);
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
export const deleteConfig = async (id: string, signed: CopyTradeSignedEnvelope): Promise<void> => {
    try {
        const headers = await getHeaders();
        const response = await fetch(`${API_BASE_URL}/config/${id}`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify(signed)
        });

        if (!response.ok) {
            throw await parseErrorResponse(response);
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
            throw await parseErrorResponse(response);
        }
    } catch (error) {
        console.error('[CopyTradeApi] Error updating status:', error);
        throw error;
    }
};

/**
 * Update a copy trade config
 */
export const updateConfig = async (id: string, signed: CopyTradeSignedEnvelope): Promise<CopyTradeConfig> => {
    try {
        const headers = await getHeaders();
        const response = await fetch(`${API_BASE_URL}/config/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(signed)
        });

        if (!response.ok) {
            throw await parseErrorResponse(response);
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
        const token = await getAuthToken();
        if (!token) {
            console.warn('[CopyTradeApi] No token available, skipping positions fetch.');
            return [];
        }
        const data = await fetchApi<{ positions?: any[] }>('/api/copy-trade/positions');
        return data?.positions || [];
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
        throw await parseErrorResponse(response);
    }
    return response.json();
};
