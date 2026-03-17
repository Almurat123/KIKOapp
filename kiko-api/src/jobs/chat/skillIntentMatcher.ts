import { skillRegistryExec } from '../../skills/registry.js';
import type { Skill } from '../../skills/types.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { TradingIntent } from './tradingIntentResolver.js';

export type SearchMode = 'forbidden' | 'fallback' | 'required';

export type NormalizedIntent =
    | 'WELCOME'
    | 'SWAP'
    | 'CROSS_CHAIN'
    | 'COPY_TRADE'
    | 'TOKEN_ANALYSIS'
    | 'RISK_SCAN'
    | 'WALLET_PORTFOLIO'
    | 'SOCIAL_DISCOVERY'
    | 'PREDICTION_MARKETS'
    | 'ZORA_DISCOVERY'
    | 'TOKEN_ALERTS'
    | 'MARKET_MACRO';

export interface QuerySignals {
    welcome: boolean;
    explicitSearch: boolean;
    realtime: boolean;
    timeContext: boolean;
    xSearch: boolean;
    webSearch: boolean;
    wallet: boolean;
    pnl: boolean;
    risk: boolean;
    prediction: boolean;
    zora: boolean;
    copyTrade: boolean;
    crossChain: boolean;
    swap: boolean;
    alerts: boolean;
    tokenAnalysis: boolean;
    social: boolean;
    market: boolean;
    hasRequestedToken: boolean;
    socialChainEvidence: boolean;
}

export interface SkillMatch {
    skillId: string;
    skillName: string;
    score: number;
    reasons: string[];
    matchedIntents: NormalizedIntent[];
}

export interface SkillMatchResult {
    rankedMatches: SkillMatch[];
    rejectedMatches: SkillMatch[];
    querySignals: QuerySignals;
    searchMode: SearchMode;
    searchReason: string;
}

const STRONG_MATCH_THRESHOLD = 60;
const MIN_MATCH_THRESHOLD = 35;
const MAX_SKILL_MATCHES = 3;

const SKILL_INTENT_MAP: Record<string, NormalizedIntent[]> = {
    welcome_onboarding: ['WELCOME'],
    swap: ['SWAP'],
    cross_chain_swap: ['CROSS_CHAIN'],
    copy_trade: ['COPY_TRADE'],
    token_analysis: ['TOKEN_ANALYSIS'],
    risk_security: ['RISK_SCAN'],
    wallet_portfolio: ['WALLET_PORTFOLIO'],
    social_farcaster: ['SOCIAL_DISCOVERY'],
    polymarket_prediction: ['PREDICTION_MARKETS'],
    zora_nfts: ['ZORA_DISCOVERY'],
    token_alert: ['TOKEN_ALERTS'],
    market_macro: ['MARKET_MACRO'],
};

const INTENT_SIGNAL_MAP: Record<NormalizedIntent, keyof QuerySignals> = {
    WELCOME: 'welcome',
    SWAP: 'swap',
    CROSS_CHAIN: 'crossChain',
    COPY_TRADE: 'copyTrade',
    TOKEN_ANALYSIS: 'tokenAnalysis',
    RISK_SCAN: 'risk',
    WALLET_PORTFOLIO: 'wallet',
    SOCIAL_DISCOVERY: 'social',
    PREDICTION_MARKETS: 'prediction',
    ZORA_DISCOVERY: 'zora',
    TOKEN_ALERTS: 'alerts',
    MARKET_MACRO: 'market',
};

const SKILL_HINT_PHRASES: Record<string, string[]> = {
    welcome_onboarding: [
        'who are you', 'what can you do', 'what do you do', 'introduce yourself',
        'how can you help', '你是谁', '你能做什么', '你会什么', '介绍一下你自己',
    ],
    swap: ['swap', 'buy', 'sell', 'trade', '兑换', '买入', '卖出'],
    cross_chain_swap: ['cross-chain', 'cross chain', 'bridge', '跨链', '桥接'],
    copy_trade: ['copy trade', 'copy-trade', 'copytrading', 'follow this trader', '跟单', '跟单交易'],
    token_analysis: [
        'token', 'coin', 'contract', 'address', 'creator', 'deployer', 'holders',
        'early buyers', 'first buyers', 'token analysis', '代币', '合约', '创建者', '部署者', '持有人', '早期买家',
    ],
    risk_security: ['risk', 'safe', 'safety', 'honeypot', 'rug', 'security', '风险', '安全', '蜜罐', '土狗'],
    wallet_portfolio: ['wallet', 'balance', 'portfolio', 'pnl', 'profit', 'performance', '钱包', '余额', '持仓', '盈亏', '收益'],
    social_farcaster: ['farcaster', 'cast', 'casts', 'warpcast', '热门', '在聊什么'],
    polymarket_prediction: [
        'polymarket', 'prediction market', 'prediction markets', 'odds', 'bet', 'bets', 'betting',
        'wager', 'what people are betting on', '押注', '大家在赌什么', '赔率', '预测市场',
    ],
    zora_nfts: ['zora', 'nft', 'nfts', 'mint', 'mints', 'minting', '铸造'],
    token_alert: ['alert', 'alerts', 'notify me', 'notification', '提醒', '预警', '通知我'],
    market_macro: ['market', 'macro', 'news', 'gas', 'economic', 'overview', '行情', '宏观', '新闻'],
};

export function matchSkillsForQuery(params: {
    snapshot: ChatContextSnapshot;
    tradingIntent: TradingIntent | null;
}): SkillMatchResult {
    const query = String(params.snapshot.lastUserMessage || '');
    const queryLower = query.toLowerCase();
    const queryTokens = tokenize(queryLower);
    const querySignals = detectQuerySignals(query, params.snapshot, params.tradingIntent);
    const toolDescriptionMap = new Map(
        (params.snapshot.toolDefinitions || []).map((definition) => [
            definition.name,
            `${definition.name} ${definition.description || ''}`.trim(),
        ]),
    );

    const scored = skillRegistryExec.getAllSkills().map((skill) => scoreSkill({
        skill,
        query,
        queryLower,
        queryTokens,
        querySignals,
        tradingIntent: params.tradingIntent,
        toolDescriptionMap,
    }));

    scored.sort((a, b) => b.score - a.score || a.skillId.localeCompare(b.skillId));
    const topScore = scored[0]?.score || 0;
    const threshold = topScore >= STRONG_MATCH_THRESHOLD ? STRONG_MATCH_THRESHOLD : MIN_MATCH_THRESHOLD;
    const rankedMatches = scored
        .filter((match) => match.score >= threshold)
        .slice(0, MAX_SKILL_MATCHES);

    if (querySignals.welcome) {
        const welcomeOnly = rankedMatches.find((match) => match.skillId === 'welcome_onboarding');
        return {
            rankedMatches: welcomeOnly ? [welcomeOnly] : [],
            rejectedMatches: scored.filter((match) => !welcomeOnly || match.skillId !== welcomeOnly.skillId),
            querySignals,
            searchMode: 'forbidden',
            searchReason: 'welcome_or_capabilities_query',
        };
    }

    const selectedForSearch = rankedMatches.length > 0 ? rankedMatches : scored.slice(0, 1);
    const hasStrongLocalDomainSkill = selectedForSearch.some((match) => !['market_macro', 'welcome_onboarding'].includes(match.skillId));
    const searchMode: SearchMode = querySignals.socialChainEvidence
        ? 'required'
        : querySignals.explicitSearch
        ? 'required'
        : querySignals.realtime
            ? 'fallback'
            : 'forbidden';
    const searchReason = querySignals.socialChainEvidence
        ? 'social_plus_chain_evidence_required'
        : querySignals.explicitSearch
        ? 'explicit_search_intent'
        : querySignals.realtime
            ? hasStrongLocalDomainSkill
                ? 'local_skill_first_with_realtime_fallback'
                : 'realtime_context_fallback'
            : 'no_search_required';

    return {
        rankedMatches,
        rejectedMatches: scored.filter((match) => !rankedMatches.some((selected) => selected.skillId === match.skillId)),
        querySignals,
        searchMode,
        searchReason,
    };
}

function scoreSkill(params: {
    skill: Skill;
    query: string;
    queryLower: string;
    queryTokens: string[];
    querySignals: QuerySignals;
    tradingIntent: TradingIntent | null;
    toolDescriptionMap: Map<string, string>;
}): SkillMatch {
    const { skill, query, queryLower, queryTokens, querySignals, tradingIntent, toolDescriptionMap } = params;
    const reasons: string[] = [];
    let score = 0;
    const matchedIntents = new Set<NormalizedIntent>();

    const normalizedIntents = SKILL_INTENT_MAP[skill.metadata.id] || [];
    for (const intent of normalizedIntents) {
        const signalKey = INTENT_SIGNAL_MAP[intent];
        if (querySignals[signalKey]) {
            score += 70;
            matchedIntents.add(intent);
            reasons.push(`signal:${intent.toLowerCase()}`);
        }
    }

    score += scoreTradingIntentBoost(skill.metadata.id, tradingIntent, reasons, matchedIntents);
    score += scorePhraseHints(skill.metadata.id, queryLower, query, reasons);
    score += scoreExamples(skill, queryLower, queryTokens, reasons);
    score += scoreTextBlock(skill.metadata.name, queryLower, queryTokens, reasons, 'name');
    score += scoreTextBlock(skill.metadata.description, queryLower, queryTokens, reasons, 'description');

    const toolText = (skill.metadata.tools || [])
        .map((toolName) => toolDescriptionMap.get(toolName) || toolName)
        .join(' ');
    score += scoreTextBlock(toolText, queryLower, queryTokens, reasons, 'tools');

    if (skill.metadata.id === 'token_analysis' && querySignals.hasRequestedToken) {
        score += 35;
        reasons.push('requested_token_context');
        matchedIntents.add('TOKEN_ANALYSIS');
    }

    if (skill.metadata.id === 'market_macro' && querySignals.explicitSearch) {
        score += 15;
        reasons.push('search_support_skill');
        matchedIntents.add('MARKET_MACRO');
    }

    return {
        skillId: skill.metadata.id,
        skillName: skill.metadata.name,
        score,
        reasons: unique(reasons).slice(0, 6),
        matchedIntents: Array.from(matchedIntents),
    };
}

function scoreTradingIntentBoost(
    skillId: string,
    tradingIntent: TradingIntent | null,
    reasons: string[],
    matchedIntents: Set<NormalizedIntent>,
): number {
    if (!tradingIntent) return 0;
    if (tradingIntent.type === 'copy_trade' && skillId === 'copy_trade') {
        reasons.push('trading_intent:copy_trade');
        matchedIntents.add('COPY_TRADE');
        return 120;
    }
    if (tradingIntent.type === 'cross_chain_trade' && skillId === 'cross_chain_swap') {
        reasons.push('trading_intent:cross_chain');
        matchedIntents.add('CROSS_CHAIN');
        return 120;
    }
    if (tradingIntent.type === 'swap' && skillId === 'swap') {
        reasons.push('trading_intent:swap');
        matchedIntents.add('SWAP');
        return 120;
    }
    return 0;
}

function scorePhraseHints(skillId: string, queryLower: string, rawQuery: string, reasons: string[]): number {
    const phrases = SKILL_HINT_PHRASES[skillId] || [];
    let score = 0;
    for (const phrase of phrases) {
        const normalized = phrase.toLowerCase();
        if ((/[\u4e00-\u9fff]/.test(phrase) ? rawQuery.includes(phrase) : queryLower.includes(normalized))) {
            score += 22;
            reasons.push(`phrase:${phrase}`);
        }
    }
    return Math.min(score, 88);
}

function scoreExamples(skill: Skill, queryLower: string, queryTokens: string[], reasons: string[]): number {
    const examples = [...(skill.metadata.examples?.en || []), ...(skill.metadata.examples?.zh || [])];
    let best = 0;
    let bestReason = '';
    for (const example of examples) {
        const normalized = normalizeText(example);
        if (!normalized) continue;
        if (queryLower.includes(normalized) || normalized.includes(queryLower)) {
            if (60 > best) {
                best = 60;
                bestReason = `example:${example}`;
            }
            continue;
        }
        const overlap = tokenOverlap(queryTokens, tokenize(normalized));
        if (overlap.shared >= 2 && overlap.ratio >= 0.34) {
            const score = Math.round(18 + overlap.ratio * 24);
            if (score > best) {
                best = score;
                bestReason = `example_overlap:${example}`;
            }
        }
    }
    if (bestReason) reasons.push(bestReason);
    return best;
}

function scoreTextBlock(text: string, queryLower: string, queryTokens: string[], reasons: string[], label: string): number {
    const normalized = normalizeText(text);
    if (!normalized) return 0;
    if (queryLower.includes(normalized) || normalized.includes(queryLower)) {
        reasons.push(`${label}:substring`);
        return label === 'name' ? 28 : 18;
    }
    const overlap = tokenOverlap(queryTokens, tokenize(normalized));
    if (overlap.shared >= 2 && overlap.ratio >= 0.3) {
        reasons.push(`${label}:overlap`);
        return Math.round(8 + overlap.ratio * (label === 'tools' ? 20 : 16));
    }
    return 0;
}

export function detectQuerySignals(query: string, snapshot: ChatContextSnapshot, tradingIntent: TradingIntent | null): QuerySignals {
    const lower = String(query || '').toLowerCase();
    const raw = String(query || '');
    const hasRequestedToken = (snapshot.requestedTokenAddresses || []).length > 0 || (snapshot.requestedTokenSymbols || []).length > 0;
    const explicitSearch = isExplicitSearchIntent(lower, raw);
    const xSearch = /\btwitter\b/i.test(lower)
        || lower.includes('x.com')
        || /\bon\s+x\b/i.test(lower)
        || /\bsearch\s+x\b/i.test(lower)
        || /\bx\s+search\b/i.test(lower)
        || ['推特', '推文', 'X上', 'x上'].some((word) => raw.includes(word));
    const webSearch = /\bweb\s+search\b/i.test(lower) || /\bsearch\s+(the\s+)?web\b/i.test(lower) || /\bon\s+the\s+web\b/i.test(lower) || ['网页', '网站', '网上'].some((word) => raw.includes(word));
    const timeContext = hasTimeOrEventContext(lower, raw);
    const walletSignal = containsAny(lower, ['wallet', 'balance', 'portfolio', 'holdings']) || ['钱包', '余额', '持仓'].some((word) => raw.includes(word));
    const pnlSignal = containsAny(lower, ['pnl', 'profit', 'profits', 'profitability', 'performance']) || ['盈亏', '收益', '利润', '表现'].some((word) => raw.includes(word));
    const realtimeSignal = containsAny(lower, ['trending', 'trend', 'latest', 'today', 'current', 'right now', 'hot', 'buzz'])
        || ['趋势', '今天', '现在', '最新', '热门', '在聊什么'].some((word) => raw.includes(word));
    const socialChainEvidence = xSearch;

    return {
        welcome: isAssistantMetaQuery(lower, raw),
        explicitSearch,
        realtime: realtimeSignal,
        timeContext,
        xSearch,
        webSearch,
        wallet: walletSignal,
        pnl: pnlSignal,
        risk: isExplicitRiskRequest(lower, raw),
        prediction: containsAny(lower, ['polymarket', 'prediction', 'predictions', 'odds', 'bet', 'bets', 'betting', 'wager'])
            || ['押注', '赔率', '预测市场', '大家在赌什么'].some((word) => raw.includes(word)),
        zora: containsAny(lower, ['zora', 'mint', 'mints', 'nft', 'nfts']) || ['铸造', 'nft'].some((word) => raw.includes(word)),
        copyTrade: containsAny(lower, ['copy trade', 'copy-trade', 'copytrading', 'follow trader']) || ['跟单', '跟单交易'].some((word) => raw.includes(word)),
        crossChain: containsAny(lower, ['cross-chain', 'cross chain', 'bridge']) || ['跨链', '桥接'].some((word) => raw.includes(word)),
        swap: Boolean(tradingIntent && (tradingIntent.type === 'swap' || tradingIntent.type === 'cross_chain_trade'))
            || containsAny(lower, ['swap', 'buy', 'sell', 'trade']) || ['兑换', '买入', '卖出', '交易'].some((word) => raw.includes(word)),
        alerts: containsAny(lower, ['alert', 'alerts', 'notify me', 'notification']) || ['提醒', '预警', '通知我'].some((word) => raw.includes(word)),
        tokenAnalysis: hasRequestedToken
            || containsAny(lower, ['token', 'coin', 'coins', 'contract', 'creator', 'deployer', 'holders', 'early buyers', 'price'])
            || ['代币', '合约', '创建者', '部署者', '持有人', '早期买家', '价格'].some((word) => raw.includes(word)),
        social: containsAny(lower, ['farcaster', 'cast', 'casts', 'warpcast', 'twitter', 'x.com', 'social', 'sentiment'])
            || ['farcaster', '社交', '情绪', '推特', '推文'].some((word) => raw.includes(word)),
        market: containsAny(lower, ['market', 'macro', 'news', 'gas', 'economic', 'overview']) || ['行情', '宏观', '新闻', 'gas'].some((word) => raw.includes(word)),
        hasRequestedToken,
        socialChainEvidence,
    };
}

function isExplicitSearchIntent(query: string, rawQuery: string): boolean {
    const hasSearchVerb = /\b(search|look up|lookup|find|browse)\b/i.test(query);
    const hasXOrTwitter = /\btwitter\b/i.test(query)
        || query.includes('x.com')
        || /\bon\s+x\b/i.test(query)
        || /\bsearch\s+x\b/i.test(query)
        || /\bx\s+search\b/i.test(query);
    const hasWebSearch = /\bweb\s+search\b/i.test(query) || /\bsearch\s+(the\s+)?web\b/i.test(query) || /\bon\s+the\s+web\b/i.test(query);
    const hasZhSearch = ['搜索', '搜一下', '查一下', '查找', '浏览', '网页', '推特', '推文', 'X上', 'x上'].some((word) => rawQuery.includes(word));
    return hasWebSearch || hasXOrTwitter || hasZhSearch || (hasSearchVerb && (hasXOrTwitter || /\bweb\b/i.test(query)));
}

function isExplicitRiskRequest(query: string, rawQuery: string): boolean {
    return containsAny(query, [
        'check token risk', 'check risk', 'risk check', 'security check', 'is this safe', 'safe or not',
        'is this token safe', 'honeypot', 'rug', 'rug pull', 'scam', 'is this a scam',
    ]) || containsAny(rawQuery, [
        '检查风险', '风险检查', '安全检查', '这个安全吗', '这个代币安全吗', '是不是土狗',
        '是不是骗局', '是不是貔貅', '貔貅', '蜜罐', '土狗', '拉地毯', 'rug', 'honeypot',
    ]);
}

function hasTimeOrEventContext(query: string, rawQuery: string): boolean {
    if (containsAny(query, [
        'announcement', 'announcements', 'announce', 'announced', 'news', 'event', 'events',
        'date', 'time', 'timeline', 'when', 'yesterday', 'tomorrow', 'this week', 'last week',
        'before', 'after',
    ])) {
        return true;
    }
    if (['公告', '新闻', '事件', '时间', '日期', '昨天', '明天', '之前', '之后', '本周', '上周'].some((word) => rawQuery.includes(word))) {
        return true;
    }
    return /\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/.test(query)
        || /\b\d{1,2}:\d{2}\b/.test(query)
        || /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i.test(rawQuery);
}

function isAssistantMetaQuery(query: string, rawQuery: string): boolean {
    const normalized = query.trim();
    const raw = rawQuery.trim();
    if (['hi', 'hello', 'hey', 'yo', 'sup'].includes(normalized)) return true;
    if (['你好', '嗨', '哈喽', '您好'].includes(raw)) return true;
    return containsAny(normalized, [
        'who are you', 'what can you do', 'what do you do', 'introduce yourself',
        'how can you help', 'help me understand your capabilities', 'tell me about yourself',
    ]) || containsAny(raw, [
        '你是谁', '你能做什么', '你会什么', '介绍一下你自己', '你可以帮我做什么', '你都能做什么',
    ]);
}

function normalizeText(text: string): string {
    return String(text || '')
        .toLowerCase()
        .replace(/[_/]+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(text: string): string[] {
    return normalizeText(text)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);
}

function tokenOverlap(a: string[], b: string[]): { shared: number; ratio: number } {
    if (a.length === 0 || b.length === 0) return { shared: 0, ratio: 0 };
    const aSet = new Set(a);
    const bSet = new Set(b);
    let shared = 0;
    for (const token of aSet) {
        if (bSet.has(token)) shared += 1;
    }
    return {
        shared,
        ratio: shared / Math.max(1, Math.min(aSet.size, bSet.size)),
    };
}

function containsAny(text: string, needles: string[]): boolean {
    return needles.some((needle) => String(text || '').includes(needle));
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values));
}
