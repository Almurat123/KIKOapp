import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { ChatContextSnapshot } from './contracts.js';
import { buildProviderOptions, resolveProviderInfo } from './providerPolicyBuilder.js';
import { resolveNodeSkills } from './nodeSkillResolver.js';
import { assembleGenerationMessages, type GenerationMessage } from './nodePromptAssembler.js';
import { parseTradingIntent } from './tradingIntentResolver.js';
import type { ToolExecutionEngine } from './toolExecutionEngine.js';
import type { ChatStreamBroker } from './streamBroker.js';
import type { PythonGenerationClient } from './pythonGenerationClient.js';

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
    const tools = buildGenerationTools(params.snapshot.toolDefinitions, skillResolution.allowedTools);
    const providerOptions = buildProviderOptions(params.snapshot, providerInfo, params.snapshot.lastUserMessage);
    const messages: GenerationMessage[] = assembleGenerationMessages(
        params.snapshot,
        skillResolution.skillPrompts,
        providerInfo,
    );

    logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: starting generation loop', {
        sessionId: params.snapshot.sessionId,
        taskId: params.snapshot.taskId,
        provider: providerInfo.provider,
        skills: skillResolution.selectedSkills,
        allowedTools: skillResolution.allowedTools,
        toolCount: tools.length,
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

        const roundResult = await params.generationClient.generate({
            sessionId: params.snapshot.sessionId,
            taskId: params.snapshot.taskId,
            model: params.snapshot.model,
            messages,
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

        if (roundResult.toolCalls.length === 0) {
            logger.info(LogCode.AI_ORCHESTRATOR, 'NodeOrchestrator: generation loop complete', {
                sessionId: params.snapshot.sessionId,
                taskId: params.snapshot.taskId,
                round,
                contentLength: roundResult.text.length,
            });
            return;
        }

        messages.push({
            role: 'assistant',
            content: roundResult.text,
            ...(roundResult.toolCalls.length > 0 ? { tool_calls: roundResult.toolCalls.map(toAssistantToolCall) } : {}),
        });

        for (const call of roundResult.toolCalls) {
            if (params.shouldCancel && await params.shouldCancel()) {
                throw new Error('Task cancelled');
            }
            await params.onToolStatus?.(call.name);
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

function buildGenerationTools(toolDefinitions: Array<{ name: string; description: string; parameters: any }>, allowedTools: string[]) {
    const allowedSet = new Set(allowedTools);
    return (toolDefinitions || [])
        .filter((definition) => allowedSet.has(definition.name))
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
