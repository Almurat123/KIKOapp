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
        skillResolution.preferredTools,
        skillResolution.allowAllTools,
        providerInfo.provider,
    );
    const providerOptions = buildProviderOptions(params.snapshot, providerInfo, params.snapshot.lastUserMessage);
    const planning = buildTaskPlanningContext(params.snapshot, skillResolution);
    let plan = planning.plan;

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
        for (const call of roundResult.toolCalls) {
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
            ...(roundResult.toolCalls.length > 0 ? { tool_calls: roundResult.toolCalls.map(toAssistantToolCall) } : {}),
        });

        for (const call of roundResult.toolCalls) {
            if (params.shouldCancel && await params.shouldCancel()) {
                throw new Error('Task cancelled');
            }
            await params.onToolStatus?.(call.name);
            const plannedStep = resolvePlanStepForTool(call.name, planning, skillResolution, params.snapshot.lastUserMessage)
                || (planning.asksOnChainEvidence && planning.requestedToken
                    ? buildChainEvidencePlanStep(skillResolution, params.snapshot.lastUserMessage)
                    : null);
            await params.broker.markPlanStepStarted(call, plannedStep || undefined);
            const result = await params.toolExecutionEngine.execute(call, params.toolContext);
            await params.broker.recordToolResult(result);
            messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result.ok ? (result.result ?? null) : { error: result.error || 'tool execution failed' }),
            });
        }
    }

    throw new Error('Max orchestration rounds exceeded');
}

function buildGenerationTools(
    toolDefinitions: Array<{ name: string; description: string; parameters: any }>,
    allowedTools: string[],
    preferredTools: string[] = [],
    allowAllTools = true,
    provider: 'openai' | 'deepseek' | 'grok' = 'deepseek',
) {
    const allowedSet = new Set(allowedTools);
    const preferredOrder = new Map(preferredTools.map((name, index) => [name, index]));
    return (toolDefinitions || [])
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
