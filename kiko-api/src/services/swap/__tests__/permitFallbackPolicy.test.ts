import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldRetryPermit2AsAllowanceHolder, shouldUseSignedPermitForSell } from '../permitFallbackPolicy.js';

test('permit2 sell execution failures retry with allowance-holder fallback', () => {
    assert.equal(shouldRetryPermit2AsAllowanceHolder({
        isPermit2Path: true,
        permit2ExecutionFallbackTried: false,
        isSellTx: true,
    }), true);
});

test('permit2 fallback does not trigger twice or on non-sell paths', () => {
    assert.equal(shouldRetryPermit2AsAllowanceHolder({
        isPermit2Path: true,
        permit2ExecutionFallbackTried: true,
        isSellTx: true,
    }), false);
    assert.equal(shouldRetryPermit2AsAllowanceHolder({
        isPermit2Path: true,
        permit2ExecutionFallbackTried: false,
        isSellTx: false,
    }), false);
});

test('signed sell permit is only enabled for 0x sell paths', () => {
    assert.equal(shouldUseSignedPermitForSell({
        dex: '0x',
        allowSignedPermit: true,
        isSellTx: true,
        isNativeIn: false,
    }), true);

    assert.equal(shouldUseSignedPermitForSell({
        dex: '0x',
        allowSignedPermit: true,
        isSellTx: true,
        isNativeIn: true,
    }), false);
});
