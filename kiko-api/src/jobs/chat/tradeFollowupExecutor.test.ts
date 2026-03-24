import test from 'node:test';
import assert from 'node:assert/strict';

import { executeDirectTradeFollowup } from './tradeFollowupExecutor.js';

test('swap confirmation accepts prepare_swap_transaction as the confirmation anchor', async () => {
    const completed: Array<{ content?: string }> = [];
    const executed: any[] = [];
    const now = new Date().toISOString();

    const snapshot: any = {
        sessionId: 'session-1',
        taskId: 'task-1',
        lastUserMessage: 'confirm',
        confirmationState: {
            kind: 'swap_confirmation',
            swap: {
                tokenIn: '0x8ac76a51cc950d982d68b83fe1ad97b32cd580d',
                tokenOut: 'BNB',
                amountIn: '0.065216073765713464',
                chainId: 56,
            },
        },
        recentToolTrace: {
            messageId: 'assistant-1',
            toolCalls: [
                {
                    tool: 'prepare_swap_transaction',
                    status: 'success',
                    args: {
                        token_in: '0x8ac76a51cc950d982d68b83fe1ad97b32cd580d',
                        token_out: 'BNB',
                        amount_in: '0.065216073765713464',
                        chain_id: 56,
                    },
                    result: {
                        finishedAt: now,
                    },
                    finishedAt: now,
                },
            ],
        },
        policySnapshot: {
            policyDecisionId: 'policy-1',
        },
    };

    const result = await executeDirectTradeFollowup({
        snapshot,
        task: {
            sessionId: 'session-1',
            assistantMessageId: 'assistant-1',
            toolContext: {
                toolConfig: {
                    customSlippage: '1.0',
                },
            },
        },
        userId: 'user-1',
        broker: {
            complete: async (payload: { content?: string }) => {
                completed.push(payload);
            },
            recordToolResult: async () => undefined,
        } as any,
        toolExecutionEngine: {
            execute: async (call: any) => {
                executed.push(call);
                return {
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments,
                    ok: true,
                    result: {
                        txHash: '0xabc',
                    },
                    metadata: { source: 'test' },
                };
            },
        } as any,
    });

    assert.equal(result.handled, true);
    assert.equal(executed.length, 1);
    assert.equal(executed[0]?.name, 'prepare_swap_transaction');
    assert.equal(completed.length, 1);
    assert.match(String(completed[0]?.content || ''), /Executed/);
});
