/**
 * User Settings API Service
 * Handles saving/loading user custom AI settings from backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface UserSettings {
    userRole: string;
    defaultSwapAmount: number;
    defaultSwapUnit: string;
    checkTokenBeforeSwap: boolean;


    slippageMode: string;
    customSlippage: number | '';
    mevProtection: boolean;
    priceDeviationCheck: boolean;

    fastSwapMode?: boolean;
    copyTradeTokenCooldownMinutes?: number | null;
    minMarketCapUsd?: number | null;
    minLiquidityUsd?: number | null;
    minTargetValueUsd?: number | null;
}


/**
 * Get user settings from backend
 */
export async function getUserSettings(accessToken: string): Promise<UserSettings | null> {
    try {
        const response = await fetch(`${API_BASE}/api/users/settings`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            console.warn('[UserSettingsApi] Failed to get settings:', response.status);
            return null;
        }

        const data = await response.json();
        return data.success ? data.data : null;
    } catch (error) {
        console.error('[UserSettingsApi] Error getting settings:', error);
        return null;
    }
}

/**
 * Save user settings to backend
 */
export async function saveUserSettings(accessToken: string, settings: Partial<UserSettings>): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/api/users/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(settings),
        });

        if (!response.ok) {
            console.error('[UserSettingsApi] Failed to save settings:', response.status);
            return false;
        }

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('[UserSettingsApi] Error saving settings:', error);
        return false;
    }
}
