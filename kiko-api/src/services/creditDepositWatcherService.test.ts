import assert from 'node:assert/strict';
import test from 'node:test';

import { processCreditDepositWebhookPayload, resolveDepositConfirmations } from './creditDepositWatcherService.js';

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
