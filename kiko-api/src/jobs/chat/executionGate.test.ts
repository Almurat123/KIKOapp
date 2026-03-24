import test from 'node:test';
import assert from 'node:assert/strict';

import { checkMutationExecutionGate, computeConfirmationToken } from './executionGate.js';

test('prepare_swap_transaction can use a prior prepare_swap_transaction success as precheck evidence', () => {
    const now = new Date().toISOString();
    const args = {
        token_in: '0x8ac76a51cc950d982d68b83fe1ad97b32cd580d',
        token_out: 'BNB',
        amount_in: '0.065216073765713464',
        chain_id: 56,
        execute: true,
    };
    const confirmationToken = computeConfirmationToken('prepare_swap_transaction', args, 'policy-1');

    const result = checkMutationExecutionGate({
        toolName: 'prepare_swap_transaction',
        args,
        policy: {
            enforcementLevel: 'hard',
            actionClass: 'TRADE_MUTATION',
            policyDecisionId: 'policy-1',
        } as any,
        gate: {
            phase: 'execute',
            confirmationToken,
        },
        snapshot: {
            sessionId: 'session-1',
            taskId: 'task-1',
            model: 'grok-4.1',
            history: [],
            lastUserMessage: 'confirm',
            requestedTokenAddresses: [],
            requestedTokenSymbols: [],
            runtime: {
                chainId: 56,
                chainName: 'bsc',
            },
            toolDefinitions: [],
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
                        result: { finishedAt: now },
                        finishedAt: now,
                    },
                ],
            },
            confirmationState: null,
        } as any,
    });

    assert.equal(result.allow, true);
});
