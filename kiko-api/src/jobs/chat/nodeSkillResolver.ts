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
    let allowAllTools = Boolean(tradingIntent);

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
    const asksCreator = containsAny(snapshot.lastUserMessage, [
        'creator', 'deployer', 'deployed by', '创建者', '部署者', '谁部署',
    ]);

    let selected = matchResult.rankedMatches.map((item) => item.skillId);
    if (querySignals.welcome) {
        allowAllTools = false;
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
        strategyNotes.push('Any X/Twitter query in this system must gather search evidence and chain-side evidence together before concluding.');
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

    if (preferXNativeSearch) {
        selected = selected.filter((skillId) => skillId !== 'social_farcaster');
        if (selected.length === 0 && !querySignals.welcome) {
            selected = ['market_macro'];
        }
    }

    if (preferXNativeSearch && !isGrok && !querySignals.prediction) {
        selected = selected.filter((skillId) => {
            if (skillId === 'social_farcaster' || skillId === 'polymarket_prediction') return false;
            if (skillId === 'market_macro') return requiresSocialChainEvidence;
            return true;
        });
        strategyNotes.push('This is an X/Twitter query on a provider path without native X search. Do not pivot to Farcaster or Polymarket unless the user explicitly asks for those domains.');
        if (requiresSocialChainEvidence) {
            strategyNotes.push('Use local external_web_search together with chain-analysis tools on this provider path, because provider-native X search is unavailable.');
        }
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

    if (contextBlocks.tokenContext || prefetched.get_token_info) {
        allowedTools = allowedTools.filter((tool) => tool !== 'get_token_info');
    }
    if (contextBlocks.walletState || prefetched.get_wallet_info) {
        allowedTools = allowedTools.filter((tool) => tool !== 'get_wallet_info');
    }
    if (!explicitRiskRequest) {
        allowedTools = allowedTools.filter((tool) => tool !== 'check_token_risk');
    }
    if (!asksWalletPnl) {
        allowedTools = allowedTools.filter((tool) => tool !== 'analyze_wallet_pnl_batch' && tool !== 'analyze_wallet_pnl');
    }

    if (isGrok) {
        pushPreferred(blockedTools, 'external_web_search');
        allowedTools = allowedTools.filter((tool) => tool !== 'external_web_search');
    }
    if (preferXNativeSearch) {
        for (const toolName of ['get_trending_casts', 'search_farcaster_casts', 'get_farcaster_user']) {
            pushPreferred(blockedTools, toolName);
        }
        allowedTools = allowedTools.filter((tool) => !['get_trending_casts', 'search_farcaster_casts', 'get_farcaster_user'].includes(tool));
        strategyNotes.push('This query is explicitly about X/Twitter. Do not substitute Farcaster trending tools unless the user explicitly asks for Farcaster.');
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
        required_evidence: requiredEvidence,
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

function isSyntheticBlockedTool(toolName: string): boolean {
    return ['external_web_search'].includes(String(toolName || '').trim());
}

function containsAny(text: string, needles: string[]): boolean {
    const haystack = String(text || '').toLowerCase();
    return needles.some((needle) => haystack.includes(String(needle).toLowerCase()));
}

function pushPreferredToolsForSkill(skillId: string, preferredTools: string[]) {
    const skill = skillRegistryExec.getSkill(skillId);
    if (!skill) return;
    for (const toolName of skill.metadata.tools || []) {
        pushPreferred(preferredTools, toolName);
    }
}
