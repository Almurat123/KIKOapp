// SuggestionContext.ts - Context awareness for intelligent suggestions

export type PageContext = 'home' | 'token' | 'social' | 'market' | 'wallet' | 'polymarket';

export interface SuggestionContext {
    currentPage?: PageContext;
    tokenSymbol?: string;         // If on token detail page
    recentCommand?: string;       // Last command executed
    mode?: 'focus';               // 'focus' means input got focus with empty text
    // Note: We do NOT auto-read clipboard for privacy reasons
}

/**
 * Get contextual score boosts for commands based on current context
 */
export function getContextualBoost(commandId: string, ctx: SuggestionContext): number {
    let boost = 0;

    // Boost trading commands on token page
    if (ctx.currentPage === 'token') {
        if (['swap', 'sell', 'buy'].includes(commandId)) {
            boost += 100;
        }
    }

    // Boost research commands on social page
    if (ctx.currentPage === 'social') {
        if (['what', 'tell', 'check'].includes(commandId)) {
            boost += 80;
        }
    }

    // Boost polymarket commands on polymarket page
    if (ctx.currentPage === 'polymarket') {
        if (['bet', 'cancel'].includes(commandId)) {
            boost += 120;
        }
    }

    // Boost wallet analysis on wallet page
    if (ctx.currentPage === 'wallet') {
        if (['check', 'copy'].includes(commandId)) {
            boost += 100;
        }
    }

    // Boost market overview on market page
    if (ctx.currentPage === 'market') {
        if (['what'].includes(commandId)) {
            boost += 50;
        }
    }

    // Chain commands: after certain commands, suggest related ones
    if (ctx.recentCommand) {
        // After swap/buy/sell, suggest checking or what
        if (['swap', 'buy', 'sell'].includes(ctx.recentCommand)) {
            if (['check', 'what'].includes(commandId)) {
                boost += 40;
            }
        }

        // After bet, suggest checking position
        if (ctx.recentCommand === 'bet' && commandId === 'check') {
            boost += 60;
        }

        // After copy trade, suggest what to monitor
        if (ctx.recentCommand === 'copy' && commandId === 'check') {
            boost += 50;
        }
    }

    return boost;
}

/**
 * Detect current page context from URL or route
 * This should be called by the parent component and passed to SuggestionEngine
 */
export function detectPageContext(pathname: string): PageContext {
    if (pathname.includes('/token/') || pathname.includes('/coin/')) {
        return 'token';
    }
    if (pathname.includes('/social') || pathname.includes('/farcaster')) {
        return 'social';
    }
    if (pathname.includes('/market')) {
        return 'market';
    }
    if (pathname.includes('/wallet') || pathname.includes('/portfolio')) {
        return 'wallet';
    }
    if (pathname.includes('/polymarket') || pathname.includes('/bet')) {
        return 'polymarket';
    }
    return 'home';
}
