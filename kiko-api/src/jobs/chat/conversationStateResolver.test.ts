import assert from 'node:assert/strict';
import test from 'node:test';
import {
    extractRecentToolTrace,
    extractRequestedTokenAddressesFromHistory,
    extractRequestedTokenSymbolsFromHistory,
    isConfirmationMessage,
    resolveTradeConfirmationState,
} from './conversationStateResolver.js';

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
    ], 'confirm');

    assert.equal(state?.kind, 'order_confirmation');
    assert.equal(state?.order?.toolName, 'place_polymarket_order');
    assert.equal(state?.order?.args?.token_id, 'token-up');
    assert.equal(state?.order?.confirmationToken, 'abc123');
    assert.equal(state?.order?.actionClass, 'ORDER_MUTATION');
});

test('isConfirmationMessage stays strict for ordinary trade requests that contain polite language', () => {
    assert.equal(isConfirmationMessage('可以帮我报价一下这个 token 吗'), false);
    assert.equal(isConfirmationMessage('ok buy 1 eth worth of virtual'), false);
    assert.equal(isConfirmationMessage('可以'), true);
    assert.equal(isConfirmationMessage('confirm'), true);
    assert.equal(isConfirmationMessage('继续执行'), true);
});
