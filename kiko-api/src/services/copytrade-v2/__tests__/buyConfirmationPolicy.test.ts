import assert from 'node:assert/strict';
import test from 'node:test';

import { waitForCopytradeBuyConfirmation } from '../buy/buyConfirmationPolicy.js';

test('buy confirmation policy resolves replacement tx success through alias-aware adjudication', async () => {
  let resolveCalls = 0;

  const result = await waitForCopytradeBuyConfirmation({
    chainId: 8453,
    txHash: '0xfailed',
    txHashes: ['0xfailed', '0xreplacement'],
    orderId: 'order-1',
    runtimeContext: {
      orderId: 'order-1',
      chainId: 8453,
      userId: 'user-1',
      walletAddress: '0xabc',
      side: 'buy',
      mode: 'copytrade',
      state: 'rpc_uncertain',
      reasonCode: 'pending_visibility',
      canonicalTxHash: '0xfailed',
      relatedTxHashes: ['0xfailed', '0xreplacement'],
      route: {},
      timing: { createdAt: Date.now() },
      attempts: [],
      fallbackUsed: false,
      metadata: {},
    },
    timeoutMs: 1000,
    pollMs: 50,
  }, {
    resolveTxFinalState(params) {
      resolveCalls += 1;
      if (params.txHash === '0xreplacement' && resolveCalls > 1) {
        return {
          state: 'confirmed_success',
          reasonCode: 'replacement_confirmed',
          terminal: true,
          accepted: true,
          visible: true,
          success: true,
          failed: false,
          source: 'adjudicator',
        };
      }
      if (params.txHash === '0xfailed') {
        return {
          state: 'confirmed_failed',
          reasonCode: 'receipt_failed',
          terminal: true,
          accepted: true,
          visible: true,
          success: false,
          failed: true,
          source: 'adjudicator',
        };
      }
      return {
        state: 'rpc_uncertain',
        reasonCode: 'pending_visibility',
        terminal: false,
        accepted: true,
        visible: false,
        success: false,
        failed: false,
        source: 'adjudicator',
      };
    },
    async waitForTransactionConfirmation() {
      return {
        success: false,
        kind: 'confirmed_failed',
        reason: 'receipt_failed',
        visible: true,
        resolvedTxHash: '0xfailed',
      };
    },
    getAdjudicatedSnapshot(params) {
      if (params.txHash === '0xreplacement' && resolveCalls > 1) {
        return {
          orderId: 'order-1',
          chainId: 8453,
          canonicalTxHash: '0xreplacement',
          allTxHashes: ['0xfailed', '0xreplacement'],
        } as any;
      }
      return {
        orderId: 'order-1',
        chainId: 8453,
        canonicalTxHash: '0xfailed',
        allTxHashes: ['0xfailed', '0xreplacement'],
      } as any;
    },
    async hydrateSharedAdjudicatedSnapshot() {
      return null;
    },
  });

  assert.equal(result.kind, 'confirmed_success');
  assert.equal(result.success, true);
  assert.equal(result.resolvedTxHash, '0xreplacement');
});

test('buy confirmation policy preserves tx hash on direct confirmation success', async () => {
  const result = await waitForCopytradeBuyConfirmation({
    chainId: 8453,
    txHash: '0xabc',
    timeoutMs: 1000,
    pollMs: 50,
  }, {
    resolveTxFinalState() {
      return {
        state: 'rpc_uncertain',
        reasonCode: 'pending_visibility',
        terminal: false,
        accepted: true,
        visible: false,
        success: false,
        failed: false,
        source: 'none',
      };
    },
    async waitForTransactionConfirmation() {
      return {
        success: true,
        kind: 'confirmed_success',
        visible: true,
        resolvedTxHash: '0xabc',
      };
    },
    getAdjudicatedSnapshot() {
      return null;
    },
    async hydrateSharedAdjudicatedSnapshot() {
      return null;
    },
  });

  assert.equal(result.kind, 'confirmed_success');
  assert.equal(result.resolvedTxHash, '0xabc');
});
