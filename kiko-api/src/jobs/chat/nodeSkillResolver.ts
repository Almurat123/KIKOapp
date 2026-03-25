import { LogCode } from '../../config/logRegistry.js';
import { skillRegistryExec } from '../../skills/registry.js';
import { logger } from '../../utils/logger.js';
import { resolveRequestedChainHint } from './chainIntent.js';
import type { ChatContextSnapshot } from './contracts.js';
import {
    detectQuerySignals,
    matchSkillsForQuery,
    type QuerySignals,
    type SearchMode,
    type SkillMatch,
} from './skillIntentMatcher.js';
import type { TradingIntent } from './tradingIntentResolver.js';

export type IntentPrimaryIntent =
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
export type IntentDomain = 'x' | 'farcaster' | 'token' | 'wallet' | 'polymarket' | 'general';
export type IntentExecutionRisk = 'read_only' | 'mutation';
export type ToolPhase = 'native_search_only' | 'local_analysis' | 'execution';

export interface IntentEnvelope {
    primary_intent: IntentPrimaryIntent;
    task_mode: IntentTaskMode;
    search_mode: SearchMode;
    search_target: IntentSearchTarget;
    domain: IntentDomain;
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

export function resolveNodeSkills(snapshot: ChatContextSnapshot, tradingIntent: TradingIntent | null): SkillResolution {
    const isGrok = String(snapshot.model || '').toLowerCase().includes('grok');
    const rawQuery = String(snapshot.lastUserMessage || '');
    const availableToolNames = new Set((snapshot.toolDefinitions || []).map((definition) => String(definition.name || '').trim()).filter(Boolean));
    const contextBlocks = snapshot.runtime.contextBlocks || {};
    const prefetched = snapshot.runtime.prefetchedToolResults || {};
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
    const hasRequestedTokenAddress = Array.isArray(snapshot.requestedTokenAddresses) && snapshot.requestedTokenAddresses.length > 0;

    const matchResult = matchSkillsForQuery({ snapshot, tradingIntent });
    const querySignals = matchResult.querySignals;
    const explicitRiskRequest = querySignals.risk;
    const asksWalletPnl = querySignals.pnl;
    const hasRequestedToken = querySignals.hasRequestedToken;
    const requiresSocialChainEvidence = querySignals.socialChainEvidence;
    const requestedChain = resolveRequestedChainHint({
        text: rawQuery,
        requestedTokenAddresses: snapshot.requestedTokenAddresses,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
    });
    const explicitlyMentionsFarcaster = containsAny(rawQuery, ['farcaster', 'warpcast', 'cast', 'casts', 'fc']);
    const preferXNativeSearch = querySignals.xSearch && !explicitlyMentionsFarcaster;
    const asksEarlyBuyers = containsAny(snapshot.lastUserMessage, [
        'early buyers', 'earliest buyers', 'first buyers', 'first buyer', 'early buyer',
        'holders', 'holder', 'first trades', 'first swaps', 'snipers', 'wallets',
        'early purchasers', '早期买家', '首批买家', '早期购买者', '持有人', '前几位买家', '早期购买',
    ]);
    const wantsEarlyBuyerFullList = containsAny(snapshot.lastUserMessage, [
        'full list', 'complete list', 'full table', 'all early buyers', 'all wallets', 'export',
        'excel', 'csv', 'table', 'full export', '完整名单', '全量', '导出', '表格', '全部钱包',
    ]);
    const asksCreator = containsAny(snapshot.lastUserMessage, [
        'creator', 'deployer', 'deployed by', '创建者', '部署者', '谁部署',
    ]);

    let selected = matchResult.rankedMatches.map((item) => item.skillId);
    if (querySignals.welcome) {
        strategyNotes.push('This is a greeting, self-introduction, or capabilities question. Answer directly without tools unless the user explicitly asks for live data or on-chain evidence.');
        selected = selected.filter((skillId) => skillId === 'welcome_onboarding');
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

    if (selected.length === 0 && !querySignals.welcome) {
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

    const polymarketShortWindowQuery = querySignals.prediction && containsAny(lowercase(rawQuery), [
        '5min', '5 min', '5-minute', '5 minute', 'up or down', 'token bet', 'coin bet', 'coin up/down', 'token up/down',
        '5分钟', '五分钟', '涨跌',
    ]);
    if (polymarketShortWindowQuery) {
        pushPreferred(preferredTools, 'get_polymarket_coin_updown_markets');
        strategyNotes.push('For coin/token Up/Down short-window requests, prefer get_polymarket_coin_updown_markets over get_new_markets because exact ET-window discovery is required.');
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
            strategyNotes.push('The user explicitly asked for a full early-buyer export. Use get_early_buyers, preserve full wallet addresses, and include trade progression when available. Do not compress the result into a whale-only summary.');
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

    if (sessionToolNames.length > 0) {
        for (const toolName of sessionToolNames) {
            if (!allowedTools.includes(toolName)) {
                allowedTools.push(toolName);
            }
        }
        for (const toolName of sessionToolNames) {
            pushPreferred(preferredTools, toolName);
        }
        strategyNotes.push(`Session tool context is available. Tools already used in this session may be reused directly when they fit the current request: ${sessionToolNames.join(', ')}.`);

        // P2: Polymarket discovery guard — prevent the model from re-running discovery when
        // results are already in the session history. This is the primary fix for the
        // "AI keeps repeating get_new_markets / get_polymarket_trending_markets on every turn" bug.
        const POLYMARKET_DISCOVERY_TOOLS = new Set([
            'get_polymarket_market_overview',
            'get_polymarket_coin_updown_markets',
            'get_polymarket_trending_markets',
            'get_polymarket_trending',
            'get_new_markets',
            'get_polymarket_event',
        ]);
        const sessionPolyDiscovery = sessionToolNames.filter((toolName) => POLYMARKET_DISCOVERY_TOOLS.has(toolName));
        if (sessionPolyDiscovery.length > 0) {
            strategyNotes.push(
                `⚠️ POLYMARKET DISCOVERY ALREADY DONE: The following discovery tools have already been called this session and returned data: ${sessionPolyDiscovery.join(', ')}. ` +
                `Do NOT call them again. Reuse their results. ` +
                `Short user replies ("yes", "ok", "this one", "go ahead", "好", "确认", "这个") are confirmations — ` +
                `respond by calling prepare_polymarket_bet or place_polymarket_order, NOT by running discovery again.`,
            );
        }

        // P1: get_current_time budget — one call per task is enough.
        if (sessionToolNames.includes('get_current_time')) {
            strategyNotes.push(
                '⏱️ TIME ALREADY CHECKED: get_current_time was already called this session. Do NOT call it again. ' +
                'Use the time result from the earlier round; wall-clock drift within a single task is negligible.',
            );
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

    const intentEnvelope = buildIntentEnvelope({
        snapshot,
        tradingIntent,
        querySignals,
        searchMode: matchResult.searchMode,
        preferXNativeSearch,
        explicitlyMentionsFarcaster,
        explicitRiskRequest,
        asksWalletPnl,
        hasRequestedToken,
    });
    const toolPhasePolicy = buildToolPhasePolicy(snapshot, tradingIntent, intentEnvelope);
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
        searchMode: matchResult.searchMode,
        searchReason: matchResult.searchReason,
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
        searchMode: matchResult.searchMode,
        searchReason: matchResult.searchReason,
        querySignals,
        intentEnvelope,
        toolPhasePolicy,
        currentPhase: toolPhasePolicy.initialPhase,
    };
}

function buildIntentEnvelope(params: {
    snapshot: ChatContextSnapshot;
    tradingIntent: TradingIntent | null;
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
        querySignals,
        searchMode,
        preferXNativeSearch,
        explicitlyMentionsFarcaster,
        explicitRiskRequest,
        asksWalletPnl,
        hasRequestedToken,
    } = params;

    const rawQuery = String(snapshot.lastUserMessage || '');
    const lower = rawQuery.toLowerCase();
    const asksEarlyBuyerEvidence = containsAny(lower, [
        'early buyers', 'earliest buyers', 'first buyers', 'first buyer', 'early buyer',
        'holders', 'holder', 'first trades', 'first swaps', 'snipers', 'creator', 'deployer',
    ]) || containsAny(rawQuery, [
        '早期买家', '首批买家', '早期购买者', '持有人', '前几位买家', '早期购买', '创建者', '部署者',
    ]);
    const mentionsExecution = containsAny(lower, [
        'place order', 'buy yes', 'buy no', 'sell yes', 'sell no', 'place a', '下注', '下单', '买 yes', '买 no', '卖 yes', '卖 no',
    ]);

    const domain: IntentDomain = explicitlyMentionsFarcaster
        ? 'farcaster'
        : preferXNativeSearch
            ? 'x'
            : querySignals.prediction
                ? 'polymarket'
                : querySignals.wallet || asksWalletPnl
                    ? 'wallet'
                    : hasRequestedToken || querySignals.tokenAnalysis || explicitRiskRequest
                        ? 'token'
                        : 'general';

    let primaryIntent: IntentPrimaryIntent = 'general_answer';
    let taskMode: IntentTaskMode = 'discover';
    if (tradingIntent?.type === 'copy_trade') {
        primaryIntent = 'copytrade_execution';
        taskMode = tradingIntent.kind === 'trade_confirmation' ? 'confirm' : 'execute';
    } else if (tradingIntent?.type === 'swap' || tradingIntent?.type === 'cross_chain_trade') {
        primaryIntent = 'swap_execution';
        taskMode = tradingIntent.kind === 'trade_confirmation' ? 'confirm' : 'execute';
    } else if (domain === 'polymarket' && mentionsExecution) {
        primaryIntent = 'polymarket_order';
        taskMode = 'execute';
    } else if (domain === 'polymarket') {
        primaryIntent = 'polymarket_discovery';
        taskMode = 'discover';
    } else if (explicitRiskRequest) {
        primaryIntent = 'token_risk';
        taskMode = 'analyze';
    } else if (domain === 'wallet') {
        primaryIntent = 'wallet_analysis';
        taskMode = 'analyze';
    } else if (hasRequestedToken || querySignals.tokenAnalysis) {
        primaryIntent = 'token_analysis';
        taskMode = 'analyze';
    } else if (domain === 'x' || domain === 'farcaster') {
        primaryIntent = querySignals.social ? 'social_discovery' : 'search_discovery';
        taskMode = 'discover';
    }

    let effectiveSearchMode: SearchMode = searchMode;
    if (preferXNativeSearch) {
        effectiveSearchMode = 'required';
    }

    const searchTarget: IntentSearchTarget = preferXNativeSearch
        ? (querySignals.webSearch ? 'x_and_web' : 'x')
        : querySignals.webSearch || effectiveSearchMode === 'required'
            ? 'web'
            : 'none';

    const requiredEvidence: string[] = [];
    if (effectiveSearchMode === 'required') {
        requiredEvidence.push('native_search_results');
    }
    if ((hasRequestedToken || querySignals.tokenAnalysis) && (querySignals.realtime || querySignals.socialChainEvidence)) {
        requiredEvidence.push('onchain_token_evidence');
    }
    if ((hasRequestedToken || querySignals.tokenAnalysis) && asksEarlyBuyerEvidence) {
        requiredEvidence.push('onchain_token_evidence');
    }
    if (querySignals.socialChainEvidence && (querySignals.wallet || asksWalletPnl)) {
        requiredEvidence.push('onchain_wallet_evidence');
    }
    if (querySignals.socialChainEvidence && !hasRequestedToken && !(querySignals.wallet || asksWalletPnl)) {
        requiredEvidence.push('connected_chain_evidence');
    }
    if (primaryIntent === 'polymarket_order') {
        requiredEvidence.push('verified_polymarket_token_id');
    }

    return {
        primary_intent: primaryIntent,
        task_mode: taskMode,
        search_mode: effectiveSearchMode,
        search_target: searchTarget,
        domain,
        execution_risk: taskMode === 'execute' || taskMode === 'confirm' ? 'mutation' : 'read_only',
        required_evidence: Array.from(new Set(requiredEvidence)),
    };
}

function buildToolPhasePolicy(
    snapshot: ChatContextSnapshot,
    tradingIntent: TradingIntent | null,
    intentEnvelope: IntentEnvelope,
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

    if (
        supportsNativeSearch
        && (
        intentEnvelope.search_mode === 'required'
        || intentEnvelope.domain === 'x'
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

function containsAny(text: string, needles: string[]): boolean {
    const haystack = String(text || '').toLowerCase();
    return needles.some((needle) => haystack.includes(String(needle).toLowerCase()));
}

function lowercase(text: string): string {
    return String(text || '').toLowerCase();
}

function pushPreferredToolsForSkill(skillId: string, preferredTools: string[]) {
    const skill = skillRegistryExec.getSkill(skillId);
    if (!skill) return;
    for (const toolName of skill.metadata.tools || []) {
        pushPreferred(preferredTools, toolName);
    }
}
