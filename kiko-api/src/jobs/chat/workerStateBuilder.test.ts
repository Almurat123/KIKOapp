import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDirectFollowupExecutionPlan, buildWorkerConversationState } from './workerStateBuilder.js';
import type { ChatContextSnapshot } from './contracts.js';

function makeSnapshot(overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    const { runtime: runtimeOverrides, ...rest } = overrides;
    return {
        sessionId: 'session-1',
        taskId: 'task-1',
        model: 'gpt-5.4',
        history: [],
        lastUserMessage: 'confirm',
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        runtime: {
            userSettings: {},
            contextBlocks: {},
            ...(runtimeOverrides || {}),
        },
        ...rest,
    } as ChatContextSnapshot;
}

test('buildWorkerConversationState exposes execution, evidence, and next-action objects', () => {
    const snapshot = makeSnapshot({
        requestedTokenSymbols: ['BENJI'],
        normalizedIntent: {
            evidenceRequirements: ['onchain_token_evidence', 'connected_chain_evidence'],
        } as any,
        conversationActionState: {
            pendingAction: 'swap',
            canExecute: true,
            needsClarification: false,
            clarificationQuestion: null,
        } as any,
        confirmationState: {
            kind: 'swap_confirmation',
            sourceTool: 'simulate_swap',
            binding: {
                binding_kind: 'preflight_quote',
                tool_name: 'simulate_swap',
                action_class: 'TRADE_MUTATION',
                source_tool: 'simulate_swap',
            },
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
                },
                {
                    tool: 'get_token_info',
                    status: 'success',
                },
            ],
        },
        runtime: {
            walletAddress: '0xabc',
            chainId: 56,
            chainName: 'BNB Chain',
        },
    });

    const state = buildWorkerConversationState(snapshot);
    assert.equal(state.task_state.scope, 'pending_execution');
    assert.equal(state.task_state.scope_source, 'confirmation_state');
    assert.equal(state.mode_progress_state.mode, 'trade_confirmation');
    assert.equal(state.mode_progress_state.internal_state, 'ready_to_execute');
    assert.equal(state.mode_progress_state.completed_steps.includes('user_confirmed'), true);
    assert.equal(state.mode_progress_state.pending_steps.includes('execute'), true);
    assert.equal(state.execution_state.phase, 'ready_to_execute');
    assert.equal(state.execution_state.pending_confirmation, 'swap_confirmation');
    assert.equal(state.evidence_state.required.includes('onchain_token_evidence'), true);
    assert.equal(state.evidence_state.gathered.includes('onchain_token_evidence'), true);
    assert.equal(state.next_action_state.kind, 'execute_confirmed_action');
    assert.equal(state.carry_forward_entities?.connected_wallet, '0xabc');
});

test('buildWorkerConversationState exposes Clanker deploy previews as token_deploy confirmation state', () => {
    const snapshot = makeSnapshot({
        confirmationState: {
            kind: 'order_confirmation',
            sourceTool: 'deploy_clanker_token',
            order: {
                toolName: 'deploy_clanker_token',
                args: {
                    name: 'Kiko Receipt Test',
                    symbol: 'KRT',
                    chainId: 8453,
                    description: 'Runtime receipt hook test token',
                },
                actionClass: 'TOKEN_DEPLOY_MUTATION',
            },
        } as any,
    });

    const state = buildWorkerConversationState(snapshot);
    assert.equal(state.task_state.scope, 'pending_confirmation');
    assert.equal(state.mode_progress_state.mode, 'token_deploy');
    assert.equal(state.mode_progress_state.internal_state, 'awaiting_confirmation');
    assert.equal(state.execution_state.phase, 'awaiting_confirmation');
    assert.equal(state.execution_state.pending_confirmation, 'order_confirmation');
    assert.equal(state.execution_state.confirmation_binding?.tool_name, 'deploy_clanker_token');
    assert.equal(state.execution_state.confirmation_binding?.action_class, 'TOKEN_DEPLOY_MUTATION');
    assert.equal(state.next_action_state.kind, 'wait_for_user_confirmation');
});

test('buildWorkerConversationState carries pending quote and latest receipt objects', () => {
    const snapshot = makeSnapshot({
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
                        price_impact: '0%',
                        quoteExpiresAt: '2099-01-01T00:00:00.000Z',
                        finishedAt: '2026-04-18T00:00:00.000Z',
                    },
                },
                {
                    tool: 'prepare_swap_transaction',
                    status: 'success',
                    args: {
                        token_in: 'BNB',
                        token_out: '0x0bc61768132aa1484e2b09301284b7def78a4444',
                        amount_in: '0.001',
                        chain_id: 56,
                    },
                    result: {
                        txHash: '0xabc',
                        chainId: 56,
                        status: 'submitted',
                        finishedAt: '2026-04-18T00:00:10.000Z',
                    },
                },
            ],
        },
    });

    const state = buildWorkerConversationState(snapshot);
    assert.equal(state.mode_progress_state.mode, 'trade_confirmation');
    assert.equal(state.mode_progress_state.internal_state, 'executed');
    assert.equal(state.execution_state.pending_quote?.expected_out, '8779.58');
    assert.equal(state.execution_state.pending_quote?.stale, false);
    assert.equal(state.execution_state.latest_receipt?.tx_hash, '0xabc');
    assert.equal(state.execution_state.latest_receipt?.status, 'submitted');
    assert.equal(state.evidence_state.gathered.includes('execution_quote'), true);
    assert.equal(state.evidence_state.gathered.includes('execution_receipt'), true);
});

test('buildWorkerConversationState keeps stale carry-forward entities from polluting a plain fresh request', () => {
    const snapshot = makeSnapshot({
        lastUserMessage: 'Explain quantum entanglement.',
        requestedTokenSymbols: ['KIKO'],
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
    });

    const state = buildWorkerConversationState(snapshot);
    assert.equal(state.task_state.scope, 'fresh_request');
    assert.equal(state.task_state.scope_source, 'fresh_turn_no_carry_forward');
    assert.equal(state.mode_progress_state.mode, 'lean_chat');
    assert.equal(state.mode_progress_state.internal_state, 'fresh_answer');
});

test('buildDirectFollowupExecutionPlan derives deterministic execute args for swap confirmations', () => {
    const snapshot = makeSnapshot({
        confirmationState: {
            kind: 'swap_confirmation',
            sourceTool: 'simulate_swap',
            swap: {
                tokenIn: 'BNB',
                tokenOut: '0x0bc61768132aa1484e2b09301284b7def78a4444',
                amountIn: '0.001',
                chainId: 56,
            },
        },
        policySnapshot: {
            policyDecisionId: 'policy-1',
        } as any,
    });

    const plan = buildDirectFollowupExecutionPlan({
        snapshot,
        taskToolContext: {
            toolConfig: {
                customSlippage: '1.5',
            },
        },
    });

    assert.ok(plan);
    assert.equal(plan?.tool_name, 'prepare_swap_transaction');
    assert.equal(plan?.args?.execute, true);
    assert.equal(plan?.args?.slippage, 1.5);
    assert.equal(typeof plan?.execution_gate?.confirmationToken, 'string');
    assert.equal(plan?.binding?.binding_kind, 'derived_execute_args');
});

test('buildDirectFollowupExecutionPlan replays Clanker deploy previews with confirmDeploy enabled', () => {
    const snapshot = makeSnapshot({
        confirmationState: {
            kind: 'order_confirmation',
            sourceTool: 'deploy_clanker_token',
            order: {
                toolName: 'deploy_clanker_token',
                args: {
                    name: 'Kiko Receipt Test',
                    symbol: 'KRT',
                    chainId: 8453,
                    description: 'Runtime receipt hook test token',
                },
                actionClass: 'TOKEN_DEPLOY_MUTATION',
            },
        } as any,
        policySnapshot: {
            policyDecisionId: 'policy-1',
        } as any,
    });

    const plan = buildDirectFollowupExecutionPlan({
        snapshot,
    });

    assert.ok(plan);
    assert.equal(plan?.tool_name, 'deploy_clanker_token');
    assert.equal(plan?.args?.confirmDeploy, true);
    assert.equal(plan?.args?.name, 'Kiko Receipt Test');
    assert.equal(plan?.args?.symbol, 'KRT');
    assert.equal(plan?.binding?.binding_kind, 'prepared_confirmation');
    assert.equal(plan?.binding?.action_class, 'TOKEN_DEPLOY_MUTATION');
    assert.equal(typeof plan?.execution_gate?.confirmationToken, 'string');
});
