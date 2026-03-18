import assert from 'node:assert/strict';
import test from 'node:test';
import {
    extractRecentToolTrace,
    extractRequestedTokenAddressesFromHistory,
    extractRequestedTokenSymbolsFromHistory,
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
