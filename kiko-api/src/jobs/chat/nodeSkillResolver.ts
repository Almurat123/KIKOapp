import { skillRegistryExec } from '../../skills/registry.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { TradingIntent } from './tradingIntentResolver.js';

export interface SkillResolution {
    selectedSkills: string[];
    skillPrompts: string[];
    allowedTools: string[];
    blockedTools: string[];
    preferredTools: string[];
    strategyNotes: string[];
    allowAllTools: boolean;
}

export function resolveNodeSkills(snapshot: ChatContextSnapshot, tradingIntent: TradingIntent | null): SkillResolution {
    const isGrok = String(snapshot.model || '').toLowerCase().includes('grok');
    const query = String(snapshot.lastUserMessage || '').toLowerCase();
    const rawQuery = String(snapshot.lastUserMessage || '');
    const contextBlocks = snapshot.runtime.contextBlocks || {};
    const prefetched = snapshot.runtime.prefetchedToolResults || {};
    const selected: string[] = [];
    const blockedTools: string[] = [];
    const preferredTools: string[] = [];
    const strategyNotes: string[] = [];
    let allowAllTools = true;
    const hasRequestedToken = (snapshot.requestedTokenAddresses || []).length > 0;
    const isMetaAssistantQuery = isAssistantMetaQuery(query, rawQuery);
    const asksEarlyBuyers = containsAny(query, [
        'early buyers', 'earliest buyers', 'first buyers', 'first buyer', 'early buyer',
        'holders', 'holder', 'first trades', 'first swaps', 'snipers', 'wallets',
        'early purchasers',
    ]) || containsAny(snapshot.lastUserMessage, ['早期买家', '首批买家', '早期购买者', '持有人', '前几位买家', '早期购买']);
    const asksCreator = containsAny(query, ['creator', 'deployer', 'deployed by']) || containsAny(snapshot.lastUserMessage, ['创建者', '部署者', '谁部署']);
    const asksRealtimeSocial = containsAny(query, [
        'latest', 'today', 'current', 'timing', 'post', 'tweet', 'twitter', 'x.com', 'social', 'cz',
    ]) || containsAny(snapshot.lastUserMessage, ['最新', '今天', '现在', '发文', '推文', '社交', 'CZ']);
    const explicitRiskRequest = isExplicitRiskRequest(query, snapshot.lastUserMessage);

    if (tradingIntent) {
        if (tradingIntent.type === 'copy_trade') {
            selected.push('copy_trade', 'wallet_portfolio');
        } else if (tradingIntent.type === 'cross_chain_trade') {
            selected.push('cross_chain_swap', 'wallet_portfolio');
        } else {
            selected.push('swap', 'wallet_portfolio');
            if (explicitRiskRequest) {
                selected.push('risk_security');
            }
        }
    } else {
        if (isMetaAssistantQuery) {
            allowAllTools = false;
            strategyNotes.push('This is a greeting, self-introduction, or capabilities question. Answer directly without tools unless the user explicitly asks for live data or on-chain evidence.');
        } else if (['wallet', 'balance', 'portfolio', 'pnl', '余额'].some((word) => query.includes(word))) {
            selected.push('wallet_portfolio');
        }
        if (!isMetaAssistantQuery && explicitRiskRequest) {
            selected.push('risk_security');
        }
        if (!isMetaAssistantQuery && ['polymarket', 'prediction', 'odds'].some((word) => query.includes(word))) {
            selected.push('polymarket_prediction');
        }
        if (!isMetaAssistantQuery && ['farcaster', 'twitter', 'x.com', 'sentiment', 'social'].some((word) => query.includes(word))) {
            selected.push('social_farcaster');
        }
        if (!isMetaAssistantQuery && hasRequestedToken) {
            selected.push('token_analysis');
        }
        if (!isMetaAssistantQuery && selected.length === 0) {
            selected.push('market_macro');
        }
    }

    const deduped = selected.filter((skillId, index) => selected.indexOf(skillId) === index && !!skillRegistryExec.getSkill(skillId));
    const skillPrompts: string[] = [];
    let allowedTools: string[] = [];

    for (const skillId of deduped) {
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

    if (isGrok) {
        pushPreferred(blockedTools, 'external_web_search');
        allowedTools = allowedTools.filter((tool) => tool !== 'external_web_search');
        if (asksRealtimeSocial) {
            const blockedLocalSocialTools = new Set([
                'get_trending_casts',
                'get_farcaster_user',
                'search_farcaster_casts',
            ]);
            for (const tool of blockedLocalSocialTools) {
                pushPreferred(blockedTools, tool);
            }
            allowedTools = allowedTools.filter((tool) => !blockedLocalSocialTools.has(tool));
        }
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
    if (asksRealtimeSocial) {
        if (isGrok) {
            strategyNotes.push('Use Grok native search tools for X/web/social discovery. Do not use local Farcaster/web search tools for this request.');
        } else {
            pushPreferred(preferredTools, 'external_web_search');
        }
    }
    if (hasRequestedToken && asksEarlyBuyers && asksRealtimeSocial) {
        strategyNotes.push('This is a composite task. Split it into sub-steps: first establish the social/timing context, then gather on-chain token evidence for the same window.');
        strategyNotes.push('When using Grok, combine native search for timing/post context with local chain tools for early buyers, holders, first trades, or wallet evidence.');
    }
    if (!explicitRiskRequest) {
        strategyNotes.push('Do not run token-risk scanning unless the user explicitly asks for a safety or risk check.');
    }

    return {
        selectedSkills: deduped,
        skillPrompts,
        allowedTools,
        blockedTools,
        preferredTools,
        strategyNotes,
        allowAllTools,
    };
}

function isExplicitRiskRequest(query: string, rawQuery: string): boolean {
    const enPhrases = [
        'check token risk',
        'check risk',
        'risk check',
        'security check',
        'is this safe',
        'safe or not',
        'is this token safe',
        'honeypot',
        'rug',
        'rug pull',
        'scam',
        'is this a scam',
    ];
    const zhPhrases = [
        '检查风险',
        '风险检查',
        '安全检查',
        '这个安全吗',
        '这个代币安全吗',
        '是不是土狗',
        '是不是骗局',
        '是不是貔貅',
        '貔貅',
        '蜜罐',
        '土狗',
        '拉地毯',
        'rug',
        'honeypot',
    ];

    return containsAny(query, enPhrases) || containsAny(rawQuery, zhPhrases);
}

function containsAny(text: string, needles: string[]): boolean {
    return needles.some((needle) => text.includes(needle));
}

function pushPreferred(target: string[], toolName: string) {
    if (!target.includes(toolName)) {
        target.push(toolName);
    }
}

function isAssistantMetaQuery(query: string, rawQuery: string): boolean {
    const normalized = query.trim();
    const raw = rawQuery.trim();
    const directGreetings = ['hi', 'hello', 'hey', 'yo', 'sup'];
    if (directGreetings.includes(normalized)) return true;
    if (['你好', '嗨', '哈喽', '您好'].includes(raw)) return true;

    return containsAny(normalized, [
        'who are you',
        'what can you do',
        'what do you do',
        'introduce yourself',
        'how can you help',
        'help me understand your capabilities',
        'tell me about yourself',
    ]) || containsAny(raw, [
        '你是谁',
        '你能做什么',
        '你会什么',
        '介绍一下你自己',
        '你可以帮我做什么',
        '你都能做什么',
    ]);
}
