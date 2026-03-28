import assert from 'node:assert/strict';
import test from 'node:test';

import { checkToolAgainstPolicy, resolveActionClass } from './controlPolicy.js';

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
