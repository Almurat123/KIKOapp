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

export function buildTaskPlanningContext(
    snapshot: ChatContextSnapshot,
    skillResolution: SkillResolution,
): TaskPlanningContext {
    const canonicalIntent = snapshot.normalizedIntent || null;
    const intentEnvelope = skillResolution.intentEnvelope;
    const locale = detectLocale(String(snapshot.lastUserMessage || ''), canonicalIntent);
    const asksRealtimeSocial = Boolean(
        intentEnvelope?.required_evidence?.includes('native_search_results')
        || (
            skillResolution.searchMode === 'required'
            && (
                intentEnvelope?.search_target === 'x'
                || intentEnvelope?.search_target === 'x_and_web'
                || intentEnvelope?.domain === 'x'
                || intentEnvelope?.domain === 'farcaster'
            )
        ),
    );
    const asksOnChainEvidence = Boolean(
        intentEnvelope?.required_evidence?.includes('onchain_token_evidence')
        || intentEnvelope?.required_evidence?.includes('onchain_wallet_evidence')
        || intentEnvelope?.required_evidence?.includes('connected_chain_evidence')
        || canonicalIntent?.requiresOnchainEvidence,
    );
    const asksCreatorEvidence = canonicalIntent?.intent === 'creator_analysis';
    const requestedToken = (snapshot.requestedTokenAddresses || []).length > 0 || (snapshot.requestedTokenSymbols || []).length > 0;
    const needsEvidence = asksRealtimeSocial || asksOnChainEvidence || asksCreatorEvidence || requestedToken;
    const isAssistantMetaDebug = canonicalIntent?.intent === 'assistant_meta' && canonicalIntent.taskMode === 'analyze';
    const steps: PlanStep[] = isAssistantMetaDebug
        ? [
            makeStep(
                'step-review-runtime',
                locale === 'zh' ? '回看上一轮行为' : 'Review the previous behavior',
                locale === 'zh'
                    ? '先回看上一轮回复、运行状态和当前轮真正关注的问题。'
                    : 'Review the previous reply, runtime state, and what this turn is actually asking about.',
                [],
            ),
            makeStep(
                'step-explain-cause',
                locale === 'zh' ? '解释原因' : 'Explain the cause',
                locale === 'zh'
                    ? '把已观察到的事实和推断分开说明，解释为什么会出现刚才的行为。'
                    : 'Separate observed facts from inferences and explain why the previous behavior happened.',
                [],
            ),
            makeStep(
                'step-summary',
                locale === 'zh' ? '生成回答' : 'Generate answer',
                locale === 'zh'
                    ? '基于当前会话里已经看到的真实信息，给出清晰解释。'
                    : 'Give a clear explanation grounded in the evidence already visible in this conversation.',
                [],
            ),
        ]
        : [
            makeStep(
                'step-understand',
                locale === 'zh' ? '理解请求' : 'Understand the request',
                locale === 'zh'
                    ? '先明确用户当前这一轮真正要解决的问题。'
                    : 'Clarify what the user is actually trying to accomplish on this turn.',
                [],
            ),
        ];
    if (needsEvidence) {
        steps.push(makeStep(
            'step-evidence',
            locale === 'zh' ? '收集证据' : 'Gather evidence',
            locale === 'zh'
                ? '只收集回答当前请求真正需要的证据。'
                : 'Collect only the evidence that is actually needed for the current request.',
            preferredPlanTools(skillResolution, skillResolution.preferredTools || []),
        ));
    }
    if (canonicalIntent?.taskMode === 'execute' || canonicalIntent?.taskMode === 'confirm' || skillResolution.intentEnvelope.execution_risk === 'mutation') {
        steps.push(makeStep(
            'step-prepare',
            locale === 'zh' ? '准备执行' : 'Prepare execution',
            locale === 'zh'
                ? '整理执行参数、确认条件和下一步。'
                : 'Prepare execution parameters, confirmation state, and the next action.',
            preferredPlanTools(skillResolution, skillResolution.preferredTools || []),
        ));
    }
    if (!steps.some((step) => step.id === 'step-summary')) {
        steps.push(makeStep(
            'step-summary',
            locale === 'zh' ? '生成回答' : 'Generate answer',
            locale === 'zh'
                ? '基于已拿到的真实结果给出回答。'
                : 'Answer from the evidence and tool results already gathered.',
            [],
        ));
    }

    steps[0].status = 'in_progress';

    return {
        plan: {
            planId: randomUUID(),
            title: resolvePlanTitle(locale, asksRealtimeSocial, asksOnChainEvidence || asksCreatorEvidence, isAssistantMetaDebug),
            summary: resolvePlanSummary(locale, asksRealtimeSocial, asksOnChainEvidence || asksCreatorEvidence, isAssistantMetaDebug),
            locale,
            status: 'in_progress',
            currentStepId: steps[0]?.id,
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

function resolvePlanTitle(locale: 'en' | 'zh', asksRealtimeSocial: boolean, asksChainEvidence: boolean, isAssistantMetaDebug: boolean): string {
    if (isAssistantMetaDebug) {
        return locale === 'zh' ? '解释上一轮行为' : 'Explain the previous behavior';
    }
    if (locale === 'zh') {
        if (asksRealtimeSocial || asksChainEvidence) return '收集相关证据';
        return '正在处理你的请求';
    }
    if (asksRealtimeSocial || asksChainEvidence) return 'Gather relevant evidence';
    return 'Working on your request';
}

function resolvePlanSummary(locale: 'en' | 'zh', asksRealtimeSocial: boolean, asksChainEvidence: boolean, isAssistantMetaDebug: boolean): string {
    if (isAssistantMetaDebug) {
        return locale === 'zh'
            ? '我会先回看刚才的回复和运行状态，再解释真正的原因。'
            : 'I will review the previous reply and runtime state first, then explain the real cause.';
    }
    if (locale === 'zh') {
        if (asksRealtimeSocial || asksChainEvidence) return '我会先收集必要证据，再基于真实结果回答。';
        return '我会逐步查看信息并在拿到结果后继续。';
    }
    if (asksRealtimeSocial || asksChainEvidence) return 'I will gather the necessary evidence first, then answer from the real results.';
    return 'I will inspect the task step by step and continue as results come in.';
}

export function buildSocialPlanStep(skillResolution: SkillResolution, query: string): PlanStep {
    const locale = detectLocale(query, null);
    return makeStep(
        'step-evidence',
        locale === 'zh' ? '收集证据' : 'Gather evidence',
        locale === 'zh'
            ? '收集回答当前请求需要的公开来源证据。'
            : 'Gather the public-source evidence needed for this request.',
        preferredPlanTools(skillResolution, skillResolution.preferredTools || ['external_web_search']),
    );
}

export function buildChainEvidencePlanStep(skillResolution: SkillResolution, query: string): PlanStep {
    const locale = detectLocale(query, null);
    return makeStep(
        'step-evidence',
        locale === 'zh' ? '收集证据' : 'Gather evidence',
        locale === 'zh'
            ? '收集回答当前请求需要的链上证据。'
            : 'Gather the chain-side evidence needed for this request.',
        preferredPlanTools(skillResolution, skillResolution.preferredTools || ['get_early_buyers', 'get_token_info', 'get_wallet_info']),
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
        locale === 'zh' ? '生成回答' : 'Generate answer',
        locale === 'zh'
            ? '基于已拿到的真实结果给出回答。'
            : 'Answer from the evidence already gathered.',
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

function isChinese(text: string): boolean {
    return /[\u4e00-\u9fff]/.test(text);
}

export function detectLocale(text: string, canonicalIntent?: CanonicalIntent | null): 'en' | 'zh' {
    if (canonicalIntent?.locale === 'zh') return 'zh';
    return isChinese(text) ? 'zh' : 'en';
}
