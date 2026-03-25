import { randomUUID } from 'node:crypto';
import type { ChatContextSnapshot, PlanCard, PlanStep } from './contracts.js';
import type { SkillResolution } from './nodeSkillResolver.js';
import type { CanonicalIntent } from './canonicalIntent.js';

export interface TaskPlanningContext {
    plan: PlanCard;
    asksRealtimeSocial: boolean;
    asksOnChainEvidence: boolean;
    asksCreatorEvidence: boolean;
    requestedToken: boolean;
    locale: 'en' | 'zh';
}

const SOCIAL_KEYWORDS = ['latest', 'today', 'current', 'timing', 'post', 'tweet', 'twitter', 'x.com', 'social', 'cz', 'trending', 'trend'];
const SOCIAL_CN_KEYWORDS = ['最新', '今天', '现在', '时点', '发文', '推文', '社交', 'CZ'];
const CHAIN_EVIDENCE_KEYWORDS = [
    'early buyers', 'earliest buyers', 'first buyers', 'first buyer', 'early buyer',
    'holders', 'holder', 'first trades', 'first swaps', 'snipers', 'wallets', 'creator',
    'deployer', 'deployed by', 'first tx', 'first transactions',
];
const CHAIN_EVIDENCE_CN_KEYWORDS = ['早期买家', '首批买家', '早期购买者', '持有人', '前几位买家', '早期购买', '创建者', '部署者', '首批交易'];

export function buildTaskPlanningContext(
    snapshot: ChatContextSnapshot,
    skillResolution: SkillResolution,
): TaskPlanningContext {
    const query = String(snapshot.lastUserMessage || '');
    const lower = query.toLowerCase();
    const canonicalIntent = snapshot.normalizedIntent || null;
    const asksRealtimeSocial = canonicalIntent
        ? canonicalIntent.searchTarget === 'x'
            || canonicalIntent.searchTarget === 'x_and_web'
            || canonicalIntent.requiresRealtime
        : containsAny(lower, SOCIAL_KEYWORDS)
            || containsAny(query, SOCIAL_CN_KEYWORDS)
            || /\bon\s+x\b/i.test(lower)
            || /\bweb\s+search\b/i.test(lower)
            || /\bsearch\s+(the\s+)?web\b/i.test(lower)
            || /\bsearch\s+x\b/i.test(lower)
            || /\bx\s+search\b/i.test(lower);
    const asksOnChainEvidence = canonicalIntent
        ? canonicalIntent.evidenceRequirements.includes('onchain_token_evidence')
            || canonicalIntent.evidenceRequirements.includes('onchain_wallet_evidence')
            || canonicalIntent.evidenceRequirements.includes('connected_chain_evidence')
            || canonicalIntent.requiresOnchainEvidence
        : containsAny(lower, CHAIN_EVIDENCE_KEYWORDS) || containsAny(query, CHAIN_EVIDENCE_CN_KEYWORDS);
    const asksCreatorEvidence = canonicalIntent
        ? canonicalIntent.intent === 'creator_analysis'
        : containsAny(lower, ['creator', 'deployer', 'deployed by']) || containsAny(query, ['创建者', '部署者', '谁部署']);
    const requestedToken = (snapshot.requestedTokenAddresses || []).length > 0 || (snapshot.requestedTokenSymbols || []).length > 0;
    const locale = detectLocale(query, canonicalIntent);

    const initialStep = makeStep(
        'step-understand',
        locale === 'zh' ? '先理解任务' : 'Understand the request',
        locale === 'zh'
            ? '先明确目标，再决定下一步要查看哪些信息。'
            : 'Clarify the goal first, then decide what evidence to gather next.',
        preferredPlanTools(skillResolution, []),
    );
    const needsChainPlanStep = asksOnChainEvidence
        || skillResolution.intentEnvelope.required_evidence.some((item) =>
            ['onchain_token_evidence', 'onchain_wallet_evidence', 'connected_chain_evidence'].includes(item),
        );
    const steps: PlanStep[] = [initialStep];
    if (asksRealtimeSocial) {
        steps.push(buildSocialPlanStep(skillResolution, query));
    }
    if (needsChainPlanStep) {
        steps.push(buildChainEvidencePlanStep(skillResolution, query));
    }
    if (asksCreatorEvidence) {
        steps.push(buildCreatorPlanStep(skillResolution, query));
    }
    steps.push(buildSummaryPlanStep(query));

    return {
        plan: {
            planId: randomUUID(),
            title: resolvePlanTitle(locale, asksRealtimeSocial, needsChainPlanStep),
            summary: resolvePlanSummary(locale, asksRealtimeSocial, needsChainPlanStep),
            locale,
            status: 'in_progress',
            currentStepId: initialStep.id,
            steps,
            activity: [],
        },
        asksRealtimeSocial,
        asksOnChainEvidence,
        asksCreatorEvidence,
        requestedToken,
        locale,
    };
}

function resolvePlanTitle(locale: 'en' | 'zh', asksRealtimeSocial: boolean, asksChainEvidence: boolean): string {
    if (locale === 'zh') {
        if (asksRealtimeSocial && asksChainEvidence) return '核实发布时间与链上买家';
        if (asksRealtimeSocial) return '核实社交时间线';
        if (asksChainEvidence) return '整理链上证据';
        return '正在处理你的请求';
    }
    if (asksRealtimeSocial && asksChainEvidence) return 'Verify timing and on-chain buyers';
    if (asksRealtimeSocial) return 'Verify social timing';
    if (asksChainEvidence) return 'Gather on-chain evidence';
    return 'Working on your request';
}

function resolvePlanSummary(locale: 'en' | 'zh', asksRealtimeSocial: boolean, asksChainEvidence: boolean): string {
    if (locale === 'zh') {
        if (asksRealtimeSocial && asksChainEvidence) {
            return '我会先确认帖子时间，再用链上工具核对买家和交易证据。';
        }
        if (asksRealtimeSocial) return '我会先确认相关帖子、时间点和公开来源。';
        if (asksChainEvidence) return '我会先获取链上证据，再整理结论。';
        return '我会逐步查看信息并在拿到结果后继续。';
    }
    if (asksRealtimeSocial && asksChainEvidence) {
        return 'I will verify the public post timing first, then gather chain-side buyer and transaction evidence.';
    }
    if (asksRealtimeSocial) return 'I will verify the relevant public post and timing first.';
    if (asksChainEvidence) return 'I will gather on-chain evidence before writing the answer.';
    return 'I will inspect the task step by step and continue as results come in.';
}

export function buildSocialPlanStep(skillResolution: SkillResolution, query: string): PlanStep {
    const locale = detectLocale(query, null);
    return makeStep(
        'step-social',
        locale === 'zh' ? '确认时间线' : 'Check timing and social context',
        locale === 'zh'
            ? '先确认相关帖子、时间点和社交上下文。'
            : 'Confirm the relevant post, timing, and surrounding social context.',
        preferredPlanTools(skillResolution, ['external_web_search']),
    );
}

export function buildChainEvidencePlanStep(skillResolution: SkillResolution, query: string): PlanStep {
    const locale = detectLocale(query, null);
    return makeStep(
        'step-chain',
        locale === 'zh' ? '查询链上证据' : 'Gather on-chain evidence',
        locale === 'zh'
            ? '查询代币、持有人、早期买家或交易证据。'
            : 'Query token, holder, buyer, or transaction evidence.',
        preferredPlanTools(skillResolution, ['get_early_buyers', 'get_token_info', 'get_wallet_info']),
    );
}

export function buildCreatorPlanStep(skillResolution: SkillResolution, query: string): PlanStep {
    const locale = detectLocale(query, null);
    return makeStep(
        'step-creator',
        locale === 'zh' ? '查看创建者信息' : 'Inspect creator evidence',
        locale === 'zh'
            ? '补充创建者、部署者和相关钱包证据。'
            : 'Gather creator, deployer, and related wallet evidence.',
        preferredPlanTools(skillResolution, ['analyze_creator', 'get_token_info']),
    );
}

export function buildSummaryPlanStep(query: string): PlanStep {
    const locale = detectLocale(query, null);
    return makeStep(
        'step-summary',
        locale === 'zh' ? '整理结果' : 'Summarize findings',
        locale === 'zh'
            ? '整理已拿到的信息并给出结论。'
            : 'Combine the evidence and produce the final answer.',
        [],
    );
}

export function resolvePlanStepForTool(
    toolName: string,
    planningOrSkills: TaskPlanningContext | SkillResolution,
    skillsOrQuery: SkillResolution | string,
    maybeQuery?: string,
): PlanStep | null {
    const legacyMode = typeof maybeQuery !== 'string';
    const planning: TaskPlanningContext = legacyMode
        ? {
            plan: {
                planId: randomUUID(),
                title: 'legacy',
                summary: 'legacy',
                locale: detectLocale(String(skillsOrQuery || ''), null),
                status: 'in_progress',
                steps: [],
            },
            asksRealtimeSocial: false,
            asksOnChainEvidence: false,
            asksCreatorEvidence: false,
            requestedToken: false,
            locale: detectLocale(String(skillsOrQuery || ''), null),
        }
        : planningOrSkills as TaskPlanningContext;
    const skillResolution = legacyMode
        ? planningOrSkills as SkillResolution
        : skillsOrQuery as SkillResolution;
    const query = legacyMode ? String(skillsOrQuery || '') : String(maybeQuery || '');

    if (toolName === 'external_web_search') {
        return buildSocialPlanStep(skillResolution, query);
    }
    if (toolName === 'analyze_creator') {
        return buildCreatorPlanStep(skillResolution, query);
    }
    if (['get_early_buyers', 'get_token_info', 'get_wallet_info'].includes(toolName)) {
        return buildChainEvidencePlanStep(skillResolution, query);
    }
    if (planning.asksOnChainEvidence && planning.requestedToken) {
        return buildChainEvidencePlanStep(skillResolution, query);
    }
    return null;
}

function makeStep(id: string, title: string, description: string, preferredTools: string[]): PlanStep {
    return {
        id,
        title,
        description,
        status: id === 'step-understand' ? 'in_progress' : 'pending',
        preferredTools,
        executions: [],
    };
}

function preferredPlanTools(skillResolution: SkillResolution, fallbacks: string[]): string[] {
    const preferred = skillResolution.preferredTools || [];
    const resolved = [
        ...preferred.filter((toolName) => fallbacks.length === 0 || fallbacks.includes(toolName)),
        ...fallbacks.filter((toolName) => !preferred.includes(toolName)),
    ];
    return Array.from(new Set(resolved));
}

function containsAny(text: string, needles: string[]): boolean {
    return needles.some((needle) => text.includes(needle));
}

function isChinese(text: string): boolean {
    return /[\u4e00-\u9fff]/.test(text);
}

export function detectLocale(text: string, canonicalIntent?: CanonicalIntent | null): 'en' | 'zh' {
    if (canonicalIntent?.locale === 'zh') return 'zh';
    return isChinese(text) ? 'zh' : 'en';
}
