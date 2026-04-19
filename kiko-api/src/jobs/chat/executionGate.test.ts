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

test('prepare_swap_transaction rejects explicitly expired quote precheck evidence', () => {
    const args = {
        token_in: 'BNB',
        token_out: '0x0bc61768132aa1484e2b09301284b7def78a4444',
        amount_in: '0.001',
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
            model: 'gpt-5.4',
            history: [],
            lastUserMessage: 'confirm',
            requestedTokenAddresses: [],
            requestedTokenSymbols: [],
            runtime: {},
            toolDefinitions: [],
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
                            expected_out_human: '8779.58',
                            quoteExpiresAt: '2000-01-01T00:00:00.000Z',
                        },
                    },
                ],
            },
        } as any,
    });

    assert.equal(result.allow, false);
    assert.equal(result.error?.code, 'PRECHECK_REQUIRED');
});

test('deploy_clanker_token dry run does not require execution confirmation', () => {
    const result = checkMutationExecutionGate({
        toolName: 'deploy_clanker_token',
        args: {
            name: 'Demo Token',
            symbol: 'DEMO',
            confirmDeploy: false,
        },
        policy: {
            enforcementLevel: 'hard',
            actionClass: 'TOKEN_DEPLOY_MUTATION',
            policyDecisionId: 'policy-1',
        } as any,
        gate: null,
    });

    assert.equal(result.allow, true);
});

test('deploy_clanker_token real deploy requires an execution confirmation token', () => {
    const args = {
        name: 'Demo Token',
        symbol: 'DEMO',
        confirmDeploy: true,
    };

    const result = checkMutationExecutionGate({
        toolName: 'deploy_clanker_token',
        args,
        policy: {
            enforcementLevel: 'hard',
            actionClass: 'TOKEN_DEPLOY_MUTATION',
            policyDecisionId: 'policy-1',
        } as any,
        gate: null,
    });

    assert.equal(result.allow, false);
    assert.equal(result.responsePayload?.requires_confirmation, true);
    assert.equal(result.responsePayload?.confirmation_payload?.tool_name, 'deploy_clanker_token');
    assert.equal(result.responsePayload?.confirmation_payload?.action_class, 'TOKEN_DEPLOY_MUTATION');
});

test('deploy_clanker_token real deploy executes only with the matching confirmation token', () => {
    const args = {
        name: 'Demo Token',
        symbol: 'DEMO',
        confirmDeploy: true,
    };
    const confirmationToken = computeConfirmationToken('deploy_clanker_token', args, 'policy-1');

    const result = checkMutationExecutionGate({
        toolName: 'deploy_clanker_token',
        args,
        policy: {
            enforcementLevel: 'hard',
            actionClass: 'TOKEN_DEPLOY_MUTATION',
            policyDecisionId: 'policy-1',
        } as any,
        gate: {
            phase: 'execute',
            confirmationToken,
        },
    });

    assert.equal(result.allow, true);
});
