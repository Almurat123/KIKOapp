// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Almurat
// Reason: web chat, X mentions, and Farcaster mentions still share one canonical
//         default model. The product default moved from GPT to the free Kimi
//         2.5 Instant/Fast model, and the UI must expose the same canonical
//         default that the backend now uses for new sessions and persisted
//         defaults. The selectable normal-model family has also moved from
//         DeepSeek ids to NVIDIA-hosted GLM/Kimi ids. The same catalog now also
//         needs a first-party vision capability flag so image-upload turns do
//         not silently route into text-only models. The chat composer now
//         presents borderless model and thinking selectors side by side, so
//         this catalog also owns the grouping metadata that lets the UI split a
//         saved model id into family and reasoning-strength controls without
//         inventing a new backend field or a separate family-default table.
//         GPT-5.4 mini now exposes only the product-visible Low/Medium subset
//         of the documented reasoning-effort ladder while the NVIDIA/XAI
//         families keep the binary Fast/Thinking choices.
// Goal: keep one stable frontend default model id that matches backend session
//       creation and persisted per-user reply policy, while exposing whether a
//       chat model can accept current-turn image input.
// Owns: frontend-visible model catalog, canonical default selection helper, and
//       first-party image-capability checks.
// Does Not Own: backend persistence, pricing, or agent execution.
// Design Language:
// - Do not rely on list order for the default model.
// - Keep UI model ids aligned with backend-supported model ids.
// - Prefer explicit helpers over duplicated literal ids in components.
// - Image upload UI must not imply vision support on text-only models.
// - UI family/reasoning selectors must resolve back to real persisted model ids.
// - Per-family fallback must come from the actual option list, not a guessed
//   reasoning-default map; the first declared option in each family is the
//   canonical fallback.
// - Reasoning labels must come from actual model variants or documented effort ladders, not synthetic tiers.
// - GPT-5.4 mini only surfaces the product-approved Low/Medium subset of its
//   documented effort ladder; do not synthesize Fast, High, or Extra High for GPT.
// - GPT display labels must be derived from the active effort state, not a
//   stale serialized `reasoningLabel` field.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: setting `kimi-k2-5-instant` as canonical frontend default
// - Verification: verified in code
// - Source: NVIDIA NIM model pages for moonshotai/kimi-k2-5 and z-ai/glm5
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: frontend-visible GLM/Kimi model ids and mode labels
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: exposing image-capable model checks in the frontend send flow
// - Verification: verified in code
// - Source: OpenAI GPT-5.4 and GPT-5.4 mini model pages
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: confirming GPT-5.4 mini supports a real reasoning-effort ladder
//   and constraining the selector to the product-visible Low/Medium subset
// - Verification: verified in docs
// - Source: OpenAI latest model guide FAQ
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: using ChatGPT-facing Instant/Thinking terminology as the
//   user-facing mental model for the selector
// - Verification: verified in docs
// - Source: /Users/almurat/KiKo/kiko-api/src/routes/ai.ts
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: exposing `glm-5-reasoning` as a real backend-supported alias
//   instead of inventing a synthetic extra tier
// - Verification: verified in code
// - Source: user request and screenshot reference for borderless model plus Reasoning selectors
// - Kind: product doc
// - Retrieved: 2026-04-17
// - Applied To: grouping model ids into family and reasoning controls in the chat composer
// - Verification: inferred
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
export type ChatReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';
export type ChatReasoningLevel = 'fast' | 'thinking' | ChatReasoningEffort;

export type ChatModelFamilyId = 'glm-5' | 'kimi-k2-5' | 'gpt-5.4-mini' | 'grok-4-1-fast';

export interface ChatModelOption {
    id: string;
    name: string;
    mode: string;
    familyId: ChatModelFamilyId;
    reasoningLevel: ChatReasoningLevel;
    reasoningLabel: string;
    reasoningEffort?: ChatReasoningEffort;
}

interface ChatModelFamilyReasoningOption {
    id: ChatReasoningLevel;
    label: string;
    effort?: ChatReasoningEffort;
}

const BINARY_REASONING_OPTIONS: ChatModelFamilyReasoningOption[] = [
    { id: 'fast', label: 'Fast' },
    { id: 'thinking', label: 'Thinking' },
];

const GPT_54_MINI_REASONING_OPTIONS: ChatModelFamilyReasoningOption[] = [
    { id: 'low', label: 'Low', effort: 'low' },
    { id: 'medium', label: 'Medium', effort: 'medium' },
];

function normalizeGpt54ReasoningLevel(level?: string | null): ChatReasoningEffort {
    const normalized = String(level || '').trim().toLowerCase();
    if (normalized === 'medium' || normalized === 'high' || normalized === 'xhigh') {
        return 'medium';
    }
    return 'low';
}

export const MODEL_OPTIONS: ChatModelOption[] = [
    { id: 'glm-5', name: 'GLM-5', mode: 'fast', familyId: 'glm-5', reasoningLevel: 'fast', reasoningLabel: 'Fast' },
    { id: 'glm-5-reasoning', name: 'GLM-5', mode: 'thinking', familyId: 'glm-5', reasoningLevel: 'thinking', reasoningLabel: 'Thinking' },
    { id: 'kimi-k2-5-instant', name: 'Kimi-K2.5', mode: 'fast', familyId: 'kimi-k2-5', reasoningLevel: 'fast', reasoningLabel: 'Fast' },
    { id: 'kimi-k2-5-reasoning', name: 'Kimi-K2.5', mode: 'thinking', familyId: 'kimi-k2-5', reasoningLevel: 'thinking', reasoningLabel: 'Thinking' },
    { id: 'gpt-5.4-mini-2026-03-17', name: 'GPT-5.4-Mini', mode: 'thinking', familyId: 'gpt-5.4-mini', reasoningLevel: 'low', reasoningLabel: 'Low', reasoningEffort: 'low' },
    { id: 'grok-4-1-fast-non-reasoning', name: 'Grok-4.1-Fast', mode: 'fast', familyId: 'grok-4-1-fast', reasoningLevel: 'fast', reasoningLabel: 'Fast' },
    { id: 'grok-4-1-fast-reasoning', name: 'Grok-4.1-Fast', mode: 'thinking', familyId: 'grok-4-1-fast', reasoningLevel: 'thinking', reasoningLabel: 'Thinking' },
];

export const DEFAULT_CHAT_MODEL_ID = 'kimi-k2-5-instant';

export function findChatModelOption(modelId?: string | null): ChatModelOption | undefined {
    const normalized = String(modelId || '').trim().toLowerCase();
    return MODEL_OPTIONS.find((model) => model.id === normalized);
}

export function getDefaultChatModelOption(): ChatModelOption {
    return findChatModelOption(DEFAULT_CHAT_MODEL_ID) || MODEL_OPTIONS[0];
}

const MODEL_FAMILY_ORDER: ChatModelFamilyId[] = ['glm-5', 'kimi-k2-5', 'gpt-5.4-mini', 'grok-4-1-fast'];

const FAMILY_REASONING_OPTIONS: Record<ChatModelFamilyId, ChatModelFamilyReasoningOption[]> = {
    'glm-5': BINARY_REASONING_OPTIONS,
    'kimi-k2-5': BINARY_REASONING_OPTIONS,
    'gpt-5.4-mini': GPT_54_MINI_REASONING_OPTIONS,
    'grok-4-1-fast': BINARY_REASONING_OPTIONS,
};

function normalizeModelFamilyId(modelId?: string | null): ChatModelFamilyId | undefined {
    const normalized = String(modelId || '').trim().toLowerCase();
    if (!normalized) return undefined;
    const existing = MODEL_OPTIONS.find((model) => model.id === normalized)?.familyId;
    if (existing) return existing;
    if (normalized.startsWith('kimi-k2-5') || normalized.startsWith('moonshotai/kimi-k2-5') || normalized.startsWith('kimi-k2.5') || normalized.startsWith('moonshotai/kimi-k2.5')) return 'kimi-k2-5';
    if (normalized.startsWith('grok-4-1-fast')) return 'grok-4-1-fast';
    if (normalized.startsWith('gpt-5.4-mini')) return 'gpt-5.4-mini';
    if (normalized.startsWith('glm-5') || normalized.startsWith('glm5') || normalized.startsWith('z-ai/glm5') || normalized.startsWith('z-ai/glm-5')) return 'glm-5';
    return undefined;
}

export interface ChatModelFamilyOption {
    id: ChatModelFamilyId;
    name: string;
    reasoningOptions: ChatModelFamilyReasoningOption[];
}

export function getChatModelFamilyOptions(): ChatModelFamilyOption[] {
    return MODEL_FAMILY_ORDER.flatMap((familyId) => {
        const familyModels = MODEL_OPTIONS.filter((model) => model.familyId === familyId);
        const reasoningOptions = FAMILY_REASONING_OPTIONS[familyId] || [];
        if (familyModels.length === 0 || reasoningOptions.length === 0) return [];

        return [{
            id: familyId,
            name: familyModels[0].name,
            reasoningOptions,
        }];
    });
}

export function findChatModelFamilyOption(modelId?: string | null): ChatModelFamilyOption | undefined {
    const familyId = normalizeModelFamilyId(modelId);
    if (!familyId) return undefined;
    return getChatModelFamilyOptions().find((family) => family.id === familyId);
}

export function findChatModelOptionByFamilyAndReasoning(
    familyId?: string | null,
    reasoningLevel?: ChatReasoningLevel | null,
): ChatModelOption | undefined {
    const normalizedFamilyId = normalizeModelFamilyId(familyId);
    if (!normalizedFamilyId) return undefined;

    const familyModels = MODEL_OPTIONS.filter((model) => model.familyId === normalizedFamilyId);
    if (familyModels.length === 0) return undefined;

    const familyReasoningOptions = FAMILY_REASONING_OPTIONS[normalizedFamilyId] || [];
    const normalizedReasoning = String(reasoningLevel || '').trim().toLowerCase() as ChatReasoningLevel;

    if (normalizedFamilyId === 'gpt-5.4-mini') {
        const normalizedGptReasoning = normalizeGpt54ReasoningLevel(normalizedReasoning);
        const requestedReasoning = familyReasoningOptions.find((option) => option.id === normalizedGptReasoning)
            || familyReasoningOptions[0];
        if (!requestedReasoning) return familyModels[0];
        return {
            id: familyModels[0].id,
            name: familyModels[0].name,
            mode: 'thinking',
            familyId: normalizedFamilyId,
            reasoningLevel: requestedReasoning.id,
            reasoningLabel: requestedReasoning.label,
            reasoningEffort: requestedReasoning.effort || 'low',
        };
    }

    const requested = familyModels.find((model) => model.reasoningLevel === normalizedReasoning);
    if (requested) return requested;

    return familyModels[0];
}

export function getChatReasoningLabel(modelId?: string | null): string {
    return findChatModelOption(modelId)?.reasoningLabel || 'Low';
}

export function getDisplayedChatReasoningLabel(
    model?: Pick<ChatModelOption, 'familyId' | 'reasoningLevel' | 'reasoningEffort' | 'reasoningLabel'> | null,
): string {
    if (!model) return 'Low';
    if (model.familyId === 'gpt-5.4-mini') {
        const normalized = normalizeGpt54ReasoningLevel(model.reasoningEffort || model.reasoningLevel);
        return normalized === 'medium' ? 'Medium' : 'Low';
    }
    return model.reasoningLabel || 'Fast';
}

export function hydrateChatModelOption(value?: unknown): ChatModelOption | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') {
        return findChatModelOption(value);
    }
    if (typeof value !== 'object') return undefined;

    const candidate = value as {
        id?: string;
        reasoningLevel?: ChatReasoningLevel | null;
        reasoningEffort?: ChatReasoningEffort | null;
    };
    const familyId = normalizeModelFamilyId(candidate.id);
    if (!familyId) return undefined;

    const savedReasoning = String(candidate.reasoningEffort || candidate.reasoningLevel || '').trim().toLowerCase() as ChatReasoningLevel;

    return findChatModelOptionByFamilyAndReasoning(familyId, savedReasoning || undefined)
        || findChatModelOption(candidate.id);
}

export function supportsVisionChatModel(modelId?: string | null): boolean {
    const normalized = String(modelId || '').trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.startsWith('gpt') || normalized.startsWith('o')) return true;
    if (normalized.includes('grok')) return true;
    return normalized.includes('kimi');
}

export const COMMON_TOKENS: Record<number, Array<{ address: string; symbol: string; decimals: number }>> = {
    1: [
        { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
        { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
        { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 },
    ],
    8453: [
        { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
        { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDbC', decimals: 6 },
        { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
    ],
    56: [
        { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD', decimals: 18 },
    ],
};

export const ACTION_CARD_TYPE_MAP: Record<string, 'text' | 'strategy-card' | 'chart-card' | 'transaction-status-card' | 'polymarket-embed'> = {
    show_strategy_card: 'strategy-card',
    show_chart_card: 'chart-card',
    show_transaction_status_card: 'transaction-status-card',
    show_cross_chain_status_card: 'transaction-status-card',
    show_polymarket_card: 'polymarket-embed',
};

export const formatChatDateSeparator = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStrToday = today.toISOString().split('T')[0];
    const dateStrYesterday = yesterday.toISOString().split('T')[0];

    if (dateStr === dateStrToday) return 'Today';
    if (dateStr === dateStrYesterday) return 'Yesterday';
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
};
