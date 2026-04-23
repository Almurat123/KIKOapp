import assert from 'node:assert/strict';
import test from 'node:test';

import { processCreditDepositWebhookPayload, resolveDepositConfirmations, stableLogIndex } from './creditDepositWatcherService.js';

test('resolveDepositConfirmations prefers explicit confirmations from activity', () => {
    assert.equal(
        resolveDepositConfirmations({ confirmations: 7, blockNum: '0x10' }, 100),
        7,
    );
});

test('resolveDepositConfirmations derives confirmations from latest block when available', () => {
    assert.equal(
        resolveDepositConfirmations({ blockNum: '0x64' }, 105),
        6,
    );
});

test('resolveDepositConfirmations falls back to one confirmation when only block number is known', () => {
    assert.equal(
        resolveDepositConfirmations({ blockNum: '0x64' }),
        1,
    );
});

test('resolveDepositConfirmations returns zero when no block or confirmation data exists', () => {
    assert.equal(
        resolveDepositConfirmations({}),
        0,
    );
});

test('stableLogIndex fallback stays inside Postgres INT4 range', () => {
    const index = stableLogIndex({
        hash: '0x9c177f9863b6fd19e6faa1d8a3ca7d20088342c984e4f37e9f3bb4d078b6bafd',
        rawContract: {
            address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            value: '1000000',
        },
        fromAddress: '0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b',
        toAddress: '0xc5377e6329770be29ef938d8acc11f22398d7e54',
    });

    assert.equal(Number.isInteger(index), true);
    assert.equal(index >= 0, true);
    assert.equal(index < 2_147_483_647, true);
});

test('processCreditDepositWebhookPayload ignores non-Base webhook payloads', async () => {
    const stats = await processCreditDepositWebhookPayload({
        event: {
            network: 'eth-mainnet',
            activity: [
                {
                    hash: '0xabc',
                    toAddress: '0x0000000000000000000000000000000000000000',
                },
            ],
        },
    }, 'eth-mainnet');

    assert.deepEqual(stats, {
        processed: 0,
        credited: 0,
        duplicate: 0,
        belowMinimum: 0,
        confirming: 0,
        unsupportedAsset: 0,
        unmatchedUser: 0,
        skipped: 0,
        errors: 0,
    });
});
