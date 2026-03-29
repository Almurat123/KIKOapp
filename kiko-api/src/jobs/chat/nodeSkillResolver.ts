import { LogCode } from '../../config/logRegistry.js';
import { skillRegistryExec } from '../../skills/registry.js';
import { logger } from '../../utils/logger.js';
import { resolveCanonicalChainRef } from './chainIntent.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { CanonicalIntent } from './canonicalIntent.js';
import {
    detectQuerySignals,
    matchSkillsForQuery,
    type QuerySignals,
    type SearchMode,
    type SkillMatch,
} from './skillIntentMatcher.js';
import type { TradingIntent } from './tradingIntentResolver.js';

export type IntentPrimaryIntent =
    | 'meta_debug'
    | 'search_discovery'
    | 'social_discovery'
    | 'token_analysis'
    | 'token_risk'
    | 'wallet_analysis'
    | 'polymarket_discovery'
    | 'polymarket_order'
    | 'swap_execution'
    | 'copytrade_execution'
    | 'general_answer';

export type IntentTaskMode = 'discover' | 'analyze' | 'execute' | 'confirm';
export type IntentSearchTarget = 'x' | 'web' | 'x_and_web' | 'none';
export type IntentDomain = 'x' | 'farcaster' | 'token' | 'wallet' | 'polymarket' | 'general' | 'zora' | 'market';
export type IntentMetaDomain = 'assistant_meta';
export type IntentExecutionRisk = 'read_only' | 'mutation';
export type ToolPhase = 'native_search_only' | 'local_analysis' | 'execution';

export interface IntentEnvelope {
    primary_intent: IntentPrimaryIntent;
    task_mode: IntentTaskMode;
    search_mode: SearchMode;
    search_target: IntentSearchTarget;
    domain: IntentDomain | IntentMetaDomain;
    execution_risk: IntentExecutionRisk;
    required_evidence: string[];
}

export interface ToolPhasePolicy {
    initialPhase: ToolPhase;
    nextPhaseAfterNativeSearch: ToolPhase | null;
    searchRetryLimit: number;
}

export interface SkillResolution {
    selectedSkills: string[];
    skillPrompts: string[];
    allowedTools: string[];
    blockedTools: string[];
    preferredTools: string[];
    strategyNotes: string[];
    allowAllTools: boolean;
    rankedMatches: SkillMatch[];
    searchMode: SearchMode;
    searchReason: string;
    querySignals: QuerySignals;
    intentEnvelope: IntentEnvelope;
    toolPhasePolicy: ToolPhasePolicy;
    currentPhase: ToolPhase;
}

const GROK_BLOCKED_FARCASTER_TOOLS = new Set([
    'get_trending_casts',
    'search_farcaster_casts',
    'get_farcaster_user',
]);

const LOCAL_TOKEN_LEADERBOARD_TOOLS = new Set([
    'get_trending_tokens',
    'get_token_info',
]);

const EXPLICIT_SOCIAL_SOURCE_QUERY_RE = /\b(x|twitter|tweet|tweets|farcaster|cast|casts)\b/i;
const EXPLICIT_SEARCH_QUERY_RE = /\b(search|look\s*up|lookup|find on|search on|from x|from twitter|from farcaster)\b/i;
const TOKEN_LEADERBOARD_QUERY_RE = /\b(trend|trending|hot token|hot coin|top token|top coin|pumping|top gainers|gainers|movers)\b/i;
const DETAILED_ONBOARDING_QUERY_RE = /\b(new here|how do i start|how to start|how do i use|how to use|get(?:ting)? started|intro(?:duction)? to kiko|about kiko|what is kiko|what can\b.{0,24}\bkiko\b|what can kiko do|who are you)\b|怎么使用\s*kiko|如何使用\s*kiko|kiko\s*怎么用|kiko\s*如何用|介绍一下\s*kiko|kiko\s*是什么|kiko\s*能做什么|你能做什么|我是新手|新手怎么开始/i;

export function resolveNodeSkills(snapshot: ChatContextSnapshot, tradingIntent: TradingIntent | null, canonicalIntent?: CanonicalIntent | null): SkillResolution {
    const isGrok = String(snapshot.model || '').toLowerCase().includes('grok');
    const rawQuery = String(snapshot.lastUserMessage || '');
    const asksDetailedOnboarding = DETAILED_ONBOARDING_QUERY_RE.test(rawQuery);
    const asksProfitRankingFollowup = /\b(pnl|profit|roi|rank)\b/i.test(rawQuery) || /收益|盈利|利润|排名|排行/.test(rawQuery);
    const asksWalletTradeSummaryFollowup = /\b(buy|sell|bought|sold|trade summary|trading summary)\b/i.test(rawQuery) || /买入|卖出|交易汇总|买卖汇总/.test(rawQuery);
    const normalizedIntent = canonicalIntent || snapshot.normalizedIntent || null;
    const inheritsEntitiesFromContext = normalizedIntent?.inheritEntitiesFromContext ?? true;
    const effectiveRequestedTokenAddresses = inheritsEntitiesFromContext
        ? (snapshot.requestedTokenAddresses || [])
        : (normalizedIntent?.entities?.tokenAddresses || []);
    const effectiveRequestedTokenSymbols = inheritsEntitiesFromContext
        ? (snapshot.requestedTokenSymbols || [])
        : (normalizedIntent?.entities?.tokenSymbols || []);
    const availableToolNames = new Set((snapshot.toolDefinitions || []).map((definition) => String(definition.name || '').trim()).filter(Boolean));
    const blockedTools: string[] = [];
    const preferredTools: string[] = [];
    const strategyNotes: string[] = [];
    let allowAllTools = true;
    const strictPolicy = snapshot.policySnapshot?.enforcementLevel === 'hard';
    const sessionToolNames = Array.from(new Set(
        (snapshot.recentToolTrace?.toolCalls || [])
            .map((call) => String(call?.tool || '').trim())
            .filter((toolName) => toolName && availableToolNames.has(toolName)),
    ));
    const hasRequestedTokenAddress = effectiveRequestedTokenAddresses.length > 0;

    const matchResult = matchSkillsForQuery({ snapshot: normalizedIntent ? { ...snapshot, normalizedIntent } : snapshot, tradingIntent });
    const querySignals = matchResult.querySignals;
    const explicitRiskRequest = querySignals.risk;
    const asksWalletPnl = querySignals.pnl;
    const hasRequestedToken = querySignals.hasRequestedToken;
    const requiresSocialChainEvidence = querySignals.socialChainEvidence;
    const requestedChain = resolveCanonicalChainRef({
        canonicalIntent: normalizedIntent,
        requestedTokenAddresses: effectiveRequestedTokenAddresses,
        requestedTokenSymbols: effectiveRequestedTokenSymbols,
        runtimeChainId: snapshot.runtime.chainId,
        runtimeChainName: snapshot.runtime.chainName,
    });
    const explicitlyMentionsFarcaster = normalizedIntent?.domain === 'farcaster';
    const preferXNativeSearch = normalizedIntent
        ? (normalizedIntent.searchTarget === 'x' || normalizedIntent.searchTarget === 'x_and_web' || normalizedIntent.domain === 'x')
        : false;
    const asksEarlyBuyers = normalizedIntent?.intent === 'early_buyers';
    const explicitEarlyBuyerRowCount = normalizedIntent?.rowCount ?? null;
    const explicitlyRequestsEarlyBuyerFullList = normalizedIntent?.outputMode === 'full_table'
        || (asksEarlyBuyers && explicitEarlyBuyerRowCount !== null);
    const wantsEarlyBuyerFullList = asksEarlyBuyers || explicitlyRequestsEarlyBuyerFullList;
    const normalizedTokenSymbols = Array.isArray(normalizedIntent?.entities?.tokenSymbols)
        ? normalizedIntent!.entities.tokenSymbols.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];
    const requestedTokenSymbols = Array.isArray(effectiveRequestedTokenSymbols)
        ? effectiveRequestedTokenSymbols.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];
    const hasExplicitPolymarketCoinSelection = normalizedTokenSymbols.length > 0 || requestedTokenSymbols.length > 0;
    const asksCreator = normalizedIntent?.intent === 'creator_analysis';

    let selected = matchResult.rankedMatches.map((item) => item.skillId);
    if (querySignals.welcome) {
        strategyNotes.push('This is a greeting, self-introduction, or capabilities question. Answer directly without tools unless the user explicitly asks for live data or on-chain evidence.');
        if (asksDetailedOnboarding) {
            strategyNotes.push('For explicit Kiko intro / capabilities / how-to-use questions, give a real onboarding answer: explain what Kiko is, group the main capabilities, show concrete example commands, explain safe first steps, and recommend the next action. Do not bounce back with "what do you want me to do?" as the main answer.');
        }
        selected = selected.filter((skillId) => skillId === 'welcome_onboarding');
    } else if (querySignals.metaDebug) {
        strategyNotes.push('This turn is about the assistant or system behavior itself. Explain the previous behavior directly from the current conversation and runtime context instead of switching back into a token or market answer.');
        strategyNotes.push('When explaining what went wrong, distinguish between observed facts from the current conversation/runtime and informed inferences. If some evidence is missing, say exactly what is missing instead of fabricating certainty.');
        selected = selected.filter((skillId) => skillId === 'meta_debug');
    }

    if (tradingIntent) {
        if (tradingIntent.type === 'copy_trade') {
            ensurePrimarySkill(selected, 'copy_trade');
            ensureSupportingSkill(selected, 'wallet_portfolio');
        } else if (tradingIntent.type === 'cross_chain_trade') {
            ensurePrimarySkill(selected, 'cross_chain_swap');
            ensureSupportingSkill(selected, 'wallet_portfolio');
        } else {
            ensurePrimarySkill(selected, 'swap');
            ensureSupportingSkill(selected, 'wallet_portfolio');
            if (explicitRiskRequest) {
                ensureSupportingSkill(selected, 'risk_security');
            }
        }
    } else {
        if (querySignals.wallet || asksWalletPnl) {
            ensurePrimarySkill(selected, 'wallet_portfolio');
        }
        if (explicitRiskRequest) {
            ensureSupportingSkill(selected, 'risk_security');
        }
        if (hasRequestedToken) {
            ensureSupportingSkill(selected, 'token_analysis');
        }
        if ((asksProfitRankingFollowup || asksWalletTradeSummaryFollowup) && sessionToolNames.includes('get_early_buyers')) {
            ensurePrimarySkill(selected, 'wallet_portfolio');
            if (hasRequestedToken) {
                ensureSupportingSkill(selected, 'token_analysis');
            }
        }
    }

    if (requiresSocialChainEvidence) {
        ensureSupportingSkill(selected, 'market_macro');
        if (snapshot.runtime.walletAddress || snapshot.runtime.userAddress) {
            ensureSupportingSkill(selected, 'wallet_portfolio');
        }
        if (hasRequestedToken) {
            ensureSupportingSkill(selected, 'token_analysis');
        }
        if (querySignals.wallet || asksWalletPnl) {
            ensureSupportingSkill(selected, 'wallet_portfolio');
        }
        strategyNotes.push('For X/Twitter queries in this system, prefer combining search evidence with chain-side evidence when it materially improves the answer.');
        if (querySignals.timeContext && hasRequestedToken) {
            strategyNotes.push('For time-anchored token analysis, establish the public post or announcement timestamp first, then run get_early_buyers with the real address + start_time/end_time contract.');
        }
    }

    if (selected.length === 0 && !querySignals.welcome && !querySignals.metaDebug) {
        selected = ['market_macro'];
    }

    if (requestedChain?.chainId && snapshot.runtime.chainId && requestedChain.chainId !== Number(snapshot.runtime.chainId)) {
        strategyNotes.push(`The user explicitly requested ${requestedChain.chainName}. Treat the connected chain only as wallet context; requested chain overrides it for this turn.`);
    }

    if (preferXNativeSearch && !isGrok && requiresSocialChainEvidence) {
        strategyNotes.push('This provider path has no native X search. Prefer local external_web_search together with relevant chain-analysis tools when you need current X/Twitter context.');
    }

    selected = selected
        .filter((skillId, index) => selected.indexOf(skillId) === index && !!skillRegistryExec.getSkill(skillId))
        .slice(0, querySignals.welcome ? 1 : 3);

    const skillPrompts: string[] = [];
    let allowedTools: string[] = [];

    for (const skillId of selected) {
        const skill = skillRegistryExec.getSkill(skillId);
        if (!skill) continue;
        if (skill.prompt) {
            skillPrompts.push(skill.prompt);
        }
        for (const toolName of skill.metadata.tools || []) {
            if (availableToolNames.has(String(toolName))) {
                if (!allowedTools.includes(toolName)) {
                    allowedTools.push(String(toolName));
                }
            }
        }
    }

    if (tradingIntent?.kind === 'trade_confirmation') {
        if (tradingIntent.type === 'swap') {
            for (const toolName of ['prepare_swap_transaction', 'prepare_cross_chain_tx']) {
                if (!allowedTools.includes(toolName)) {
                    allowedTools.push(toolName);
                }
            }
        }
        if (tradingIntent.type === 'copy_trade' && !allowedTools.includes('create_copy_trade_config')) {
            allowedTools.push('create_copy_trade_config');
        }
    }

    if (tradingIntent?.kind === 'trading' && tradingIntent.type === 'swap') {
        const userSettings = snapshot.runtime.userSettings || {};
        const fastSwapMode = userSettings.fastSwapMode === true;
        const quoteBeforeSwap = userSettings.showQuoteBeforeSwap !== false && !fastSwapMode;
        pushPreferred(preferredTools, 'get_wallet_info');
        pushPreferred(preferredTools, 'prepare_swap_transaction');
        if (quoteBeforeSwap) {
            pushPreferred(preferredTools, 'simulate_swap');
            strategyNotes.push('Quote-before-swap mode is enabled: resolve balance with get_wallet_info, run simulate_swap once for the first pair+amount, present the quote, then use prepare_swap_transaction only after explicit user confirmation.');
        } else if (fastSwapMode) {
            strategyNotes.push('Fast swap mode is enabled: do not make simulate_swap a blocking prerequisite. Resolve wallet/balance context first, then move directly toward prepare_swap_transaction execution once token, chain, and amount are explicit and safe.');
        } else {
            strategyNotes.push('Direct execution mode is enabled: resolve wallet/balance context first, use preflight only when needed for ambiguity or safety, then move toward prepare_swap_transaction execution without stalling on quote presentation.');
        }
        strategyNotes.push('Do not use get_token_price as a prerequisite for selling or swapping a contract-address token. That tool is only for mainstream symbol price lookups.');
    }

    if (!strictPolicy) {
        allowedTools = Array.from(availableToolNames).sort();
    }

    const polymarketShortWindowQuery = normalizedIntent?.intent === 'polymarket_short_window';
    if (polymarketShortWindowQuery) {
        if (hasExplicitPolymarketCoinSelection) {
            pushPreferred(preferredTools, 'get_polymarket_coin_updown_markets');
            strategyNotes.push('For explicit coin/token Up/Down short-window requests, prefer get_polymarket_coin_updown_markets because exact ET-window discovery is required.');
        } else {
            pushPreferred(preferredTools, 'get_polymarket_market_overview');
            pushPreferred(preferredTools, 'get_new_markets');
            strategyNotes.push('Generic short-window market requests are broader than the coin-only 5-minute slice. Use grouped overview/new-market discovery first, and only narrow to get_polymarket_coin_updown_markets when the user explicitly asks for a coin/token series.');
        }
    }
    const polymarketOrderQuery = normalizedIntent?.intent === 'polymarket_order';
    if (polymarketOrderQuery) {
        pushPreferred(preferredTools, 'prepare_polymarket_bet');
        strategyNotes.push('For concrete Polymarket order turns, go straight to prepare_polymarket_bet when market, outcome, and amount are already explicit. Do not spend another turn re-confirming obvious selected parameters.');
    }

    if ((tradingIntent?.kind === 'trading' && tradingIntent.type === 'swap') || hasRequestedTokenAddress) {
        removeTool(allowedTools, 'get_token_price');
        removeTool(preferredTools, 'get_token_price');
        if (hasRequestedTokenAddress) {
            strategyNotes.push('get_token_price is restricted to mainstream symbol lookups. Contract-address tokens should use wallet, token, and swap tooling instead.');
        }
    }

    if (preferXNativeSearch) {
        strategyNotes.push('This query is explicitly about X/Twitter. Prefer X-related evidence first, but choose the tools that best answer the request.');
    }

    if (hasRequestedToken) {
        pushPreferred(preferredTools, 'get_token_info');
    }
    if (requiresSocialChainEvidence && !isGrok) {
        pushPreferred(preferredTools, 'external_web_search');
    }
    if (asksEarlyBuyers && hasRequestedToken) {
        pushPreferred(preferredTools, 'get_early_buyers');
        pushPreferred(preferredTools, 'get_token_info');
        strategyNotes.push('This request asks for on-chain buyer/holder evidence. Prefer local token-analysis tools before answering from web summaries alone.');
        if (wantsEarlyBuyerFullList) {
            strategyNotes.push(`Early-buyer queries default to full-list output${explicitEarlyBuyerRowCount ? ` with ${explicitEarlyBuyerRowCount} rows` : ''}. Preserve full wallet addresses and render the returned rows directly as a clean markdown table instead of compressing them into a short summary. Do not request trade progression or wallet PnL unless the user explicitly asks for those deeper wallet details.`);
        }
    }
    if (asksCreator && hasRequestedToken) {
        pushPreferred(preferredTools, 'analyze_creator');
        pushPreferred(preferredTools, 'get_token_info');
    }
    if (asksWalletPnl) {
        pushPreferred(preferredTools, 'analyze_wallet_pnl_batch');
    }
    if (requiresSocialChainEvidence && (querySignals.wallet || asksWalletPnl)) {
        pushPreferred(preferredTools, 'get_wallet_info');
        pushPreferred(preferredTools, 'analyze_wallet_pnl_batch');
    }
    if (requiresSocialChainEvidence && hasRequestedToken) {
        pushPreferred(preferredTools, 'get_early_buyers');
        pushPreferred(preferredTools, 'analyze_creator');
    }
    if (requiresSocialChainEvidence && (snapshot.runtime.walletAddress || snapshot.runtime.userAddress)) {
        pushPreferred(preferredTools, 'get_wallet_info');
    }

    for (const skillId of selected) {
        pushPreferredToolsForSkill(skillId, preferredTools);
    }

    if (polymarketShortWindowQuery && !hasExplicitPolymarketCoinSelection) {
        removeTool(preferredTools, 'get_polymarket_coin_updown_markets');
    }

    if (sessionToolNames.length > 0) {
        for (const toolName of sessionToolNames) {
            if (!allowedTools.includes(toolName)) {
                allowedTools.push(toolName);
            }
        }
        for (const toolName of sessionToolNames) {
            pushPreferred(preferredTools, toolName);
        }
        strategyNotes.push(`Recent tool evidence is available from this session: ${sessionToolNames.join(', ')}. Reuse it when it still answers the current turn, and refresh only when the structured workflow state or new user request makes targeted re-verification necessary.`);
        if (
            polymarketOrderQuery
            && sessionToolNames.some((toolName) => ['get_polymarket_coin_updown_markets', 'prepare_polymarket_bet', 'get_polymarket_market_overview'].includes(toolName))
        ) {
            strategyNotes.push('Recent Polymarket discovery/prep evidence already exists in this session. Reuse that evidence and move directly into bet preparation unless the user explicitly changed the market, side, or amount.');
        }
        if ((asksWalletPnl || asksProfitRankingFollowup || asksWalletTradeSummaryFollowup) && sessionToolNames.includes('get_early_buyers')) {
            pushPreferred(preferredTools, 'analyze_wallet_pnl_batch');
            strategyNotes.push('If recent early-buyer rows already exist and the user now asks for profit/PnL or per-wallet buy/sell summaries, reuse those wallet addresses as the candidate set for batch wallet PnL analysis.');
            strategyNotes.push('Pass the same token_address into analyze_wallet_pnl_batch so the result reports each wallet\'s buy USD, sell USD, realized PnL, and profit percent for that token over a supported recent window (1d / 7d / 30d, default 30d).');
            strategyNotes.push('Do not answer profit ranking or per-wallet token trade summaries from the early-buyer rows alone when those rows lack wallet PnL evidence.');
        }
    }

    if (selected.length > 0) {
        const missingToolsBySkill = selected
            .map((skillId) => {
                const skill = skillRegistryExec.getSkill(skillId);
                if (!skill) return null;
                const missing = (skill.metadata.tools || []).filter((toolName) => !availableToolNames.has(String(toolName)));
                return missing.length > 0 ? { skillId, missing } : null;
            })
            .filter(Boolean) as Array<{ skillId: string; missing: string[] }>;
        if (missingToolsBySkill.length > 0) {
            logger.warn(LogCode.AI_SKILLS_ATTACHED, 'Node skill resolution dropped tools missing from runtime registry snapshot', {
                sessionId: snapshot.sessionId,
                taskId: snapshot.taskId,
                missingToolsBySkill,
            });
        }
    }

    const droppedPreferredTools = preferredTools.filter((toolName) => !availableToolNames.has(String(toolName)));
    if (droppedPreferredTools.length > 0) {
        strategyNotes.push(`Some preferred tools are not available in the current registry snapshot and were removed: ${droppedPreferredTools.join(', ')}.`);
    }

    allowedTools = allowedTools.filter((toolName) => availableToolNames.has(String(toolName)));
    preferredTools.splice(0, preferredTools.length, ...preferredTools.filter((toolName) => availableToolNames.has(String(toolName))));
    blockedTools.splice(0, blockedTools.length, ...blockedTools.filter((toolName) => availableToolNames.has(String(toolName)) || isSyntheticBlockedTool(toolName)));

    if (allowedTools.length === 0 && selected.length > 0) {
        strategyNotes.push('Matched skills did not have any registry-backed tools available in this runtime snapshot, so the model must rely on provider-native search or direct answering.');
    }

    if (matchResult.searchMode === 'required') {
        strategyNotes.push('External search evidence is required for this query. Retrieve it before concluding.');
    } else if (matchResult.searchMode === 'fallback') {
        strategyNotes.push('Matched local skills are primary for this query. Use search only if the user explicitly requests external evidence or the local tools are insufficient.');
    } else {
        strategyNotes.push('Do not use generic search unless the user explicitly asks for external web/X evidence.');
    }

    if (hasRequestedToken && asksEarlyBuyers && querySignals.realtime) {
        strategyNotes.push('This is a composite task. First establish the social/timing context, then gather local on-chain token evidence for the same window.');
    }
    if (!explicitRiskRequest) {
        strategyNotes.push('Do not run token-risk scanning unless the user explicitly asks for a safety or risk check.');
    }

    let effectiveSearchMode = matchResult.searchMode;
    let effectiveSearchReason = matchResult.searchReason;
    const intentEnvelope = buildIntentEnvelope({
        snapshot,
        tradingIntent,
        canonicalIntent: normalizedIntent,
        querySignals,
        searchMode: effectiveSearchMode,
        preferXNativeSearch,
        explicitlyMentionsFarcaster,
        explicitRiskRequest,
        asksWalletPnl,
        hasRequestedToken,
    });
    if (!normalizedIntent && isGrok && shouldPreferLocalTokenLeaderboard(snapshot, intentEnvelope)) {
        effectiveSearchMode = 'forbidden';
        effectiveSearchReason = 'local_token_leaderboard_preferred';
        intentEnvelope.search_mode = 'forbidden';
        intentEnvelope.search_target = 'none';
        intentEnvelope.required_evidence = intentEnvelope.required_evidence.filter((item) => item !== 'native_search_results');
        for (const toolName of LOCAL_TOKEN_LEADERBOARD_TOOLS) {
            if (availableToolNames.has(toolName) && !allowedTools.includes(toolName)) {
                allowedTools.push(toolName);
            }
        }
        allowedTools = allowedTools.filter((toolName) => LOCAL_TOKEN_LEADERBOARD_TOOLS.has(toolName));
        preferredTools.splice(0, preferredTools.length, ...preferredTools.filter((toolName) => LOCAL_TOKEN_LEADERBOARD_TOOLS.has(toolName)));
        pushPreferred(preferredTools, 'get_trending_tokens');
        pushPreferred(preferredTools, 'get_token_info');
        allowAllTools = false;
        strategyNotes.push('This read-only token trend query is satisfiable from KiKo local token leaderboard data. Start with get_trending_tokens and stay on local token evidence unless the user explicitly asks for social/search sources.');
    }
    if (isGrok) {
        allowedTools = allowedTools.filter((toolName) => !GROK_BLOCKED_FARCASTER_TOOLS.has(toolName));
        preferredTools.splice(0, preferredTools.length, ...preferredTools.filter((toolName) => !GROK_BLOCKED_FARCASTER_TOOLS.has(toolName)));
        strategyNotes.push('Grok path does not expose local Farcaster cache/search tools. Use provider-native search instead for social discovery.');
    }
    const toolPhasePolicy = buildToolPhasePolicy(snapshot, tradingIntent, intentEnvelope, Boolean(normalizedIntent));
    if (!isGrok && intentEnvelope.search_mode === 'required') {
        strategyNotes.push('This provider does not support provider-native X/web search in the current orchestration path. Use only relevant local tools if they truly match the request, otherwise state the limitation plainly.');
    }
    strategyNotes.push(describePhasePolicy(intentEnvelope, toolPhasePolicy));

    logger.info(LogCode.AI_SKILLS_ATTACHED, 'Node skill resolution completed', {
        sessionId: snapshot.sessionId,
        taskId: snapshot.taskId,
        selectedSkills: selected,
        rankedMatches: matchResult.rankedMatches.map((match) => ({
            skillId: match.skillId,
            score: match.score,
            reasons: match.reasons,
        })),
        rejectedSkills: matchResult.rejectedMatches.slice(0, 5).map((match) => ({
            skillId: match.skillId,
            score: match.score,
        })),
        searchMode: effectiveSearchMode,
        searchReason: effectiveSearchReason,
        allowedTools,
        blockedTools,
    });

    return {
        selectedSkills: selected,
        skillPrompts,
        allowedTools,
        blockedTools,
        preferredTools,
        strategyNotes,
        allowAllTools,
        rankedMatches: matchResult.rankedMatches,
        searchMode: effectiveSearchMode,
        searchReason: effectiveSearchReason,
        querySignals,
        intentEnvelope,
        toolPhasePolicy,
        currentPhase: toolPhasePolicy.initialPhase,
    };
}

function buildIntentEnvelope(params: {
    snapshot: ChatContextSnapshot;
    tradingIntent: TradingIntent | null;
    canonicalIntent: CanonicalIntent | null;
    querySignals: QuerySignals;
    searchMode: SearchMode;
    preferXNativeSearch: boolean;
    explicitlyMentionsFarcaster: boolean;
    explicitRiskRequest: boolean;
    asksWalletPnl: boolean;
    hasRequestedToken: boolean;
}): IntentEnvelope {
    const {
        snapshot,
        tradingIntent,
        canonicalIntent,
        querySignals,
        searchMode,
        preferXNativeSearch,
        explicitlyMentionsFarcaster,
        explicitRiskRequest,
        asksWalletPnl,
        hasRequestedToken,
    } = params;

    if (canonicalIntent) {
        const canonicalPrimary = (() => {
            switch (canonicalIntent.intent) {
                case 'assistant_meta':
                    return canonicalIntent.taskMode === 'analyze'
                        ? 'meta_debug' as const
                        : 'general_answer' as const;
                case 'copy_trade':
                    return 'copytrade_execution' as const;
                case 'swap':
                case 'cross_chain_swap':
                    return 'swap_execution' as const;
                case 'polymarket_order':
                    return 'polymarket_order' as const;
                case 'polymarket_discovery':
                case 'polymarket_short_window':
                    return 'polymarket_discovery' as const;
                case 'token_risk':
                    return 'token_risk' as const;
                case 'wallet_analysis':
                case 'wallet_pnl':
                    return 'wallet_analysis' as const;
                case 'token_analysis':
                case 'early_buyers':
                case 'creator_analysis':
                    return 'token_analysis' as const;
                case 'social_discovery':
                    return canonicalIntent.domain === 'x' || canonicalIntent.domain === 'farcaster'
                        ? 'social_discovery' as const
                        : 'search_discovery' as const;
                default:
                    return 'general_answer' as const;
            }
        })();

        const canonicalDomain: IntentDomain | IntentMetaDomain = canonicalIntent.domain === 'market'
            ? 'market'
            : canonicalIntent.domain === 'zora'
                ? 'zora'
                : canonicalIntent.domain === 'assistant_meta'
                    ? 'assistant_meta'
                    : canonicalIntent.domain;

        return {
            primary_intent: canonicalPrimary,
            task_mode: canonicalIntent.taskMode,
            search_mode: canonicalIntent.searchMode,
            search_target: canonicalIntent.searchTarget,
            domain: canonicalDomain,
            execution_risk: canonicalIntent.taskMode === 'execute' || canonicalIntent.taskMode === 'confirm' ? 'mutation' : 'read_only',
            required_evidence: Array.from(new Set(canonicalIntent.evidenceRequirements)),
        };
    }

    if (tradingIntent?.type === 'copy_trade') {
        return {
            primary_intent: 'copytrade_execution',
            task_mode: tradingIntent.kind === 'trade_confirmation' ? 'confirm' : 'execute',
            search_mode: searchMode,
            search_target: 'none',
            domain: 'wallet',
            execution_risk: 'mutation',
            required_evidence: [],
        };
    }
    if (tradingIntent?.type === 'swap' || tradingIntent?.type === 'cross_chain_trade') {
        return {
            primary_intent: 'swap_execution',
            task_mode: tradingIntent.kind === 'trade_confirmation' ? 'confirm' : 'execute',
            search_mode: searchMode,
            search_target: 'none',
            domain: hasRequestedToken ? 'token' : 'general',
            execution_risk: 'mutation',
            required_evidence: [],
        };
    }

    return {
        primary_intent: 'general_answer',
        task_mode: 'discover',
        search_mode: searchMode,
        search_target: 'none',
        domain: 'general',
        execution_risk: 'read_only',
        required_evidence: [],
    };
}

function buildToolPhasePolicy(
    snapshot: ChatContextSnapshot,
    tradingIntent: TradingIntent | null,
    intentEnvelope: IntentEnvelope,
    hasCanonicalIntent: boolean,
): ToolPhasePolicy {
    const supportsNativeSearch = String(snapshot.model || '').toLowerCase().includes('grok');
    const confirmationKind = String(snapshot.confirmationState?.kind || '');
    const executionReady = intentEnvelope.execution_risk === 'mutation'
        && intentEnvelope.required_evidence.length === 0
        && (
            tradingIntent?.kind === 'trade_confirmation'
            || confirmationKind === 'swap_confirmation'
            || confirmationKind === 'copy_trade_confirmation'
            || confirmationKind === 'order_confirmation'
        );

    if (executionReady) {
        return {
            initialPhase: 'execution',
            nextPhaseAfterNativeSearch: null,
            searchRetryLimit: 2,
        };
    }

    if (!hasCanonicalIntent && supportsNativeSearch && shouldPreferLocalTokenLeaderboard(snapshot, intentEnvelope)) {
        return {
            initialPhase: 'local_analysis',
            nextPhaseAfterNativeSearch: null,
            searchRetryLimit: 0,
        };
    }

    if (
        supportsNativeSearch
        && intentEnvelope.primary_intent === 'social_discovery'
        && (intentEnvelope.domain === 'x' || intentEnvelope.domain === 'farcaster')
    ) {
        return {
            initialPhase: 'native_search_only',
            nextPhaseAfterNativeSearch: requiresPostSearchLocalAnalysis(intentEnvelope) ? 'local_analysis' : null,
            searchRetryLimit: 2,
        };
    }

    if (
        supportsNativeSearch
        && (
        intentEnvelope.search_mode === 'required'
        || intentEnvelope.domain === 'x'
        || intentEnvelope.search_target === 'web'
        || intentEnvelope.search_target === 'x'
        || intentEnvelope.search_target === 'x_and_web'
        )
    ) {
        return {
            initialPhase: 'native_search_only',
            nextPhaseAfterNativeSearch: requiresPostSearchLocalAnalysis(intentEnvelope) ? 'local_analysis' : null,
            searchRetryLimit: 2,
        };
    }

    return {
        initialPhase: 'local_analysis',
        nextPhaseAfterNativeSearch: null,
        searchRetryLimit: 2,
    };
}

function requiresPostSearchLocalAnalysis(intentEnvelope: IntentEnvelope): boolean {
    if (intentEnvelope.domain === 'x') {
        return true;
    }
    return intentEnvelope.required_evidence.some((item) => item !== 'native_search_results')
        || ['token_analysis', 'token_risk', 'wallet_analysis', 'polymarket_discovery', 'polymarket_order'].includes(intentEnvelope.primary_intent);
}

function describePhasePolicy(intentEnvelope: IntentEnvelope, toolPhasePolicy: ToolPhasePolicy): string {
    if (toolPhasePolicy.initialPhase === 'native_search_only') {
        return `Structured intent: ${intentEnvelope.primary_intent} in domain=${intentEnvelope.domain}. Start with provider-native search only, then move to ${toolPhasePolicy.nextPhaseAfterNativeSearch || 'final answer'} once evidence is gathered.`;
    }
    if (toolPhasePolicy.initialPhase === 'execution') {
        return `Structured intent: ${intentEnvelope.primary_intent}. Execution phase is allowed only for the approved mutation tools in this turn.`;
    }
    return `Structured intent: ${intentEnvelope.primary_intent} in domain=${intentEnvelope.domain}. Start with local analysis tools; search stays gated by the phase policy.`;
}

function shouldPreferLocalTokenLeaderboard(snapshot: ChatContextSnapshot, intentEnvelope: IntentEnvelope): boolean {
    if (intentEnvelope.execution_risk !== 'read_only') return false;
    if (intentEnvelope.primary_intent !== 'search_discovery') return false;
    if (intentEnvelope.domain !== 'token') return false;
    const hasLocalLeaderboardTool = (snapshot.toolDefinitions || []).some((definition) => definition.name === 'get_trending_tokens');
    if (!hasLocalLeaderboardTool) return false;
    const query = String(snapshot.lastUserMessage || '').trim();
    if (!query) return false;
    if (!TOKEN_LEADERBOARD_QUERY_RE.test(query)) return false;
    if (EXPLICIT_SOCIAL_SOURCE_QUERY_RE.test(query)) return false;
    if (EXPLICIT_SEARCH_QUERY_RE.test(query)) return false;
    if (intentEnvelope.search_target === 'x' || intentEnvelope.search_target === 'x_and_web' || intentEnvelope.search_target === 'web') {
        return false;
    }
    return true;
}

function ensurePrimarySkill(selected: string[], skillId: string) {
    if (selected[0] === skillId) return;
    const filtered = selected.filter((item) => item !== skillId);
    filtered.unshift(skillId);
    selected.splice(0, selected.length, ...filtered);
}

function ensureSupportingSkill(selected: string[], skillId: string) {
    if (!selected.includes(skillId)) {
        selected.push(skillId);
    }
}

function pushPreferred(target: string[], toolName: string) {
    if (!target.includes(toolName)) {
        target.push(toolName);
    }
}

function removeTool(target: string[], toolName: string) {
    let index = target.indexOf(toolName);
    while (index !== -1) {
        target.splice(index, 1);
        index = target.indexOf(toolName);
    }
}

function isSyntheticBlockedTool(toolName: string): boolean {
    return ['external_web_search'].includes(String(toolName || '').trim());
}

function pushPreferredToolsForSkill(skillId: string, preferredTools: string[]) {
    const skill = skillRegistryExec.getSkill(skillId);
    if (!skill) return;
    for (const toolName of skill.metadata.tools || []) {
        pushPreferred(preferredTools, toolName);
    }
}
