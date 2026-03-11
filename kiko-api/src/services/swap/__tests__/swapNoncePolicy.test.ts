import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTradeSendNonce } from '../swapNoncePolicy.js';

test('swap nonce policy drops pre-warmed nonce after approval confirmation', () => {
    const nonce = resolveTradeSendNonce({
        preWarmedNonce: '9',
        approvalExecutedOnChain: true,
    });

    assert.equal(nonce, undefined);
});

test('swap nonce policy keeps pre-warmed nonce when approval was not sent', () => {
    const nonce = resolveTradeSendNonce({
        preWarmedNonce: '9',
        approvalExecutedOnChain: false,
    });

    assert.equal(nonce, '9');
});
