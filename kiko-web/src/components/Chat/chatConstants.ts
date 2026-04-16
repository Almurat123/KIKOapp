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
//         not silently route into text-only models.
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
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
export interface ChatModelOption {
    id: string;
    name: string;
    mode: string;
}

export const MODEL_OPTIONS: ChatModelOption[] = [
    { id: 'glm-5', name: 'GLM-5', mode: 'thinking' },
    { id: 'kimi-k2-5-reasoning', name: 'Kimi-K2.5', mode: 'thinking' },
    { id: 'kimi-k2-5-instant', name: 'Kimi-K2.5', mode: 'fast' },
    { id: 'gpt-5.4-mini-2026-03-17', name: 'GPT-5.4-mini', mode: 'thinking' },
    { id: 'grok-4-1-fast-reasoning', name: 'Grok-4.1-Fast', mode: 'thinking' },
    { id: 'grok-4-1-fast-non-reasoning', name: 'Grok-4.1-Fast', mode: 'fast' },
];

export const DEFAULT_CHAT_MODEL_ID = 'kimi-k2-5-instant';

export function findChatModelOption(modelId?: string | null): ChatModelOption | undefined {
    const normalized = String(modelId || '').trim().toLowerCase();
    return MODEL_OPTIONS.find((model) => model.id === normalized);
}

export function getDefaultChatModelOption(): ChatModelOption {
    return findChatModelOption(DEFAULT_CHAT_MODEL_ID) || MODEL_OPTIONS[0];
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
