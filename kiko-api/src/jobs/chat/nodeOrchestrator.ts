import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { ChatContextSnapshot } from './contracts.js';
import { buildProviderOptions, resolveProviderInfo } from './providerPolicyBuilder.js';
import { resolveNodeSkills } from './nodeSkillResolver.js';
import { assembleGenerationMessages, sanitizeProviderHistory, type GenerationMessage } from './nodePromptAssembler.js';
import { parseTradingIntent } from './tradingIntentResolver.js';
import { checkToolAgainstPolicy, resolvePolicyToolBudget } from './controlPolicy.js';
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
    const strictPolicy = params.snapshot.policySnapshot?.enforcementLevel === 'hard';
    const effectiveAllowedTools = strictPolicy && params.snapshot.policySnapshot
        ? params.snapshot.policySnapshot.allowedTools
        : skillResolution.allowedTools;
    const tools = buildGenerationTools(
        params.snapshot.toolDefinitions,
        effectiveAllowedTools,
        skillResolution.blockedTools,
        skillResolution.preferredTools,
        strictPolicy ? false : skillResolution.allowAllTools,
        providerInfo.provider,
    );
    const providerOptions = buildProviderOptions(params.snapshot, providerInfo, params.snapshot.lastUserMessage, skillResolution);
    const planning = buildTaskPlanningContext(params.snapshot, skillResolution);
    let plan = planning.plan;
    const executedToolResults = new Map<string, {
        name: string;
        arguments: Record<string, any>;
        result: any;
        ok: boolean;
        error?: string;
        metadata?: Record<string, any>;
    }>();
    let duplicateOnlyRounds = 0;
    let forceAnswerWithoutTools = false;
    const toolUsageCount = new Map<string, number>();
    const knownToolNames = new Set(params.snapshot.toolDefinitions.map((item) => item.name));

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
            rankedMatches: skillResolution.rankedMatches,
            searchMode: skillResolution.searchMode,
            searchReason: skillResolution.searchReason,
        },
    );

    logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: starting generation loop', {
        sessionId: params.snapshot.sessionId,
        taskId: params.snapshot.taskId,
        provider: providerInfo.provider,
        skills: skillResolution.selectedSkills,
        rankedMatches: skillResolution.rankedMatches.map((item) => ({
            skillId: item.skillId,
            score: item.score,
        })),
        searchMode: skillResolution.searchMode,
        allowedTools: effectiveAllowedTools,
        toolCount: tools.length,
        planSteps: plan?.steps.length || 0,
    });

    const emitMissingTail = async (fullText: string, streamedText: string, emit: (text: string) => Promise<void>) => {
        if (!fullText) return;
        if (!streamedText) {
            await emit(fullText);
            return;
        }
        if (fullText.startsWith(streamedText)) {
            const tail = fullText.slice(streamedText.length);
            if (tail) {
                await emit(tail);
            }
        }
    };

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
        const roundTools = forceAnswerWithoutTools ? [] : tools;
        const roundProviderOptions = providerOptions;
        let roundResult;
        let streamedRoundText = '';
        let streamedRoundReasoning = '';
        let retriedWithoutPreviousResponse = false;
        while (true) {
            try {
                roundResult = await params.generationClient.generate({
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    model: params.snapshot.model,
                    messages: providerReadyMessages,
                    tools: roundTools,
                    providerOptions: roundProviderOptions,
                    shouldCancel: params.shouldCancel,
                    onTextDelta: async (text) => {
                        if (!text) return;
                        streamedRoundText += text;
                        await params.broker.pushText(text);
                    },
                    onReasoningDelta: async (text) => {
                        if (!text) return;
                        streamedRoundReasoning += text;
                        await params.broker.pushReasoning(text);
                    },
                    onUsage: params.broker.pushUsage.bind(params.broker),
                    onCitation: params.broker.pushCitation.bind(params.broker),
                    onProviderState: async (state) => {
                        let forwardedState = state;
                        if (state.previousResponseId) {
                            const candidate = String(state.previousResponseId || '').trim();
                            const suspicious = providerInfo.provider === 'grok' && isSuspiciousProviderResponseId(candidate);
                            if (!suspicious && candidate) {
                                providerOptions.previous_response_id = candidate;
                                forwardedState = { ...state, previousResponseId: candidate };
                            } else if (suspicious) {
                                logger.warn(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: ignoring suspicious provider response id', {
                                    sessionId: params.snapshot.sessionId,
                                    taskId: params.snapshot.taskId,
                                    previousResponseId: candidate,
                                });
                                return;
                            }
                        }
                        await params.onProviderState?.(forwardedState);
                    },
                });
                break;
            } catch (error: any) {
                const errorMessage = error?.message || String(error);
                const canRetryWithoutPreviousResponse =
                    !retriedWithoutPreviousResponse
                    && providerInfo.provider === 'grok'
                    && typeof providerOptions.previous_response_id === 'string'
                    && providerOptions.previous_response_id.trim().length > 0
                    && isStalePreviousResponseError(errorMessage);

                logger.error(LogCode.AI_API_ERROR, 'NodeOrchestrator: generation round failed', {
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    round,
                    model: params.snapshot.model,
                    error: errorMessage,
                    retryWithoutPreviousResponse: canRetryWithoutPreviousResponse,
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

                if (canRetryWithoutPreviousResponse) {
                    retriedWithoutPreviousResponse = true;
                    providerOptions.previous_response_id = undefined;
                    continue;
                }
                throw error;
            }
        }

        if (roundResult.toolCalls.length === 0) {
            const summaryStep = buildSummaryPlanStep(params.snapshot.lastUserMessage);
            await params.broker.markAnswerStarted(summaryStep);
            await params.broker.markPlanPhase(
                planning.locale === 'zh'
                    ? '已完成证据整理，正在生成回答'
                    : 'Evidence gathered, generating the answer'
            );
            await emitMissingTail(roundResult.reasoning || '', streamedRoundReasoning, (text) => params.broker.pushReasoning(text));
            await emitMissingTail(roundResult.text || '', streamedRoundText, (text) => params.broker.pushText(text));
            logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: generation loop complete', {
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                round,
                contentLength: roundResult.text.length,
            });
            return;
        }

        const normalizedToolCalls = roundResult.toolCalls.map((call) => normalizeToolCallForProvider(call, providerInfo.provider));
        for (const call of normalizedToolCalls) {
            const policyViolation = checkToolAgainstPolicy({
                call,
                policy: params.snapshot.policySnapshot || null,
                knownToolNames,
            });
            if (policyViolation) {
                throw createOrchestrationError(policyViolation.code, policyViolation.message);
            }
        }
        const actionableToolCalls = normalizedToolCalls.filter((call) => !isProviderManagedNativeTool(call.name, providerInfo.provider));
        const providerManagedOnlyRound = normalizedToolCalls.length > 0 && actionableToolCalls.length === 0;

        if (providerManagedOnlyRound) {
            if ((roundResult.text || '').trim().length > 0 || (roundResult.reasoning || '').trim().length > 0) {
                const summaryStep = buildSummaryPlanStep(params.snapshot.lastUserMessage);
                await params.broker.markAnswerStarted(summaryStep);
                await params.broker.markPlanPhase(
                    planning.locale === 'zh'
                        ? '已完成证据整理，正在生成回答'
                    : 'Evidence gathered, generating the answer'
                );
                await emitMissingTail(roundResult.reasoning || '', streamedRoundReasoning, (text) => params.broker.pushReasoning(text));
                await emitMissingTail(roundResult.text || '', streamedRoundText, (text) => params.broker.pushText(text));
                logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: provider-managed tool round already produced answer text', {
                    sessionId: params.snapshot.sessionId,
                    taskId: params.snapshot.taskId,
                    round,
                    contentLength: roundResult.text.length,
                });
                return;
            }

            logger.error(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: provider-managed tool chain produced no stable final text', {
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                round,
                tools: normalizedToolCalls.map((call) => call.name),
            });

            throw createOrchestrationError(
                'NO_FINAL_TEXT_AFTER_TOOL_CHAIN',
                planning.locale === 'zh'
                    ? '工具调用已完成，但模型没有产出稳定的最终回答'
                    : 'Tool chain completed, but the model did not return a stable final answer',
            );
        }

        await params.broker.markPlanPhase(
            actionableToolCalls.length > 0
                ? planning.locale === 'zh'
                    ? `已确定 ${actionableToolCalls.length} 个下一步动作`
                    : `Selected ${actionableToolCalls.length} next action(s)`
                : planning.locale === 'zh'
                    ? '已决定直接生成最终回答'
                    : 'Decided to answer directly'
        );
        await params.broker.ensurePlanStep(buildSummaryPlanStep(params.snapshot.lastUserMessage));
        for (const call of actionableToolCalls) {
            const plannedStep = resolvePlanStepForTool(call.name, planning, skillResolution, params.snapshot.lastUserMessage)
                || (planning.asksOnChainEvidence && planning.requestedToken
                    ? buildChainEvidencePlanStep(skillResolution, params.snapshot.lastUserMessage)
                    : null);
            await params.broker.noteToolSelected(call, plannedStep || undefined);
        }
        messages.push({
            role: 'assistant',
            content: actionableToolCalls.length > 0
                ? ''
                : roundResult.text,
            ...(String(params.snapshot.model || '').trim().toLowerCase() === 'deepseek-reasoner'
                && actionableToolCalls.length === 0
                ? { reasoning_content: roundResult.reasoning || '' }
                : {}),
            ...(actionableToolCalls.length > 0 ? { tool_calls: actionableToolCalls.map(toAssistantToolCall) } : {}),
        });

        let executedFreshTool = false;
        for (const call of actionableToolCalls) {
            if (params.shouldCancel && await params.shouldCancel()) {
                throw new Error('Task cancelled');
            }
            const polymarketOrderGuard = resolvePolymarketOrderGuardResult(
                call,
                executedToolResults,
                params.snapshot,
            );
            if (polymarketOrderGuard) {
                await params.broker.recordToolResult(polymarketOrderGuard);
                messages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: JSON.stringify({
                        error: polymarketOrderGuard.error,
                        reasonCode: polymarketOrderGuard.reasonCode,
                    }),
                });
                continue;
            }
            const usageCount = (toolUsageCount.get(call.name) || 0) + 1;
            toolUsageCount.set(call.name, usageCount);
            const toolBudget = resolvePolicyToolBudget(params.snapshot.policySnapshot || null, call.name);
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
                    reasonCode: 'TOOL_BUDGET_EXCEEDED',
                    policyDecisionId: params.snapshot.policySnapshot?.policyDecisionId,
                    result: {
                        error: buildToolBudgetMessage(call.name, planning.locale),
                        reasonCode: 'TOOL_BUDGET_EXCEEDED',
                        reason_code: 'TOOL_BUDGET_EXCEEDED',
                        policy_decision_id: params.snapshot.policySnapshot?.policyDecisionId,
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
                if (!result.ok && result.reasonCode && ['POLICY_UNAUTHORIZED_TOOL', 'POLICY_CONTROL_PLANE_VIOLATION'].includes(result.reasonCode)) {
                    throw createOrchestrationError(result.reasonCode, result.error || 'Tool blocked by policy');
                }
                executedToolResults.set(toolKey, {
                    name: call.name,
                    arguments: call.arguments || {},
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
                tools: actionableToolCalls.map((call) => call.name),
            });
            if (duplicateOnlyRounds >= 2) {
                const evidenceSnapshot = buildFinalizationEvidenceSnapshot(
                    executedToolResults,
                    [],
                    [],
                );
                const finalizationDirective = planning.locale === 'zh'
                    ? '你已经拿到了工具结果。不要再调用任何工具，请直接基于已有结果给出最终回答。'
                    : 'You already have tool outputs. Do not call tools again; provide the final answer from existing evidence.';
                messages.push({
                    role: 'system',
                    content: evidenceSnapshot
                        ? `${finalizationDirective}\n\nTool evidence JSON:\n${evidenceSnapshot}`
                        : finalizationDirective,
                });
                forceAnswerWithoutTools = true;
                duplicateOnlyRounds = 0;
                continue;
            }
        } else {
            duplicateOnlyRounds = 0;
            forceAnswerWithoutTools = false;
        }
    }

    throw new Error('Max orchestration rounds exceeded');
}

function buildToolCallKey(name: string, args: Record<string, any>): string {
    return `${name}:${stableStringify(args || {})}`;
}

function isStalePreviousResponseError(message: string): boolean {
    const normalized = String(message || '').toLowerCase();
    return (
        (normalized.includes('response with id') && normalized.includes('not found'))
        || (normalized.includes('previous_response_id') && normalized.includes('not found'))
        || (normalized.includes('grpc error') && normalized.includes('not found'))
    );
}

function normalizeToolCallForProvider(
    call: { id: string; name: string; arguments: Record<string, any> },
    provider: 'openai' | 'deepseek' | 'grok',
) {
    // Hard-policy mode does not perform provider fallback tool remapping.
    // Tool names must be validated as-is by the policy layer.
    void provider;
    return call;
}

function isProviderManagedNativeTool(toolName: string, provider: 'openai' | 'deepseek' | 'grok') {
    if (provider !== 'grok') return false;
    return ['web_search', 'web_search_with_snippets', 'x_search', 'x_keyword_search', 'x_semantic_search', 'x_thread_fetch', 'browse_page', 'open_page', 'code_execution', 'collections_search', 'mcp'].includes(toolName);
}

function isSuspiciousProviderResponseId(value: string): boolean {
    const normalized = String(value || '').trim();
    if (!normalized) return true;
    return /^chatcmpl-?-?\d+$/.test(normalized);
}

function resolveToolBudget(toolName: string): number {
    return resolvePolicyToolBudget(null, toolName);
}

function buildToolBudgetMessage(toolName: string, locale: 'en' | 'zh'): string {
    if (locale === 'zh') {
        return `工具 ${toolName} 已达到本轮调用上限。请基于现有证据直接给出结论，不要继续重复搜索。`;
    }
    return `Tool budget reached for ${toolName}. Answer from the current evidence and do not continue repeating searches.`;
}

function createOrchestrationError(code: string, message: string): Error {
    const error = new Error(`[${code}] ${message}`);
    (error as any).code = code;
    return error;
}

const POLYMARKET_TOKEN_SOURCE_TOOLS = new Set([
    'get_polymarket_event',
    'get_polymarket_trending_markets',
    'get_new_markets',
]);

export function resolvePolymarketOrderGuardResult(
    call: { id: string; name: string; arguments: Record<string, any> },
    executedToolResults: Map<string, { name?: string; arguments?: Record<string, any>; ok?: boolean; result?: any; metadata?: Record<string, any> }>,
    snapshot: ChatContextSnapshot,
) {
    if (String(call.name || '') !== 'place_polymarket_order') {
        return null;
    }

    const tokenId = String(call.arguments?.token_id || '').trim();
    const verifiedTokenIds = collectVerifiedPolymarketTokenIds(executedToolResults, snapshot);
    if (tokenId && verifiedTokenIds.has(tokenId)) {
        return null;
    }

    const error = tokenId
        ? 'Polymarket order blocked: token_id was not verified by get_polymarket_event, get_polymarket_trending_markets, or get_new_markets in the current evidence chain.'
        : 'Polymarket order blocked: missing concrete token_id. Resolve the exact selected outcome with get_polymarket_event, get_polymarket_trending_markets, or get_new_markets first.';

    return {
        id: call.id,
        name: call.name,
        arguments: call.arguments || {},
        ok: false,
        error,
        reasonCode: 'PRECHECK_REQUIRED' as const,
        result: {
            error,
            reasonCode: 'PRECHECK_REQUIRED',
            required_tools: Array.from(POLYMARKET_TOKEN_SOURCE_TOOLS),
            token_id: tokenId || null,
        },
        metadata: { source: 'polymarket_token_guard' },
    };
}

export function collectVerifiedPolymarketTokenIds(
    executedToolResults: Map<string, { name?: string; arguments?: Record<string, any>; ok?: boolean; result?: any; metadata?: Record<string, any> }>,
    snapshot: ChatContextSnapshot,
): Set<string> {
    const tokenIds = new Set<string>();

    for (const item of executedToolResults.values()) {
        if (!item?.ok) continue;
        const toolName = String(item?.name || '').trim();
        if (!POLYMARKET_TOKEN_SOURCE_TOOLS.has(toolName)) continue;
        for (const tokenId of extractPolymarketTokenIds(item.result)) {
            tokenIds.add(tokenId);
        }
    }

    const recentCalls = snapshot.recentToolTrace?.toolCalls || [];
    for (const toolCall of recentCalls) {
        const toolName = String(toolCall?.tool || '').trim();
        const status = String(toolCall?.status || '').trim().toLowerCase();
        if (!POLYMARKET_TOKEN_SOURCE_TOOLS.has(toolName)) continue;
        if (!['success', 'cached'].includes(status)) continue;
        for (const tokenId of extractPolymarketTokenIds(toolCall?.result)) {
            tokenIds.add(tokenId);
        }
    }

    return tokenIds;
}

function extractPolymarketTokenIds(result: any): string[] {
    const found = new Set<string>();

    const visit = (value: any) => {
        if (value == null) return;
        if (Array.isArray(value)) {
            for (const item of value) visit(item);
            return;
        }
        if (typeof value !== 'object') return;

        const tokenId = value.token_id ?? value.tokenId;
        if (tokenId != null) {
            const normalized = String(tokenId).trim();
            if (normalized) {
                found.add(normalized);
            }
        }

        for (const child of Object.values(value)) {
            if (child && typeof child === 'object') {
                visit(child);
            }
        }
    };

    visit(result);
    return Array.from(found);
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

export function buildFinalizationEvidenceSnapshot(
    executedToolResults: Map<string, { name?: string; arguments?: Record<string, any>; ok?: boolean; result?: any; metadata?: Record<string, any> }>,
    providerNativeToolSelections: Array<{ name?: string; arguments?: Record<string, any> }>,
    providerNativeResults: Array<{ results?: any[] }>,
): string | null {
    const payload: Record<string, any> = {};

    for (const item of executedToolResults.values()) {
        const toolName = String(item?.name || '').trim();
        if (!toolName) continue;
        payload[toolName] = {
            ok: item?.ok !== false,
            arguments: item?.arguments || {},
            result: item?.result ?? null,
            source: item?.metadata?.source || 'tool_runtime',
        };
    }

    const normalizedProviderResults = (providerNativeResults || [])
        .flatMap((entry) => Array.isArray(entry?.results) ? entry.results : [])
        .map((entry) => ({
            title: entry?.title || undefined,
            url: entry?.url || undefined,
            snippet: entry?.snippet || undefined,
        }))
        .filter((entry) => entry.title || entry.url || entry.snippet);
    if (normalizedProviderResults.length > 0) {
        payload.provider_native_results = normalizedProviderResults;
    }

    if (Object.keys(payload).length === 0) return null;
    void providerNativeToolSelections;
    return JSON.stringify(payload);
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
