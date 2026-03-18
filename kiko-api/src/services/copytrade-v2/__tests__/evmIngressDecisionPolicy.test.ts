import assert from 'node:assert/strict';
import test from 'node:test';

import { decideEvmProvisionalIngress } from '../ingress/evmIngressDecisionPolicy.js';

const BUY_SWAP = {
  tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  tokenOut: '0x65021a79aeef22b17cdc1b768f5e79a8618beba3',
} as any;

test('evm ingress policy allows provisional dispatch for single-wallet routable cached predecode', () => {
  const decision = decideEvmProvisionalIngress({
    chainId: 8453,
    trackedWalletCount: 1,
    trackedWallet: '0xf199e2a67a3862a4d1178c697abb8e76ef7c681b',
    swapOrigin: 'cached_predecoded',
    swap: BUY_SWAP,
    sourceTxFrom: null,
    pendingHintTargetWallet: '0xf199e2a67a3862a4d1178c697abb8e76ef7c681b',
    cashLegHint: {
      cashSpentUsd: 233,
      inferredTxType: 'TARGET_BUY',
    },
  });

  assert.deepEqual(decision, {
    action: 'dispatch_provisional',
    reasonCode: 'single_wallet_predecoded_routable',
    swapSource: 'webhook_provisional_predecoded',
    allowMissingSourceTxFrom: true,
  });
});

test('evm ingress policy rejects provisional dispatch when multiple tracked wallets are present', () => {
  const decision = decideEvmProvisionalIngress({
    chainId: 8453,
    trackedWalletCount: 2,
    trackedWallet: '0xf199e2a67a3862a4d1178c697abb8e76ef7c681b',
    swapOrigin: 'cached_predecoded',
    swap: BUY_SWAP,
  });

  assert.equal(decision.action, 'require_receipt');
  assert.equal(decision.reasonCode, 'multiple_tracked_wallets');
});

test('evm ingress policy rejects provisional dispatch on wallet conflict', () => {
  const decision = decideEvmProvisionalIngress({
    chainId: 8453,
    trackedWalletCount: 1,
    trackedWallet: '0xf199e2a67a3862a4d1178c697abb8e76ef7c681b',
    swapOrigin: 'activity_decode',
    swap: BUY_SWAP,
    sourceTxFrom: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });

  assert.equal(decision.action, 'require_receipt');
  assert.equal(decision.reasonCode, 'source_wallet_conflict');
});

test('evm ingress policy rejects provisional dispatch for token-to-token ambiguity', () => {
  const decision = decideEvmProvisionalIngress({
    chainId: 8453,
    trackedWalletCount: 1,
    trackedWallet: '0xf199e2a67a3862a4d1178c697abb8e76ef7c681b',
    swapOrigin: 'activity_decode',
    swap: {
      tokenIn: '0x1111111111111111111111111111111111111111',
      tokenOut: '0x2222222222222222222222222222222222222222',
    } as any,
    cashLegHint: {
      inferredTxType: 'TARGET_TOKEN_SWAP',
    },
  });

  assert.equal(decision.action, 'require_receipt');
  assert.equal(decision.reasonCode, 'direction_not_routable');
});
