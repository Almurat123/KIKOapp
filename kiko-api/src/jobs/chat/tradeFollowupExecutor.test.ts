import test from 'node:test';
import assert from 'node:assert/strict';

import { executeDirectTradeFollowup } from './tradeFollowupExecutor.js';
import { chatWS } from '../../services/chatWebSocket.js';

test('swap confirmation accepts prepare_swap_transaction as the confirmation anchor', async () => {
    const completed: Array<{ content?: string }> = [];
    const executed: any[] = [];
    const now = new Date().toISOString();

    const snapshot: any = {
        sessionId: 'session-1',
        taskId: 'task-1',
        lastUserMessage: 'confirm',
        normalizedIntent: {
            intent: 'swap',
            taskMode: 'confirm',
        },
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
    assert.match(String(completed[0]?.content || ''), /Trade submitted/);
});

test('swap confirmation still executes when the prior quote timestamp is old', async () => {
    const completed: Array<{ content?: string }> = [];
    const executed: any[] = [];

    const snapshot: any = {
        sessionId: 'session-1',
        taskId: 'task-1',
        lastUserMessage: 'yes 0.001 bnb to benji',
        normalizedIntent: {
            intent: 'swap',
            taskMode: 'confirm',
        },
        confirmationState: {
            kind: 'swap_confirmation',
            swap: {
                tokenIn: 'BNB',
                tokenOut: '0x0bc61768132aa1484e2b09301284b7def78a4444',
                amountIn: '0.001',
                chainId: 56,
            },
        },
        recentToolTrace: {
            messageId: 'assistant-1',
            toolCalls: [
                {
                    tool: 'simulate_swap',
                    status: 'success',
                    args: {
                        token_in: 'BNB',
                        token_out: '0x0bc61768132aa1484e2b09301284b7def78a4444',
                        amount_in: '0.001',
                        chain_id: 56,
                    },
                    result: {
                        finishedAt: '2026-03-26T13:04:13.000Z',
                    },
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
    assert.equal(result.toolResult?.ok, true);
    assert.match(String(completed[0]?.content || ''), /Trade submitted/);
});

test('non-confirm analysis turns do not execute from stale swap confirmation', async () => {
    const executed: any[] = [];
    const snapshot: any = {
        sessionId: 'session-1',
        taskId: 'task-1',
        lastUserMessage: '你能告诉我0x3e17ee3B1895dD1A7CF993A89769C5e029584444的早期购买者吗？',
        normalizedIntent: {
            intent: 'early_buyers',
            taskMode: 'analyze',
        },
        confirmationState: {
            kind: 'swap_confirmation',
            swap: {
                tokenIn: 'BNB',
                tokenOut: '0x3e17ee3B1895dD1A7CF993A89769C5e029584444',
                amountIn: '0.001',
                chainId: 56,
            },
        },
        recentToolTrace: {
            messageId: 'assistant-1',
            toolCalls: [
                {
                    tool: 'simulate_swap',
                    status: 'success',
                    args: {
                        token_in: 'BNB',
                        token_out: '0x3e17ee3B1895dD1A7CF993A89769C5e029584444',
                        amount_in: '0.001',
                        chain_id: 56,
                    },
                },
            ],
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
            complete: async () => undefined,
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
                };
            },
        } as any,
    });

    assert.equal(result.handled, false);
    assert.equal(executed.length, 0);
});

test('copy trade confirmation rebroadcasts strategy card in direct follow-up execution', async () => {
    const completed: Array<{ content?: string }> = [];
    const broadcasts: any[] = [];
    const originalBroadcast = chatWS.broadcastToUser;
    chatWS.broadcastToUser = ((userId: string, payload: any) => {
        broadcasts.push({ userId, payload });
    }) as any;

    try {
        const result = await executeDirectTradeFollowup({
            snapshot: {
                sessionId: 'session-1',
                taskId: 'task-1',
                lastUserMessage: 'confirm',
                normalizedIntent: {
                    intent: 'copy_trade',
                    taskMode: 'confirm',
                },
                confirmationState: {
                    kind: 'copy_trade_confirmation',
                    copyTrade: {
                        targetWallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
                        buyAmountUsd: 0.5,
                        chainId: 8453,
                        mirrorSell: true,
                        takeProfitPct: 50,
                        stopLossPct: 20,
                    },
                },
                policySnapshot: {
                    policyDecisionId: 'policy-1',
                },
            } as any,
            task: {
                sessionId: 'session-1',
                assistantMessageId: 'assistant-1',
                toolContext: {},
            },
            userId: 'user-1',
            broker: {
                complete: async (payload: { content?: string }) => {
                    completed.push(payload);
                },
                recordToolResult: async () => undefined,
            } as any,
            toolExecutionEngine: {
                execute: async (call: any) => ({
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments,
                    ok: true,
                    result: {
                        id: 'cfg-1',
                        summary: 'Copy trade created.',
                        targetWallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
                        buyAmountUsd: 0.5,
                        chainId: 8453,
                        status: 'active',
                    },
                    metadata: { source: 'test' },
                }),
            } as any,
        });

        assert.equal(result.handled, true);
        assert.equal(completed.length, 1);
        assert.ok(
            broadcasts.some((entry) =>
                entry.userId === 'user-1'
                && entry.payload?.type === 'client_action'
                && entry.payload?.data?.action?.type === 'show_strategy_card'
                && entry.payload?.data?.targetMessageId === 'assistant-1'
            ),
        );
    } finally {
        chatWS.broadcastToUser = originalBroadcast;
    }
});
