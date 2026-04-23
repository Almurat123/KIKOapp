import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyConversationActionState,
    extractEffectiveUserQuery,
    extractRecentToolTrace,
    extractRequestedTokenAddressesFromHistory,
    extractRequestedTokenSymbolsFromHistory,
    isConfirmationMessage,
    resolveTradeConfirmationState,
} from './conversationStateResolver.js';
import { computeConfirmationToken } from './executionGate.js';
import type { CanonicalIntent } from './canonicalIntent.js';

test('extractRequestedTokenAddressesFromHistory keeps prior contract context for short follow-up turns', () => {
    const contract = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const addresses = extractRequestedTokenAddressesFromHistory([
        { role: 'user', content: `你可以寻找这个代币的${contract}在binance官方账户发布关于这个代币发布上架Alpha的日期吗？`, message_index: 1 },
        { role: 'assistant', content: '可以，我先确认一下。', message_index: 2 },
        { role: 'user', content: '可以', message_index: 3 },
    ]);

    assert.deepEqual(addresses, [contract.toLowerCase()]);
});

test('extractRequestedTokenSymbolsFromHistory keeps prior token symbols for short follow-up turns', () => {
    const symbols = extractRequestedTokenSymbolsFromHistory([
        { role: 'user', content: 'Check BTC and ETH sentiment on X', message_index: 1 },
        { role: 'assistant', content: 'I can do that.', message_index: 2 },
        { role: 'user', content: '继续', message_index: 3 },
    ]);

    assert.deepEqual(symbols.sort(), ['BTC', 'ETH']);
});

test('extractRequestedTokenSymbolsFromHistory keeps lowercase trade asset mentions for short follow-up turns', () => {
    const symbols = extractRequestedTokenSymbolsFromHistory([
        { role: 'user', content: 'sell all virtual to eth', message_index: 1 },
        { role: 'assistant', content: 'I can do that.', message_index: 2 },
        { role: 'user', content: '继续', message_index: 3 },
    ]);

    assert.deepEqual(symbols.sort(), ['ETH', 'VIRTUAL']);
});

test('extractEffectiveUserQuery unwraps Farcaster current cast text', () => {
    const token = '0x4972e029f2e1831d205b20d05833cc771feb2ba3';
    const text = `Farcaster inbound mention context:\nParent @someone: previous\nCurrent @almurat: ${token}`;

    assert.equal(extractEffectiveUserQuery(text), token);
});

test('extractRequestedTokenSymbolsFromHistory ignores Farcaster transport wrapper labels', () => {
    const token = '0x4972e029f2e1831d205b20d05833cc771feb2ba3';
    const symbols = extractRequestedTokenSymbolsFromHistory([
        {
            role: 'user',
            content: `Farcaster inbound mention context:\nCurrent @almurat: ${token}`,
            message_index: 1,
        },
        { role: 'assistant', content: '收到。', message_index: 2 },
        { role: 'user', content: '继续', message_index: 3 },
    ]);

    assert.deepEqual(symbols, []);
});

test('extractRecentToolTrace aggregates tool calls across the session instead of only the last assistant turn', () => {
    const trace = extractRecentToolTrace([
        {
            role: 'assistant',
            id: 'a1',
            message_index: 1,
            data: {
                toolTrace: {
                    toolCalls: [
                        { tool: 'external_web_search', status: 'success' },
                    ],
                },
            },
        },
        {
            role: 'assistant',
            id: 'a2',
            message_index: 2,
            data: {
                toolTrace: {
                    toolCalls: [
                        { tool: 'get_token_info', status: 'success' },
                        { tool: 'get_early_buyers', status: 'success' },
                    ],
                },
            },
        },
    ]);

    assert.equal(trace?.messageId, 'a2');
    assert.deepEqual(
        trace?.toolCalls.map((call) => call.tool),
        ['external_web_search', 'get_token_info', 'get_early_buyers'],
    );
});

test('resolveTradeConfirmationState does not treat explicit chain switch requests as trade confirmations', () => {
    const state = resolveTradeConfirmationState([
        {
            role: 'assistant',
            id: 'a1',
            message_index: 1,
            data: {
                toolTrace: {
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
                            result: {
                                finishedAt: '2026-03-19T09:36:35.000Z',
                            },
                        },
                    ],
                },
            },
        },
    ], 'Switch to polygon');

    assert.equal(state, null);
});

test('resolveTradeConfirmationState clears stale swap confirmation when latest turn is a fresh amount-adjustment request', () => {
    const token = '0x0bc61768132aa1484e2b09301284b7def78a4444';
    const normalizedIntent: CanonicalIntent = {
        domain: 'token',
        intent: 'swap',
        taskMode: 'execute',
        outputMode: 'execution_ready',
        searchMode: 'forbidden',
        searchTarget: 'none',
        confidence: 0.91,
        explanation: 'test',
        entities: {
            tokenAddresses: [token],
            tokenSymbols: ['BENJI'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: {
            chainId: 56,
            chainName: 'BNB Chain',
            source: 'llm',
        },
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
    };

    const state = resolveTradeConfirmationState([
        {
            role: 'assistant',
            id: 'a1',
            message_index: 1,
            data: {
                toolTrace: {
                    toolCalls: [
                        {
                            tool: 'simulate_swap',
                            status: 'success',
                            args: {
                                token_in: 'BNB',
                                token_out: token,
                                amount_in: '0.01',
                                chain_id: 56,
                            },
                            result: {
                                finishedAt: '2026-03-26T13:46:59.000Z',
                            },
                        },
                    ],
                },
            },
        },
    ], '0.001 BNB', normalizedIntent);

    assert.equal(state, null);
});

test('applyConversationActionState clears stale swap confirmation for read-only analysis intents', () => {
    const token = '0x3e17ee3B1895dD1A7CF993A89769C5e029584444';
    const snapshot = applyConversationActionState({
        sessionId: 's1',
        taskId: 't1',
        model: 'gpt-5.4',
        history: [],
        lastUserMessage: `你能告诉我${token}的早期购买者吗？`,
        recentToolTrace: {
            messageId: 'assistant-1',
            toolCalls: [
                {
                    tool: 'simulate_swap',
                    status: 'success',
                    args: {
                        token_in: 'BNB',
                        token_out: token,
                        amount_in: '0.001',
                        chain_id: 56,
                    },
                    result: {
                        expected_out: '52.88',
                    },
                },
            ],
        },
        runtime: {
            chainId: 56,
            chainName: 'BNB Chain',
        },
        requestedTokenAddresses: [token.toLowerCase()],
        requestedTokenSymbols: [],
        normalizedIntent: {
            domain: 'token',
            intent: 'early_buyers',
            taskMode: 'analyze',
            outputMode: 'full_table',
            searchMode: 'fallback',
            searchTarget: 'none',
            confidence: 0.96,
            explanation: 'test',
            entities: {
                tokenAddresses: [token.toLowerCase()],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: {
                chainId: 56,
                chainName: 'BNB Chain',
                source: 'llm',
            },
            timeContext: null,
            evidenceRequirements: ['onchain_token_evidence'],
            requiresRealtime: false,
            requiresOnchainEvidence: true,
            executionCandidate: false,
            rowCount: null,
            locale: 'zh',
            needsClarification: false,
            clarificationQuestion: null,
            source: 'llm',
        } as any,
        toolDefinitions: [],
    } as any);

    assert.equal(snapshot.conversationActionState?.pendingAction, 'none');
    assert.equal(snapshot.confirmationState, null);
});

test('applyConversationActionState clears stale swap confirmation when task route is a non-mutation owner', () => {
    const token = '0x3e17ee3B1895dD1A7CF993A89769C5e029584444';
    const snapshot = applyConversationActionState({
        sessionId: 's1',
        taskId: 't1',
        model: 'gpt-5.4',
        history: [],
        lastUserMessage: `Explain why ${token} rallied.`,
        recentToolTrace: {
            messageId: 'assistant-1',
            toolCalls: [
                {
                    tool: 'simulate_swap',
                    status: 'success',
                    args: {
                        token_in: 'BNB',
                        token_out: token,
                        amount_in: '0.001',
                        chain_id: 56,
                    },
                    result: {
                        expected_out: '52.88',
                    },
                },
            ],
        },
        runtime: {
            chainId: 56,
            chainName: 'BNB Chain',
        },
        requestedTokenAddresses: [token.toLowerCase()],
        requestedTokenSymbols: [],
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
            explanation: 'Plain explanation request.',
            confidence: 0.95,
            source: 'llm',
        } as any,
        normalizedIntent: {
            domain: 'token',
            intent: 'swap',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.96,
            explanation: 'stale canonical swap',
            entities: {
                tokenAddresses: [token.toLowerCase()],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: {
                chainId: 56,
                chainName: 'BNB Chain',
                source: 'llm',
            },
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
        } as any,
        toolDefinitions: [],
    } as any);

    assert.equal(snapshot.conversationActionState?.pendingAction, 'none');
    assert.equal(snapshot.confirmationState, null);
});

test('resolveTradeConfirmationState extracts order confirmation from a prepared Polymarket bet', () => {
    const state = resolveTradeConfirmationState([
        {
            role: 'assistant',
            id: 'a1',
            message_index: 1,
            data: {
                toolTrace: {
                    toolCalls: [
                        {
                            tool: 'prepare_polymarket_bet',
                            status: 'success',
                            args: {
                                token_id: 'token-up',
                                question: 'Ethereum Up or Down - March 25, 5:00AM-5:05AM ET',
                                outcome: 'Up',
                                amount_usd: 1,
                            },
                            result: {
                                requires_confirmation: true,
                                confirmation_payload: {
                                    tool_name: 'place_polymarket_order',
                                    args: {
                                        token_id: 'token-up',
                                        side: 'BUY',
                                        amount_usd: 1,
                                        question: 'Ethereum Up or Down - March 25, 5:00AM-5:05AM ET',
                                        outcome: 'Up',
                                    },
                                    confirmation_token: 'abc123',
                                    action_class: 'ORDER_MUTATION',
                                },
                            },
                        },
                    ],
                },
            },
        },
    ], 'confirm', {
        domain: 'polymarket',
        intent: 'polymarket_order',
        taskMode: 'confirm',
    } as any);

    assert.equal(state?.kind, 'order_confirmation');
    assert.equal(state?.order?.toolName, 'place_polymarket_order');
    assert.equal(state?.order?.args?.token_id, 'token-up');
    assert.equal(state?.order?.confirmationToken, 'abc123');
    assert.equal(state?.order?.actionClass, 'ORDER_MUTATION');
});

test('resolveTradeConfirmationState preserves swap quote metadata on confirmation state', () => {
    const freshTimestamp = new Date(Date.now() - 30_000).toISOString();
    const state = resolveTradeConfirmationState([
        {
            role: 'assistant',
            id: 'a-quote',
            message_index: 1,
            data: {
                toolTrace: {
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
                            },
                            finishedAt: freshTimestamp,
                        },
                    ],
                },
            },
        },
    ], 'confirm', {
        domain: 'token',
        intent: 'swap',
        taskMode: 'confirm',
    } as any);

    assert.equal(state?.kind, 'swap_confirmation');
    assert.equal(state?.quote?.tool_name, 'simulate_swap');
    assert.equal(state?.quote?.expected_out, '8779.58');
    assert.equal(state?.quote?.stale, false);
});

test('resolveTradeConfirmationState ignores swap confirmation quotes outside the reusable window', () => {
    const staleTimestamp = new Date(Date.now() - (5 * 60 * 1000)).toISOString();
    const state = resolveTradeConfirmationState([
        {
            role: 'assistant',
            id: 'a-old-quote',
            message_index: 1,
            data: {
                toolTrace: {
                    toolCalls: [
                        {
                            tool: 'prepare_swap_transaction',
                            status: 'success',
                            args: {
                                token_in: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                                token_out: 'ETH',
                                amount_in: '2.322311',
                                chain_id: 8453,
                                execute: false,
                            },
                            result: {
                                requires_confirmation: true,
                                quoteExpiresAt: '2099-01-01T00:00:00.000Z',
                                finishedAt: staleTimestamp,
                            },
                            finishedAt: staleTimestamp,
                        },
                    ],
                },
            },
        },
    ], 'confirm', {
        domain: 'token',
        intent: 'swap',
        taskMode: 'confirm',
    } as any);

    assert.equal(state, null);
});

test('resolveTradeConfirmationState preserves token deploy mutation action class', () => {
    const state = resolveTradeConfirmationState([
        {
            role: 'assistant',
            id: 'a-clanker',
            message_index: 1,
            data: {
                toolTrace: {
                    toolCalls: [
                        {
                            tool: 'deploy_clanker_token',
                            status: 'success',
                            result: {
                                requires_confirmation: true,
                                confirmation_payload: {
                                    tool_name: 'deploy_clanker_token',
                                    args: {
                                        name: 'Demo Token',
                                        symbol: 'DEMO',
                                        confirmDeploy: true,
                                    },
                                    confirmation_token: 'deploy123',
                                    action_class: 'TOKEN_DEPLOY_MUTATION',
                                },
                            },
                        },
                    ],
                },
            },
        },
    ], 'confirm', {
        domain: 'token',
        intent: 'clanker_deploy',
        taskMode: 'confirm',
    } as any);

    assert.equal(state?.kind, 'order_confirmation');
    assert.equal(state?.order?.toolName, 'deploy_clanker_token');
    assert.equal(
        state?.order?.confirmationToken,
        computeConfirmationToken('deploy_clanker_token', {
            name: 'Demo Token',
            symbol: 'DEMO',
            confirmDeploy: true,
        }),
    );
    assert.equal(state?.order?.actionClass, 'TOKEN_DEPLOY_MUTATION');
});

test('resolveTradeConfirmationState treats a Clanker dry run as reusable deploy confirmation state', () => {
    const state = resolveTradeConfirmationState([
        {
            role: 'assistant',
            id: 'a-clanker-dry-run',
            message_index: 1,
            data: {
                toolTrace: {
                    toolCalls: [
                        {
                            tool: 'deploy_clanker_token',
                            status: 'success',
                            args: {
                                name: 'Kiko Receipt Test',
                                symbol: 'KRT',
                                description: 'Runtime receipt hook test token',
                                confirmDeploy: false,
                            },
                            result: {
                                success: true,
                                dryRun: true,
                                payload: {
                                    token: {
                                        name: 'Kiko Receipt Test',
                                        symbol: 'KRT',
                                        description: 'Runtime receipt hook test token',
                                        tokenAdmin: '0x1234567890123456789012345678901234567890',
                                        requestKey: '1234567890abcdef1234567890abcdef',
                                    },
                                    chainId: 8453,
                                    rewards: [
                                        {
                                            admin: '0x1234567890123456789012345678901234567890',
                                            recipient: '0x1234567890123456789012345678901234567890',
                                            allocation: 100,
                                        },
                                    ],
                                    pool: {
                                        type: 'standard',
                                    },
                                    fees: {
                                        type: 'static',
                                        clankerFee: 1,
                                        pairedFee: 1,
                                    },
                                },
                            },
                        },
                    ],
                },
            },
        },
    ], 'confirm', {
        domain: 'token',
        intent: 'clanker_deploy',
        taskMode: 'confirm',
    } as any);

    assert.equal(state?.kind, 'order_confirmation');
    assert.equal(state?.order?.toolName, 'deploy_clanker_token');
    assert.equal(state?.order?.args?.name, 'Kiko Receipt Test');
    assert.equal(state?.order?.args?.symbol, 'KRT');
    assert.equal(state?.order?.args?.description, 'Runtime receipt hook test token');
    assert.equal(state?.order?.args?.tokenAdmin, '0x1234567890123456789012345678901234567890');
    assert.equal(state?.order?.args?.chainId, 8453);
    assert.equal(state?.order?.args?.requestKey, '1234567890abcdef1234567890abcdef');
    assert.equal(state?.order?.args?.pool?.type, 'standard');
    assert.equal(state?.order?.args?.fees?.type, 'static');
    assert.equal(state?.order?.args?.confirmDeploy, true);
    assert.equal(state?.order?.actionClass, 'TOKEN_DEPLOY_MUTATION');
});

test('resolveTradeConfirmationState preserves copy-trade wallet binding provenance', () => {
    const walletBinding = {
        rawUserMessage: 'Copy Trade 0xbd708164137146ac234aceb75d3981cd3599e21a with $8',
        extractedWallets: ['0xbd708164137146ac234aceb75d3981cd3599e21a'],
        llmTargetWallet: '0xbd708164137146ac234aceb75d3981cd359e21a',
        finalTargetWallet: '0xbd708164137146ac234aceb75d3981cd3599e21a',
        source: 'latest_user_message_literal',
        reasonCode: 'MODEL_ARG_OVERRIDDEN_BY_LITERAL',
    };
    const state = resolveTradeConfirmationState([
        {
            role: 'assistant',
            id: 'a-copy',
            message_index: 1,
            data: {
                toolTrace: {
                    toolCalls: [
                        {
                            tool: 'create_copy_trade_config',
                            status: 'success',
                            result: {
                                requires_confirmation: true,
                                confirmation_payload: {
                                    tool_name: 'create_copy_trade_config',
                                    args: {
                                        target_wallet: '0xbd708164137146ac234aceb75d3981cd3599e21a',
                                        buy_amount_usd: 8,
                                        chain_id: 56,
                                    },
                                    wallet_binding: walletBinding,
                                    confirmation_token: 'copy123',
                                    action_class: 'ORDER_MUTATION',
                                },
                            },
                        },
                    ],
                },
            },
        },
    ], 'confirm', {
        domain: 'copy_trade',
        intent: 'copy_trade',
        taskMode: 'confirm',
    } as any);

    assert.equal(state?.kind, 'copy_trade_confirmation');
    assert.deepEqual(state?.copyTrade?.walletBinding, walletBinding);
});

test('isConfirmationMessage stays strict for ordinary trade requests that contain polite language', () => {
    assert.equal(isConfirmationMessage('可以帮我报价一下这个 token 吗'), false);
    assert.equal(isConfirmationMessage('ok buy 1 eth worth of virtual'), false);
    assert.equal(isConfirmationMessage('confirm', {
        normalizedIntent: {
            taskMode: 'confirm',
        },
    } as any), true);
    assert.equal(isConfirmationMessage('继续执行', {
        normalizedIntent: {
            taskMode: 'execute',
        },
    } as any), true);
    assert.equal(isConfirmationMessage('confirm', {
        taskRoute: {
            owner: 'swap',
            phase: 'confirm',
        },
    } as any), true);
});

test('confirmation-like turns without a pending payload do not force a hardcoded clarification', () => {
    const snapshot = applyConversationActionState({
        sessionId: 's1',
        taskId: 't1',
        model: 'gpt-5.4',
        history: [],
        lastUserMessage: 'confirm',
        recentToolTrace: null,
        runtime: {},
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        normalizedIntent: {
            domain: 'polymarket',
            intent: 'polymarket_order',
            taskMode: 'confirm',
            outputMode: 'confirmation_required',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.9,
            explanation: 'test',
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['BTC'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: null,
            timeContext: null,
            evidenceRequirements: ['verified_polymarket_token_id'],
            requiresRealtime: false,
            requiresOnchainEvidence: false,
            executionCandidate: true,
            rowCount: null,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            source: 'llm',
        } as any,
        toolDefinitions: [],
    } as any);

    assert.equal(snapshot.conversationActionState?.pendingAction, 'none');
    assert.equal(snapshot.conversationActionState?.canExecute, false);
    assert.equal(snapshot.conversationActionState?.needsClarification, false);
    assert.equal(snapshot.conversationActionState?.clarificationQuestion, null);
});
