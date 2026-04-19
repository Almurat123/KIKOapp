/**
 * User Settings API Service
 * Handles saving/loading user custom AI settings from backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const USER_SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;

interface UserSettingsCacheEntry {
    authKey: string;
    data: UserSettings | null;
    cachedAt: number;
}

let userSettingsCache: UserSettingsCacheEntry | null = null;
const userSettingsInFlight = new Map<string, Promise<UserSettings | null>>();

// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Rowan
// Reason: Chat and welcome surfaces were each re-reading `/api/users/settings`,
//         which amplified rate limits during ordinary navigation and route churn.
// Goal: reuse one recent settings snapshot across chat-related owners so model
//       defaults, reasoning strength, and swap preferences do not re-hit the
//       backend on every mount.
// Owns: User-settings read dedupe, short-lived cache reuse, cache invalidation
//       after saves, and the cached remote default model/reasoning snapshot.
// Does Not Own: Settings interpretation inside pages, auth token minting, or backend persistence rules.
// Design Language:
// - identical settings reads should share one request
// - recent settings should be reused instead of reloaded on every mount
// - forbidden local patch patterns: each chat surface fetching `/api/users/settings` independently
// - remote default model saves must carry the paired reasoning level for split-effort families
// Document Provenance:
// - Source: Production console traces showing `/api/users/settings` 429s alongside token-page navigation
// - Kind: runtime observation
// - Retrieved: 2026-04-10
// - Applied To: add shared cache and in-flight dedupe for user settings
// - Source: operator bug report that model choice and thinking strength reset after refresh
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: caching and saving the paired default reasoning level
// - Verification: partially verified
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-token-page-stray-read-rate-limit.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md

export interface UserSettings {
    // userRole removed
    defaultChatModel?: string;
    defaultChatReasoningLevel?: string;
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

function getFreshUserSettings(authKey: string): UserSettings | null | undefined {
    if (
        userSettingsCache
        && userSettingsCache.authKey === authKey
        && (Date.now() - userSettingsCache.cachedAt) < USER_SETTINGS_CACHE_TTL_MS
    ) {
        return userSettingsCache.data;
    }
    return undefined;
}

/**
 * Get user settings from backend
 */
export async function getUserSettings(accessToken: string): Promise<UserSettings | null> {
    const authKey = accessToken || 'anonymous';
    const cached = getFreshUserSettings(authKey);
    if (cached !== undefined) {
        return cached;
    }

    const inFlight = userSettingsInFlight.get(authKey);
    if (inFlight) {
        return inFlight;
    }

    const request = (async () => {
        try {
        const response = await fetch(`${API_BASE}/api/users/settings`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            console.warn('[UserSettingsApi] Failed to get settings:', response.status);
            return getFreshUserSettings(authKey) ?? null;
        }

        const data = await response.json();
        const next = data.success ? data.data : null;
        userSettingsCache = {
            authKey,
            data: next,
            cachedAt: Date.now(),
        };
        return next;
        } catch (error) {
            console.error('[UserSettingsApi] Error getting settings:', error);
            return getFreshUserSettings(authKey) ?? null;
        }
    })();

    userSettingsInFlight.set(authKey, request);
    try {
        return await request;
    } finally {
        userSettingsInFlight.delete(authKey);
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
        if (data.success) {
            const existing = userSettingsCache?.authKey === accessToken ? (userSettingsCache.data || null) : null;
            userSettingsCache = {
                authKey: accessToken,
                data: existing ? { ...existing, ...settings } : ({ ...settings } as UserSettings),
                cachedAt: Date.now(),
            };
        }
        return data.success;
    } catch (error) {
        console.error('[UserSettingsApi] Error saving settings:', error);
        return false;
    }
}
