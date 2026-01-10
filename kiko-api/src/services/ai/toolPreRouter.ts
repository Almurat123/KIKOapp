/**
 * Tool Pre-Router Service
 * 
 * Filters available tools based on user message keywords BEFORE sending to LLM.
 * This prevents the LLM from choosing wrong tools by limiting its options.
 */

import { ToolDefinition, toolRegistry } from '../../tools/registry.js';

interface ToolCategory {
    keywords: RegExp;
    tools: string[];
    priority: number; // Higher = more specific
}

/**
 * Tool categories ordered by specificity (most specific first)
 */
const TOOL_CATEGORIES: ToolCategory[] = [
    // TRADING - Most specific
    {
        keywords: /\b(swap|buy|sell|trade|exchange|convert|购买|卖出|兑换)\b/i,
        tools: ['prepare_swap_transaction', 'check_token_risk', 'get_wallet_info', 'get_token_info', 'create_copy_trade_config'],
        priority: 100
    },

    // WALLET ANALYSIS
    {
        keywords: /\b(pnl|profit|loss|roi|win\s*rate|performance|history|early\s*buyers?|smart\s*money|holdings?|cost\s*basis|收益|利润|早期买家|最早买家|聪明钱)\b/i,
        tools: ['get_token_early_buyers', 'get_token_info', 'get_wallet_info'],
        priority: 95
    },

    // WALLET
    {
        keywords: /\b(wallet|balance|funds|my\s+(?:eth|usdc|tokens?)|portfolio|余额|钱包)\b/i,
        tools: ['get_wallet_info'],
        priority: 90
    },

    // FARCASTER SOCIAL
    {
        keywords: /\b(farcaster|social\s+trends?|casts?|warpcast)\b/i,
        tools: ['get_trending_casts', 'search_farcaster_casts', 'get_farcaster_user'],
        priority: 80
    },

    // ZORA
    {
        keywords: /\b(zora|new\s+coins?|top\s+gainers?|trending\s+(tokens?|coins?)|zora\s+profile|zora\s+balances?)\b/i,
        tools: ['get_zora_trending', 'get_zora_profile', 'get_zora_balances'],
        priority: 85
    },

    // PREDICTION MARKETS
    {
        keywords: /\b(polymarket|prediction|betting|bet\s+on|odds)\b/i,
        tools: ['get_polymarket_trending', 'get_polymarket_event', 'search_polymarket'],
        priority: 80
    },

    // TOKEN SAFETY
    {
        keywords: /\b(safe|honeypot|risk|scam|rug\s*pull|security|安全)\b/i,
        tools: ['check_token_risk', 'get_token_info'],
        priority: 70
    },

    // TOKEN INFO (with contract address)
    {
        keywords: /0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/,
        tools: ['get_token_info', 'check_token_risk', 'prepare_swap_transaction', 'get_token_early_buyers'],
        priority: 60
    },

    // TRENDING
    {
        keywords: /\b(trending|hot\s+tokens?|gainers|movers|top\s+tokens?)\b/i,
        tools: ['get_trending_tokens'],
        priority: 50
    },

    // MARKET OVERVIEW
    {
        keywords: /\b(market|crypto\s+market|overview|macro|vix|fear\s+greed)\b/i,
        tools: ['get_market_overview'],
        priority: 40
    },

    // COPY TRADING - Higher priority than TRADING to catch "copy trade" before "trade"
    {
        keywords: /\b(copy\s*trader?|copy\s*trading|auto\s*trad(e|ing)?|mirror\s*trad(e|ing)?|follow\s*wallet|跟单|复制交易|follow\s*me|mirror\s*me)\b/i,
        tools: ['create_copy_trade_config', 'list_copy_trade_configs', 'pause_copy_trade_config', 'delete_copy_trade_config'],
        priority: 110  // Higher than TRADING (100) to catch "copy trade" first
    },

    // GAS
    {
        keywords: /\b(gas|gwei|fee|transaction\s+cost)\b/i,
        tools: ['get_gas_price'],
        priority: 30
    },

    // GENERAL KNOWLEDGE - Broad access for educational/informational queries
    // Low priority so specific categories take precedence
    {
        keywords: /\b(what\s+is|how\s+does|explain|tell\s+me|why|who\s+is|when\s+did|介绍|是什么|怎么|为什么)\b/i,
        tools: ['web_search', 'get_market_overview', 'get_token_info', 'get_trending_tokens'],
        priority: 5  // Very low - only used if no specific category matches
    }
];

/**
 * Get filtered tool definitions based on user message.
 * If message matches a specific category, only return those tools.
 * If no category matches, return all tools.
 */
export function getFilteredTools(userMessage: string): ToolDefinition[] {
    const allTools = toolRegistry.getAllDefinitions();

    // Find matching categories
    const matchedCategories = TOOL_CATEGORIES
        .filter(cat => cat.keywords.test(userMessage))
        .sort((a, b) => b.priority - a.priority);

    if (matchedCategories.length === 0) {
        // No specific category matched, return all tools
        console.log('[ToolPreRouter] No category matched, using all tools');
        return allTools;
    }

    // Use the highest priority matched category
    const primaryCategory = matchedCategories[0];
    const allowedToolNames = new Set(primaryCategory.tools);

    // Always include web_search as fallback
    allowedToolNames.add('web_search');

    const filteredTools = allTools.filter(tool => allowedToolNames.has(tool.name));

    console.log(`[ToolPreRouter] Category matched: ${primaryCategory.keywords.source}`);
    console.log(`[ToolPreRouter] Filtered tools: ${filteredTools.map(t => t.name).join(', ')}`);

    return filteredTools;
}

/**
 * Check if message has a specific category match (for bypassing LLM entirely)
 */
export function getDirectToolMatch(userMessage: string): string | null {
    // Very specific patterns that should ALWAYS use a specific tool
    const directMatches: { pattern: RegExp; tool: string }[] = [
        { pattern: /^check\s+my\s+(?:wallet\s+)?balance$/i, tool: 'get_wallet_info' },
        { pattern: /^my\s+balance$/i, tool: 'get_wallet_info' },
        { pattern: /^what(?:'s| is)\s+hot\s+on\s+farcaster\??$/i, tool: 'get_trending_casts' },
        { pattern: /^trending\s+on\s+farcaster$/i, tool: 'get_trending_casts' },
    ];

    for (const { pattern, tool } of directMatches) {
        if (pattern.test(userMessage.trim())) {
            console.log(`[ToolPreRouter] Direct match: ${tool}`);
            return tool;
        }
    }

    return null;
}
