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

test('tool execution engine repairs malformed copy-trade target_wallet from the latest literal user address before confirmation gating', async () => {
    const engine = new ToolExecutionEngine();
    const result = await engine.execute(
        {
            id: 'call-2',
            name: 'create_copy_trade_config',
            arguments: {
                target_wallet: '0xbd708164137146ac234aceb75d3981cd359e21a',
                buy_amount_usd: 8,
                chain_id: 56,
            },
        },
        {
            __snapshot: {
                lastUserMessage: 'Copy Trade 0xbd708164137146ac234aceb75d3981cd3599e21a with $8 per trade at BSC',
                requestedTokenAddresses: ['0xbd708164137146ac234aceb75d3981cd3599e21a'],
            },
            __controlPolicy: {
                policyVersion: 'test',
                policyDecisionId: 'policy-2',
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
    assert.equal(
        result.result?.confirmation_payload?.args?.target_wallet,
        '0xbd708164137146ac234aceb75d3981cd3599e21a',
    );
    assert.equal(
        result.result?.confirmation_payload?.wallet_binding?.llmTargetWallet,
        '0xbd708164137146ac234aceb75d3981cd359e21a',
    );
    assert.equal(
        result.result?.confirmation_payload?.wallet_binding?.finalTargetWallet,
        '0xbd708164137146ac234aceb75d3981cd3599e21a',
    );
    assert.equal(
        result.result?.confirmation_payload?.wallet_binding?.reasonCode,
        'MODEL_ARG_OVERRIDDEN_BY_LITERAL',
    );
});

test('tool execution engine blocks copy-trade creation when latest user message contains multiple wallet candidates', async () => {
    const engine = new ToolExecutionEngine();
    const firstWallet = '0xbd708164137146ac234aceb75d3981cd3599e21a';
    const secondWallet = '0x077b9981bc8a2ca417cea41861111da63266988b';
    const result = await engine.execute(
        {
            id: 'call-3',
            name: 'create_copy_trade_config',
            arguments: {
                target_wallet: firstWallet,
                buy_amount_usd: 8,
                chain_id: 56,
            },
        },
        {
            __snapshot: {
                lastUserMessage: `Copy Trade ${firstWallet} or ${secondWallet} with $8 per trade at BSC`,
            },
            __controlPolicy: {
                policyVersion: 'test',
                policyDecisionId: 'policy-3',
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

    assert.equal(result.ok, false);
    assert.equal(result.reasonCode, 'AMBIGUOUS_COPY_TRADE_TARGET_WALLET');
    assert.deepEqual(result.result?.wallet_candidates, [firstWallet, secondWallet]);
});
