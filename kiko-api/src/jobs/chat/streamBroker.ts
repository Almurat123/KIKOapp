import { randomUUID } from 'node:crypto';
import * as chatRepo from '../../repositories/chatRepository.js';
import { chatWS } from '../../services/chatWebSocket.js';
import { LogCode } from '../../config/logRegistry.js';
import { logger } from '../../utils/logger.js';
import {
    createLeadingInternalScaffoldSuppressor,
    sanitizeReasoningForDisplay,
    stripLeadingInternalScaffold,
} from '../../services/ai/promptLeakSanitizer.js';
import { orderPlanSteps } from './planOrdering.js';
import type {
    AgentRuntimeEnvelope,
    AgentRuntimeEvent,
    AgentRuntimeEventType,
    OrchestratorToolCall,
    OrchestratorToolResult,
    OrchestratorUsage,
    PlanCard,
    PlanRuntimeState,
    PlanStep,
    PlanStepExecution,
    PlanStepStatus,
    ProviderNativeEvidenceSnapshot,
} from './contracts.js';
import { extractPolymarketSelectionState, mergePolymarketSelectionState } from './polymarketSelectionState.js';

export class ChatStreamBroker {
    private content = '';
    private reasoning = '';
    private rawReasoning = '';
    private citations: any[] = [];
    private citationKeys = new Set<string>();
    private usage: OrchestratorUsage | null = null;
    private toolResults: OrchestratorToolResult[] = [];
    private lastPersistMs = 0;
    private planCard: PlanCard | null = null;
    private assistantData: Record<string, any> = {};
    private readonly contentSuppressor = createLeadingInternalScaffoldSuppressor();

    constructor(
        private readonly params: {
            userId: string | null;
            sessionId: string;
            taskId?: string;
            assistantMessageId: string;
            model: string;
        }
    ) {}

    start() {
        if (!this.params.userId) return;
        chatWS.broadcastToUser(this.params.userId, {
            type: 'message_start',
            sessionId: this.params.sessionId,
            data: {
                messageId: this.params.assistantMessageId,
                taskId: this.params.taskId,
                role: 'assistant',
                model: this.params.model,
            },
        });
    }

    async pushText(text: string) {
        if (!text) return;
        const visibleText = this.contentSuppressor.push(text);
        if (!visibleText) return;
        this.content += visibleText;
        if (this.params.userId) {
            chatWS.broadcastToUser(this.params.userId, {
                type: 'chunk',
                sessionId: this.params.sessionId,
                data: { messageId: this.params.assistantMessageId, content: visibleText },
            });
        }
        await this.persistStreaming();
    }

    async pushReasoning(text: string) {
        if (!text) return;
        this.rawReasoning += text;
        const sanitized = sanitizeReasoningForDisplay(this.rawReasoning);
        const visibleReasoning = sanitized.startsWith(this.reasoning)
            ? sanitized.slice(this.reasoning.length)
            : sanitized;
        this.reasoning = sanitized;
        if (!visibleReasoning) return;
        if (this.params.userId) {
            chatWS.broadcastToUser(this.params.userId, {
                type: 'chunk',
                sessionId: this.params.sessionId,
                data: {
                    messageId: this.params.assistantMessageId,
                    type: 'reasoning',
                    reasoning_content: visibleReasoning,
                },
            });
        }
        await this.persistStreaming();
    }

    pushUsage(usage: OrchestratorUsage) {
        this.usage = mergeOrchestratorUsage(this.usage, usage);
    }

    async blockContent(replacement: string, options?: { clearReasoning?: boolean }) {
        this.content = replacement;
        if (options?.clearReasoning) {
            this.reasoning = '';
            this.rawReasoning = '';
        }
        if (this.params.userId) {
            chatWS.broadcastToUser(this.params.userId, {
                type: 'content_block',
                sessionId: this.params.sessionId,
                data: {
                    messageId: this.params.assistantMessageId,
                    taskId: this.params.taskId,
                    content: replacement,
                    replace: true,
                    clearReasoning: Boolean(options?.clearReasoning),
                    is_final: false,
                },
            });
        }
        await chatRepo.updateMessage(this.params.assistantMessageId, {
            content: this.content,
            reasoning_content: this.reasoning,
            data: this.assistantData,
            status: 'streaming',
        });
    }

    pushCitation(citation: any) {
        if (Array.isArray(citation)) {
            for (const item of citation) this.pushCitation(item);
            return;
        }
        const key = this.buildCitationKey(citation);
        if (key && this.citationKeys.has(key)) return;
        if (key) this.citationKeys.add(key);
        this.citations.push(citation);
        if (this.params.userId) {
            chatWS.broadcastToUser(this.params.userId, {
                type: 'citations',
                sessionId: this.params.sessionId,
                data: {
                    messageId: this.params.assistantMessageId,
                    citations: [citation],
                },
            });
        }
    }

    async bootstrapRuntime(plan: PlanCard) {
        if (this.planCard) return;
        this.planCard = this.clonePlan(plan);
        this.planCard.activity = [
            this.makeRuntimeEvent('bootstrap', this.localeText('Plan created', '已创建任务流程'), {
                detail: {
                    title: plan.title,
                    stepCount: plan.steps.length,
                },
            }),
        ];
        await this.persistRuntimeState('streaming');
    }

    async applyModelPlan(plan: PlanCard): Promise<PlanCard> {
        if (this.planCard?.activity?.some((event) => [
            'tool_started',
            'tool_completed',
            'tool_failed',
            'answer_started',
            'answer_completed',
            'runtime_error',
        ].includes(event.type))) {
            return this.clonePlan(this.planCard);
        }
        if (!this.planCard) {
            this.planCard = this.clonePlan(plan);
        } else {
            this.planCard = this.mergePlanCard(this.planCard, plan);
        }
        this.planCard.activity = this.appendRuntimeEvent(
            this.planCard.activity,
            this.makeRuntimeEvent('plan_created', this.localeText('Plan updated from model', '已用模型计划更新任务卡'))
        );
        await this.persistRuntimeState('streaming');
        return this.clonePlan(this.planCard);
    }

    async markPlanPhase(message: string) {
        if (!this.planCard) return;
        const next = this.clonePlan(this.planCard);
        const step = next.steps.find((item) => item.status === 'in_progress')
            || next.steps.find((item) => item.status === 'pending')
            || next.steps[next.steps.length - 1];
        if (!step) return;
        next.currentStepId = step.id;
        next.status = next.steps.some((item) => item.status === 'in_progress') ? 'in_progress' : next.status;
        next.activity = this.appendRuntimeEvent(
            next.activity,
            this.makeRuntimeEvent(
                this.isCompletionLike(message) ? 'analysis_completed' : 'analysis_started',
                message,
                { stepId: step.id },
            ),
        );
        await this.persistPlanCard(next);
    }

    async setRuntimeState(state: PlanRuntimeState | undefined, summary?: string) {
        if (!this.planCard) return;
        const next = this.clonePlan(this.planCard);
        next.runtimeState = state;
        if (summary) {
            next.activity = this.appendRuntimeEvent(
                next.activity,
                this.makeRuntimeEvent('runtime_note', summary, {
                    status: next.status === 'failed' ? 'failed' : 'in_progress',
                    detail: state ? { runtimeState: state } : undefined,
                }),
            );
        }
        await this.persistPlanCard(next);
    }

    async ensurePlanStep(step: PlanStep) {
        if (!this.planCard) return;
        const next = this.clonePlan(this.planCard);
        if (next.steps.some((item) => item.id === step.id)) return;
        next.steps = orderPlanSteps([...next.steps, { ...step, executions: step.executions || [] }]);
        next.activity = this.appendRuntimeEvent(
            next.activity,
            this.makeRuntimeEvent('step_added', this.localeText(`Added step: ${step.title}`, `已添加步骤：${step.title}`), {
                stepId: step.id,
                status: step.status,
            }),
        );
        await this.persistPlanCard(next);
    }

    async focusPlanStep(stepId: string, feedback?: string) {
        if (!this.planCard) return;
        const next = this.clonePlan(this.planCard);
        const step = next.steps.find((item) => item.id === stepId);
        if (!step) return;
        if (step.status === 'pending') {
            step.status = 'in_progress';
            step.startedAt ||= new Date().toISOString();
        }
        void feedback;
        next.currentStepId = step.id;
        next.status = 'in_progress';
        await this.persistPlanCard(next);
    }

    async noteToolSelected(call: OrchestratorToolCall, step?: PlanStep) {
        if (step) {
            await this.ensurePlanStep(step);
        }
        if (!this.planCard) return;
        const next = this.clonePlan(this.planCard);
        const targetStep = step
            ? next.steps.find((item) => item.id === step.id)
            : this.resolveStepForTool(next, call.name);
        next.activity = this.appendRuntimeEvent(
            next.activity,
            this.makeRuntimeEvent('tool_selected', this.localeText(
                `Selected action: ${describeToolAction(call.name, this.getLocale())}`,
                `已选择动作：${describeToolAction(call.name, this.getLocale())}`
            ), {
                stepId: targetStep?.id,
                toolName: call.name,
                detail: { arguments: call.arguments },
            }),
        );
        await this.persistPlanCard(next);
    }

    async markPlanStepStarted(call: OrchestratorToolCall, step?: PlanStep) {
        if (!this.planCard) return;
        const next = this.clonePlan(this.planCard);
        const targetStep = step
            ? next.steps.find((item) => item.id === step.id)
            : this.resolveStepForTool(next, call.name);
        if (!targetStep && step) {
            next.steps = [...next.steps, { ...step, executions: step.executions || [] }];
        }
        const resolvedStep = targetStep
            || (step ? next.steps.find((item) => item.id === step.id) : undefined)
            || this.resolveStepForTool(next, call.name);
        if (!resolvedStep) return;
        const now = new Date().toISOString();
        const execution: PlanStepExecution = {
            id: call.id || randomUUID(),
            toolName: call.name,
            status: 'in_progress',
            summary: this.localeText(
                `Running: ${describeToolAction(call.name, this.getLocale())}`,
                `正在执行：${describeToolAction(call.name, this.getLocale())}`
            ),
            startedAt: now,
        };
        resolvedStep.status = 'in_progress';
        resolvedStep.startedAt ||= now;
        resolvedStep.executions = [...(resolvedStep.executions || []), execution];
        next.status = 'in_progress';
        next.currentStepId = resolvedStep.id;
        next.activity = this.appendRuntimeEvent(next.activity, this.makeRuntimeEvent('tool_started', execution.summary, {
            stepId: resolvedStep.id,
            toolName: call.name,
            detail: {
                arguments: call.arguments,
            },
            status: 'in_progress',
        }));
        await this.persistPlanCard(next);
    }

    async markAnswerStarted(step?: PlanStep) {
        if (step) {
            await this.ensurePlanStep(step);
        }
        if (!this.planCard) return;
        const next = this.clonePlan(this.planCard);
        const targetStep = step
            ? next.steps.find((item) => item.id === step.id)
            : next.steps.find((item) => item.id === 'step-summary');
        if (targetStep) {
            targetStep.status = 'in_progress';
            targetStep.startedAt ||= new Date().toISOString();
            next.currentStepId = targetStep.id;
        }
        next.status = 'in_progress';
        next.activity = this.appendRuntimeEvent(next.activity, this.makeRuntimeEvent('answer_started', this.localeText('Writing the answer', '正在生成回答'), {
            stepId: targetStep?.id,
            status: 'in_progress',
        }));
        await this.persistPlanCard(next);
    }

    async recordToolResult(result: OrchestratorToolResult) {
        this.toolResults.push(result);
        try {
            await this.markPlanStepFinished(result);

            const toolCitations = this.extractToolCitations(result.result);
            if (toolCitations.length > 0) {
                this.pushCitation(toolCitations);
            }

            const existingTrace = this.assistantData.toolTrace || {};
            const existingCalls = Array.isArray(existingTrace.toolCalls) ? existingTrace.toolCalls : [];
            const normalizedResult = (() => {
                if (result.result !== undefined) {
                    if (!result.ok && result.error && typeof result.result === 'object' && result.result !== null && !Array.isArray(result.result)) {
                        return {
                            ...(result.result as Record<string, any>),
                            error: (result.result as Record<string, any>).error || result.error,
                        };
                    }
                    return result.result;
                }
                return result.ok ? null : { error: result.error || 'tool execution failed' };
            })();
            const toolTrace = {
                mode: 'execution',
                skillVersion: 'exec',
                ...existingTrace,
                toolCalls: [
                    ...existingCalls,
                    {
                        tool: result.name,
                        args: result.arguments || {},
                        status: result.ok ? 'success' : 'error',
                        result: normalizedResult,
                        error: result.error,
                        finishedAt: new Date().toISOString(),
                    },
                ],
            };
            const data: Record<string, any> = {
                ...this.assistantData,
                toolTrace,
                orchestrationToolResults: [...(this.assistantData.orchestrationToolResults || []), result],
            };
            const liveDataPatch: Record<string, any> = {
                toolTrace: data.toolTrace,
                orchestrationToolResults: data.orchestrationToolResults,
            };
            const renderContract = extractRenderContract(normalizedResult);
            if (renderContract) {
                data.renderContracts = mergeRenderContracts(this.assistantData.renderContracts || [], renderContract);
                liveDataPatch.renderContracts = data.renderContracts;
            }
            const nextPolymarketSelection = extractPolymarketSelectionState(result.name, normalizedResult);
            if (nextPolymarketSelection) {
                data.polymarketSelection = mergePolymarketSelectionState(
                    this.assistantData.polymarketSelection || null,
                    nextPolymarketSelection,
                );
                liveDataPatch.polymarketSelection = data.polymarketSelection;
            }
            this.assistantData = data;
            await chatRepo.updateMessage(this.params.assistantMessageId, { data, status: 'streaming' });
            this.broadcastAssistantDataPatch(liveDataPatch);
            await this.persistToolSideEffects(result);
        } catch (error: any) {
            logger.warn(LogCode.DB_TRANSACTION_FAILED, 'ChatStreamBroker: failed to record tool result', {
                messageId: this.params.assistantMessageId,
                error: error?.message || String(error),
            });
        }
    }

    getUsage() {
        return this.usage;
    }

    getCitations() {
        return [...this.citations];
    }

    getToolResults() {
        return [...this.toolResults];
    }

    getContent() {
        return this.content;
    }

    getProviderNativeEvidence(): ProviderNativeEvidenceSnapshot[] {
        return Array.isArray(this.assistantData.providerNativeEvidence)
            ? [...this.assistantData.providerNativeEvidence]
            : [];
    }

    async recordProviderNativeEvidence(snapshot: ProviderNativeEvidenceSnapshot) {
        const existing = this.getProviderNativeEvidence();
        const merged = mergeProviderNativeEvidence(existing, snapshot);
        this.assistantData = {
            ...this.assistantData,
            providerNativeEvidence: merged,
        };
        this.broadcastAssistantDataPatch({
            providerNativeEvidence: merged,
        });
        await this.persistRuntimeState('streaming');
    }

    async complete(overrides?: { content?: string }) {
        if (typeof overrides?.content === 'string') {
            this.content = stripLeadingInternalScaffold(overrides.content);
        } else {
            const bufferedTail = this.contentSuppressor.flush();
            if (bufferedTail) {
                this.content += bufferedTail;
                if (this.params.userId) {
                    chatWS.broadcastToUser(this.params.userId, {
                        type: 'chunk',
                        sessionId: this.params.sessionId,
                        data: { messageId: this.params.assistantMessageId, content: bufferedTail },
                    });
                }
            }
        }
        this.content = stripLeadingInternalScaffold(this.content);
        await this.completePlanCard();
        await chatRepo.updateMessage(this.params.assistantMessageId, {
            content: this.content,
            reasoning_content: this.reasoning,
            citations: this.citations,
            usage: this.usage || undefined,
            status: 'complete',
        });
        if (this.params.userId) {
            chatWS.broadcastToUser(this.params.userId, {
                type: 'message_complete',
                sessionId: this.params.sessionId,
                data: {
                    messageId: this.params.assistantMessageId,
                    taskId: this.params.taskId,
                    usage: this.usage || undefined,
                    citations: this.citations,
                },
            });
        }
    }

    async fail(message: string, options?: { replaceContent?: boolean; clearReasoning?: boolean }) {
        if (options?.replaceContent) {
            this.content = message;
            if (options.clearReasoning) {
                this.reasoning = '';
                this.rawReasoning = '';
            }
        } else {
            const bufferedTail = this.contentSuppressor.flush();
            if (bufferedTail) {
                this.content += bufferedTail;
            }
            this.content = stripLeadingInternalScaffold(this.content);
        }
        await this.markPlanFailed(message);
        try {
            await chatRepo.updateMessage(this.params.assistantMessageId, {
                content: this.content || message,
                reasoning_content: this.reasoning,
                citations: this.citations,
                usage: this.usage || undefined,
                status: 'error',
            });
        } catch (error: any) {
            logger.warn(LogCode.DB_TRANSACTION_FAILED, 'ChatStreamBroker: failed to persist error state for assistant message', {
                messageId: this.params.assistantMessageId,
                error: error?.message || String(error),
            });
        }
        if (this.params.userId) {
            chatWS.broadcastToUser(this.params.userId, {
                type: 'error',
                sessionId: this.params.sessionId,
                data: {
                    messageId: this.params.assistantMessageId,
                    taskId: this.params.taskId,
                    error: message,
                    citations: this.citations,
                    usage: this.usage || undefined,
                },
            });
            chatWS.broadcastToUser(this.params.userId, {
                type: 'message_complete',
                sessionId: this.params.sessionId,
                data: {
                    messageId: this.params.assistantMessageId,
                    taskId: this.params.taskId,
                    usage: this.usage || undefined,
                    citations: this.citations,
                },
            });
        }
    }

    private async persistStreaming() {
        const now = Date.now();
        if (now - this.lastPersistMs < 1000) return;
        this.lastPersistMs = now;
        await chatRepo.updateMessage(this.params.assistantMessageId, {
            content: this.content,
            reasoning_content: this.reasoning,
            data: this.assistantData,
            status: 'streaming',
        });
    }

    private async persistToolSideEffects(result: OrchestratorToolResult) {
        const rawResult = result.result;
        const clientAction = this.resolveClientAction(result.name, rawResult);
        if (!clientAction) return;

        if (this.params.userId) {
            chatWS.broadcastToUser(this.params.userId, {
                type: 'client_action',
                sessionId: this.params.sessionId,
                data: {
                    message_id: this.params.assistantMessageId,
                    targetMessageId: this.params.assistantMessageId,
                    action: clientAction,
                },
            });
        }

        let dbMessageType = 'text';
        if (clientAction.type === 'show_chart_card') dbMessageType = 'chart-card';
        else if (clientAction.type === 'show_strategy_card') dbMessageType = 'strategy-card';
        else if (clientAction.type === 'show_token_card') dbMessageType = 'token-card';
        else if (clientAction.type === 'show_polymarket_card') dbMessageType = 'polymarket-embed';
        else if (clientAction.type === 'show_transaction_status_card' || clientAction.type === 'show_cross_chain_status_card') {
            dbMessageType = 'transaction-status-card';
        }

        const actionData = clientAction.data || clientAction.payload;
        const hasDedicatedTxMessage = dbMessageType === 'transaction-status-card'
            && rawResult?.messageId
            && rawResult.messageId !== this.params.assistantMessageId;
        if (!hasDedicatedTxMessage) {
            this.assistantData = {
                ...this.assistantData,
                ...(actionData || {}),
            };
            await chatRepo.updateMessage(this.params.assistantMessageId, {
                type: dbMessageType,
                data: this.assistantData,
                transactionStatus: dbMessageType === 'transaction-status-card' ? actionData?.status : undefined,
                transactionHash: dbMessageType === 'transaction-status-card' ? actionData?.txHash : undefined,
            });
        }

        const txMessageId = rawResult?.messageId;
        if (txMessageId && this.params.userId) {
            try {
                const txMessage = await chatRepo.getMessage(txMessageId);
                const txData = txMessage?.data || actionData || {};
                const actionType = clientAction.type === 'show_cross_chain_status_card'
                    ? 'show_cross_chain_status_card'
                    : 'show_transaction_status_card';
                chatWS.broadcastToUser(this.params.userId, {
                    type: 'client_action',
                    sessionId: this.params.sessionId,
                    data: {
                        message_id: this.params.assistantMessageId,
                        targetMessageId: txMessageId,
                        action: {
                            type: actionType,
                            data: txData,
                        },
                    },
                });
            } catch (error: any) {
                logger.warn(LogCode.WS_ERROR, 'ChatStreamBroker: failed to rebroadcast dedicated transaction card', {
                    assistantMessageId: this.params.assistantMessageId,
                    txMessageId,
                    error: error?.message || String(error),
                });
            }
        }
    }

    private resolveClientAction(toolName: string, result: any): any {
        if (result && typeof result === 'object' && result.__client_action) {
            return result.__client_action;
        }
        if (toolName === 'create_copy_trade_config' && result) {
            return { type: 'show_strategy_card', data: result };
        }
        if (toolName === 'get_token_chart' && result) {
            return { type: 'show_chart_card', data: result };
        }
        return null;
    }

    private async markPlanStepFinished(result: OrchestratorToolResult) {
        if (!this.planCard) return;
        const next = this.clonePlan(this.planCard);
        const step = this.resolveStepForResult(next, result);
        if (!step) return;

        const now = new Date().toISOString();
        const executions = [...(step.executions || [])];
        const matchingIndex = executions.findIndex((item) => item.id === result.id);
        const inProgressIndex = matchingIndex >= 0
            ? matchingIndex
            : findLastIndex(executions, (item) => item.toolName === result.name && item.status === 'in_progress');
        const collapsedIndex = shouldCollapseRuntimeResult(result, executions);

        if (collapsedIndex >= 0) {
            const existingExecution = executions[collapsedIndex];
            executions[collapsedIndex] = {
                ...existingExecution,
                detail: mergeCollapsedExecutionDetail(existingExecution.detail, result),
            };
            step.executions = executions;
            await this.persistPlanCard(next);
            return;
        }

        const execution: PlanStepExecution = inProgressIndex >= 0
            ? {
                ...executions[inProgressIndex],
                status: result.ok ? 'completed' : 'failed',
                summary: result.ok
                    ? this.localeText(
                        `Completed: ${describeToolAction(result.name, this.getLocale())}`,
                        `已完成：${describeToolAction(result.name, this.getLocale())}`
                    )
                    : this.localeText(
                        `Failed: ${describeToolAction(result.name, this.getLocale())}`,
                        `执行失败：${describeToolAction(result.name, this.getLocale())}`
                    ),
                detail: buildExecutionDetail(result),
                completedAt: now,
            }
            : {
                id: result.id || randomUUID(),
                toolName: result.name,
                status: result.ok ? 'completed' : 'failed',
                summary: result.ok
                    ? this.localeText(
                        `Completed: ${describeToolAction(result.name, this.getLocale())}`,
                        `已完成：${describeToolAction(result.name, this.getLocale())}`
                    )
                    : this.localeText(
                        `Failed: ${describeToolAction(result.name, this.getLocale())}`,
                        `执行失败：${describeToolAction(result.name, this.getLocale())}`
                    ),
                detail: buildExecutionDetail(result),
                startedAt: now,
                completedAt: now,
            };

        if (inProgressIndex >= 0) {
            executions[inProgressIndex] = execution;
        } else {
            executions.push(execution);
        }

        step.executions = executions;
        step.status = result.ok ? 'completed' : 'failed';
        step.completedAt = now;
        step.feedback = execution.summary;

        next.currentStepId = next.steps.find((item) => item.status === 'pending')?.id;
        next.status = next.steps.every((item) => item.status === 'completed')
            ? 'completed'
            : next.steps.some((item) => item.status === 'failed')
                ? 'failed'
                : 'in_progress';
        next.runtimeState = result.ok ? undefined : next.runtimeState;
        next.activity = this.appendRuntimeEvent(next.activity, this.makeRuntimeEvent(
            result.ok ? 'tool_completed' : 'tool_failed',
            execution.summary,
            {
                stepId: step.id,
                toolName: result.name,
                detail: execution.detail,
                status: execution.status,
            },
        ));

        await this.persistPlanCard(next);
    }

    private async completePlanCard() {
        if (!this.planCard) return;
        const next = this.clonePlan(this.planCard);
        const hadFailedSteps = next.steps.some((step) => step.status === 'failed');
        next.steps = next.steps.map((step) => {
            if (step.status !== 'failed') {
                return {
                    ...step,
                    status: 'completed' as const,
                    feedback: this.isCompletionLike(step.feedback)
                        ? step.feedback
                        : (step.feedback || this.localeText('Completed', '已完成')),
                    completedAt: step.completedAt || new Date().toISOString(),
                };
            }
            return step;
        });
        next.currentStepId = undefined;
        next.runtimeState = undefined;
        // `complete()` means the task reached a controlled terminal answer.
        // Keep failed step details for debugging, but do not brand the whole plan as failed.
        next.status = 'completed';
        next.activity = this.appendRuntimeEvent(next.activity, this.makeRuntimeEvent(
            'answer_completed',
            hadFailedSteps
                ? this.localeText('Completed with handled issues', '已完成，并处理了执行问题')
                : this.localeText('Completed the final answer', '已完成最终回答')
        ));
        await this.persistPlanCard(next);
    }

    private async markPlanFailed(message: string) {
        if (!this.planCard) return;
        const next = this.clonePlan(this.planCard);
        const now = new Date().toISOString();
        const active = next.steps.find((step) => step.status === 'in_progress')
            || next.steps.find((step) => step.status === 'pending');
        if (active) {
            active.status = 'failed';
            active.completedAt = now;
            active.feedback = message;
            active.executions = [
                ...(active.executions || []),
                {
                    id: randomUUID(),
                    status: 'failed',
                    summary: message,
                    detail: { error: message },
                    startedAt: now,
                    completedAt: now,
                },
            ];
        }
        next.steps = terminalizeRemainingPlanStepsAfterFailure(
            next.steps,
            active?.id,
            now,
            this.localeText(
                'Not completed because the task stopped after an earlier error.',
                '由于任务在更早步骤失败，此步骤未继续执行。'
            ),
        );
        next.status = 'failed';
        next.runtimeState = 'blocked_on_missing_evidence';
        next.currentStepId = undefined;
        next.activity = this.appendRuntimeEvent(next.activity, this.makeRuntimeEvent('runtime_error', message, {
            detail: { error: message },
            status: 'failed',
        }));
        await this.persistPlanCard(next);
    }

    private resolveStepForTool(plan: PlanCard, toolName: string): PlanStep | undefined {
        return plan.steps.find((step) => step.status === 'in_progress' && (step.preferredTools || []).includes(toolName))
            || plan.steps.find((step) => step.status === 'pending' && (step.preferredTools || []).includes(toolName))
            || plan.steps.find((step) => step.status === 'in_progress')
            || plan.steps.find((step) => step.status === 'pending')
            || plan.steps.find((step) => (step.preferredTools || []).includes(toolName));
    }

    private resolveStepForResult(plan: PlanCard, result: OrchestratorToolResult): PlanStep | undefined {
        return plan.steps.find((step) => (step.executions || []).some((item) => item.id === result.id))
            || this.resolveStepForTool(plan, result.name);
    }

    private async persistPlanCard(plan: PlanCard) {
        this.planCard = this.clonePlan(plan);
        await this.persistRuntimeState();
    }

    private async persistRuntimeState(status: 'streaming' | 'complete' | 'error' = 'streaming') {
        this.assistantData = {
            ...this.assistantData,
            agentRuntime: {
                plan: this.planCard,
                providerNativeEvidence: this.getProviderNativeEvidence(),
            },
        };
        await chatRepo.updateMessage(this.params.assistantMessageId, {
            data: this.assistantData,
            status,
        });
        this.broadcastAgentRuntime();
    }

    private broadcastAssistantDataPatch(patch: Record<string, any>) {
        if (!this.params.userId) return;
        if (!patch || typeof patch !== 'object' || Object.keys(patch).length === 0) return;
        chatWS.broadcastToUser(this.params.userId, {
            type: 'client_action',
            sessionId: this.params.sessionId,
            data: {
                message_id: this.params.assistantMessageId,
                targetMessageId: this.params.assistantMessageId,
                action: {
                    type: 'update_message_data',
                    data: patch,
                },
            },
        });
    }

    private broadcastAgentRuntime() {
        if (!this.params.userId || !this.planCard) return;
        const latestEvent = this.planCard.activity?.[this.planCard.activity.length - 1] || null;
        const envelope: AgentRuntimeEnvelope = {
            kind: 'agent_runtime',
            scope: 'chat_task',
            messageId: this.params.assistantMessageId,
            planId: this.planCard.planId,
            snapshot: {
                plan: this.planCard,
            },
            event: latestEvent,
        };
        chatWS.broadcastToUser(this.params.userId, {
            type: 'agent_runtime',
            sessionId: this.params.sessionId,
            data: envelope,
        });
    }

    private extractToolCitations(result: any): any[] {
        if (!result || typeof result !== 'object') return [];
        const collected: any[] = [];
        for (const key of ['citations', 'sources', 'references']) {
            if (Array.isArray(result[key])) collected.push(...result[key]);
        }
        return collected;
    }

    private buildCitationKey(citation: any): string | null {
        if (!citation) return null;
        if (typeof citation === 'string') return citation;
        if (typeof citation === 'object') {
            if (typeof citation.url === 'string') return citation.url;
            try {
                return JSON.stringify(citation);
            } catch {
                return null;
            }
        }
        return null;
    }

    private clonePlan(plan: PlanCard): PlanCard {
        return JSON.parse(JSON.stringify(plan)) as PlanCard;
    }

    private mergePlanCard(current: PlanCard, incoming: PlanCard): PlanCard {
        const currentStepMap = new Map(current.steps.map((step) => [step.id, step]));
        const incomingSteps = incoming.steps.map((step) => {
            const existing = currentStepMap.get(step.id);
            return existing
                ? {
                    ...existing,
                    title: step.title,
                    description: step.description,
                    preferredTools: step.preferredTools || existing.preferredTools,
                }
                : step;
        });
        const preservedSteps = current.steps.filter((step) => !incoming.steps.some((incomingStep) => incomingStep.id === step.id));
        const mergedSteps = orderPlanSteps([...incomingSteps, ...preservedSteps]);
        return {
            ...current,
            title: incoming.title || current.title,
            summary: incoming.summary || current.summary,
            locale: incoming.locale || current.locale,
            steps: mergedSteps,
        };
    }

    private makeRuntimeEvent(
        type: AgentRuntimeEventType,
        summary: string,
        extras?: {
            stepId?: string;
            toolName?: string;
            detail?: any;
            status?: PlanStepStatus;
        },
    ): AgentRuntimeEvent {
        return {
            id: randomUUID(),
            type,
            summary,
            stepId: extras?.stepId,
            toolName: extras?.toolName,
            detail: extras?.detail,
            status: extras?.status,
            createdAt: new Date().toISOString(),
        };
    }

    private appendRuntimeEvent(activity: AgentRuntimeEvent[] | undefined, event: AgentRuntimeEvent): AgentRuntimeEvent[] {
        const next = [...(activity || []), event];
        return next.slice(-24);
    }

    private getLocale(): 'en' | 'zh' {
        return this.planCard?.locale === 'zh' ? 'zh' : 'en';
    }

    private localeText(en: string, zh: string): string {
        return this.getLocale() === 'zh' ? zh : en;
    }

    private isCompletionLike(text: string | undefined): boolean {
        const value = String(text || '').toLowerCase();
        return value.includes('completed') || value.includes('done') || value.includes('已完成');
    }
}

function extractRenderContract(result: any): any | null {
    if (!result || typeof result !== 'object') return null;
    const renderContract = (result as Record<string, any>).renderContract;
    return renderContract && typeof renderContract === 'object' ? renderContract : null;
}

function mergeRenderContracts(existing: any[], next: any) {
    const contracts = Array.isArray(existing) ? [...existing] : [];
    const nextId = String(next?.id || '');
    if (!nextId) return [...contracts, next];
    const index = contracts.findIndex((item) => String(item?.id || '') === nextId);
    if (index >= 0) {
        contracts[index] = next;
        return contracts;
    }
    return [...contracts, next];
}

function mergeProviderNativeEvidence(
    existing: ProviderNativeEvidenceSnapshot[],
    incoming: ProviderNativeEvidenceSnapshot,
): ProviderNativeEvidenceSnapshot[] {
    const merged = [...existing];
    const duplicate = merged.find((item) =>
        item.round === incoming.round
        && item.querySummary === incoming.querySummary
        && JSON.stringify(item.sourceTypes) === JSON.stringify(incoming.sourceTypes)
    );
    if (duplicate) {
        duplicate.results = mergeProviderNativeResults(duplicate.results || [], incoming.results || []);
        duplicate.retrievedAt = incoming.retrievedAt;
        return merged;
    }
    merged.push({
        ...incoming,
        results: mergeProviderNativeResults([], incoming.results || []),
    });
    return merged;
}

function mergeProviderNativeResults(existing: ProviderNativeEvidenceSnapshot['results'], incoming: ProviderNativeEvidenceSnapshot['results']) {
    const seen = new Set(existing.map((item) => `${item.sourceType}:${item.url || ''}:${item.snippet || ''}:${item.title || ''}`));
    const merged = [...existing];
    for (const item of incoming) {
        const key = `${item.sourceType}:${item.url || ''}:${item.snippet || ''}:${item.title || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
    }
    return merged;
}

function describeToolAction(toolName: string, locale: 'en' | 'zh' = 'en'): string {
    const labels: Record<string, { en: string; zh: string }> = {
        external_web_search: { en: 'check web and social context', zh: '获取网页与社交上下文' },
        get_token_info: { en: 'inspect token info', zh: '查询代币信息' },
        get_early_buyers: { en: 'find early buyers', zh: '查询早期买家' },
        analyze_creator: { en: 'inspect creator evidence', zh: '分析创建者地址' },
        get_wallet_info: { en: 'inspect wallet info', zh: '查询钱包信息' },
        get_market_overview: { en: 'fetch market overview', zh: '获取市场概览' },
        get_economic_calendar: { en: 'fetch economic calendar', zh: '获取经济日历' },
        get_polymarket_market_overview: { en: 'fetch Polymarket overview', zh: '获取 Polymarket 概览' },
        get_polymarket_coin_updown_markets: { en: 'find 5-minute coin markets', zh: '查找 5 分钟代币盘口' },
    };
    return labels[toolName]?.[locale] || toolName.replace(/_/g, ' ');
}

function buildExecutionDetail(result: OrchestratorToolResult) {
    return result.ok
        ? {
            tool: result.name,
            arguments: result.arguments,
            result: compactDetail(result.result),
            metadata: result.metadata,
        }
        : {
            tool: result.name,
            arguments: result.arguments,
            error: result.error || 'tool execution failed',
            metadata: result.metadata,
        };
}

export function shouldCollapseRuntimeResult(result: OrchestratorToolResult, executions: PlanStepExecution[]): number {
    const source = String(result.metadata?.source || '').trim();
    if (!['repeat_cache', 'tool_budget_guard'].includes(source)) {
        return -1;
    }
    return findLastIndex(
        executions,
        (item) => item.toolName === result.name && item.status !== 'in_progress',
    );
}

export function mergeCollapsedExecutionDetail(existingDetail: any, result: OrchestratorToolResult) {
    const source = String(result.metadata?.source || '').trim();
    const current = existingDetail && typeof existingDetail === 'object' ? { ...existingDetail } : {};
    const collapsed = current.collapsed && typeof current.collapsed === 'object' ? { ...current.collapsed } : {};
    const countKey = source === 'tool_budget_guard' ? 'budgetGuardCount' : 'repeatCacheCount';
    const noteKey = source === 'tool_budget_guard' ? 'lastBudgetGuard' : 'lastRepeatCache';

    collapsed[countKey] = Number(collapsed[countKey] || 0) + 1;
    collapsed[noteKey] = compactDetail({
        tool: result.name,
        arguments: result.arguments,
        error: result.error,
        metadata: result.metadata,
    });

    return {
        ...current,
        collapsed,
    };
}

export function mergeOrchestratorUsage(
    existing: OrchestratorUsage | null | undefined,
    incoming: OrchestratorUsage | null | undefined,
): OrchestratorUsage | null {
    if (!existing && !incoming) return null;
    const promptTokens = Number(existing?.prompt_tokens || 0) + Number(incoming?.prompt_tokens || 0);
    const completionTokens = Number(existing?.completion_tokens || 0) + Number(incoming?.completion_tokens || 0);
    const reasoningTokens = getUsageReasoningTokens(existing) + getUsageReasoningTokens(incoming);
    const reportedTotal = Number(existing?.total_tokens || 0) + Number(incoming?.total_tokens || 0);
    const computedTotal = promptTokens + completionTokens + reasoningTokens;
    const costInUsdTicks = Number(existing?.cost_in_usd_ticks || 0) + Number(incoming?.cost_in_usd_ticks || 0);
    const promptCacheHitTokens = Number(existing?.prompt_cache_hit_tokens || 0) + Number(incoming?.prompt_cache_hit_tokens || 0);
    const promptCacheMissTokens = Number(existing?.prompt_cache_miss_tokens || 0) + Number(incoming?.prompt_cache_miss_tokens || 0);
    const promptTokensDetails = mergeUsageDetails(existing?.prompt_tokens_details, incoming?.prompt_tokens_details);
    const completionTokensDetails = mergeUsageDetails(existing?.completion_tokens_details, incoming?.completion_tokens_details);

    return {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: Math.max(reportedTotal, computedTotal),
        reasoning_tokens: reasoningTokens > 0 ? reasoningTokens : undefined,
        cost_in_usd_ticks: costInUsdTicks > 0 ? costInUsdTicks : undefined,
        prompt_cache_hit_tokens: promptCacheHitTokens > 0 ? promptCacheHitTokens : undefined,
        prompt_cache_miss_tokens: promptCacheMissTokens > 0 ? promptCacheMissTokens : undefined,
        prompt_tokens_details: promptTokensDetails,
        completion_tokens_details: completionTokensDetails,
    };
}

function getUsageReasoningTokens(usage: OrchestratorUsage | null | undefined): number {
    if (!usage) return 0;
    return Number(usage.reasoning_tokens || usage.completion_tokens_details?.reasoning_tokens || 0);
}

function mergeUsageDetails<T extends Record<string, any> | null | undefined>(
    existing: T,
    incoming: T,
): T | undefined {
    if (!existing && !incoming) return undefined;
    const keys = new Set<string>([
        ...Object.keys(existing || {}),
        ...Object.keys(incoming || {}),
    ]);
    const merged: Record<string, any> = {};
    for (const key of keys) {
        const left = existing?.[key];
        const right = incoming?.[key];
        if (typeof left === 'number' || typeof right === 'number') {
            merged[key] = Number(left || 0) + Number(right || 0);
            continue;
        }
        merged[key] = right ?? left;
    }
    return merged as T;
}

export function terminalizeRemainingPlanStepsAfterFailure(
    steps: PlanStep[],
    activeStepId: string | undefined,
    completedAt: string,
    fallbackFeedback: string,
): PlanStep[] {
    return steps.map((step) => {
        if (step.id === activeStepId) return step;
        if (step.status !== 'pending' && step.status !== 'in_progress') return step;
        return {
            ...step,
            status: 'failed',
            completedAt,
            feedback: step.feedback || fallbackFeedback,
        };
    });
}

function findLastIndex<T>(items: T[], predicate: (value: T) => boolean): number {
    for (let index = items.length - 1; index >= 0; index -= 1) {
        if (predicate(items[index])) return index;
    }
    return -1;
}

function compactDetail(value: any, depth = 0): any {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
        return value.length > 3000 ? `${value.slice(0, 3000)}...` : value;
    }
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) {
        const limited = value.slice(0, 8).map((item) => compactDetail(item, depth + 1));
        return value.length > 8 ? [...limited, `... ${value.length - 8} more item(s)`] : limited;
    }
    if (depth >= 2) {
        const summary = Object.fromEntries(Object.entries(value).slice(0, 10));
        return Object.keys(value).length > 10
            ? { ...summary, _truncated: `${Object.keys(value).length - 10} more field(s)` }
            : summary;
    }
    const entries = Object.entries(value).slice(0, 12).map(([key, item]) => [key, compactDetail(item, depth + 1)]);
    const next = Object.fromEntries(entries);
    if (Object.keys(value).length > 12) {
        next._truncated = `${Object.keys(value).length - 12} more field(s)`;
    }
    return next;
}
