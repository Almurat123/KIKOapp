import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { waitForReplacementVisibility } from '../services/swap/replacementVisibilityGate.js';

describe('replacement visibility gate', () => {
  test('returns visible only when replacement tx becomes queryable', async () => {
    const result = await waitForReplacementVisibility(
      {
        chainId: 1,
        replacementTxHash: '0xvisible',
        sender: '0xabc',
        targetNonce: 22n,
        retries: 2,
        delayMs: 0,
      },
      {
        async getTransactionByHash() {
          return { hash: '0xvisible' } as any;
        },
        async callRpc() {
          return '0x16' as any;
        },
        async sleep() {},
      },
    );

    assert.equal(result.visible, true);
    assert.equal(result.reasonCode, 'REPLACEMENT_VISIBLE');
  });

  test('returns not visible when replacement hash never appears but nonce is unchanged', async () => {
    const result = await waitForReplacementVisibility(
      {
        chainId: 1,
        replacementTxHash: '0xmissing',
        sender: '0xabc',
        targetNonce: 22n,
        retries: 2,
        delayMs: 0,
      },
      {
        async getTransactionByHash() {
          return null as any;
        },
        async callRpc() {
          return '0x16' as any;
        },
        async sleep() {},
      },
    );

    assert.equal(result.visible, false);
    assert.equal(result.reasonCode, 'REPLACEMENT_NOT_VISIBLE');
  });

  test('returns nonce consumed when sender nonce has already advanced', async () => {
    const result = await waitForReplacementVisibility(
      {
        chainId: 1,
        replacementTxHash: '0xmissing',
        sender: '0xabc',
        targetNonce: 22n,
        retries: 1,
        delayMs: 0,
      },
      {
        async getTransactionByHash() {
          return null as any;
        },
        async callRpc() {
          return '0x17' as any;
        },
        async sleep() {},
      },
    );

    assert.equal(result.visible, false);
    assert.equal(result.reasonCode, 'REPLACEMENT_NONCE_ALREADY_CONSUMED');
  });
});
