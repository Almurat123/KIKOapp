// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Renata
// Reason: Clanker token-launch queries were still being treated as generic
//         trading traffic, which meant the dedicated launch prompt could be
//         skipped even when the user explicitly asked for a Clanker deploy.
//         Canonical normalization now also exposes `clanker_deploy`, so the
//         matcher must route both raw and normalized deploy turns to the same
//         Clanker skill. Chat v2 now also needs a dedicated image-generation
//         signal so the model only sees the internal image tool on real visual
//         deliverable requests. The image signal must handle Chinese requests
//         where style/use modifiers appear between the action and the asset
//         noun, such as "做一张赛博朋克风的产品海报".
// Goal: keep Clanker launch, history, and reward queries routed to the
//       dedicated Clanker skill so the model sees the launch prompt before it
//       attempts deployment, and expose the generated-image skill only on real
//       image-generation requests.
// Owns: query-signal detection and skill scoring for chat skill selection.
// Does Not Own: Clanker API payload normalization, tool execution, or provider routing.
// Design Language:
// - Dedicated launch/deploy queries should outscore generic trading skills.
// - Clanker mentions should be recognized on both canonical-normalized and raw-query paths.
// - Skill routing should stay deterministic instead of depending on hidden prompt memory.
// - `clanker_deploy` canonical intent must select the Clanker skill before generic token analysis.
// - Plain capability questions such as "what can you do" should route to onboarding, not a generic market skill.
// - Chinese visual-asset requests may include modifiers between the verb and noun; keep those routed to image generation.
// Document Provenance:
// - Source: Clanker Documentation, Deploy Token (v4.0.0)
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: choosing a dedicated Clanker deploy skill for launch queries
// - Verification: verified in docs and code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: routing change that exposes the Clanker skill prompt and canonical deploy route
// - Verification: inferred from code and tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-lean-chat-context-exposure.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: routing plain capability questions like "what can you do" to onboarding instead of a generic market skill
// - Verification: verified in code and targeted tests
// - Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: image-generation query signal and skill routing
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md
// - /Users/almurat/KiKo/system-journal/owner-map/clanker-skill.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-lean-chat-context-exposure.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
import { skillRegistryExec } from '../../skills/registry.js';
import type { Skill } from '../../skills/types.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { TradingIntent } from './tradingIntentResolver.js';
import type { CanonicalIntent } from './canonicalIntent.js';

export type SearchMode = 'forbidden' | 'fallback' | 'required';

export type NormalizedIntent =
    | 'WELCOME'
    | 'META_DEBUG'
    | 'IMAGE_GENERATION'
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
    | 'MARKET_MACRO'
    | 'CLANKER_DEPLOY';

export interface QuerySignals {
    welcome: boolean;
    metaDebug: boolean;
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
    clankerDeploy: boolean;
    imageGeneration: boolean;
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
const GREETING_QUERY_RE = /^(?:\s)*(?:hi|hello|hey|yo|gm|gn|good\s+morning|good\s+afternoon|good\s+evening|你好|您好|嗨|哈喽)(?:\s|!|\.|,|$)/i;
const PLATFORM_ONBOARDING_QUERY_RE = /\b(?:new here|how do i start|how to start|how do i use|how to use|get(?:ting)? started|intro(?:duction)? to kiko|about kiko|what is kiko|what can\b.{0,24}\bkiko\b|what can\b.{0,24}\byou\b.{0,24}\bkiko\b|what can kiko do|what can you do|who are you)\b|怎么使用\s*kiko|如何使用\s*kiko|kiko\s*怎么用|kiko\s*如何用|介绍一下\s*kiko|kiko\s*是什么|kiko\s*能做什么|你能做什么|我是新手|新手怎么开始/i;

const SKILL_INTENT_MAP: Record<string, NormalizedIntent[]> = {
    welcome_onboarding: ['WELCOME'],
    meta_debug: ['META_DEBUG'],
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
    clanker_deploy_token: ['CLANKER_DEPLOY'],
    image_generation: ['IMAGE_GENERATION'],
};

const INTENT_SIGNAL_MAP: Record<NormalizedIntent, keyof QuerySignals> = {
    WELCOME: 'welcome',
    META_DEBUG: 'metaDebug',
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
    CLANKER_DEPLOY: 'clankerDeploy',
    IMAGE_GENERATION: 'imageGeneration',
};

const CLANKER_DEPLOY_QUERY_RE = /\bclanker\b|\b(?:deploy|launch|create|mint)\s+(?:a\s+)?(?:token|coin|memecoin)\b|\btoken\s+(?:deploy|launch|launchpad)\b|部署代币|上线代币|创建代币|发币|发行代币/i;
const IMAGE_GENERATION_QUERY_RE = /\b(?:generate|create|make|design|draw|render|illustrate)\b.{0,40}\b(?:image|poster|cover|illustration|thumbnail|banner|hero|visual|artwork|ad|creative|mockup|photo)\b|\b(?:image|poster|cover|illustration|thumbnail|banner|hero|visual|artwork|ad|creative|mockup|photo)\b.{0,40}\b(?:generate|create|make|design|draw|render)\b|(?:做|生成|画|设计)(?:一张|一个|个)?[^。！？\n]{0,40}(?:图|图片|海报|封面|插画|配图|宣传图|视觉稿)/i;
const IMAGE_PROMPT_ADVICE_QUERY_RE = /\b(?:prompt|image prompt)\b.{0,24}\b(?:how|write|writing|improve|tutorial)\b|\b(?:提示词)\b.{0,24}(?:怎么写|教程|优化|写法)|告诉我怎么写(?:图片)?提示词/i;

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
    if (querySignals.metaDebug) {
        const metaOnly = rankedMatches.find((match) => match.skillId === 'meta_debug');
        return {
            rankedMatches: metaOnly ? [metaOnly] : [],
            rejectedMatches: scored.filter((match) => !metaOnly || match.skillId !== metaOnly.skillId),
            querySignals,
            searchMode: canonicalIntent?.searchMode || 'forbidden',
            searchReason: 'assistant_meta_debug_query',
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
    const clankerDeploy = detectClankerDeploySignal(query);
    if (canonicalIntent) {
        return deriveQuerySignalsFromCanonicalIntent(snapshot, tradingIntent, canonicalIntent, clankerDeploy);
    }
    const hasRequestedToken = (snapshot.requestedTokenAddresses || []).length > 0 || (snapshot.requestedTokenSymbols || []).length > 0;
    const welcomeQuery = !tradingIntent
        && !hasRequestedToken
        && (GREETING_QUERY_RE.test(query) || PLATFORM_ONBOARDING_QUERY_RE.test(query));

    return {
        welcome: welcomeQuery,
        metaDebug: false,
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
        clankerDeploy,
        imageGeneration: IMAGE_GENERATION_QUERY_RE.test(query) && !IMAGE_PROMPT_ADVICE_QUERY_RE.test(query),
        hasRequestedToken,
        socialChainEvidence: false,
    };
}

function deriveQuerySignalsFromCanonicalIntent(
    snapshot: ChatContextSnapshot,
    tradingIntent: TradingIntent | null,
    canonicalIntent: CanonicalIntent,
    clankerDeploy: boolean,
): QuerySignals {
    const inheritsEntitiesFromContext = canonicalIntent.inheritEntitiesFromContext ?? true;
    const isAssistantMeta = canonicalIntent.intent === 'assistant_meta' || canonicalIntent.domain === 'assistant_meta';
    const hasRequestedToken = canonicalIntent.entities.tokenAddresses.length > 0
        || canonicalIntent.entities.tokenSymbols.length > 0
        || (
            inheritsEntitiesFromContext
            && (
                (snapshot.requestedTokenAddresses || []).length > 0
                || (snapshot.requestedTokenSymbols || []).length > 0
            )
        );
    const requiredEvidence = new Set(canonicalIntent.evidenceRequirements || []);

    return {
        welcome: isAssistantMeta && canonicalIntent.taskMode === 'discover',
        metaDebug: isAssistantMeta && canonicalIntent.taskMode === 'analyze',
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
        clankerDeploy: clankerDeploy || canonicalIntent.intent === 'clanker_deploy',
        imageGeneration: false,
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
        if (canonicalIntent.taskMode !== 'discover') return 0;
        return boost(140, 'canonical:intent=assistant_meta', 'WELCOME');
    }
    if (skillId === 'meta_debug' && intent === 'assistant_meta' && canonicalIntent.taskMode === 'analyze') {
        return boost(140, 'canonical:intent=assistant_meta_analyze', 'META_DEBUG');
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
    if (skillId === 'clanker_deploy_token' && intent === 'clanker_deploy') {
        return boost(160, 'canonical:intent=clanker_deploy', 'CLANKER_DEPLOY');
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

function detectClankerDeploySignal(query: string): boolean {
    return CLANKER_DEPLOY_QUERY_RE.test(String(query || ''));
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values));
}
