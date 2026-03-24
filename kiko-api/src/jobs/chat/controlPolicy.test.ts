import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveActionClass } from './controlPolicy.js';

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
