import assert from 'node:assert/strict';
import test from 'node:test';

import {
    ReadExecutionPlanTool,
    ReadProviderNativeEvidenceTool,
    ReadSkillPromptsTool,
    ReadUserSettingsTool,
    ReadUserContextTool,
    ReadWalletStateTool,
    ReadWorkflowStateTool,
} from './contextReadTools.js';
import type { ChatContextSnapshot } from './contracts.js';

function makeSnapshot(message: string, overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    const { runtime: runtimeOverrides, ...restOverrides } = overrides;
    return {
        sessionId: 'session-1',
        taskId: 'task-1',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        ...restOverrides,
        runtime: {
            userSettings: {},
            contextBlocks: {},
            ...(runtimeOverrides || {}),
        },
    } as ChatContextSnapshot;
}

test('read_user_context returns connected chain, requested chain, and address classifications', async () => {
    const snapshot = makeSnapshot('Buy CAKE on BNB chain', {
        requestedTokenSymbols: ['CAKE', 'BNB'],
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        requestedAddressClassifications: [
            {
                address: '0x1111111111111111111111111111111111111111',
                kind: 'token_contract',
                chainId: 8453,
                chainName: 'Base',
                source: 'rpc',
            },
        ],
        runtime: {
            walletAddress: '0xabc',
            chainId: 8453,
            chainName: 'Base',
        },
    });

    const result = await ReadUserContextTool.handler({}, { __snapshot: snapshot });
    assert.equal(result.available, true);
    assert.equal(result.context?.context_kind, 'session_context');
    assert.equal(result.context?.wallet?.address, '0xabc');
    assert.equal(result.context?.wallet?.connected, true);
    assert.equal(result.context?.chain?.connected?.chain_id, 8453);
    assert.equal(result.context?.chain?.connected?.name, 'Base');
    assert.equal(result.context?.chain?.requested?.chain_id, 56);
    assert.equal(result.context?.chain?.requested?.name, 'BNB Chain');
    assert.equal(result.context?.chain?.effective?.chain_id, 56);
    assert.equal(result.context?.chain?.effective_source, 'user_request');
    assert.equal(result.context?.request_entities?.address_classifications?.[0]?.kind, 'token_contract');
});

test('read_user_settings returns one normalized execution-preference contract', async () => {
    const snapshot = makeSnapshot('Swap ETH for USDC', {
        runtime: {
            userSettings: {
                quickSwapMode: true,
                fastSwapMode: false,
                showQuoteBeforeSwap: true,
                mevProtection: true,
                priceDeviationCheck: false,
                defaultSwapAmount: '0.25',
                defaultSwapUnit: 'ETH',
                slippageMode: 'custom',
                customSlippage: '1.5',
                copyTradeAIMode: 'balanced',
            },
        },
    });

    const result = await ReadUserSettingsTool.handler({}, { __snapshot: snapshot });
    assert.equal(result.available, true);
    assert.equal(result.settings?.execution_mode, 'quote_before_swap');
    assert.equal(result.settings?.execution_preferences?.quote_required_before_swap, true);
    assert.equal(result.settings?.execution_preferences?.quick_swap_enabled, true);
    assert.equal(result.settings?.safety_checks?.mev_protection, true);
    assert.equal(result.settings?.safety_checks?.price_deviation_check, false);
    assert.equal(result.settings?.swap_defaults?.amount, '0.25');
    assert.equal(result.settings?.swap_defaults?.unit, 'ETH');
    assert.equal(result.settings?.swap_defaults?.slippage_mode, 'custom');
    assert.equal(result.settings?.swap_defaults?.custom_slippage_pct, '1.5');
    assert.equal(result.settings?.copy_trade?.ai_mode, 'balanced');
});

test('read_wallet_state returns compact worker-facing balance context', async () => {
    const token = '0x1111111111111111111111111111111111111111';
    const snapshot = makeSnapshot('What can I sell?', {
        runtime: {
            walletAddress: '0xabc',
            chainId: 8453,
            chainName: 'Base',
            nativeBalance: '0.145',
            balance: {
                [token]: {
                    balance: '1234.5',
                    symbol: 'USDC',
                    contractAddress: token,
                    decimals: 6,
                },
            },
            balanceSnapshotAt: '2026-03-19T00:00:00.000Z',
            allChainBalances: {
                bsc: {
                    ethBalanceFormatted: '2.0',
                    tokens: {
                        BNB: { balance: '2.0' },
                    },
                },
            },
            allChainBalancesSnapshotAt: '2026-03-19T00:01:00.000Z',
        },
    });

    const result = await ReadWalletStateTool.handler({}, { __snapshot: snapshot });
    assert.equal(result.available, true);
    assert.equal(result.context?.context_kind, 'wallet_state');
    assert.equal(result.context?.wallet?.address, '0xabc');
    assert.equal(result.context?.active_chain?.chain_id, 8453);
    assert.equal(result.context?.balances?.active_chain?.native, '0.145');
    assert.equal(result.context?.balances?.active_chain?.tokens?.[0]?.symbol, 'USDC');
    assert.equal(result.context?.balances?.active_chain?.tokens?.[0]?.contract_address, token);
    assert.equal(result.context?.balances?.all_chains?.[0]?.chain, 'bsc');
    assert.equal(result.context?.balances?.all_chains?.[0]?.native, '2.0');
    assert.equal(result.context?.snapshots?.active_chain_at, '2026-03-19T00:00:00.000Z');
});

test('read_workflow_state carries persisted polymarket selection', async () => {
    const snapshot = makeSnapshot('bet down for 1$', {
        requestedTokenSymbols: ['BTC'],
        normalizedIntent: {
            timeContext: {
                isTimeBound: true,
                description: 'today 11:48 in user timezone',
                startTime: '2026-04-03T11:48:00+08:00',
                endTime: '2026-04-03T11:48:59+08:00',
            },
        } as any,
        conversationActionState: {
            pendingAction: 'none',
            canExecute: false,
            needsClarification: false,
            clarificationQuestion: null,
        },
        polymarketSelection: {
            sourceTool: 'get_polymarket_coin_updown_markets',
            capturedAt: '2026-03-26T05:58:03.000Z',
            candidates: [
                {
                    title: 'Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET',
                    question: 'Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET',
                    marketId: '305787',
                    marketSlug: 'btc-updown-5m-1774504500',
                    conditionId: 'condition-1',
                    outcomes: [
                        { name: 'Up', tokenId: 'token-up' },
                        { name: 'Down', tokenId: 'token-down' },
                    ],
                },
            ],
        },
    });

    const result = await ReadWorkflowStateTool.handler({}, { __snapshot: snapshot });
    assert.equal(result.available, true);
    assert.equal(result.timeContext?.startTime, '2026-04-03T11:48:00+08:00');
    assert.equal(result.timeContext?.endTime, '2026-04-03T11:48:59+08:00');
    assert.equal(result.polymarketSelection?.candidates?.[0]?.title, 'Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET');
    assert.equal(result.polymarketSelection?.candidates?.[0]?.outcomes?.[0]?.name, 'Up');
});

test('read_execution_plan, read_skill_prompts, and read_provider_native_evidence expose compact runtime artifacts', async () => {
    const toolContext = {
        __chatContextRuntime: {
            executionPlan: {
                planId: 'plan-1',
                status: 'in_progress',
                steps: [
                    {
                        id: 'step-1',
                        title: 'Understand Query',
                        status: 'pending',
                        preferredTools: ['x_search'],
                    },
                ],
            },
            skillPrompts: ['Use the token skill.', 'Prefer on-chain evidence.'],
            providerNativeEvidence: [
                {
                    sourceTypes: ['x_search'],
                    querySummary: 'trending topics on X today',
                    retrievedAt: '2026-03-16T10:00:00.000Z',
                    round: 1,
                    results: [
                        {
                            sourceType: 'x_search',
                            title: 'Trending Topics',
                            url: 'https://x.com/explore',
                            snippet: 'Top current trends.',
                        },
                    ],
                },
            ],
        },
    };

    const executionPlan = await ReadExecutionPlanTool.handler({}, toolContext);
    const skillPrompts = await ReadSkillPromptsTool.handler({}, toolContext);
    const providerEvidence = await ReadProviderNativeEvidenceTool.handler({}, toolContext);

    assert.equal(executionPlan.available, true);
    assert.equal(executionPlan.plan?.planId, 'plan-1');
    assert.equal(executionPlan.plan?.steps?.[0]?.preferredTools?.[0], 'x_search');

    assert.equal(skillPrompts.available, true);
    assert.deepEqual(skillPrompts.prompts, ['Use the token skill.', 'Prefer on-chain evidence.']);

    assert.equal(providerEvidence.available, true);
    assert.equal(providerEvidence.evidence?.[0]?.querySummary, 'trending topics on X today');
    assert.equal(providerEvidence.evidence?.[0]?.results?.[0]?.url, 'https://x.com/explore');
});
