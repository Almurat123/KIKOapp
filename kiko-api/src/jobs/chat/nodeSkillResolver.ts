import { skillRegistryExec } from '../../skills/registry.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { TradingIntent } from './tradingIntentResolver.js';

export interface SkillResolution {
    selectedSkills: string[];
    skillPrompts: string[];
    allowedTools: string[];
}

export function resolveNodeSkills(snapshot: ChatContextSnapshot, tradingIntent: TradingIntent | null): SkillResolution {
    const query = String(snapshot.lastUserMessage || '').toLowerCase();
    const contextBlocks = snapshot.runtime.contextBlocks || {};
    const prefetched = snapshot.runtime.prefetchedToolResults || {};
    const selected: string[] = [];

    if (tradingIntent) {
        if (tradingIntent.type === 'copy_trade') {
            selected.push('copy_trade', 'wallet_portfolio');
        } else if (tradingIntent.type === 'cross_chain_trade') {
            selected.push('cross_chain_swap', 'wallet_portfolio');
        } else {
            selected.push('swap', 'wallet_portfolio');
            const settings = snapshot.runtime.userSettings || {};
            if ((settings as any).checkTokenBeforeSwap) {
                selected.push('risk_security');
            }
        }
    } else {
        if (['wallet', 'balance', 'portfolio', 'pnl', '余额'].some((word) => query.includes(word))) {
            selected.push('wallet_portfolio');
        }
        if (['risk', 'safe', 'honeypot', 'rug', '风险', '安全吗'].some((word) => query.includes(word))) {
            selected.push('risk_security');
        }
        if (['polymarket', 'prediction', 'odds'].some((word) => query.includes(word))) {
            selected.push('polymarket_prediction');
        }
        if (['farcaster', 'twitter', 'x.com', 'sentiment', 'social'].some((word) => query.includes(word))) {
            selected.push('social_farcaster');
        }
        if ((snapshot.requestedTokenAddresses || []).length > 0) {
            selected.push('token_analysis');
        }
        if (selected.length === 0) {
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

    const explicitRiskRequest = ['risk', 'safe', 'honeypot', 'rug', '风险', '安全吗'].some((word) => query.includes(word));
    if (contextBlocks.launchpadContext && !explicitRiskRequest) {
        allowedTools = allowedTools.filter((tool) => tool !== 'check_token_risk');
    }

    if (String(snapshot.model || '').toLowerCase().includes('grok') && !allowedTools.includes('external_web_search')) {
        allowedTools.push('external_web_search');
    }

    return {
        selectedSkills: deduped,
        skillPrompts,
        allowedTools,
    };
}
