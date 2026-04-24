import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWorkerConversationState } from './workerStateBuilder.js';
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

test('buildWorkerConversationState does not treat a fresh trade request as already executed from the previous receipt', () => {
    const snapshot = makeSnapshot({
        lastUserMessage: 'Sell all USDC to ETH',
        requestedTokenSymbols: ['USDC', 'ETH'],
        taskRoute: {
            owner: 'swap',
            phase: 'execute',
            facets: [],
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['USDC', 'ETH'],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: [],
            },
            requestedChain: {
                chainId: 8453,
                chainName: 'Base',
            },
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: false,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Fresh sell request.',
            confidence: 0.98,
            source: 'llm',
        } as any,
        recentToolTrace: {
            messageId: 'assistant-1',
            toolCalls: [
                {
                    tool: 'prepare_swap_transaction',
                    status: 'success',
                    args: {
                        token_in: 'ETH',
                        token_out: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                        amount_in: '0.001',
                        chain_id: 8453,
                    },
                    result: {
                        txHash: '0xb1b9f8340dabebbc366e33334155575b4c519cb6575f88eae35cc2b591bae57d',
                        chainId: 8453,
                        status: 'success',
                        finishedAt: '2026-04-23T13:32:18.972Z',
                    },
                },
            ],
        },
        runtime: {
            walletAddress: '0xabc',
            chainId: 8453,
            chainName: 'Base',
        },
    });

    const state = buildWorkerConversationState(snapshot);
    assert.equal(state.task_state.scope, 'fresh_request');
    assert.equal(
        state.task_state.current_goal,
        'Handle the latest trade request as a new action. Do not treat any prior quote or receipt as fulfillment for this turn.',
    );
    assert.equal(
        state.task_state.completion_rule,
        'Do not claim quote or execution from prior turns. Gather the current trade evidence or prepare the current trade action for this request first.',
    );
    assert.equal(state.mode_progress_state.mode, 'swap_quote');
    assert.equal(state.mode_progress_state.internal_state, 'quote_needed');
    assert.equal(state.mode_progress_state.completed_steps.includes('identify_intent'), true);
    assert.equal(state.mode_progress_state.pending_steps.includes('quote_or_prepare'), true);
    assert.equal(state.execution_state.latest_receipt, undefined);
    assert.equal(state.execution_state.pending_quote, undefined);
    assert.equal(state.next_action_state.kind, 'call_tool');
});

test('buildWorkerConversationState prefers task route over stale canonical token carry-forward', () => {
    const snapshot = makeSnapshot({
        lastUserMessage: 'Explain quantum entanglement.',
        requestedTokenSymbols: ['KIKO'],
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        taskRoute: {
            owner: 'general_answer',
            phase: 'answer',
            facets: [],
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: [],
            },
            requestedChain: null,
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: false,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Plain direct answer.',
            confidence: 0.95,
            source: 'llm',
        } as any,
        normalizedIntent: {
            domain: 'token',
            intent: 'token_analysis',
            taskMode: 'analyze',
            outputMode: 'narrative',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.7,
            explanation: 'stale token carry-forward',
            entities: {
                tokenAddresses: ['0x1111111111111111111111111111111111111111'],
                tokenSymbols: ['KIKO'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: null,
            timeContext: null,
            evidenceRequirements: ['onchain_token_evidence'],
            requiresRealtime: false,
            requiresOnchainEvidence: true,
            executionCandidate: false,
            rowCount: null,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            source: 'llm',
        } as any,
    });

    const state = buildWorkerConversationState(snapshot);
    assert.equal(state.task_state.scope, 'fresh_request');
    assert.equal(state.mode_progress_state.mode, 'lean_chat');
    assert.equal(
        (state.evidence_state?.required || []).includes('onchain_token_evidence'),
        false,
    );
});
