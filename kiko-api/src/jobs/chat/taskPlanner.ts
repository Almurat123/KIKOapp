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
    const locale = detectLocale(String(snapshot.lastUserMessage || ''), canonicalIntent);
    const asksRealtimeSocial = Boolean(
        canonicalIntent?.searchTarget === 'x'
        || canonicalIntent?.searchTarget === 'x_and_web'
        || canonicalIntent?.requiresRealtime,
    );
    const asksOnChainEvidence = Boolean(
        canonicalIntent?.evidenceRequirements.includes('onchain_token_evidence')
        || canonicalIntent?.evidenceRequirements.includes('onchain_wallet_evidence')
        || canonicalIntent?.evidenceRequirements.includes('connected_chain_evidence')
        || canonicalIntent?.requiresOnchainEvidence,
    );
    const asksCreatorEvidence = canonicalIntent?.intent === 'creator_analysis';
    const requestedToken = (snapshot.requestedTokenAddresses || []).length > 0 || (snapshot.requestedTokenSymbols || []).length > 0;
    const steps: PlanStep[] = [];

    steps.push(makeStep(
        'step-discover',
        locale === 'zh' ? '识别意图与范围' : 'Resolve intent and scope',
        locale === 'zh'
            ? '根据规范化意图确定范围、证据要求与输出模式。'
            : 'Use canonical intent to lock the scope, evidence requirements, and output mode.',
        preferredPlanTools(skillResolution, []),
    ));
    if (asksRealtimeSocial || asksOnChainEvidence || asksCreatorEvidence) {
        steps.push(makeStep(
            'step-verify',
            locale === 'zh' ? '验证关键证据' : 'Verify key evidence',
            locale === 'zh'
                ? '仅收集当前任务真正需要的实时或链上证据。'
                : 'Collect only the realtime or on-chain evidence required for this task.',
            preferredPlanTools(skillResolution, asksOnChainEvidence ? ['get_early_buyers', 'get_token_info', 'get_wallet_info'] : asksRealtimeSocial ? ['external_web_search'] : ['analyze_creator']),
        ));
    }
    if (canonicalIntent?.taskMode === 'execute' || canonicalIntent?.taskMode === 'confirm' || skillResolution.intentEnvelope.execution_risk === 'mutation') {
        steps.push(makeStep(
            'step-prepare',
            locale === 'zh' ? '准备执行' : 'Prepare execution',
            locale === 'zh'
                ? '准备确认所需参数、执行前提和最小下一步。'
                : 'Prepare the execution prerequisites, confirmation payload, and smallest next step.',
            preferredPlanTools(skillResolution, skillResolution.preferredTools || []),
        ));
    }
    steps.push(makeStep(
        'step-summary',
        locale === 'zh' ? '整合回答' : 'Synthesize answer',
        locale === 'zh'
            ? '按照结构化输出契约返回结果。'
            : 'Return the answer using the structured output contract.',
        [],
    ));

    steps[0].status = 'in_progress';

    return {
        plan: {
            planId: randomUUID(),
            title: resolvePlanTitle(locale, asksRealtimeSocial, asksOnChainEvidence || asksCreatorEvidence),
            summary: resolvePlanSummary(locale, asksRealtimeSocial, asksOnChainEvidence || asksCreatorEvidence),
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

function isChinese(text: string): boolean {
    return /[\u4e00-\u9fff]/.test(text);
}

export function detectLocale(text: string, canonicalIntent?: CanonicalIntent | null): 'en' | 'zh' {
    if (canonicalIntent?.locale === 'zh') return 'zh';
    return isChinese(text) ? 'zh' : 'en';
}
