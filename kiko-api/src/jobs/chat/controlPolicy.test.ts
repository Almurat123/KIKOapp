import assert from 'node:assert/strict';
import test from 'node:test';

import { buildControlPolicySnapshot, checkToolAgainstPolicy, isTokenDeployMutationTool, resolveActionClass } from './controlPolicy.js';

test('resolveActionClass treats order confirmations as order mutations', () => {
    const actionClass = resolveActionClass({
        sessionId: 'session-1',
        taskId: 'task-1',
        model: 'gpt-5',
        history: [],
        lastUserMessage: 'confirm',
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        runtime: {},
        toolDefinitions: [],
        confirmationState: {
            kind: 'order_confirmation',
            order: {
                toolName: 'place_polymarket_order',
                args: {
                    token_id: 'token-up',
                    question: 'ETH Up or Down',
                    outcome: 'Up',
                    amount_usd: 1,
                },
                confirmationToken: 'abc123',
                actionClass: 'ORDER_MUTATION',
            },
        },
    } as any, null);

    assert.equal(actionClass, 'ORDER_MUTATION');
});

test('provider-native x_user_search is allowed even though it is not a registry-backed node tool', () => {
    const result = checkToolAgainstPolicy({
        call: {
            id: 'native-1',
            name: 'x_user_search',
            arguments: { query: 'berachain airdrop' },
        },
        policy: {
            policyVersion: 'test',
            policyDecisionId: 'policy-1',
            actionClass: 'READ_ONLY',
            controlPlane: 'node',
            mutationAllowed: false,
            enforcementLevel: 'hard',
            allowedTools: [],
            mutationToolAllowlist: [],
            providerNativeTools: ['web_search', 'x_search'],
            toolBudgets: { default: 4 },
        },
        knownToolNames: new Set(['external_web_search', 'search_polymarket']),
    });

    assert.equal(result, null);
});

test('resolveActionClass treats canonical Clanker deploy as token deploy mutation', () => {
    const actionClass = resolveActionClass({
        sessionId: 'session-1',
        taskId: 'task-1',
        model: 'gpt-5',
        history: [],
        lastUserMessage: 'Deploy a token on Base',
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        runtime: {},
        toolDefinitions: [],
        normalizedIntent: {
            domain: 'token',
            intent: 'clanker_deploy',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.9,
            explanation: 'test',
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: null,
            timeContext: null,
            evidenceRequirements: [],
            requiresRealtime: false,
            requiresOnchainEvidence: false,
            executionCandidate: true,
            rowCount: null,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            source: 'llm',
        },
    } as any, null);

    assert.equal(actionClass, 'TOKEN_DEPLOY_MUTATION');
});

test('buildControlPolicySnapshot promotes Clanker skill envelope to token deploy mutation', () => {
    const policy = buildControlPolicySnapshot({
        snapshot: {
            sessionId: 'session-1',
            taskId: 'task-1',
            model: 'gpt-5',
            history: [],
            lastUserMessage: 'Deploy a token via Clanker',
            requestedTokenAddresses: [],
            requestedTokenSymbols: [],
            runtime: {},
            toolDefinitions: [],
        } as any,
        tradingIntent: null,
        skillResolution: {
            allowedTools: ['deploy_clanker_token'],
            intentEnvelope: {
                primary_intent: 'token_deploy',
                task_mode: 'execute',
                search_mode: 'forbidden',
                search_target: 'none',
                domain: 'token',
                execution_risk: 'mutation',
                required_evidence: [],
            },
        } as any,
    });

    assert.equal(policy.actionClass, 'TOKEN_DEPLOY_MUTATION');
    assert.equal(policy.mutationAllowed, true);
    assert.ok(policy.mutationToolAllowlist.includes('deploy_clanker_token'));
    assert.ok(isTokenDeployMutationTool('deploy_clanker_token'));
});

test('token deploy mutation policy blocks swap mutation tools', () => {
    const result = checkToolAgainstPolicy({
        call: {
            id: 'swap-1',
            name: 'prepare_swap_transaction',
            arguments: { execute: true },
        },
        policy: {
            policyVersion: 'test',
            policyDecisionId: 'policy-1',
            actionClass: 'TOKEN_DEPLOY_MUTATION',
            controlPlane: 'node',
            mutationAllowed: true,
            enforcementLevel: 'hard',
            allowedTools: ['prepare_swap_transaction'],
            mutationToolAllowlist: ['deploy_clanker_token'],
            providerNativeTools: [],
            toolBudgets: { default: 4 },
        },
        knownToolNames: new Set(['prepare_swap_transaction', 'deploy_clanker_token']),
    });

    assert.equal(result?.code, 'POLICY_UNAUTHORIZED_TOOL');
});
