// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Rowan
// Reason: chat v2 was exposing user settings to the model through multiple
//         inconsistent shapes: a catalog label, a read-tool payload, and an
//         extra execution-mode prose block. That made execution preferences
//         noisy and harder for the model to consume deterministically.
//         Product review on 2026-04-18 clarified the worker needs to
//         distinguish hard user constraints from soft defaults so the model can
//         obey non-negotiable execution rules without treating every preference
//         like a mandatory workflow gate.
// Goal: keep model-visible user settings in one compact contract shape that
//       can be reused by prompt assembly and read-context tools.
// Owns: model-facing normalization of chat user settings and derived execution mode.
// Does Not Own: persistence of user settings, UI defaults, or execution gating.
// Design Language:
// - user settings exposed to the model must be structured, not mixed prose
// - derived execution mode belongs in the contract so prompt layers do not need extra narrative blocks
// - absent settings may stay absent unless the product has a real runtime default
// - contract fields should use stable snake_case keys for model readability
// - hard constraints and soft preferences must be separated so the worker can
//   obey non-negotiable rules without overfitting to defaults
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: keeping runtime context available through explicit structured contracts
// - Verification: inferred from plan and verified in code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-17
// - Applied To: removing messy multi-shape user-settings prompt exposure from execution turns
// - Verification: verified against runtime transcript and code
// - Source: product owner correction in local runtime thread about actual
//   execution workflow and quote-confirmation behavior
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: separating hard constraints from soft preferences in the
//   model-facing user settings contract
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-user-settings-contract.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-work-protocol-refactor.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type ModelUserSettingsContract = {
    execution_mode: 'fast_swap' | 'quote_before_swap' | 'direct';
    hard_constraints: {
        quote_required_before_swap: boolean;
    };
    soft_preferences?: {
        fast_swap_enabled?: boolean;
        quick_swap_enabled?: boolean;
    };
    swap_defaults?: {
        amount?: string | number;
        unit?: string | number;
        slippage_mode?: string | number;
        custom_slippage_pct?: string | number;
    };
    safety_checks?: {
        mev_protection?: boolean;
        price_deviation_check?: boolean;
    };
    copy_trade?: {
        ai_mode?: string | number;
    };
};

export function buildUserSettingsContract(settings: Record<string, any>): ModelUserSettingsContract {
    const executionMode = resolveExecutionMode(settings);
    const softPreferences = stripEmptyEntries({
        fast_swap_enabled: asBoolean(settings.fastSwapMode),
        quick_swap_enabled: asBoolean(settings.quickSwapMode),
    });
    const swapDefaults = stripEmptyEntries({
        amount: normalizeStringOrNumber(settings.defaultSwapAmount),
        unit: normalizeStringOrNumber(settings.defaultSwapUnit),
        slippage_mode: normalizeStringOrNumber(settings.slippageMode),
        custom_slippage_pct: normalizeStringOrNumber(settings.customSlippage),
    });
    const safetyChecks = stripEmptyEntries({
        mev_protection: asBoolean(settings.mevProtection),
        price_deviation_check: asBoolean(settings.priceDeviationCheck),
    });
    const copyTrade = stripEmptyEntries({
        ai_mode: normalizeStringOrNumber(settings.copyTradeAIMode),
    });

    return stripEmptyEntries({
        execution_mode: executionMode,
        hard_constraints: {
            quote_required_before_swap: executionMode === 'quote_before_swap',
        },
        soft_preferences: softPreferences,
        swap_defaults: swapDefaults,
        safety_checks: safetyChecks,
        copy_trade: copyTrade,
    });
}

function resolveExecutionMode(settings: Record<string, any>): ModelUserSettingsContract['execution_mode'] {
    if (asBoolean(settings.fastSwapMode)) {
        return 'fast_swap';
    }
    if (settings.showQuoteBeforeSwap !== false) {
        return 'quote_before_swap';
    }
    return 'direct';
}

function asBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return undefined;
}

function normalizePrimitive(value: unknown): string | number | boolean | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return undefined;
}

function normalizeStringOrNumber(value: unknown): string | number | undefined {
    const primitive = normalizePrimitive(value);
    if (typeof primitive === 'string' || typeof primitive === 'number') {
        return primitive;
    }
    return undefined;
}

function stripEmptyEntries<T extends Record<string, any>>(input: T): T {
    return Object.fromEntries(
        Object.entries(input).filter(([, value]) => {
            if (value === null || value === undefined) return false;
            if (typeof value === 'string' && !value.trim()) return false;
            if (Array.isArray(value) && value.length === 0) return false;
            if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;
            return true;
        }),
    ) as T;
}
