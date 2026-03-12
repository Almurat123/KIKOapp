import * as chatRepo from '../../repositories/chatRepository.js';
import { chatWS } from '../../services/chatWebSocket.js';
import { LogCode } from '../../config/logRegistry.js';
import { logger } from '../../utils/logger.js';
import type { OrchestratorToolResult, OrchestratorUsage } from './contracts.js';

export class ChatStreamBroker {
    private content = '';
    private reasoning = '';
    private citations: any[] = [];
    private citationKeys = new Set<string>();
    private usage: OrchestratorUsage | null = null;
    private toolResults: OrchestratorToolResult[] = [];
    private lastPersistMs = 0;

    constructor(
        private readonly params: {
            userId: string | null;
            sessionId: string;
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
                role: 'assistant',
                model: this.params.model,
            },
        });
    }

    async pushText(text: string) {
        if (!text) return;
        this.content += text;
        if (this.params.userId) {
            chatWS.broadcastToUser(this.params.userId, {
                type: 'chunk',
                sessionId: this.params.sessionId,
                data: { messageId: this.params.assistantMessageId, content: text },
            });
        }
        await this.persistStreaming();
    }

    async pushReasoning(text: string) {
        if (!text) return;
        this.reasoning += text;
        await this.persistStreaming();
    }

    pushUsage(usage: OrchestratorUsage) {
        this.usage = usage;
        if (this.params.userId) {
            chatWS.broadcastToUser(this.params.userId, {
                type: 'usage',
                sessionId: this.params.sessionId,
                data: { messageId: this.params.assistantMessageId, usage },
            });
        }
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
    }

    async recordToolResult(result: OrchestratorToolResult) {
        this.toolResults.push(result);
        try {
            const toolCitations = this.extractToolCitations(result.result);
            if (toolCitations.length > 0) {
                this.pushCitation(toolCitations);
                if (this.params.userId) {
                    chatWS.broadcastToUser(this.params.userId, {
                        type: 'citations',
                        sessionId: this.params.sessionId,
                        data: {
                            message_id: this.params.assistantMessageId,
                            citations: toolCitations,
                        },
                    });
                }
            }
            const message = await chatRepo.getMessage(this.params.assistantMessageId);
            const existingTrace = message?.data?.toolTrace || {};
            const existingCalls = Array.isArray(existingTrace.toolCalls) ? existingTrace.toolCalls : [];
            const normalizedResult = result.ok ? (result.result ?? null) : { error: result.error || 'tool execution failed' };
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
            const data = {
                ...(message?.data || {}),
                toolTrace,
                orchestrationToolResults: [...((message?.data?.orchestrationToolResults) || []), result],
            };
            await chatRepo.updateMessage(this.params.assistantMessageId, { data, status: 'streaming' });
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

    getToolResults() {
        return [...this.toolResults];
    }

    getContent() {
        return this.content;
    }

    async complete(overrides?: { content?: string }) {
        if (typeof overrides?.content === 'string') {
            this.content = overrides.content;
        }
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
                data: { messageId: this.params.assistantMessageId },
            });
        }
    }

    async fail(message: string) {
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
                data: { messageId: this.params.assistantMessageId, error: message },
            });
            chatWS.broadcastToUser(this.params.userId, {
                type: 'message_complete',
                sessionId: this.params.sessionId,
                data: { messageId: this.params.assistantMessageId },
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
        else if (clientAction.type === 'show_transaction_status_card' || clientAction.type === 'show_cross_chain_status_card') {
            dbMessageType = 'transaction-status-card';
        }

        const actionData = clientAction.data || clientAction.payload;
        const hasDedicatedTxMessage = dbMessageType === 'transaction-status-card'
            && rawResult?.messageId
            && rawResult.messageId !== this.params.assistantMessageId;
        if (!hasDedicatedTxMessage) {
            await chatRepo.updateMessage(this.params.assistantMessageId, {
                type: dbMessageType,
                data: actionData,
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
}
