import { LogCode } from '../../config/logRegistry.js';
import { skillRegistryExec } from '../../skills/registry.js';
import { logger } from '../../utils/logger.js';
import type { ChatContextSnapshot } from './contracts.js';
import {
    detectQuerySignals,
    matchSkillsForQuery,
    type QuerySignals,
    type SearchMode,
    type SkillMatch,
} from './skillIntentMatcher.js';
import type { TradingIntent } from './tradingIntentResolver.js';

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
}

export function resolveNodeSkills(snapshot: ChatContextSnapshot, tradingIntent: TradingIntent | null): SkillResolution {
    const isGrok = String(snapshot.model || '').toLowerCase().includes('grok');
    const rawQuery = String(snapshot.lastUserMessage || '');
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

    if (selected.length === 0 && !querySignals.welcome) {
        selected = ['market_macro'];
    }

    if (preferXNativeSearch) {
        selected = selected.filter((skillId) => skillId !== 'social_farcaster');
        if (selected.length === 0 && !querySignals.welcome) {
            selected = ['market_macro'];
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
            if (!allowedTools.includes(toolName)) {
                allowedTools.push(String(toolName));
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

    for (const skillId of selected) {
        pushPreferredToolsForSkill(skillId, preferredTools);
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
    };
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
