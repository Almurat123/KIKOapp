import type { SuggestionItem } from './ChatInputSuggestions';
import {
    Layers, Shield, BarChart3, History, ArrowRightLeft,
    Search, Globe, Wallet, Flame, Star, MessageCircle,
    Activity, TrendingUp, Info
} from 'lucide-react'; // Icons

export type Intent =
    | 'SWAP' | 'ANALYZE' | 'PNL' | 'COPY'
    | 'SECURITY' | 'MARKET' | 'EARLY_BUYER'
    | 'SOCIAL' | 'POLYMARKET' | 'WALLET' | 'SEARCH'
    | 'UNKNOWN';

export const IntentValues = {
    SWAP: 'SWAP' as Intent,
    ANALYZE: 'ANALYZE' as Intent,
    PNL: 'PNL' as Intent,
    COPY: 'COPY' as Intent,
    SECURITY: 'SECURITY' as Intent,
    MARKET: 'MARKET' as Intent,
    EARLY_BUYER: 'EARLY_BUYER' as Intent,
    SOCIAL: 'SOCIAL' as Intent,
    POLYMARKET: 'POLYMARKET' as Intent,
    WALLET: 'WALLET' as Intent,
    SEARCH: 'SEARCH' as Intent,
    UNKNOWN: 'UNKNOWN' as Intent,
};

export interface SuggestionContext {
    history: string[]; // Recent addresses/symbols
    trending: { symbol: string; address?: string }[]; // Market trending
}

export interface SlotState {
    intent: Intent;
    amount?: string;
    tokenIn?: string;
    tokenOut?: string;
    address?: string;
    query?: string;
    isComplete: boolean;
}

export class SuggestionEngine {
    private static EVM_ADDR_REGEX = /0x[a-fA-F0-9]{40}/;
    private static SOL_ADDR_REGEX = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
    private static AMOUNT_REGEX = /\b(\d+(?:\.\d+)?)\b/;

    // Basic Intent Matchers 
    private static INTENT_PATTERNS = {
        [IntentValues.EARLY_BUYER]: /\b(early|buyer|insider|whale|holder|first)\b/i,
        [IntentValues.SOCIAL]: /\b(farcaster|fc|cast|zora|nft|social|trending|warpcast)\b/i,
        [IntentValues.POLYMARKET]: /\b(poly|market|pm|bet|predict|election|event)\b/i,
        [IntentValues.WALLET]: /\b(gas|fee|balance|fav|favorite|my|wallet|infrastructure)\b/i,
        [IntentValues.SEARCH]: /\b(search|find|news|web|google|who|what|how)\b/i,
        [IntentValues.SWAP]: /\b(buy|sell|swap|trade|swp|trde|swa|exchange|convert)\b/i,
        [IntentValues.ANALYZE]: /\b(check|analyze|risk|safe|scrn|screen|detect|audit|scan)\b/i,
        [IntentValues.PNL]: /\b(pnl|profit|wallet|history|perf|balance|bal|roi)\b/i,
        [IntentValues.COPY]: /\b(copy|follow|track|cp|fllw|mirror)\b/i,
        [IntentValues.SECURITY]: /\b(audit|revoke|approve|hack|scam)\b/i,
        [IntentValues.MARKET]: /\b(price|chart|vol|volume|liq|liquidity|depth|cap|fdv)\b/i,
    };

    /**
     * Identifies the primary intent and extracts currently filled slots.
     */
    public static parse(text: string): SlotState {
        const lowerText = text.toLowerCase().trim();
        let detectedIntent = IntentValues.UNKNOWN;

        // 1. Detect Intent
        for (const [intent, pattern] of Object.entries(this.INTENT_PATTERNS)) {
            if (pattern.test(lowerText)) {
                detectedIntent = intent as Intent;
                break;
            }
        }

        // 2. Default to ANALYZE if address detected without intent
        const hasAddress = this.EVM_ADDR_REGEX.test(text) || this.SOL_ADDR_REGEX.test(text);
        if (detectedIntent === IntentValues.UNKNOWN && hasAddress) {
            detectedIntent = IntentValues.ANALYZE;
        }

        // 3. Extract Slots
        const slots: SlotState = { intent: detectedIntent, isComplete: false };

        if (detectedIntent === IntentValues.SWAP) {
            const amountMatch = text.match(this.AMOUNT_REGEX);
            if (amountMatch) slots.amount = amountMatch[1];

            const words = lowerText.split(/\s+/);
            const commonTokens = ['eth', 'sol', 'usdc', 'usdt', 'btc', 'wif', 'bonk', 'pepe', 'base'];
            const potentialTokens = words.filter(w => !this.INTENT_PATTERNS[IntentValues.SWAP].test(w) && !this.AMOUNT_REGEX.test(w));

            for (const word of potentialTokens) {
                if (commonTokens.includes(word) || word.length > 2) {
                    if (!slots.tokenIn) slots.tokenIn = word.toUpperCase();
                    else if (word.toUpperCase() !== slots.tokenIn) slots.tokenOut = word.toUpperCase();
                }
            }
            slots.isComplete = !!(slots.amount && slots.tokenIn && slots.tokenOut);
        } else {
            const addrMatch = text.match(this.EVM_ADDR_REGEX) || text.match(this.SOL_ADDR_REGEX);
            if (addrMatch) {
                slots.address = addrMatch[0];
                slots.isComplete = true;
            }

            if (!slots.address) {
                const words = text.split(/\s+/).filter(w =>
                    !Object.values(this.INTENT_PATTERNS).some(p => p.test(w))
                );
                if (words.length > 0) slots.query = words.join(' ');
            }
        }
        return slots;
    }

    public static getSuggestions(
        text: string,
        onSend: (text: string) => void,
        onSetInput: (text: string) => void,
        context: SuggestionContext
    ): SuggestionItem[] {
        if (!text || text.trim().length === 0) return [];

        const slots = this.parse(text);
        if (slots.intent === IntentValues.UNKNOWN && !slots.address) return [];

        const suggestions: SuggestionItem[] = [];

        switch (slots.intent) {
            case IntentValues.SWAP:
                this.buildSwapSuggestions(slots, suggestions, onSend, onSetInput, context);
                break;
            case IntentValues.ANALYZE:
            case IntentValues.SECURITY:
            case IntentValues.MARKET:
                this.buildAnalyzeSuggestions(slots, suggestions, onSend, onSetInput, context);
                break;
            case IntentValues.PNL:
                this.buildPnlSuggestions(slots, suggestions, onSend, onSetInput, context);
                break;
            case IntentValues.COPY:
                this.buildCopySuggestions(slots, suggestions, onSend, onSetInput, context);
                break;
            case IntentValues.EARLY_BUYER:
                this.buildEarlyBuyerSuggestions(slots, suggestions, onSend, onSetInput, context);
                break;
            case IntentValues.SOCIAL:
                this.buildSocialSuggestions(slots, suggestions, onSend, onSetInput, context);
                break;
            case IntentValues.POLYMARKET:
                this.buildPolymarketSuggestions(slots, suggestions, onSend, onSetInput, context);
                break;
            case IntentValues.WALLET:
                this.buildWalletSuggestions(slots, suggestions, onSend, onSetInput, context);
                break;
            case IntentValues.SEARCH:
                this.buildSearchSuggestions(slots, suggestions, onSend, onSetInput, context);
                break;
        }

        return suggestions.slice(0, 5);
    }

    private static buildSwapSuggestions(
        slots: SlotState,
        items: SuggestionItem[],
        onSend: (text: string) => void,
        onSetInput: (text: string) => void,
        context: SuggestionContext
    ) {
        if (slots.isComplete) {
            items.push({
                id: 'swap-ready-exec',
                label: `Swap ${slots.amount} ${slots.tokenIn} -> ${slots.tokenOut}`,
                subLabel: 'Click to <em>Execute</em> Trade',
                icon: <ArrowRightLeft size={16} />,
                action: () => onSend(`Swap ${slots.amount} ${slots.tokenIn} to ${slots.tokenOut}`),
                highlight: true
            });
            items.push({
                id: 'swap-sim',
                label: 'Simulate Trade (Fees & Slip)',
                subLabel: `Check impact for ${slots.amount} ${slots.tokenIn}`,
                icon: <Layers size={16} />,
                action: () => onSend(`Simulate swap ${slots.amount} ${slots.tokenIn} to ${slots.tokenOut}`),
            });
        } else if (!slots.amount) {
            items.push({
                id: 'swap-amt',
                label: 'Swap [Amount] ETH for [Token]',
                subLabel: 'Missing: <em>Amount</em>',
                icon: <ArrowRightLeft size={16} />,
                action: () => onSetInput('Swap 0.1 '),
            });
        } else if (!slots.tokenIn) {
            items.push({
                id: 'swap-token-in',
                label: `Swap ${slots.amount} [Token] for ...`,
                subLabel: 'Missing: <em>Input Token</em>',
                icon: <ArrowRightLeft size={16} />,
                action: () => onSetInput(`Swap ${slots.amount} ETH `),
            });
        } else {
            const targets = context.trending.length > 0 ? context.trending : [{ symbol: 'USDC' }, { symbol: 'WIF' }];
            targets.forEach(t => {
                items.push({
                    id: `swap-to-${t.symbol}`,
                    label: `Swap ${slots.amount} ${slots.tokenIn} for ${t.symbol}`,
                    subLabel: `Market Trending ${t.symbol}`,
                    icon: <BarChart3 size={16} />,
                    action: () => onSend(`Swap ${slots.amount} ${slots.tokenIn} for ${t.address || t.symbol}`),
                });
            });
        }
    }

    private static buildAnalyzeSuggestions(
        slots: SlotState,
        items: SuggestionItem[],
        onSend: (text: string) => void,
        onSetInput: (text: string) => void,
        context: SuggestionContext
    ) {
        if (slots.address) {
            const addrShort = slots.address.slice(0, 6) + '...';
            items.push({
                id: 'analyze-sec',
                label: `Security Scan: ${addrShort}`,
                subLabel: 'Run Audit & Risk Check',
                icon: <Shield size={16} />,
                action: () => onSend(`Check ${slots.address}`),
                highlight: true
            });
            items.push({
                id: 'analyze-mkt',
                label: `Market Data: ${addrShort}`,
                subLabel: 'View Price, Chart & Volume',
                icon: <BarChart3 size={16} />,
                action: () => onSend(`Check price and chart for ${slots.address}`),
            });
            items.push({
                id: 'analyze-soc',
                label: `Social Search: ${addrShort}`,
                subLabel: 'Search Web & Farcaster',
                icon: <Globe size={16} />,
                action: () => onSend(`Search web for ${slots.address}`),
            });
        } else {
            context.history.filter(a => a.startsWith('0x')).forEach(addr => {
                items.push({
                    id: `analyze-hist-${addr}`,
                    label: `Analyze Recent: ${addr.slice(0, 8)}...`,
                    subLabel: 'From your history',
                    icon: <History size={16} />,
                    action: () => onSend(`Check ${addr}`),
                });
            });
            items.push({
                id: 'analyze-prompt',
                label: 'Analyze [Address]',
                subLabel: 'Paste a contract address to check <em>safety</em>',
                icon: <Shield size={16} />,
                action: () => onSetInput('Check '),
            });
        }
    }

    private static buildPnlSuggestions(
        slots: SlotState,
        items: SuggestionItem[],
        onSend: (text: string) => void,
        onSetInput: (text: string) => void,
        context: SuggestionContext
    ) {
        if (slots.address) {
            const addrShort = slots.address.slice(0, 6) + '...';
            items.push({
                id: 'pnl-overview',
                label: `PnL Overview: ${addrShort}`,
                subLabel: 'Total Profit & ROI Performance',
                icon: <BarChart3 size={16} />,
                action: () => onSend(`Analyze wallet ${slots.address} pnl`),
                highlight: true
            });
            items.push({
                id: 'pnl-hist',
                label: `Trade History: ${addrShort}`,
                subLabel: 'View Recent Transactions',
                icon: <History size={16} />,
                action: () => onSend(`Show recent trades for ${slots.address}`),
            });
        } else {
            const recentWallets = context.history.filter(a => a.startsWith('0x')).slice(0, 2);
            recentWallets.forEach(addr => {
                items.push({
                    id: `pnl-hist-${addr}`,
                    label: `Check Recent PnL: ${addr.slice(0, 8)}...`,
                    subLabel: 'From your wallet history',
                    icon: <History size={16} />,
                    action: () => onSend(`Analyze wallet ${addr} pnl`),
                });
            });
            items.push({
                id: 'pnl-prompt',
                label: 'Check PnL for [Address]',
                subLabel: 'Missing: <em>Wallet Address</em>',
                icon: <BarChart3 size={16} />,
                action: () => onSetInput('PnL '),
            });
        }
    }

    private static buildCopySuggestions(
        slots: SlotState,
        items: SuggestionItem[],
        onSend: (text: string) => void,
        onSetInput: (text: string) => void,
        context: SuggestionContext
    ) {
        if (slots.address) {
            items.push({
                id: 'copy-ready',
                label: `Copy Trade: ${slots.address.slice(0, 8)}...`,
                subLabel: 'Click to start tracking',
                icon: <ArrowRightLeft size={16} />,
                action: () => onSend(`Copy trade wallet ${slots.address}`),
                highlight: true
            });
            items.push({
                id: 'copy-analyze',
                label: `Analyze Trader: ${slots.address.slice(0, 8)}...`,
                subLabel: 'Check Win Rate before copying',
                icon: <BarChart3 size={16} />,
                action: () => onSend(`Analyze wallet ${slots.address} performance`),
            });
        } else {
            const recentWallets = context.history.filter(a => a.startsWith('0x')).slice(0, 2);
            recentWallets.forEach(addr => {
                items.push({
                    id: `copy-hist-${addr}`,
                    label: `Copy Trade Recent: ${addr.slice(0, 8)}...`,
                    subLabel: 'From your wallet history',
                    icon: <History size={16} />,
                    action: () => onSend(`Copy trade wallet ${addr}`),
                });
            });
            items.push({
                id: 'copy-prompt',
                label: 'Copy Trade [Address]',
                subLabel: 'Missing: <em>Target Wallet</em>',
                icon: <ArrowRightLeft size={16} />,
                action: () => onSetInput('Copy '),
            });
        }
    }

    private static buildEarlyBuyerSuggestions(
        slots: SlotState,
        items: SuggestionItem[],
        onSend: (text: string) => void,
        onSetInput: (text: string) => void,
        context: SuggestionContext
    ) {
        if (slots.address) {
            const addrShort = slots.address.slice(0, 6) + '...';
            items.push({
                id: 'early-buyer-ready',
                label: `Early Buyer Scan: ${addrShort}`,
                subLabel: 'Find first holders & insider activity',
                icon: <History size={16} />,
                action: () => onSend(`Get early buyers for ${slots.address}`),
                highlight: true
            });
            items.push({
                id: 'creator-analysis',
                label: `Analyze Creator: ${addrShort}`,
                subLabel: 'Check deployer risk & history',
                icon: <Shield size={16} />,
                action: () => onSend(`Analyze creator of ${slots.address}`),
            });
        } else {
            context.history.filter(a => a.startsWith('0x')).forEach(addr => {
                items.push({
                    id: `early-hist-${addr}`,
                    label: `Early Buyers: ${addr.slice(0, 8)}...`,
                    subLabel: 'Scan your recent tokens',
                    icon: <History size={16} />,
                    action: () => onSend(`Get early buyers for ${addr}`),
                });
            });
            items.push({
                id: 'early-buyer-prompt',
                label: 'Early Buyer [Address]',
                subLabel: 'Missing: <em>Token Address</em>',
                icon: <History size={16} />,
                action: () => onSetInput('Early Buyer '),
            });
        }
    }

    private static buildSocialSuggestions(
        slots: SlotState,
        items: SuggestionItem[],
        onSend: (text: string) => void,
        _onSetInput: (text: string) => void,
        _context: SuggestionContext
    ) {
        items.push({
            id: 'fc-trending',
            label: 'Trending Farcaster Casts',
            subLabel: 'See what is viral on Warpcast',
            icon: <MessageCircle size={16} />,
            action: () => onSend('Get trending farcaster casts'),
            highlight: true
        });
        items.push({
            id: 'zora-trending',
            label: 'Trending on Zora',
            subLabel: 'Discover viral NFT collections',
            icon: <Flame size={16} />,
            action: () => onSend('Get trending zora mints'),
        });
        if (slots.query) {
            items.push({
                id: 'fc-search',
                label: `Search Farcaster: "${slots.query}"`,
                subLabel: 'Find casts by keyword',
                icon: <Search size={16} />,
                action: () => onSend(`Search farcaster casts for ${slots.query}`),
            });
        }
    }

    private static buildPolymarketSuggestions(
        slots: SlotState,
        items: SuggestionItem[],
        onSend: (text: string) => void,
        _onSetInput: (text: string) => void,
        _context: SuggestionContext
    ) {
        items.push({
            id: 'pm-trending',
            label: 'Trending Markets',
            subLabel: 'View top prediction markets',
            icon: <TrendingUp size={16} />,
            action: () => onSend('Get trending polymarket markets'),
            highlight: true
        });
        items.push({
            id: 'pm-whale',
            label: 'Polymarket Whale Watch',
            subLabel: 'See where big money is betting',
            icon: <Activity size={16} />,
            action: () => onSend('Get polymarket whale activity'),
        });
        if (slots.query) {
            items.push({
                id: 'pm-search',
                label: `Search Markets: "${slots.query}"`,
                subLabel: 'Search events on Polymarket',
                icon: <Search size={16} />,
                action: () => onSend(`Search polymarket for ${slots.query}`),
            });
        }
    }

    private static buildWalletSuggestions(
        _slots: SlotState,
        items: SuggestionItem[],
        onSend: (text: string) => void,
        _onSetInput: (text: string) => void,
        _context: SuggestionContext
    ) {
        items.push({
            id: 'wallet-gas',
            label: 'Check Gas Prices',
            subLabel: 'Current fees on Eth, Base, Solana',
            icon: <Flame size={16} />,
            action: () => onSend('Check gas prices'),
            highlight: true
        });
        items.push({
            id: 'wallet-fav',
            label: 'My Favorites',
            subLabel: 'Quick access to tracked wallets',
            icon: <Star size={16} />,
            action: () => onSend('Show my favorite tokens'),
        });
        items.push({
            id: 'wallet-info',
            label: 'Wallet Overview',
            subLabel: 'Balances and token assets',
            icon: <Wallet size={16} />,
            action: () => onSend('Show my wallet info'),
        });
    }

    private static buildSearchSuggestions(
        slots: SlotState,
        items: SuggestionItem[],
        onSend: (text: string) => void,
        _onSetInput: (text: string) => void,
        _context: SuggestionContext
    ) {
        if (slots.query) {
            items.push({
                id: 'search-web',
                label: `Web Search: "${slots.query}"`,
                subLabel: 'Search the global web for news',
                icon: <Globe size={16} />,
                action: () => onSend(`Search the web for ${slots.query}`),
                highlight: true
            });
        } else if (slots.address) {
            items.push({
                id: 'search-info',
                label: `Token Info: ${slots.address.slice(0, 8)}...`,
                subLabel: 'Get fundamentals, website & supply',
                icon: <Info size={16} />,
                action: () => onSend(`Get info for ${slots.address}`),
                highlight: true
            });
        } else {
            items.push({
                id: 'market-overview',
                label: 'Market Overview',
                subLabel: 'Overall crypto health and sentiment',
                icon: <BarChart3 size={16} />,
                action: () => onSend('Provide market overview'),
            });
            items.push({
                id: 'market-cal',
                label: 'Economic Calendar',
                subLabel: 'Upcoming macro events (CPI, Fed)',
                icon: <Activity size={16} />,
                action: () => onSend('Show economic calendar'),
            });
        }
    }
}
