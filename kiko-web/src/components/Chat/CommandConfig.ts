// CommandConfig.ts - Central command configuration for the Suggestion Engine

export type CommandCategory = 'trading' | 'research' | 'wallet' | 'general';

export interface CommandConfig {
    id: string;
    triggers: string[];           // Multiple triggers: ['swap', 'sw']
    label: string;
    actionText: string;
    score: number;
    category: CommandCategory;
    stages?: string[];            // Progressive stages ids
    stageConfigs?: Record<string, StageConfig>; // Dynamic config for each stage
    options?: CommandOption[];    // Static options (for Tell, What, etc.)
    requiresAddress?: boolean;    // Triggers clipboard paste for address
    requiresLink?: boolean;       // For Polymarket links
}

export interface StageConfig {
    id: string;
    labelTemplate: string;        // e.g. "Swap {amount} {token} to [Paste]"
    actionTextTemplate: string;   // e.g. "Swap {amount} {token} to "
    displayText?: string;
    suggestions?: string;         // Name of the generator function or static list
}

export interface CommandOption {
    id: string;
    label: string;
    actionSuffix: string;         // What to append to the command
    requiresAddress?: boolean;
    requiresLink?: boolean;
}

// ============================================================================
// COMMAND CONFIGURATIONS
// ============================================================================

export const COMMAND_CONFIGS: CommandConfig[] = [
    // --- TRADING ---
    {
        id: 'swap',
        triggers: ['swap', 'sw'],
        label: 'Swap',
        actionText: 'Swap ',
        score: 1000,
        category: 'trading',
        stages: ['ARGS_AMOUNT', 'ARGS_TARGET', 'ARGS_CHAIN'],
        stageConfigs: {
            'ARGS_AMOUNT': {
                id: 'ARGS_AMOUNT',
                labelTemplate: 'Swap {amount} {tokenIn} to [Paste]',
                actionTextTemplate: 'Swap {amount} {tokenIn} to ',
                suggestions: 'getAmountSuggestions'
            },
            'ARGS_TARGET': {
                id: 'ARGS_TARGET',
                labelTemplate: 'Swap ... to {target}',
                actionTextTemplate: 'Swap ... to {target}',
                suggestions: 'getTargetSuggestions'
            }
        }
    },
    {
        id: 'sell',
        triggers: ['sell', 'se'],
        label: 'Sell',
        actionText: 'Sell ',
        score: 950,
        category: 'trading',
        stages: ['ARGS_AMOUNT', 'ARGS_TARGET', 'ARGS_CHAIN'],
        stageConfigs: {
            'ARGS_AMOUNT': {
                id: 'ARGS_AMOUNT',
                labelTemplate: 'Sell {amount} [Paste] to {tokenIn}',
                actionTextTemplate: 'Sell {amount} ',
                suggestions: 'getAmountSuggestions'
            },
            'ARGS_TARGET': {
                id: 'ARGS_TARGET',
                labelTemplate: 'Sell ... to {target}',
                actionTextTemplate: 'Sell ... to {target}',
                suggestions: 'getTargetSuggestions'
            }
        }
    },
    {
        id: 'buy',
        triggers: ['buy', 'bu'],
        label: 'Buy',
        actionText: 'Buy ',
        score: 950,
        category: 'trading',
        stages: ['ARGS_AMOUNT', 'ARGS_TARGET', 'ARGS_CHAIN'],
        stageConfigs: {
            'ARGS_AMOUNT': {
                id: 'ARGS_AMOUNT',
                labelTemplate: 'Buy {amount} {tokenIn} of [Paste]',
                actionTextTemplate: 'Buy {amount} {tokenIn} of ',
                suggestions: 'getAmountSuggestions'
            },
            'ARGS_TARGET': {
                id: 'ARGS_TARGET',
                labelTemplate: 'Buy ... of {target}',
                actionTextTemplate: 'Buy ... of {target}',
                suggestions: 'getTargetSuggestions'
            }
        }
    },
    {
        id: 'copy',
        triggers: ['copy trade', 'copy', 'co'],
        label: 'Copy Trade',
        actionText: 'Copy Trade ',
        score: 900,
        category: 'trading',
        stages: ['ARGS_COPY_TARGET', 'ARGS_COPY_AMOUNT', 'ARGS_CHAIN', 'ARGS_COPY_CONFIG'],
        requiresAddress: true,
        stageConfigs: {
            'ARGS_COPY_TARGET': {
                id: 'ARGS_COPY_TARGET',
                labelTemplate: 'Copy Trade [Paste Wallet Address]',
                actionTextTemplate: 'Copy Trade ',
                suggestions: 'getCopyTargetSuggestions'
            },
            'ARGS_COPY_AMOUNT': {
                id: 'ARGS_COPY_AMOUNT',
                labelTemplate: '{current} with {amount} ETH per trade',
                actionTextTemplate: '{current} with {amount} ETH per trade',
                suggestions: 'getCopyAmountSuggestions'
            },
            'ARGS_COPY_CONFIG': {
                id: 'ARGS_COPY_CONFIG',
                labelTemplate: 'Configure Auto Sell, TP/SL',
                actionTextTemplate: '{current}',
                suggestions: 'getCopyConfigSuggestions'
            }
        }
    },

    // --- WALLET ---
    {
        id: 'show',
        triggers: ['show', 'sh'],
        label: 'Show',
        actionText: 'Show ',
        score: 800,
        category: 'wallet',
        options: [
            { id: 'show-bal', label: 'Show my wallet balance', actionSuffix: 'my wallet balance' }
        ]
    },
    {
        id: 'my',
        triggers: ['my'],
        label: 'My',
        actionText: 'My ',
        score: 800,
        category: 'wallet',
        options: [
            { id: 'my-pnl', label: 'My PNL', actionSuffix: 'PNL' },
            { id: 'my-port', label: 'My portfolio', actionSuffix: 'portfolio' },
            { id: 'my-fav', label: 'My favorites', actionSuffix: 'favorites' }
        ]
    },
    {
        id: 'how_much',
        triggers: ['how much', 'how'],
        label: 'How much',
        actionText: 'How much ',
        score: 750,
        category: 'wallet',
        options: [
            { id: 'how-eth', label: 'How much ETH do I have?', actionSuffix: 'ETH do I have?' }
        ]
    },

    // --- RESEARCH ---
    {
        id: 'check',
        triggers: ['check', 'ch'],
        label: 'Check',
        actionText: 'Check ',
        score: 850,
        category: 'research',
        stages: ['ARGS_CHECK_TARGET', 'ARGS_CHECK_OPTION'],
        requiresAddress: true,
        options: [
            { id: 'check-paste', label: 'Check [Paste Wallet Address]', actionSuffix: '', requiresAddress: true }
        ]
    },
    {
        id: 'what',
        triggers: ['what', 'wh', 'w'],
        label: 'What',
        actionText: "What's ",
        score: 800,
        category: 'research',
        options: [
            { id: 'what-pnl', label: "What's [Paste Address] PNL", actionSuffix: 'PNL', requiresAddress: true },
            { id: 'what-risk', label: "What's [Paste Address] risk", actionSuffix: 'risk', requiresAddress: true },
            { id: 'what-balance', label: "What's [Paste Address] balance", actionSuffix: 'balance', requiresAddress: true }
        ]
    },
    {
        id: 'analyze',
        triggers: ['analyze', 'an'],
        label: 'Analyze',
        actionText: 'Analyze ',
        score: 850,
        category: 'research',
        requiresAddress: true,
        options: [
            { id: 'analyze-paste', label: 'Analyze [Paste Address]', actionSuffix: '', requiresAddress: true }
        ]
    },
    {
        id: 'price',
        triggers: ['price', 'pr'],
        label: 'Price',
        actionText: 'Price of ',
        score: 800,
        category: 'research',
        options: [
            { id: 'price-btc', label: 'Price of BTC', actionSuffix: 'BTC' },
            { id: 'price-eth-hist', label: 'ETH price history', actionSuffix: 'ETH price history' }
        ]
    },
    {
        id: 'gas',
        triggers: ['gas', 'ga'],
        label: 'Gas Price',
        actionText: 'Gas price on ',
        score: 800,
        category: 'research',
        options: [
            { id: 'gas-eth', label: 'Gas price on Ethereum', actionSuffix: 'Ethereum' },
            { id: 'gas-base', label: 'Gas price on Base', actionSuffix: 'Base' },
            { id: 'gas-sol', label: 'Gas price on Solana', actionSuffix: 'Solana' }
        ]
    },
    // --- GENERAL ---
    {
        id: 'help',
        triggers: ['help', 'he'],
        label: 'Help',
        actionText: 'Help',
        score: 600,
        category: 'general',
        options: [
            { id: 'help-do', label: 'What can you do?', actionSuffix: '' }
        ]
    },
    {
        id: 'hi',
        triggers: ['hi', 'hello'],
        label: 'Hi',
        actionText: 'Hi',
        score: 600,
        category: 'general',
        options: [
            { id: 'hi-who', label: 'Hi, who are you?', actionSuffix: ', who are you?' }
        ]
    }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find commands matching the given input using trigger matching
 */
export function findMatchingCommands(input: string): CommandConfig[] {
    const lower = input.toLowerCase().trim();
    if (!lower) return [];

    return COMMAND_CONFIGS.filter(cmd =>
        cmd.triggers.some(trigger => trigger.startsWith(lower) || lower.startsWith(trigger))
    ).sort((a, b) => b.score - a.score);
}

/**
 * Get command by ID
 */
export function getCommandById(id: string): CommandConfig | undefined {
    return COMMAND_CONFIGS.find(cmd => cmd.id === id);
}

/**
 * Get commands by category
 */
export function getCommandsByCategory(category: CommandCategory): CommandConfig[] {
    return COMMAND_CONFIGS.filter(cmd => cmd.category === category);
}

/**
 * Category labels for UI grouping
 */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
    trading: 'TRADING',
    wallet: 'WALLET',
    research: 'RESEARCH',
    general: 'GENERAL'
};

/**
 * Category order for display
 */
export const CATEGORY_ORDER: CommandCategory[] = ['trading', 'wallet', 'research', 'general'];
