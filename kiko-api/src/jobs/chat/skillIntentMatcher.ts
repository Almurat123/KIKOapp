// CONTEXT MEMORY
// Updated: 2026-04-21
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
//         noun, such as "做一张赛博朋克风的产品海报". Product now also requires a
//         companion image-prompt guidance skill so prompt-advice turns do not
//         fall back to generic help, and real image requests can load the
//         prompt-writing playbook alongside the execution skill. OpenAI-aligned
//         runtime evaluation then showed Chinese edit-prompt requests such as
//         "改图提示词" could still miss image-prompt routing unless edit wording
//         was treated as prompt-help intent too. Production Farcaster review
//         then showed English "picture" wording could miss the generated-image
//         skill even when the request was a concrete visual deliverable.
//         Another runtime trace on 2026-04-21 showed multiline social prompts
//         and reference-image edit wording such as "put X on Y" could still
//         miss image-generation routing, which left the model with no image
//         tool and caused it to answer with a packaged prompt instead of
//         executing the image tool.
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
// - English `picture` is a first-class generated-image object, not only
//   conversational prose.
// - Image prompt coaching should route to a dedicated prompt skill, not to the image tool.
// - Real image requests may load both the image-generation skill and the image-prompt guidance skill.
// - Chinese edit-prompt wording such as 改图/修图/图像编辑提示词 should count as image prompt coaching.
// - Multiline visual briefs should be normalized before image regex matching.
// - Reference-image edit requests like "put X on Y" should expose the image
//   tool when current-turn image context or explicit image-model preference exists.
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
// - Source: OpenAI GPT Image Generation Models Prompting Guide
// - Kind: official API doc
// - Retrieved: 2026-04-19
// - Applied To: adding a prompt-guidance skill alongside image-generation routing
// - Verification: verified in docs and code
// - Source: Google Imagen prompt guide
// - Kind: official API doc
// - Retrieved: 2026-04-19
// - Applied To: prompt-advice routing and subject/context/style-driven image prompt guidance
// - Verification: verified in docs and code
// - Source: xAI Image Generation guide
// - Kind: official API doc
// - Retrieved: 2026-04-19
// - Applied To: prompt-advice routing and iterative image prompt guidance
// - Verification: verified in docs and code
// - Source: local OpenAI-aligned live eval of image prompt coaching turns
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: matching Chinese edit-prompt phrasing such as 改图提示词 to image_prompting
// - Verification: verified in runtime and code
// - Source: operator review on 2026-04-21 of "how to generate a picture of..."
//   image request behavior
// - Kind: runtime observation
// - Retrieved: 2026-04-21
// - Applied To: routing concrete English picture-generation asks to image_generation
// - Verification: verified in targeted tests
// - Source: production runtime log /Users/almurat/Downloads/logs.1776781337663.json
// - Kind: runtime observation
// - Retrieved: 2026-04-21
// - Applied To: normalizing multiline social prompts and exposing image-generation
//   on reference-image edit wording so the model calls the image tool instead
//   of replying with a rewritten prompt
// - Verification: verified in runtime log and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/image-prompt-guidance.md
// - /Users/almurat/KiKo/system-journal/owner-map/image-prompt-skills.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-openai-alignment-eval.md
// - /Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md
// - /Users/almurat/KiKo/system-journal/owner-map/clanker-skill.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-provenance.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-lean-chat-context-exposure.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
import { skillRegistryExec } from '../../skills/registry.js';
import type { Skill } from '../../skills/types.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { TradingIntent } from './tradingIntentResolver.js';
import type { CanonicalIntent } from './canonicalIntent.js';
import { hasTaskRouteFacet, resolveTaskRouteEvidenceRequirements, taskRouteNeedsRealtime } from './taskRoute.js';

export type SearchMode = 'forbidden' | 'fallback' | 'required';

export type NormalizedIntent =
    | 'WELCOME'
    | 'META_DEBUG'
    | 'IMAGE_GENERATION'
    | 'IMAGE_PROMPTING'
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
    imagePrompting: boolean;
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
    image_prompting: ['IMAGE_PROMPTING'],
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
    IMAGE_PROMPTING: 'imagePrompting',
};

const CLANKER_DEPLOY_QUERY_RE = /\bclanker\b|\b(?:deploy|launch|create|mint)\s+(?:a\s+)?(?:token|coin|memecoin)\b|\btoken\s+(?:deploy|launch|launchpad)\b|部署代币|上线代币|创建代币|发币|发行代币/i;
const IMAGE_GENERATION_QUERY_RE = /\b(?:generate|create|make|design|draw|render|illustrate)\b.{0,40}\b(?:image|picture|poster|cover|illustration|thumbnail|banner|hero|visual|artwork|ad|creative|mockup|photo)\b|\b(?:image|picture|poster|cover|illustration|thumbnail|banner|hero|visual|artwork|ad|creative|mockup|photo)\b.{0,40}\b(?:generate|create|make|design|draw|render)\b|(?:做|生成|画|设计)(?:一张|一个|个)?[^。！？\n]{0,40}(?:图|图片|海报|封面|插画|配图|宣传图|视觉稿)/i;
const IMAGE_VISUAL_ACTION_RE = /\b(?:generate|create|make|design|draw|render|illustrate|edit|restyle|transform|photoshop|composite|remix|reimagine|replace|remove|erase|extend|inpaint|outpaint|place|put|turn)\b|(?:做|生成|画|设计|改|修|编辑|重绘|扩图|补图|抠掉|去掉|替换|换成|放到|放在|合成|变成|做成)/i;
const IMAGE_VISUAL_NOUN_RE = /\b(?:image|picture|poster|cover|illustration|thumbnail|banner|hero|visual|artwork|ad|creative|mockup|photo|photograph|wallpaper|portrait|scene|shot)\b|(?:图|图片|海报|封面|插画|配图|宣传图|视觉稿|壁纸|头像|照片|场景图)/i;
const IMAGE_REFERENCE_EDIT_QUERY_RE = /\b(?:edit|restyle|transform|replace|remove|erase|extend|inpaint|outpaint|photoshop|composite|place|put)\b|\bturn\b.{0,32}\binto\b|\bmake\b.{0,32}\blook\b|(?:改图|修图|修照片|改照片|图像编辑|图片编辑|替换背景|去掉背景|换背景|扩图|补图|抠图|把.+变成|把.+放到)/i;
const IMAGE_PROMPT_ADVICE_QUERY_RE = /\b(?:prompt|prompts|image prompt)\b.{0,32}\b(?:how|write|writing|improve|optimi[sz]e|tutorial|guide|better)\b|\b(?:how|write|writing|improve|optimi[sz]e)\b.{0,32}\b(?:prompt|image prompt)\b|(?:图片|出图|海报|封面|插画|视觉稿)?提示词.{0,24}(?:怎么写|教程|优化|写法|模板|指南)|(?:怎么写|优化|改写).{0,24}(?:图片|出图|海报|封面|插画|视觉稿)?提示词|给我(?:写|改写|优化)一个(?:图片|出图|海报|封面|插画|视觉稿)?提示词|(?:改图|修图|改图片|修图片|改照片|修照片|图像编辑|图片编辑).{0,24}(?:提示词|prompt)|(?:帮我|给我|告诉我)(?:写|改写|优化).{0,24}(?:改图|修图|图像编辑).{0,12}(?:提示词|prompt)/i;

function normalizeQueryForIntentMatching(query: string): string {
    return String(query || '').replace(/\s+/g, ' ').trim();
}

function hasImageExecutionContext(snapshot: ChatContextSnapshot): boolean {
    const runtime = snapshot.runtime as any;
    const socialImageCount = Array.isArray(snapshot.runtime?.socialInput?.images)
        ? snapshot.runtime.socialInput.images.length
        : 0;
    const preferredGeneratedImageModel = String(
        runtime?.generatedImagePreference?.model
        || runtime?.toolContext?.generatedImagePreference?.model
        || '',
    ).trim().toLowerCase();
    return socialImageCount > 0 || preferredGeneratedImageModel.includes('image');
}

function detectImageGenerationSignal(query: string, snapshot: ChatContextSnapshot): boolean {
    const normalizedQuery = normalizeQueryForIntentMatching(query);
    if (!normalizedQuery) return false;
    if (IMAGE_PROMPT_ADVICE_QUERY_RE.test(normalizedQuery)) return false;

    const explicitVisualDeliverable = IMAGE_GENERATION_QUERY_RE.test(normalizedQuery)
        || (IMAGE_VISUAL_ACTION_RE.test(normalizedQuery) && IMAGE_VISUAL_NOUN_RE.test(normalizedQuery));
    const referenceImageEdit = hasImageExecutionContext(snapshot) && IMAGE_REFERENCE_EDIT_QUERY_RE.test(normalizedQuery);
    return explicitVisualDeliverable || referenceImageEdit;
}

function detectImagePromptingSignal(query: string, snapshot: ChatContextSnapshot): boolean {
    const normalizedQuery = normalizeQueryForIntentMatching(query);
    return detectImageGenerationSignal(normalizedQuery, snapshot) || IMAGE_PROMPT_ADVICE_QUERY_RE.test(normalizedQuery);
}

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
    if (snapshot.taskRoute) {
        return deriveQuerySignalsFromTaskRoute(snapshot, query, tradingIntent, snapshot.taskRoute, clankerDeploy);
    }
    if (canonicalIntent) {
        return deriveQuerySignalsFromCanonicalIntent(snapshot, query, tradingIntent, canonicalIntent, clankerDeploy);
    }
    const hasRequestedToken = (snapshot.requestedTokenAddresses || []).length > 0 || (snapshot.requestedTokenSymbols || []).length > 0;
    const welcomeQuery = !tradingIntent
        && !hasRequestedToken
        && (GREETING_QUERY_RE.test(query) || PLATFORM_ONBOARDING_QUERY_RE.test(query));
    const imageGeneration = detectImageGenerationSignal(query, snapshot);
    const imagePrompting = detectImagePromptingSignal(query, snapshot);

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
        imageGeneration,
        imagePrompting,
        hasRequestedToken,
        socialChainEvidence: false,
    };
}

function deriveQuerySignalsFromTaskRoute(
    snapshot: ChatContextSnapshot,
    query: string,
    tradingIntent: TradingIntent | null,
    taskRoute: NonNullable<ChatContextSnapshot['taskRoute']>,
    clankerDeploy: boolean,
): QuerySignals {
    const hasRequestedToken = taskRoute.entities.tokenAddresses.length > 0
        || taskRoute.entities.tokenSymbols.length > 0
        || (
            taskRoute.inheritEntitiesFromContext
            && (
                (snapshot.requestedTokenAddresses || []).length > 0
                || (snapshot.requestedTokenSymbols || []).length > 0
            )
        );
    const requiredEvidence = new Set(resolveTaskRouteEvidenceRequirements(taskRoute));
    const imageGeneration = detectImageGenerationSignal(query, snapshot);
    const imagePrompting = detectImagePromptingSignal(query, snapshot);
    const socialPlatform = String(
        snapshot.runtime?.socialInput?.platform
        || snapshot.runtime?.currentPage
        || '',
    ).trim().toLowerCase();
    const isSocialX = taskRoute.owner === 'social' && (socialPlatform === 'x' || socialPlatform === 'twitter');
    const isSocialWeb = taskRoute.owner === 'social' && !isSocialX;

    return {
        welcome: taskRoute.owner === 'assistant_meta' && taskRoute.phase === 'answer',
        metaDebug: taskRoute.owner === 'assistant_meta' && (taskRoute.phase === 'analyze' || hasTaskRouteFacet(taskRoute, 'behavior_debug')),
        explicitSearch: requiredEvidence.has('native_search_results'),
        realtime: taskRouteNeedsRealtime(taskRoute),
        timeContext: Boolean(taskRoute.timeContext),
        xSearch: isSocialX,
        webSearch: isSocialWeb || taskRoute.owner === 'market' || taskRoute.owner === 'zora' || (taskRoute.owner === 'token' && hasTaskRouteFacet(taskRoute, 'realtime')) || (taskRoute.owner === 'wallet' && hasTaskRouteFacet(taskRoute, 'realtime')) || (taskRoute.owner === 'polymarket' && hasTaskRouteFacet(taskRoute, 'realtime')),
        wallet: taskRoute.owner === 'wallet',
        pnl: taskRoute.owner === 'wallet' && hasTaskRouteFacet(taskRoute, 'wallet_followup'),
        risk: taskRoute.owner === 'token' && hasTaskRouteFacet(taskRoute, 'risk_review'),
        prediction: taskRoute.owner === 'polymarket',
        zora: taskRoute.owner === 'zora',
        copyTrade: taskRoute.owner === 'copy_trade',
        crossChain: taskRoute.owner === 'swap' && hasTaskRouteFacet(taskRoute, 'cross_chain'),
        swap: Boolean(tradingIntent && (tradingIntent.type === 'swap' || tradingIntent.type === 'cross_chain_trade'))
            || taskRoute.owner === 'swap',
        alerts: false,
        tokenAnalysis: taskRoute.owner === 'token',
        social: taskRoute.owner === 'social',
        market: taskRoute.owner === 'market',
        clankerDeploy: clankerDeploy || taskRoute.owner === 'token_deploy',
        imageGeneration: imageGeneration || taskRoute.owner === 'image',
        imagePrompting: imagePrompting || (taskRoute.owner === 'image' && hasTaskRouteFacet(taskRoute, 'prompt_only')),
        hasRequestedToken,
        socialChainEvidence: requiredEvidence.has('native_search_results')
            && (
                requiredEvidence.has('onchain_token_evidence')
                || requiredEvidence.has('onchain_wallet_evidence')
                || requiredEvidence.has('connected_chain_evidence')
            ),
    };
}

function deriveQuerySignalsFromCanonicalIntent(
    snapshot: ChatContextSnapshot,
    query: string,
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
    const imageGeneration = detectImageGenerationSignal(query, snapshot);
    const imagePrompting = detectImagePromptingSignal(query, snapshot);

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
        imageGeneration,
        imagePrompting,
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
