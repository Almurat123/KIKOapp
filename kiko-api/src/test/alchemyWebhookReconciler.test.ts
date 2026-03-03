import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { diffWebhookAddresses } from '../services/alchemyWebhookReconciler.js';

describe('alchemyWebhookReconciler diffing', () => {
    test('ethereum drift removes stale test wallet and adds real target wallet', () => {
        const desired = ['0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed'];
        const current = ['0xc0262af90b5b86d6c0d7fe2b7d666c476c9b8b6a'];

        const result = diffWebhookAddresses(1, desired, current);

        assert.deepEqual(result.added, desired);
        assert.deepEqual(result.removed, current);
    });

    test('evm comparison is case-insensitive through normalization inputs', () => {
        const desired = ['0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed'];
        const current = ['0x2CD32FB42748774FAFDE72D8607F16CCC5F5C0ED'];

        const result = diffWebhookAddresses(1, desired.map((value) => value.toLowerCase()), current.map((value) => value.toLowerCase()));

        assert.deepEqual(result.added, []);
        assert.deepEqual(result.removed, []);
    });
});
