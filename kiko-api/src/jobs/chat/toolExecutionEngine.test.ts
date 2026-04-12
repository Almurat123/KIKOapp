import assert from 'node:assert/strict';
import test from 'node:test';

import { ToolExecutionEngine } from './toolExecutionEngine.js';

test('tool execution engine preserves copytrade confirmation payload without marking it failed', async () => {
    const engine = new ToolExecutionEngine();
    const result = await engine.execute(
        {
            id: 'call-1',
            name: 'create_copy_trade_config',
            arguments: {
                target_wallet: '0x9aef1e321ea673d0b2ba929de0760ac8a1238ba3',
                buy_amount_usd: 0.5,
                chain_id: 56,
            },
        },
        {
            __controlPolicy: {
                policyVersion: 'test',
                policyDecisionId: 'policy-1',
                actionClass: 'ORDER_MUTATION',
                controlPlane: 'node',
                mutationAllowed: true,
                enforcementLevel: 'hard',
                allowedTools: ['create_copy_trade_config'],
                mutationToolAllowlist: ['create_copy_trade_config'],
                providerNativeTools: [],
                toolBudgets: { default: 4 },
            },
            __executionGate: {
                phase: 'preflight',
            },
        },
    );

    assert.equal(result.ok, true);
    assert.equal(result.metadata?.source, 'execution_gate');
    assert.equal(result.metadata?.confirmationRequired, true);
    assert.equal(result.result?.requires_confirmation, true);
    assert.equal(result.result?.confirmation_payload?.tool_name, 'create_copy_trade_config');
    assert.equal(result.result?.confirmation_payload?.args?.chain_id, 56);
});
