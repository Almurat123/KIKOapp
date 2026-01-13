import type { SuggestionGroup, SuggestionItem } from './ChatInputSuggestions';
import { COMMAND_REGISTRY, ParamMemory, type CommandDef } from './CommandRegistry';

interface MatchResult {
    command: CommandDef;
    score: number;
    type: 'nlu' | 'exact' | 'prefix' | 'alias' | 'fuzzy' | 'intent' | 'context' | 'popular';
    indices?: number[];
    extractedParams?: Record<string, string>;
    displayLabel?: string; // What user sees (natural language prediction)
    commitText?: string; // What gets inserted into the input
    subLabel?: string; // Secondary line in UI (e.g., executable command)
    dedupeKey?: string;
}

export interface GetSuggestionsOptions {
    mode?: 'typing' | 'focus';
}

const RECENT_ITEMS_KEY = 'kiko-recent-items';

// Intent patterns for natural language understanding
const INTENT_PATTERNS: Record<string, RegExp[]> = {
    'swap': [
        /\b(buy|sell|trade|exchange|swap|convert)\b/i,
        /\bwant to (buy|sell|trade|get)\b/i,
        /\b(i want|need|looking for)\b.*\b(token|coin|crypto)\b/i,
        /(买|卖|交易|兑换|换|swap|交换)/i
    ],
    'token info': [
        /\b(what is|tell me about|info|details|check)\b/i,
        /\b(token|coin|contract)\b.*\b(info|details|about)\b/i,
        /(代币|token|合约).*(信息|详情|是什么|介绍|查一下)/i
    ],
    'chart': [
        /\b(chart|price|graph|show)\b/i,
        /\b(how much|price of)\b/i,
        /(价格|走势|k线|图表|曲线|chart)/i
    ],
    'analyze pnl': [
        /\b(pnl|profit|loss|gains|earnings|performance)\b/i,
        /\b(my|check my|show my)\b.*\b(profit|loss|pnl)\b/i,
        /(盈亏|收益|亏损|pnl|赚了|亏了)/i
    ],
    'wallet info': [
        /\b(wallet|balance|portfolio|holdings)\b/i,
        /\b(my|check my|show my)\b.*\b(wallet|balance)\b/i,
        /(钱包|余额|资产|持仓|portfolio)/i
    ],
    'get trending tokens': [
        /\b(trending|hot|popular|top)\b.*\b(token|coin)\b/i,
        /\b(what'?s|show me)\b.*\b(hot|trending|popular)\b/i,
        /(热门|趋势|热度|trending|top).*(代币|token|币)/i
    ],
    'token risk': [
        /\b(safe|risk|scam|rug|check|verify)\b/i,
        /\bis this (safe|legit|real)\b/i,
        /(风险|安全|骗局|rug|貔貅|查风险|查安全|靠谱吗)/i
    ]
};

// Usage frequency tracker
class UsageTracker {
    private static STORAGE_KEY = 'kiko-command-usage';

    static track(commandName: string) {
        try {
            const usage = this.getAll();
            usage[commandName] = (usage[commandName] || 0) + 1;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(usage));
        } catch (e) {
            console.warn('Failed to track usage:', e);
        }
    }

    static getAll(): Record<string, number> {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }

    static getScore(commandName: string): number {
        const usage = this.getAll();
        return usage[commandName] || 0;
    }
}

export class SuggestionEngine {
    private static hasCJK(text: string): boolean {
        return /[\u4e00-\u9fff]/.test(text);
    }

    private static shortAddress(address: string): string {
        if (address.length <= 12) return address;
        return `${address.slice(0, 6)}…${address.slice(-4)}`;
    }

    private static safeReadRecentItems(): string[] {
        try {
            const raw = localStorage.getItem(RECENT_ITEMS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
        } catch {
            return [];
        }
    }

    private static findCommand(name: string): CommandDef | undefined {
        return COMMAND_REGISTRY.find(c => c.name === name);
    }

    private static stableHash(value: string): string {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = (hash * 31 + value.charCodeAt(i)) | 0;
        }
        return Math.abs(hash).toString(36);
    }

    public static getSuggestions(
        text: string,
        onCommit: (text: string) => void,
        options: GetSuggestionsOptions = {}
    ): SuggestionGroup[] {
        const mode = options.mode ?? 'typing';
        if (!text || text.trim().length === 0) {
            if (mode !== 'focus') return [];
            const matches = this.getPopularSuggestions();
            const items = matches.slice(0, 5).map(m => this.buildSuggestionItem(m, onCommit));
            return items.length > 0 ? [{ label: 'COMMANDS', items }] : [];
        }

        const input = text.toLowerCase().trim();
        const matches: MatchResult[] = [];

        // 1. Extract entities for context awareness
        const entities = this.extractEntities(text);
        const memory = ParamMemory.loadAll();

        // 2. Natural language prediction suggestions (Google-style)
        matches.push(...this.matchByNLU(text, entities, memory));

        // 3. Command name/alias matching (traditional IDE-style)
        for (const cmd of COMMAND_REGISTRY) {
            const match = this.calculateMatch(input, cmd, entities);
            if (match) matches.push(match);
        }

        // 4. Lightweight intent matching (fallback)
        const intentMatches = this.matchByIntent(input);
        matches.push(...intentMatches);

        // 5. Context-based suggestions (smart defaults)
        if (entities.address) {
            matches.push(...this.getAddressContextSuggestions(entities.address));
        }
        if (entities.amount) {
            matches.push(...this.getAmountContextSuggestions(entities.amount));
        }

        // 6. If still no good matches, show popular commands
        if (matches.length === 0 || matches.every(m => m.score < 200)) {
            matches.push(...this.getPopularSuggestions());
        }

        // 7. Apply usage frequency boost
        const usage = UsageTracker.getAll();
        matches.forEach(m => {
            const usageBoost = (usage[m.command.name] || 0) * 5;
            m.score += usageBoost;
        });

        // 8. Sort and deduplicate
        matches.sort((a, b) => b.score - a.score);
        const seen = new Set<string>();
        const unique = matches.filter(m => {
            const key = m.dedupeKey || m.commitText || m.displayLabel || m.command.name;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // 9. Build UI items
        const items = unique.slice(0, 7).map(m => this.buildSuggestionItem(m, onCommit));

        return items.length > 0 ? [{ label: 'COMMANDS', items }] : [];
    }

    /**
     * Traditional IDE-style matching (exact, prefix, fuzzy)
     */
    private static calculateMatch(input: string, cmd: CommandDef, entities: any): MatchResult | null {
        const cmdName = cmd.name.toLowerCase();
        const firstToken = input.split(/\s+/)[0] || input;

        // Exact match
        if (cmdName === input) {
            return {
                command: cmd,
                score: 1000,
                type: 'exact',
                indices: Array.from({ length: cmdName.length }, (_, i) => i),
                extractedParams: entities
            };
        }

        // Leading command match (when user already typed args): "swap 0.01 ..."
        if (input.startsWith(`${cmdName} `) || input === cmdName) {
            return {
                command: cmd,
                score: 800,
                type: 'prefix',
                indices: Array.from({ length: cmdName.length }, (_, i) => i),
                extractedParams: entities
            };
        }

        // Exact alias match
        for (const alias of cmd.aliases) {
            if (alias.toLowerCase() === input) {
                return {
                    command: cmd,
                    score: 950,
                    type: 'alias',
                    extractedParams: entities
                };
            }
        }

        // Leading alias match (when user already typed args): "buy 0.01 ..." -> swap
        for (const alias of cmd.aliases) {
            const a = alias.toLowerCase();
            if (input.startsWith(`${a} `) || firstToken === a) {
                return {
                    command: cmd,
                    score: 780,
                    type: 'alias',
                    extractedParams: entities
                };
            }
        }

        // Prefix match
        if (cmdName.startsWith(firstToken)) {
            return {
                command: cmd,
                score: 500 + firstToken.length * 10,
                type: 'prefix',
                indices: Array.from({ length: firstToken.length }, (_, i) => i),
                extractedParams: entities
            };
        }

        // Alias prefix
        for (const alias of cmd.aliases) {
            if (alias.toLowerCase().startsWith(firstToken)) {
                return {
                    command: cmd,
                    score: 450 + firstToken.length * 10,
                    type: 'alias',
                    extractedParams: entities
                };
            }
        }

        // Word start match
        const words = cmdName.split(' ');
        for (let i = 0; i < words.length; i++) {
            if (words[i].startsWith(input)) {
                const offset = words.slice(0, i).join(' ').length + (i > 0 ? 1 : 0);
                return {
                    command: cmd,
                    score: 400 + input.length * 5,
                    type: 'prefix',
                    indices: Array.from({ length: input.length }, (_, j) => offset + j),
                    extractedParams: entities
                };
            }
        }

        // Fuzzy match
        if (firstToken.length >= 2) {
            const fuzzy = this.fuzzyMatch(firstToken, cmdName);
            if (fuzzy.score > 0) {
                return {
                    command: cmd,
                    score: fuzzy.score,
                    type: 'fuzzy',
                    indices: fuzzy.indices,
                    extractedParams: entities
                };
            }
        }

        return null;
    }

    /**
     * Natural language "query prediction" that maps to project commands + slots.
     * The user sees a natural-language completion, but selecting inserts an executable command string.
     */
    private static matchByNLU(
        rawText: string,
        entities: {
            address?: string;
            amount?: string;
            tokenIn?: string;
            tokenOut?: string;
            tokens?: string[];
            tokenCandidates?: Array<{ token: string; index: number }>;
        },
        memory: Record<string, string>
    ): MatchResult[] {
        const text = rawText.trim();
        const isZh = this.hasCJK(text);

        const hasSignal =
            text.length >= 2 ||
            Boolean(entities.address) ||
            Boolean(entities.amount) ||
            Boolean(entities.tokenIn) ||
            Boolean(entities.tokenOut);
        if (!hasSignal) return [];

        const recent = this.safeReadRecentItems();
        const lastAddress = recent[0];
        const refersToLast = /(这个|这(个)?(币|代币|合约)|它|该(币|代币|合约)|this( token)?|that( token)?)/i.test(text);

        const resolvedAddress =
            entities.address ||
            (refersToLast ? lastAddress : undefined) ||
            (/(my|我的).*(wallet|address|钱包|地址)/i.test(text) ? (memory.wallet || lastAddress) : undefined);

        const results: MatchResult[] = [];

        const push = (match: MatchResult | null) => {
            if (!match) return;
            results.push(match);
        };

        const build = (cmdName: string, commitText: string, displayLabel: string, score: number): MatchResult | null => {
            const cmd = this.findCommand(cmdName);
            if (!cmd) return null;
            return {
                command: cmd,
                score,
                type: 'nlu',
                displayLabel,
                commitText,
                subLabel: commitText,
                dedupeKey: `${cmd.name}|${commitText}`
            };
        };

        // Utility intents
        if (/(help|\?|\bcommands?\b|what can you do|怎么用|帮助|指令|命令)/i.test(text)) {
            push(build('help', 'help', isZh ? '查看可用命令' : 'Show available commands', 900));
        }
        if (/(gas|gwei|手续费|燃料费|gas 价格)/i.test(text)) {
            push(build('gas price', 'gas price', isZh ? '查看当前 Gas 价格' : 'Check current gas price', 880));
        }
        if (/(trending casts|farcaster|\bcasts\b|fc|热(门)?动态|热门(动态|帖子))/i.test(text)) {
            push(build('trending casts', 'trending casts', isZh ? '查看热门 Farcaster 动态' : 'Show trending Farcaster casts', 820));
        }
        if (/(polymarket|prediction markets|预测市场|押注|博彩|市场趋势)/i.test(text)) {
            push(build('polymarket trending', 'polymarket trending', isZh ? '查看热门预测市场' : 'Show trending prediction markets', 820));
        }
        if (/(trending|hot|popular|top).*(token|coin)|热门(代币|币)|趋势(代币|币)/i.test(text)) {
            push(build('get trending tokens', 'get trending tokens', isZh ? '查看热门代币' : 'Show trending tokens', 860));
        }

        // Address-centric intents
        if (resolvedAddress) {
            const short = this.shortAddress(resolvedAddress);
            if (/(风险|安全|骗局|rug|scam|safe|verify|check)/i.test(text)) {
                push(build('token risk', `token risk ${resolvedAddress}`, isZh ? `检查 ${short} 是否安全/有风险` : `Check token risk for ${short}`, 930));
            }
            if (/(信息|详情|是什么|介绍|token info|contract|details|about|what is)/i.test(text)) {
                push(build('token info', `token info ${resolvedAddress}`, isZh ? `查看 ${short} 代币信息` : `Get token info for ${short}`, 920));
            }
            if (/(价格|走势|k线|图表|chart|price|graph|show)/i.test(text)) {
                push(build('chart', `chart ${resolvedAddress}`, isZh ? `查看 ${short} 价格图表` : `Show chart for ${short}`, 920));
            }
            if (/(早期|early buyers|sniper|first buyers)/i.test(text)) {
                push(build('early buyers', `early buyers ${resolvedAddress}`, isZh ? `分析 ${short} 早期买家` : `Analyze early buyers for ${short}`, 860));
            }
            if (/(跟单|copy|follow trader|copy trade)/i.test(text)) {
                push(build('copy trade', `copy trade ${resolvedAddress}`, isZh ? `跟单 ${short}` : `Copy trade ${short}`, 860));
            }

            // If user pasted an address but didn't specify intent, still provide strong defaults.
            if (!/(风险|安全|骗局|rug|scam|safe|verify|check|信息|详情|是什么|介绍|token info|contract|details|about|what is|价格|走势|k线|图表|chart|price|graph|show|早期|early buyers|sniper|first buyers|跟单|copy|follow trader|copy trade)/i.test(text)) {
                push(build('chart', `chart ${resolvedAddress}`, isZh ? `查看 ${short} 价格图表` : `Show chart for ${short}`, 700));
                push(build('token info', `token info ${resolvedAddress}`, isZh ? `查看 ${short} 代币信息` : `Get token info for ${short}`, 680));
                push(build('token risk', `token risk ${resolvedAddress}`, isZh ? `检查 ${short} 风险` : `Check token risk for ${short}`, 660));
                push(build('early buyers', `early buyers ${resolvedAddress}`, isZh ? `分析 ${short} 早期买家` : `Analyze early buyers for ${short}`, 640));
            }
        }

        // Wallet-centric intents
        const resolvedWallet = /(my|我的).*(wallet|address|钱包|地址)/i.test(text) ? (resolvedAddress || memory.wallet || lastAddress) : undefined;
        if (/(pnl|profit|loss|盈亏|收益|亏损|赚了|亏了)/i.test(text) && resolvedWallet) {
            const short = this.shortAddress(resolvedWallet);
            push(build('analyze pnl', `analyze pnl ${resolvedWallet}`, isZh ? `分析钱包 ${short} 的盈亏` : `Analyze PNL for ${short}`, 900));
        }
        if (/(wallet|balance|portfolio|holdings|钱包|余额|资产|持仓)/i.test(text) && resolvedWallet) {
            const short = this.shortAddress(resolvedWallet);
            push(build('wallet info', `wallet info ${resolvedWallet}`, isZh ? `查看钱包 ${short} 的资产/余额` : `Show wallet info for ${short}`, 880));
        }
        if (/(list copy trades|my copies|copy configs|列出跟单|我的跟单)/i.test(text)) {
            push(build('list copy trades', 'list copy trades', isZh ? '列出我的跟单配置' : 'List my copy trade configs', 820));
        }

        // Swap intent (slot-filling)
        if (INTENT_PATTERNS.swap.some(r => r.test(text))) {
            const swapCandidates = this.buildSwapNLUSuggestions(text, entities, memory, isZh);
            results.push(...swapCandidates);
        }

        return results;
    }

    private static buildSwapNLUSuggestions(
        text: string,
        entities: {
            amount?: string;
            tokenIn?: string;
            tokenOut?: string;
            tokens?: string[];
            tokenCandidates?: Array<{ token: string; index: number }>;
        },
        memory: Record<string, string>,
        isZh: boolean
    ): MatchResult[] {
        const cmd = this.findCommand('swap');
        if (!cmd) return [];

        const results: MatchResult[] = [];

        const defaultAmount = entities.amount || memory.amount || '0.01';
        const tokens = entities.tokens || [];

        const isBuy = /(buy|购买|买入|买)\b/i.test(text) || /买/.test(text);
        const isSell = /(sell|卖出|卖)\b/i.test(text) || /卖/.test(text);
        const hasToWord = /\b(to|into|for)\b/i.test(text) || /(换成|换为|到|兑成|兑换成)/.test(text);

        let tokenIn = entities.tokenIn;
        let tokenOut = entities.tokenOut;

        // Prefer ordering by appearance when available
        const ordered = (entities.tokenCandidates || []).slice().sort((a, b) => a.index - b.index).map(t => t.token);
        const orderedTokens = ordered.length > 0 ? ordered : tokens;

        // Explicit "A TOKEN to TOKEN" patterns
        const explicit = text.match(/(\d+(?:\.\d+)?)\s*([A-Za-z]{2,10})\s*(to|for|into|换成|换为|到|兑成|兑换成)\s*([A-Za-z]{2,10})/i);
        if (explicit) {
            const amount = explicit[1];
            const tIn = explicit[2].toUpperCase();
            const tOut = explicit[4].toUpperCase();
            tokenIn = tIn;
            tokenOut = tOut;
            const commit = `swap ${amount} ${tIn} to ${tOut}`;
            results.push({
                command: cmd,
                score: 980,
                type: 'nlu',
                displayLabel: isZh ? `把 ${amount} ${tIn} 换成 ${tOut}` : `Swap ${amount} ${tIn} to ${tOut}`,
                commitText: commit,
                subLabel: commit,
                extractedParams: { amount, tokenIn: tIn, tokenOut: tOut },
                dedupeKey: `${cmd.name}|${commit}`
            });
            return results;
        }

        // Heuristic based on tokens in text
        if (orderedTokens.length >= 2) {
            tokenIn = orderedTokens[0];
            tokenOut = hasToWord ? orderedTokens[orderedTokens.length - 1] : orderedTokens[1];
        } else if (orderedTokens.length === 1) {
            const only = orderedTokens[0];
            if (isBuy) {
                tokenOut = only;
                tokenIn = memory.tokenIn || 'USDC';
            } else if (isSell) {
                tokenIn = only;
                tokenOut = memory.tokenOut || 'USDC';
            } else if (hasToWord) {
                tokenOut = only;
                tokenIn = memory.tokenIn || 'ETH';
            } else {
                tokenIn = only;
                tokenOut = memory.tokenOut || 'USDC';
            }
        }

        const popularOut = ['USDC', 'ETH', 'SOL', 'USDT'];
        const popularIn = ['ETH', 'USDC', 'SOL'];

        const build = (amount: string, tIn: string, tOut: string, score: number) => {
            const commit = `swap ${amount} ${tIn} to ${tOut}`;
            results.push({
                command: cmd,
                score,
                type: 'nlu',
                displayLabel: isZh ? `把 ${amount} ${tIn} 换成 ${tOut}` : `Swap ${amount} ${tIn} to ${tOut}`,
                commitText: commit,
                subLabel: commit,
                extractedParams: { amount, tokenIn: tIn, tokenOut: tOut },
                dedupeKey: `${cmd.name}|${commit}`
            });
        };

        if (tokenIn && tokenOut) {
            build(defaultAmount, tokenIn, tokenOut, 940);
            return results;
        }

        // Fill missing slots with smart defaults
        if (!tokenIn && tokenOut) {
            const candidates = [memory.tokenIn, ...popularIn].filter(Boolean) as string[];
            candidates.slice(0, 2).forEach((tIn, idx) => build(defaultAmount, tIn, tokenOut!, 820 - idx * 20));
            return results;
        }

        if (tokenIn && !tokenOut) {
            const outs = [memory.tokenOut, ...popularOut].filter(Boolean) as string[];
            outs.filter(o => o !== tokenIn).slice(0, 3).forEach((tOut, idx) => build(defaultAmount, tokenIn!, tOut, 820 - idx * 20));
            return results;
        }

        // No tokens at all: propose a few sensible swaps using memory/popular tokens.
        const fallbackIn = memory.tokenIn || 'ETH';
        const fallbackOuts = [memory.tokenOut, ...popularOut].filter(Boolean).filter(t => t !== fallbackIn) as string[];
        fallbackOuts.slice(0, 2).forEach((tOut, idx) => build(defaultAmount, fallbackIn, tOut, 760 - idx * 20));

        return results;
    }

    /**
     * Natural language intent matching (Google-style)
     */
    private static matchByIntent(input: string): MatchResult[] {
        const results: MatchResult[] = [];

        for (const [cmdName, patterns] of Object.entries(INTENT_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(input)) {
                    const cmd = COMMAND_REGISTRY.find(c => c.name === cmdName);
                    if (cmd) {
                        results.push({
                            command: cmd,
                            score: 350, // Medium-high priority for intent matches
                            type: 'intent'
                        });
                        break; // Only match once per command
                    }
                }
            }
        }

        return results;
    }

    /**
     * Context-aware suggestions when address is detected
     */
    private static getAddressContextSuggestions(address: string): MatchResult[] {
        const addressCommands = ['token info', 'chart', 'token risk', 'copy trade'];
        const results: MatchResult[] = [];

        for (const name of addressCommands) {
            const cmd = COMMAND_REGISTRY.find(c => c.name === name);
            if (!cmd) continue;
            const commitText = `${cmd.name} ${address}`;
            results.push({
                command: cmd,
                score: 500, // Medium priority for context matches (NLU may be higher)
                type: 'context',
                extractedParams: { address },
                commitText,
                subLabel: commitText,
                dedupeKey: `${cmd.name}|${commitText}`
            });
        }

        return results;
    }

    /**
     * Context-aware suggestions when amount is detected
     */
    private static getAmountContextSuggestions(amount: string): MatchResult[] {
        const cmd = COMMAND_REGISTRY.find(c => c.name === 'swap');
        return cmd ? [{
            command: cmd,
            score: 520,
            type: 'context',
            extractedParams: { amount },
            dedupeKey: `swap|amount:${amount}`
        }] : [];
    }

    /**
     * Popular commands fallback
     */
    private static getPopularSuggestions(): MatchResult[] {
        const usage = UsageTracker.getAll();
        const sorted = Object.entries(usage)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name]) => name);

        // If no usage history, use defaults
        const popular = sorted.length > 0 ? sorted : ['swap', 'get trending tokens', 'analyze pnl', 'token info', 'help'];

        const results: MatchResult[] = [];

        popular.forEach((name, idx) => {
            const cmd = COMMAND_REGISTRY.find(c => c.name === name);
            if (!cmd) return;
            results.push({
                command: cmd,
                score: 100 - idx,
                type: 'popular'
            });
        });

        return results;
    }

    /**
     * Fuzzy subsequence matching
     */
    private static fuzzyMatch(input: string, target: string): { score: number, indices: number[] } {
        let inputIdx = 0;
        let targetIdx = 0;
        let score = 0;
        let consecutive = 0;
        const indices: number[] = [];

        while (inputIdx < input.length && targetIdx < target.length) {
            if (input[inputIdx] === target[targetIdx]) {
                score += 10 + consecutive * 5;
                consecutive++;
                indices.push(targetIdx);
                inputIdx++;
            } else {
                consecutive = 0;
                score -= 1;
            }
            targetIdx++;
        }

        if (inputIdx === input.length) {
            return { score: Math.max(0, 100 + score), indices };
        }

        return { score: 0, indices: [] };
    }

    /**
     * Extract entities from input
     */
    private static extractEntities(text: string) {
        const result: {
            address?: string;
            amount?: string;
            tokenIn?: string;
            tokenOut?: string;
            tokens?: string[];
            tokenCandidates?: Array<{ token: string; index: number }>;
        } = {};

        const evmMatch = text.match(/0x[a-fA-F0-9]{40}/i);
        if (evmMatch) result.address = evmMatch[0];

        if (!result.address) {
            const solMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
            if (solMatch) result.address = solMatch[0];
        }

        const amountMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
        if (amountMatch) result.amount = amountMatch[0];

        // Token candidates: keep order by appearance, and normalize common synonyms.
        const stop = new Set(['SWAP', 'TO', 'FOR', 'BUY', 'SELL', 'TRADE', 'TOKEN', 'INFO', 'CHART']);
        const candidates: Array<{ token: string; index: number }> = [];

        const synonymRules: Array<{ re: RegExp; token: string }> = [
            { re: /\beth\b|ethereum|weth|以太坊|以太/gi, token: 'ETH' },
            { re: /\bsol\b|solana|索拉纳|索尔/gi, token: 'SOL' },
            { re: /\busdc\b|美元币/gi, token: 'USDC' },
            { re: /\busdt\b|泰达/gi, token: 'USDT' }
        ];

        for (const rule of synonymRules) {
            for (const m of text.matchAll(rule.re)) {
                if (typeof m.index !== 'number') continue;
                candidates.push({ token: rule.token, index: m.index });
            }
        }

        for (const m of text.matchAll(/\b([A-Z]{2,10})\b/g)) {
            if (typeof m.index !== 'number') continue;
            const token = m[1].toUpperCase();
            if (stop.has(token)) continue;
            candidates.push({ token, index: m.index });
        }

        candidates.sort((a, b) => a.index - b.index);
        const seen = new Set<string>();
        const orderedTokens: string[] = [];
        const orderedCandidates: Array<{ token: string; index: number }> = [];
        for (const c of candidates) {
            if (seen.has(c.token)) continue;
            seen.add(c.token);
            orderedTokens.push(c.token);
            orderedCandidates.push(c);
        }
        if (orderedTokens.length > 0) {
            result.tokens = orderedTokens;
            result.tokenCandidates = orderedCandidates;
            result.tokenIn = orderedTokens[0];
            if (orderedTokens.length >= 2) result.tokenOut = orderedTokens[1];
        }

        return result;
    }

    /**
     * Build UI suggestion item
     */
    private static buildSuggestionItem(match: MatchResult, onCommit: (t: string) => void): SuggestionItem {
        const cmd = match.command;
        const memory = ParamMemory.loadAll();
        const extracted = match.extractedParams || {};

        let computedLabel = cmd.pattern;

        cmd.params.forEach(p => {
            const key = `{${p.name}}`;
            if (extracted[p.name]) {
                computedLabel = computedLabel.replace(key, extracted[p.name]);
            } else if (memory[p.name]) {
                computedLabel = computedLabel.replace(key, memory[p.name]);
            }
        });

        const label = match.displayLabel || computedLabel;
        const subLabel = match.subLabel;
        const idSource = match.dedupeKey || match.commitText || match.displayLabel || `${cmd.name}|${label}`;
        const id = `cmd-${cmd.name}-${this.stableHash(idSource)}`;

        return {
            id,
            label,
            subLabel,
            action: () => {
                let finalCmd = match.commitText || cmd.pattern;

                if (!match.commitText) {
                    cmd.params.forEach(p => {
                        if (extracted[p.name]) {
                            finalCmd = finalCmd.replace(`{${p.name}}`, extracted[p.name]);
                        } else if (memory[p.name]) {
                            finalCmd = finalCmd.replace(`{${p.name}}`, memory[p.name]);
                        } else if (p.placeholder) {
                            finalCmd = finalCmd.replace(`{${p.name}}`, p.placeholder);
                        }
                    });
                }

                // Track usage for personalization
                UsageTracker.track(cmd.name);

                onCommit(finalCmd);
            },
            matchedIndices: match.indices
        };
    }
}
