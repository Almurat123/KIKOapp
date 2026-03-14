import { randomUUID } from 'node:crypto';
import type { ChatContextSnapshot, PlanCard, PlanStep } from './contracts.js';
import type { SkillResolution } from './nodeSkillResolver.js';

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
    const asksRealtimeSocial = containsAny(lower, SOCIAL_KEYWORDS)
        || containsAny(query, SOCIAL_CN_KEYWORDS)
        || /\bon\s+x\b/i.test(lower)
        || /\bweb\s+search\b/i.test(lower)
        || /\bsearch\s+(the\s+)?web\b/i.test(lower)
        || /\bsearch\s+x\b/i.test(lower)
        || /\bx\s+search\b/i.test(lower);
    const asksOnChainEvidence = containsAny(lower, CHAIN_EVIDENCE_KEYWORDS) || containsAny(query, CHAIN_EVIDENCE_CN_KEYWORDS);
    const asksCreatorEvidence = containsAny(lower, ['creator', 'deployer', 'deployed by']) || containsAny(query, ['创建者', '部署者', '谁部署']);
    const requestedToken = (snapshot.requestedTokenAddresses || []).length > 0 || (snapshot.requestedTokenSymbols || []).length > 0;
    const locale = detectLocale(query);

    const initialStep = makeStep(
        'step-understand',
        locale === 'zh' ? '先理解任务' : 'Understand the request',
        locale === 'zh'
            ? '先明确目标，再决定下一步要查看哪些信息。'
            : 'Clarify the goal first, then decide what evidence to gather next.',
        preferredPlanTools(skillResolution, []),
    );

    return {
        plan: {
            planId: randomUUID(),
            title: locale === 'zh' ? '正在处理你的请求' : 'Working on your request',
            summary: locale === 'zh'
                ? '我会逐步查看信息并在拿到结果后继续。'
                : 'I will inspect the task step by step and continue as results come in.',
            locale,
            status: 'in_progress',
            currentStepId: initialStep.id,
            steps: [initialStep],
            activity: [],
        },
        asksRealtimeSocial,
        asksOnChainEvidence,
        asksCreatorEvidence,
        requestedToken,
        locale,
    };
}

export function buildSocialPlanStep(skillResolution: SkillResolution, query: string): PlanStep {
    const locale = detectLocale(query);
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
    const locale = detectLocale(query);
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
    const locale = detectLocale(query);
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
    const locale = detectLocale(query);
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
                locale: detectLocale(String(skillsOrQuery || '')),
                status: 'in_progress',
                steps: [],
            },
            asksRealtimeSocial: false,
            asksOnChainEvidence: false,
            asksCreatorEvidence: false,
            requestedToken: false,
            locale: detectLocale(String(skillsOrQuery || '')),
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

export function detectLocale(text: string): 'en' | 'zh' {
    return isChinese(text) ? 'zh' : 'en';
}
