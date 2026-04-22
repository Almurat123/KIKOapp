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

test('resolveActionClass prefers task route execution owner over stale canonical intent', () => {
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
        taskRoute: {
            owner: 'token_deploy',
            phase: 'execute',
            facets: [],
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: [],
            },
            requestedChain: {
                chainId: 8453,
                chainName: 'Base',
                source: 'llm',
            },
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: false,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Deploy a token now.',
            confidence: 0.94,
            source: 'llm',
        } as any,
        normalizedIntent: {
            domain: 'general',
            intent: 'general_answer',
            taskMode: 'discover',
            outputMode: 'narrative',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.2,
            explanation: 'stale canonical fallback',
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
            executionCandidate: false,
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

test('policy allowlist stays scoped to resolver tools while read-only mutation guard remains active', () => {
    const policy = buildControlPolicySnapshot({
        snapshot: {
            sessionId: 'session-1',
            taskId: 'task-1',
            model: 'gpt-5',
            history: [],
            lastUserMessage: 'Generate a product poster',
            requestedTokenAddresses: [],
            requestedTokenSymbols: [],
            runtime: {},
            toolDefinitions: [
                { name: 'generate_image_from_intent', description: 'image tool', parameters: {} },
                { name: 'get_wallet_info', description: 'wallet read', parameters: {} },
                { name: 'prepare_swap_transaction', description: 'swap mutation', parameters: {} },
            ],
        } as any,
        tradingIntent: null,
        skillResolution: {
            allowedTools: ['generate_image_from_intent'],
            intentEnvelope: {
                primary_intent: 'general_answer',
                task_mode: 'discover',
                search_mode: 'forbidden',
                search_target: 'none',
                domain: 'general',
                execution_risk: 'read_only',
                required_evidence: [],
            },
        } as any,
    });

    assert.equal(policy.actionClass, 'READ_ONLY');
    assert.deepEqual(policy.allowedTools, ['generate_image_from_intent']);

    const result = checkToolAgainstPolicy({
        call: {
            id: 'swap-1',
            name: 'prepare_swap_transaction',
            arguments: { execute: true },
        },
        policy,
        knownToolNames: new Set(['generate_image_from_intent', 'get_wallet_info', 'prepare_swap_transaction']),
    });
    assert.equal(result?.code, 'POLICY_UNAUTHORIZED_TOOL');
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
