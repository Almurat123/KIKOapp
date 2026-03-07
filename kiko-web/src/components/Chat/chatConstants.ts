export interface ChatModelOption {
    id: string;
    name: string;
    mode: string;
}

export const MODEL_OPTIONS: ChatModelOption[] = [
    { id: 'deepseek-chat', name: 'DeepSeek-V3.2', mode: 'fast' },
    { id: 'deepseek-reasoner', name: 'DeepSeek-V3.2', mode: 'thinking' },
    { id: 'gpt-5-mini', name: 'ChatGPT-5-mini', mode: 'thinking' },
    { id: 'grok-4-1-fast-reasoning', name: 'Grok-4.1-Fast', mode: 'thinking' },
    { id: 'grok-4-1-fast-non-reasoning', name: 'Grok-4.1-Fast', mode: 'fast' },
];

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

export const ACTION_CARD_TYPE_MAP: Record<string, 'text' | 'strategy-card' | 'chart-card' | 'transaction-status-card'> = {
    show_strategy_card: 'strategy-card',
    show_chart_card: 'chart-card',
    show_transaction_status_card: 'transaction-status-card',
    show_cross_chain_status_card: 'transaction-status-card',
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
