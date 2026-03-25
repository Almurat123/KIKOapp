import { skillRegistryExec } from '../../skills/registry.js';
import type { Skill } from '../../skills/types.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { TradingIntent } from './tradingIntentResolver.js';
import type { CanonicalIntent } from './canonicalIntent.js';

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

export function matchSkillsForQuery(params: {
    snapshot: ChatContextSnapshot;
    tradingIntent: TradingIntent | null;
}): SkillMatchResult {
    const canonicalIntent = params.snapshot.normalizedIntent || null;
    const querySignals = detectQuerySignals(
        params.snapshot.lastUserMessage,
        params.snapshot,
        params.tradingIntent,
        canonicalIntent,
    );
    const toolDescriptionMap = new Map(
        (params.snapshot.toolDefinitions || []).map((definition) => [
            definition.name,
            `${definition.name} ${definition.description || ''}`.trim(),
        ]),
    );

    const scored = skillRegistryExec.getAllSkills().map((skill) => scoreSkill({
        skill,
        querySignals,
        canonicalIntent,
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
    const searchMode: SearchMode = canonicalIntent?.searchMode
        || (querySignals.socialChainEvidence
            ? 'required'
            : querySignals.explicitSearch
            ? 'required'
            : querySignals.realtime
                ? 'fallback'
                : 'forbidden');
    const searchReason = canonicalIntent
        ? `canonical_${canonicalIntent.intent}`
        : querySignals.socialChainEvidence
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
    querySignals: QuerySignals;
    canonicalIntent: CanonicalIntent | null;
    tradingIntent: TradingIntent | null;
    toolDescriptionMap: Map<string, string>;
}): SkillMatch {
    const { skill, querySignals, canonicalIntent, tradingIntent, toolDescriptionMap } = params;
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

    score += scoreCanonicalIntentBoost(skill.metadata.id, canonicalIntent, reasons, matchedIntents);
    score += scoreTradingIntentBoost(skill.metadata.id, tradingIntent, reasons, matchedIntents);
    score += scoreToolCoverage(skill, toolDescriptionMap, reasons);

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

function scoreToolCoverage(skill: Skill, toolDescriptionMap: Map<string, string>, reasons: string[]): number {
    const registeredTools = (skill.metadata.tools || []).filter((toolName) => toolDescriptionMap.has(toolName));
    if (registeredTools.length === 0) return 0;
    reasons.push('registry_tool_support');
    return Math.min(registeredTools.length * 2, 8);
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

export function detectQuerySignals(query: string, snapshot: ChatContextSnapshot, tradingIntent: TradingIntent | null, canonicalIntent?: CanonicalIntent | null): QuerySignals {
    if (canonicalIntent) {
        return deriveQuerySignalsFromCanonicalIntent(snapshot, tradingIntent, canonicalIntent);
    }
    const hasRequestedToken = (snapshot.requestedTokenAddresses || []).length > 0 || (snapshot.requestedTokenSymbols || []).length > 0;

    return {
        welcome: false,
        explicitSearch: false,
        realtime: false,
        timeContext: false,
        xSearch: false,
        webSearch: false,
        wallet: false,
        pnl: false,
        risk: false,
        prediction: false,
        zora: false,
        copyTrade: tradingIntent?.type === 'copy_trade',
        crossChain: tradingIntent?.type === 'cross_chain_trade',
        swap: Boolean(tradingIntent && (tradingIntent.type === 'swap' || tradingIntent.type === 'cross_chain_trade'))
            || hasRequestedToken,
        alerts: false,
        tokenAnalysis: hasRequestedToken,
        social: false,
        market: false,
        hasRequestedToken,
        socialChainEvidence: false,
    };
}

function deriveQuerySignalsFromCanonicalIntent(
    snapshot: ChatContextSnapshot,
    tradingIntent: TradingIntent | null,
    canonicalIntent: CanonicalIntent,
): QuerySignals {
    const hasRequestedToken = canonicalIntent.entities.tokenAddresses.length > 0
        || canonicalIntent.entities.tokenSymbols.length > 0
        || (snapshot.requestedTokenAddresses || []).length > 0
        || (snapshot.requestedTokenSymbols || []).length > 0;
    const requiredEvidence = new Set(canonicalIntent.evidenceRequirements || []);

    return {
        welcome: canonicalIntent.intent === 'assistant_meta',
        explicitSearch: canonicalIntent.searchMode === 'required',
        realtime: canonicalIntent.requiresRealtime,
        timeContext: Boolean(canonicalIntent.timeContext),
        xSearch: canonicalIntent.searchTarget === 'x' || canonicalIntent.searchTarget === 'x_and_web' || canonicalIntent.domain === 'x',
        webSearch: canonicalIntent.searchTarget === 'web' || canonicalIntent.searchTarget === 'x_and_web',
        wallet: canonicalIntent.domain === 'wallet' || canonicalIntent.intent === 'wallet_analysis' || canonicalIntent.intent === 'wallet_pnl',
        pnl: canonicalIntent.intent === 'wallet_pnl',
        risk: canonicalIntent.intent === 'token_risk',
        prediction: canonicalIntent.domain === 'polymarket',
        zora: canonicalIntent.domain === 'zora' || canonicalIntent.intent === 'zora_discovery',
        copyTrade: canonicalIntent.intent === 'copy_trade',
        crossChain: canonicalIntent.intent === 'cross_chain_swap',
        swap: Boolean(tradingIntent && (tradingIntent.type === 'swap' || tradingIntent.type === 'cross_chain_trade'))
            || canonicalIntent.intent === 'swap'
            || canonicalIntent.intent === 'cross_chain_swap',
        alerts: canonicalIntent.intent === 'token_alerts',
        tokenAnalysis: canonicalIntent.domain === 'token'
            || ['token_analysis', 'early_buyers', 'creator_analysis', 'token_risk'].includes(canonicalIntent.intent),
        social: canonicalIntent.domain === 'x' || canonicalIntent.domain === 'farcaster' || canonicalIntent.intent === 'social_discovery',
        market: canonicalIntent.domain === 'market' || canonicalIntent.intent === 'market_macro',
        hasRequestedToken,
        socialChainEvidence: requiredEvidence.has('native_search_results')
            && (
                requiredEvidence.has('onchain_token_evidence')
                || requiredEvidence.has('onchain_wallet_evidence')
                || requiredEvidence.has('connected_chain_evidence')
            ),
    };
}

function scoreCanonicalIntentBoost(
    skillId: string,
    canonicalIntent: CanonicalIntent | null,
    reasons: string[],
    matchedIntents: Set<NormalizedIntent>,
): number {
    if (!canonicalIntent) return 0;

    const domain = canonicalIntent.domain;
    const intent = canonicalIntent.intent;
    const boost = (points: number, reason: string, matched?: NormalizedIntent) => {
        reasons.push(reason);
        if (matched) matchedIntents.add(matched);
        return points;
    };

    if (skillId === 'welcome_onboarding' && intent === 'assistant_meta') {
        return boost(140, 'canonical:intent=assistant_meta', 'WELCOME');
    }
    if (skillId === 'swap' && intent === 'swap') {
        return boost(140, 'canonical:intent=swap', 'SWAP');
    }
    if (skillId === 'cross_chain_swap' && intent === 'cross_chain_swap') {
        return boost(140, 'canonical:intent=cross_chain_swap', 'CROSS_CHAIN');
    }
    if (skillId === 'copy_trade' && intent === 'copy_trade') {
        return boost(140, 'canonical:intent=copy_trade', 'COPY_TRADE');
    }
    if (skillId === 'token_analysis' && (domain === 'token' || ['token_analysis', 'early_buyers', 'creator_analysis'].includes(intent))) {
        return boost(130, `canonical:intent=${intent}`, 'TOKEN_ANALYSIS');
    }
    if (skillId === 'risk_security' && intent === 'token_risk') {
        return boost(130, 'canonical:intent=token_risk', 'RISK_SCAN');
    }
    if (skillId === 'wallet_portfolio' && (domain === 'wallet' || ['wallet_analysis', 'wallet_pnl'].includes(intent))) {
        return boost(130, `canonical:intent=${intent}`, 'WALLET_PORTFOLIO');
    }
    if (skillId === 'social_farcaster' && domain === 'farcaster') {
        return boost(130, 'canonical:domain=farcaster', 'SOCIAL_DISCOVERY');
    }
    if (skillId === 'polymarket_prediction' && domain === 'polymarket') {
        return boost(140, `canonical:intent=${intent}`, 'PREDICTION_MARKETS');
    }
    if (skillId === 'zora_nfts' && (domain === 'zora' || intent === 'zora_discovery')) {
        return boost(130, 'canonical:intent=zora_discovery', 'ZORA_DISCOVERY');
    }
    if (skillId === 'token_alert' && intent === 'token_alerts') {
        return boost(130, 'canonical:intent=token_alerts', 'TOKEN_ALERTS');
    }
    if (skillId === 'market_macro' && (domain === 'market' || domain === 'x' || intent === 'social_discovery' || intent === 'market_macro')) {
        return boost(95, `canonical:intent=${intent}`, 'MARKET_MACRO');
    }
    return 0;
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values));
}
