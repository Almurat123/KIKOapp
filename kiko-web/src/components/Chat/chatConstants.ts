// CONTEXT MEMORY
// Updated: 2026-04-15
// Author: Almurat
// Reason: web chat, X mentions, and Farcaster mentions still share one canonical
//         default model, but the product default moved from Grok to GPT. The UI
//         must expose the same canonical default that the backend now uses for
//         new sessions and persisted defaults.
// Goal: keep one stable frontend default model id that matches backend session
//       creation and persisted per-user reply policy.
// Owns: frontend-visible model catalog and canonical default selection helper.
// Does Not Own: backend persistence, pricing, or agent execution.
// Design Language:
// - Do not rely on list order for the default model.
// - Keep UI model ids aligned with backend-supported model ids.
// - Prefer explicit helpers over duplicated literal ids in components.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
// - Kind: repo doc
// - Retrieved: 2026-04-15
// - Applied To: setting `gpt-5.4-mini-2026-03-17` as canonical frontend default
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
export interface ChatModelOption {
    id: string;
    name: string;
    mode: string;
}

export const MODEL_OPTIONS: ChatModelOption[] = [
    { id: 'deepseek-chat', name: 'DeepSeek-V3.2', mode: 'fast' },
    { id: 'deepseek-reasoner', name: 'DeepSeek-V3.2', mode: 'thinking' },
    { id: 'gpt-5.4-mini-2026-03-17', name: 'GPT-5.4-mini', mode: 'thinking' },
    { id: 'grok-4-1-fast-reasoning', name: 'Grok-4.1-Fast', mode: 'thinking' },
    { id: 'grok-4-1-fast-non-reasoning', name: 'Grok-4.1-Fast', mode: 'fast' },
];

export const DEFAULT_CHAT_MODEL_ID = 'gpt-5.4-mini-2026-03-17';

export function findChatModelOption(modelId?: string | null): ChatModelOption | undefined {
    const normalized = String(modelId || '').trim().toLowerCase();
    return MODEL_OPTIONS.find((model) => model.id === normalized);
}

export function getDefaultChatModelOption(): ChatModelOption {
    return findChatModelOption(DEFAULT_CHAT_MODEL_ID) || MODEL_OPTIONS[0];
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
