import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { ChatContextSnapshot } from './contracts.js';
import { buildProviderOptions, resolveProviderInfo } from './providerPolicyBuilder.js';
import { resolveNodeSkills } from './nodeSkillResolver.js';
import { assembleGenerationMessages, sanitizeProviderHistory, type GenerationMessage } from './nodePromptAssembler.js';
import { parseTradingIntent } from './tradingIntentResolver.js';
import type { ToolExecutionEngine } from './toolExecutionEngine.js';
import type { ChatStreamBroker } from './streamBroker.js';
import type { PythonGenerationClient } from './pythonGenerationClient.js';
import {
    buildChainEvidencePlanStep,
    buildSocialPlanStep,
    buildSummaryPlanStep,
    buildTaskPlanningContext,
    resolvePlanStepForTool,
} from './taskPlanner.js';
import { generateModelPlan } from './modelPlanGenerator.js';

export async function runNodeOrchestration(params: {
    snapshot: ChatContextSnapshot;
    generationClient: PythonGenerationClient;
    toolExecutionEngine: ToolExecutionEngine;
    broker: ChatStreamBroker;
    toolContext: Record<string, any>;
    shouldCancel?: () => Promise<boolean>;
    onToolStatus?: (toolName: string) => Promise<void> | void;
    onProviderState?: (state: { previousResponseId?: string }) => Promise<void> | void;
}) {
    const providerInfo = resolveProviderInfo(params.snapshot.model);
    const tradingIntent = parseTradingIntent(params.snapshot.lastUserMessage, params.snapshot);
    const skillResolution = resolveNodeSkills(params.snapshot, tradingIntent);
    const tools = buildGenerationTools(
        params.snapshot.toolDefinitions,
        skillResolution.allowedTools,
        skillResolution.blockedTools,
        skillResolution.preferredTools,
        skillResolution.allowAllTools,
        providerInfo.provider,
    );
    const providerOptions = buildProviderOptions(params.snapshot, providerInfo, params.snapshot.lastUserMessage);
    const planning = buildTaskPlanningContext(params.snapshot, skillResolution);
    let plan = planning.plan;
    const executedToolResults = new Map<string, { result: any; ok: boolean; error?: string; metadata?: Record<string, any> }>();
    let duplicateOnlyRounds = 0;
    const toolUsageCount = new Map<string, number>();

    await params.broker.bootstrapRuntime(plan);

    void generateModelPlan({
        snapshot: params.snapshot,
        planning,
        skillResolution,
        generationClient: params.generationClient,
        shouldCancel: params.shouldCancel,
    }).then(async (modelPlan) => {
        if (!modelPlan) return;
        await params.broker.applyModelPlan(modelPlan);
    }).catch((error) => {
        logger.warn(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: async model plan update failed', {
            sessionId: params.snapshot.sessionId,
            taskId: params.snapshot.taskId,
            error: error instanceof Error ? error.message : String(error),
        });
    });

    const messages: GenerationMessage[] = assembleGenerationMessages(
        params.snapshot,
        skillResolution.skillPrompts,
        providerInfo,
        {
            preferredTools: skillResolution.preferredTools,
            strategyNotes: skillResolution.strategyNotes,
            allowAllTools: skillResolution.allowAllTools,
            executionPlan: plan,
        },
    );

    logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: starting generation loop', {
        sessionId: params.snapshot.sessionId,
        taskId: params.snapshot.taskId,
        provider: providerInfo.provider,
        skills: skillResolution.selectedSkills,
        allowedTools: skillResolution.allowedTools,
        toolCount: tools.length,
        planSteps: plan?.steps.length || 0,
    });

    for (let round = 1; round <= 8; round += 1) {
        if (params.shouldCancel && await params.shouldCancel()) {
            throw new Error('Task cancelled');
        }
        logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: generation round start', {
            sessionId: params.snapshot.sessionId,
            taskId: params.snapshot.taskId,
            round,
        });
        await params.broker.markPlanPhase(
            round === 1
                ? planning.locale === 'zh'
                    ? '正在分析问题并决定下一步'
                    : 'Analyzing the request and deciding the next step'
                : planning.locale === 'zh'
                    ? '正在根据最新结果调整后续步骤'
                    : 'Updating the next steps from the latest result'
        );
        if (round === 1 && planning.asksRealtimeSocial) {
            await params.broker.ensurePlanStep(buildSocialPlanStep(skillResolution, params.snapshot.lastUserMessage));
            await params.broker.focusPlanStep(
                'step-social',
                planning.locale === 'zh'
                    ? '正在确认相关帖子和时间线'
                    : 'Checking the relevant post and timing'
            );
        }

        const providerReadyMessages = sanitizeProviderHistory(messages, params.snapshot.model);
        let roundResult;
        try {
            roundResult = await params.generationClient.generate({
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                model: params.snapshot.model,
                messages: providerReadyMessages,
                tools,
                providerOptions,
                shouldCancel: params.shouldCancel,
                onTextDelta: params.broker.pushText.bind(params.broker),
                onReasoningDelta: params.broker.pushReasoning.bind(params.broker),
                onUsage: params.broker.pushUsage.bind(params.broker),
                onCitation: params.broker.pushCitation.bind(params.broker),
                onProviderState: async (state) => {
                    if (state.previousResponseId) {
                        providerOptions.previous_response_id = state.previousResponseId;
                    }
                    await params.onProviderState?.(state);
                },
            });
        } catch (error: any) {
            logger.error(LogCode.AI_API_ERROR, 'NodeOrchestrator: generation round failed', {
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                round,
                model: params.snapshot.model,
                error: error?.message || String(error),
                recentMessages: providerReadyMessages.slice(-4).map((msg) => ({
                    role: msg.role,
                    contentType: msg.content === null ? 'null' : typeof msg.content,
                    contentLength: typeof msg.content === 'string' ? msg.content.length : null,
                    hasToolCalls: Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0,
                    toolCallCount: Array.isArray(msg.tool_calls) ? msg.tool_calls.length : 0,
                    hasReasoning: typeof (msg as any).reasoning_content === 'string',
                    reasoningLength: typeof (msg as any).reasoning_content === 'string' ? (msg as any).reasoning_content.length : null,
                    toolCallId: msg.tool_call_id || null,
                })),
            });
            throw error;
        }

        if (roundResult.toolCalls.length === 0) {
            const summaryStep = buildSummaryPlanStep(params.snapshot.lastUserMessage);
            await params.broker.markAnswerStarted(summaryStep);
            await params.broker.markPlanPhase(
                planning.locale === 'zh'
                    ? '已完成证据整理，正在生成回答'
                    : 'Evidence gathered, generating the answer'
            );
            logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: generation loop complete', {
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                round,
                contentLength: roundResult.text.length,
            });
            return;
        }

        await params.broker.markPlanPhase(
            roundResult.toolCalls.length > 0
                ? planning.locale === 'zh'
                    ? `已确定 ${roundResult.toolCalls.length} 个下一步动作`
                    : `Selected ${roundResult.toolCalls.length} next action(s)`
                : planning.locale === 'zh'
                    ? '已决定直接生成最终回答'
                    : 'Decided to answer directly'
        );
        await params.broker.ensurePlanStep(buildSummaryPlanStep(params.snapshot.lastUserMessage));
        const normalizedToolCalls = roundResult.toolCalls.map((call) => normalizeToolCallForProvider(call, providerInfo.provider));
        for (const call of normalizedToolCalls) {
            const plannedStep = resolvePlanStepForTool(call.name, planning, skillResolution, params.snapshot.lastUserMessage)
                || (planning.asksOnChainEvidence && planning.requestedToken
                    ? buildChainEvidencePlanStep(skillResolution, params.snapshot.lastUserMessage)
                    : null);
            await params.broker.noteToolSelected(call, plannedStep || undefined);
        }
        messages.push({
            role: 'assistant',
            content: roundResult.toolCalls.length > 0
                ? ''
                : roundResult.text,
            ...(String(params.snapshot.model || '').trim().toLowerCase() === 'deepseek-reasoner'
                && roundResult.toolCalls.length === 0
                ? { reasoning_content: roundResult.reasoning || '' }
                : {}),
            ...(normalizedToolCalls.length > 0 ? { tool_calls: normalizedToolCalls.map(toAssistantToolCall) } : {}),
        });

        let executedFreshTool = false;
        for (const call of normalizedToolCalls) {
            if (params.shouldCancel && await params.shouldCancel()) {
                throw new Error('Task cancelled');
            }
            if (isProviderManagedNativeTool(call.name, providerInfo.provider)) {
                logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: skipping provider-managed native tool call', {
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    round,
                    tool: call.name,
                });
                continue;
            }
            const usageCount = (toolUsageCount.get(call.name) || 0) + 1;
            toolUsageCount.set(call.name, usageCount);
            const toolBudget = resolveToolBudget(call.name);
            if (usageCount > toolBudget) {
                logger.warn(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: tool budget exceeded', {
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    round,
                    tool: call.name,
                    usageCount,
                    toolBudget,
                });
                const budgetResult = {
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments || {},
                    ok: false,
                    error: buildToolBudgetMessage(call.name, planning.locale),
                    result: {
                        error: buildToolBudgetMessage(call.name, planning.locale),
                        reasonCode: 'TOOL_BUDGET_EXCEEDED',
                        tool: call.name,
                        usageCount,
                        toolBudget,
                    },
                    metadata: { source: 'tool_budget_guard' },
                };
                await params.broker.recordToolResult(budgetResult);
                messages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: JSON.stringify({ error: budgetResult.error, reasonCode: 'TOOL_BUDGET_EXCEEDED' }),
                });
                continue;
            }
            await params.onToolStatus?.(call.name);
            const plannedStep = resolvePlanStepForTool(call.name, planning, skillResolution, params.snapshot.lastUserMessage)
                || (planning.asksOnChainEvidence && planning.requestedToken
                    ? buildChainEvidencePlanStep(skillResolution, params.snapshot.lastUserMessage)
                    : null);
            await params.broker.markPlanStepStarted(call, plannedStep || undefined);
            const toolKey = buildToolCallKey(call.name, call.arguments || {});
            let result;
            const cached = executedToolResults.get(toolKey);
            if (cached) {
                logger.warn(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: duplicate tool call reused from cache', {
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    round,
                    tool: call.name,
                    toolKey,
                });
                result = {
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments || {},
                    ok: cached.ok,
                    result: cached.result,
                    error: cached.error,
                    metadata: {
                        ...(cached.metadata || {}),
                        source: 'repeat_cache',
                    },
                };
            } else {
                executedFreshTool = true;
                result = await params.toolExecutionEngine.execute(call, params.toolContext);
                executedToolResults.set(toolKey, {
                    ok: result.ok,
                    result: result.result,
                    error: result.error,
                    metadata: result.metadata,
                });
            }
            await params.broker.recordToolResult(result);
            messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result.ok ? (result.result ?? null) : { error: result.error || 'tool execution failed' }),
            });
        }
        if (!executedFreshTool) {
            duplicateOnlyRounds += 1;
            logger.warn(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: duplicate-only tool round detected', {
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                round,
                duplicateOnlyRounds,
                tools: normalizedToolCalls.map((call) => call.name),
            });
            if (duplicateOnlyRounds >= 2) {
                throw new Error('Duplicate tool loop blocked');
            }
        } else {
            duplicateOnlyRounds = 0;
        }
    }

    throw new Error('Max orchestration rounds exceeded');
}

function buildToolCallKey(name: string, args: Record<string, any>): string {
    return `${name}:${stableStringify(args || {})}`;
}

function normalizeToolCallForProvider(
    call: { id: string; name: string; arguments: Record<string, any> },
    provider: 'openai' | 'deepseek' | 'grok',
) {
    if (provider !== 'grok') return call;

    if (call.name === 'x_keyword_search') {
        return {
            ...call,
            name: 'x_search',
            arguments: {
                query: String(call.arguments?.query || '').trim(),
                ...(call.arguments?.mode ? { mode: call.arguments.mode } : {}),
            },
        };
    }

    if (call.name === 'x_semantic_search') {
        return {
            ...call,
            name: 'x_search',
            arguments: {
                query: String(call.arguments?.query || '').trim(),
                ...(call.arguments?.mode ? { mode: call.arguments.mode } : {}),
                ...(call.arguments?.limit ? { limit: call.arguments.limit } : {}),
            },
        };
    }

    if (call.name === 'x_thread_fetch') {
        const postId = String(call.arguments?.post_id || call.arguments?.tweet_id || call.arguments?.id || '').trim();
        return {
            ...call,
            name: 'x_search',
            arguments: {
                query: postId ? `https://x.com/i/status/${postId}` : '',
            },
        };
    }

    if (call.name === 'web_search_with_snippets') {
        return {
            ...call,
            name: 'web_search',
            arguments: {
                query: String(call.arguments?.query || '').trim(),
                ...(call.arguments?.num_results ? { num_results: call.arguments.num_results } : {}),
                ...(call.arguments?.max_results ? { num_results: call.arguments.max_results } : {}),
            },
        };
    }

    return call;
}

function isProviderManagedNativeTool(toolName: string, provider: 'openai' | 'deepseek' | 'grok') {
    if (provider !== 'grok') return false;
    return ['web_search', 'web_search_with_snippets', 'x_search', 'x_keyword_search', 'x_semantic_search', 'x_thread_fetch', 'code_execution', 'collections_search', 'mcp'].includes(toolName);
}

function resolveToolBudget(toolName: string): number {
    if (toolName === 'external_web_search') return 3;
    if (toolName === 'search_farcaster_casts' || toolName === 'get_trending_casts') return 2;
    if (toolName === 'get_token_info' || toolName === 'get_wallet_info') return 2;
    return 4;
}

function buildToolBudgetMessage(toolName: string, locale: 'en' | 'zh'): string {
    if (locale === 'zh') {
        return `工具 ${toolName} 已达到本轮调用上限。请基于现有证据直接给出结论，不要继续重复搜索。`;
    }
    return `Tool budget reached for ${toolName}. Answer from the current evidence and do not continue repeating searches.`;
}

function stableStringify(value: any): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function buildGenerationTools(
    toolDefinitions: Array<{ name: string; description: string; parameters: any }>,
    allowedTools: string[],
    blockedTools: string[] = [],
    preferredTools: string[] = [],
    allowAllTools = true,
    provider: 'openai' | 'deepseek' | 'grok' = 'deepseek',
) {
    const allowedSet = new Set(allowedTools);
    const blockedSet = new Set(blockedTools);
    const preferredOrder = new Map(preferredTools.map((name, index) => [name, index]));
    return (toolDefinitions || [])
        .filter((definition) => !blockedSet.has(definition.name))
        .filter((definition) => !(provider === 'grok' && definition.name === 'external_web_search'))
        .filter((definition) => allowAllTools || allowedSet.has(definition.name))
        .sort((a, b) => {
            const aRank = preferredOrder.has(a.name) ? preferredOrder.get(a.name)! : Number.MAX_SAFE_INTEGER;
            const bRank = preferredOrder.has(b.name) ? preferredOrder.get(b.name)! : Number.MAX_SAFE_INTEGER;
            if (aRank !== bRank) return aRank - bRank;
            return a.name.localeCompare(b.name);
        })
        .map((definition) => ({
            type: 'function',
            function: {
                name: definition.name,
                description: definition.description,
                parameters: definition.parameters,
            },
        }));
}

function toAssistantToolCall(call: { id: string; name: string; arguments: Record<string, any> }) {
    return {
        id: call.id,
        type: 'function',
        function: {
            name: call.name,
            arguments: JSON.stringify(call.arguments || {}),
        },
    };
}
