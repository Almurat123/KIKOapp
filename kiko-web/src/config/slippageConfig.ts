/**
 * Slippage Configuration (minimal: no dynamic calculation, no extra requests)
 */

export type SlippageMode = 'auto' | 'custom';

export interface SlippageConfig {
    mode: SlippageMode;
    customValue: number; // in percentage (0.5 = 0.5%)
    autoValue?: number; // when mode=auto, display value (same as AUTO_SLIPPAGE_PERCENT)
}

/** When mode is "auto", use this single value (%). No tiers, no API, no risk calc. */
export const AUTO_SLIPPAGE_PERCENT = 10;

/**
 * Convert slippage percentage to basis points
 */
export function slippageToBps(slippagePercent: number): number {
    return Math.round(slippagePercent * 100);
}

/**
 * Convert basis points to slippage percentage
 */
export function bpsToSlippage(bps: number): number {
    return bps / 100;
}

/**
 * Default slippage config
 */
export const DEFAULT_SLIPPAGE_CONFIG: SlippageConfig = {
    mode: 'auto',
    customValue: 0.5,
};

// --- Single source of truth for all trading systems ---
// 1) Custom settings (CustomAISettingsModal): kiko-custom-ai-settings.slippageMode + customSlippage
// 2) Fallback: Swap card value in kiko-swap-slippage (percentage number)

export const SLIPPAGE_STORAGE_KEY = 'kiko-swap-slippage';
const CUSTOM_AI_SETTINGS_KEY = 'kiko-custom-ai-settings';
const DEFAULT_SLIPPAGE_PERCENT = 0.5;
const DEFAULT_SLIPPAGE_BPS = 50;

function getSlippagePercentFromCustomSettings(): number | null {
    try {
        const saved = localStorage.getItem(CUSTOM_AI_SETTINGS_KEY);
        if (!saved) return null;
        const data = JSON.parse(saved) as { slippageMode?: string; customSlippage?: number | '' };
        if (data.slippageMode !== 'custom') return null;
        const p = data.customSlippage;
        const percent = typeof p === 'number' ? p : parseFloat(String(p));
        if (!Number.isFinite(percent) || percent < 0.1 || percent > 50) return null;
        return percent;
    } catch {
        return null;
    }
}

/**
 * Read user's slippage tolerance in basis points.
 * Priority: Custom settings (slippageMode=custom, customSlippage) → kiko-swap-slippage → default 50.
 * Used by: API calls, Chat instant swap, strategies, and all swap execution paths.
 */
export function getStoredSlippageBps(): number {
    const fromCustom = getSlippagePercentFromCustomSettings();
    if (fromCustom != null) return Math.round(fromCustom * 100);
    try {
        const saved = localStorage.getItem(SLIPPAGE_STORAGE_KEY);
        if (saved == null) return DEFAULT_SLIPPAGE_BPS;
        const percent = parseFloat(saved);
        if (!Number.isFinite(percent) || percent < 0.1 || percent > 50) return DEFAULT_SLIPPAGE_BPS;
        return Math.round(percent * 100);
    } catch {
        return DEFAULT_SLIPPAGE_BPS;
    }
}

/**
 * Read user's slippage tolerance in percentage (e.g. 0.5 for 0.5%).
 * Same priority: Custom settings → kiko-swap-slippage → default.
 */
export function getStoredSlippagePercent(): number {
    const fromCustom = getSlippagePercentFromCustomSettings();
    if (fromCustom != null) return fromCustom;
    try {
        const saved = localStorage.getItem(SLIPPAGE_STORAGE_KEY);
        if (saved == null) return DEFAULT_SLIPPAGE_PERCENT;
        const percent = parseFloat(saved);
        if (!Number.isFinite(percent) || percent < 0.1 || percent > 50) return DEFAULT_SLIPPAGE_PERCENT;
        return percent;
    } catch {
        return DEFAULT_SLIPPAGE_PERCENT;
    }
}

/**
 * Persist user's slippage (percentage). Call this whenever the user changes slippage in the Swap UI.
 */
export function setStoredSlippagePercent(percent: number): void {
    try {
        const value = Math.max(0.1, Math.min(50, percent));
        localStorage.setItem(SLIPPAGE_STORAGE_KEY, value.toString());
    } catch {
        // ignore
    }
}
