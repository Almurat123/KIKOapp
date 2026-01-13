/**
 * CommandRegistry - IDE-like Code Completion Command Definitions
 * 
 * Centralized registry of all available commands with:
 * - Pattern matching with parameters
 * - Aliases for flexible matching
 * - Parameter definitions with types and defaults
 */

export interface ParamDef {
    name: string;
    type: 'number' | 'token' | 'address' | 'string';
    required: boolean;
    storageKey?: string; // localStorage key for parameter memory
    placeholder?: string;
}

export interface CommandDef {
    name: string;
    pattern: string;
    aliases: string[];
    description: string;
    descriptionCN?: string;
    params: ParamDef[];
    category: 'trading' | 'analysis' | 'social' | 'general';
}

// All available commands
export const COMMAND_REGISTRY: CommandDef[] = [
    // Trading Commands
    {
        name: 'swap',
        pattern: 'swap {amount} {tokenIn} to {tokenOut}',
        aliases: ['buy', 'sell', 'trade', 'exchange'],
        description: 'Exchange tokens',
        descriptionCN: '代币交换',
        category: 'trading',
        params: [
            { name: 'amount', type: 'number', required: true, storageKey: 'kiko-param-amount', placeholder: '0.01' },
            { name: 'tokenIn', type: 'token', required: true, storageKey: 'kiko-param-tokenIn', placeholder: 'ETH' },
            { name: 'tokenOut', type: 'token', required: true, storageKey: 'kiko-param-tokenOut', placeholder: 'USDC' }
        ]
    },
    {
        name: 'token info',
        pattern: 'token info {address}',
        aliases: ['info', 'token', 'details'],
        description: 'Get token fundamentals',
        descriptionCN: '获取代币信息',
        category: 'analysis',
        params: [
            { name: 'address', type: 'address', required: true, storageKey: 'kiko-param-address' }
        ]
    },
    {
        name: 'chart',
        pattern: 'chart {address}',
        aliases: ['price', 'graph'],
        description: 'View price chart',
        descriptionCN: '查看价格图表',
        category: 'analysis',
        params: [
            { name: 'address', type: 'address', required: true, storageKey: 'kiko-param-address' }
        ]
    },
    {
        name: 'analyze pnl',
        pattern: 'analyze pnl {address}',
        aliases: ['pnl', 'my pnl', 'profit', 'loss'],
        description: 'Analyze wallet PNL',
        descriptionCN: '分析钱包盈亏',
        category: 'analysis',
        params: [
            { name: 'address', type: 'address', required: false, storageKey: 'kiko-param-wallet' }
        ]
    },
    {
        name: 'wallet info',
        pattern: 'wallet info {address}',
        aliases: ['wallet', 'balance', 'portfolio'],
        description: 'Get wallet information',
        descriptionCN: '获取钱包信息',
        category: 'analysis',
        params: [
            { name: 'address', type: 'address', required: false, storageKey: 'kiko-param-wallet' }
        ]
    },
    // Discovery Commands
    {
        name: 'get trending tokens',
        pattern: 'get trending tokens',
        aliases: ['trending', 'hot', 'popular tokens'],
        description: 'Show trending tokens',
        descriptionCN: '显示热门代币',
        category: 'general',
        params: []
    },
    {
        name: 'trending casts',
        pattern: 'trending casts',
        aliases: ['farcaster', 'fc', 'casts', 'social'],
        description: 'Show trending Farcaster casts',
        descriptionCN: '显示热门 Farcaster 动态',
        category: 'social',
        params: []
    },
    // Copy Trading
    {
        name: 'copy trade',
        pattern: 'copy trade {address}',
        aliases: ['copy', 'follow trader'],
        description: 'Copy a wallet\'s trades',
        descriptionCN: '跟单某钱包',
        category: 'trading',
        params: [
            { name: 'address', type: 'address', required: true, storageKey: 'kiko-param-copyAddress' }
        ]
    },
    {
        name: 'list copy trades',
        pattern: 'list copy trades',
        aliases: ['my copies', 'copy configs'],
        description: 'List active copy trade configs',
        descriptionCN: '列出跟单配置',
        category: 'trading',
        params: []
    },
    // Token Analysis
    {
        name: 'early buyers',
        pattern: 'early buyers {address}',
        aliases: ['sniper', 'first buyers'],
        description: 'Analyze early token buyers',
        descriptionCN: '分析早期买家',
        category: 'analysis',
        params: [
            { name: 'address', type: 'address', required: true, storageKey: 'kiko-param-address' }
        ]
    },
    {
        name: 'token risk',
        pattern: 'token risk {address}',
        aliases: ['risk', 'rug check', 'safety'],
        description: 'Check token risk',
        descriptionCN: '检查代币风险',
        category: 'analysis',
        params: [
            { name: 'address', type: 'address', required: true, storageKey: 'kiko-param-address' }
        ]
    },
    // Polymarket
    {
        name: 'polymarket trending',
        pattern: 'polymarket trending',
        aliases: ['prediction', 'betting', 'markets'],
        description: 'Show trending prediction markets',
        descriptionCN: '显示热门预测市场',
        category: 'general',
        params: []
    },
    // Utility
    {
        name: 'gas price',
        pattern: 'gas price',
        aliases: ['gas', 'gwei'],
        description: 'Check current gas price',
        descriptionCN: '查看当前 Gas 价格',
        category: 'general',
        params: []
    },
    {
        name: 'help',
        pattern: 'help',
        aliases: ['?', 'commands', 'what can you do'],
        description: 'Show available commands',
        descriptionCN: '显示可用命令',
        category: 'general',
        params: []
    }
];

/**
 * Parameter Memory - Save and load user's last used parameter values
 */
export const ParamMemory = {
    save(paramName: string, value: string): void {
        try {
            localStorage.setItem(`kiko-param-${paramName}`, value);
        } catch (e) {
            console.warn('Failed to save param memory:', e);
        }
    },

    load(paramName: string): string | null {
        try {
            return localStorage.getItem(`kiko-param-${paramName}`);
        } catch (e) {
            return null;
        }
    },

    loadAll(): Record<string, string> {
        const memory: Record<string, string> = {};
        const keys = ['amount', 'tokenIn', 'tokenOut', 'address', 'wallet', 'copyAddress'];

        for (const key of keys) {
            const value = this.load(key);
            if (value) memory[key] = value;
        }

        return memory;
    },

    // Extract and save parameters from executed command
    extractAndSave(text: string): void {
        // Extract amount (number pattern)
        const amountMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
        if (amountMatch) {
            this.save('amount', amountMatch[1]);
        }

        // Extract addresses (EVM and Solana)
        const evmMatch = text.match(/0x[a-fA-F0-9]{40}/i);
        if (evmMatch) {
            this.save('address', evmMatch[0]);
        }

        const solMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
        if (solMatch && !evmMatch) {
            this.save('address', solMatch[0]);
        }

        // Extract token symbols (simple heuristic: uppercase 2-6 letter words)
        const tokenMatches = text.match(/\b([A-Z]{2,10})\b/g);
        if (tokenMatches && tokenMatches.length >= 2) {
            // Assume first is tokenIn, second is tokenOut in swap context
            if (text.toLowerCase().includes('swap') || text.toLowerCase().includes('to')) {
                this.save('tokenIn', tokenMatches[0]);
                this.save('tokenOut', tokenMatches[1]);
            }
        }
    }
};

/**
 * Get command by name
 */
export function getCommand(name: string): CommandDef | undefined {
    return COMMAND_REGISTRY.find(cmd =>
        cmd.name === name || cmd.aliases.includes(name.toLowerCase())
    );
}

/**
 * Get all commands by category
 */
export function getCommandsByCategory(category: CommandDef['category']): CommandDef[] {
    return COMMAND_REGISTRY.filter(cmd => cmd.category === category);
}
