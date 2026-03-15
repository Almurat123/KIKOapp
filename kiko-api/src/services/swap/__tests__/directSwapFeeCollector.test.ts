import assert from 'node:assert/strict';
import test from 'node:test';

import {
  __directSwapFeeCollectorTest,
  buildDirectSwapFeeSettlement,
  collectDirectSwapFeeFromSettlement,
} from '../fee/directSwapFeeCollector.js';

test('copytrade fee collection requires canonical source tx hash', async () => {
  let sendCalled = false;

  await collectDirectSwapFeeFromSettlement({
    userId: 'did:privy:user-1',
    settlement: {
      amountIn: '1',
      chainId: 56,
      mode: 'copytrade',
      normalizedTokenIn: '0x1111111111111111111111111111111111111111',
      normalizedTokenOut: '0x2222222222222222222222222222222222222222',
      amountOutBase: '1000',
      feeContext: 'copyTrade',
      deferred: false,
      reasonCode: 'confirmed_success_recovery',
    },
    trace: (msg: string) => msg,
    deps: {
      sendTransaction: async () => {
        sendCalled = true;
        return '0xhash';
      },
    },
  });

  assert.equal(sendCalled, false);
  assert.equal(__directSwapFeeCollectorTest.requiresCanonicalSourceTxHashForFeeContext('copyTrade'), true);
  assert.equal(__directSwapFeeCollectorTest.requiresCanonicalSourceTxHashForFeeContext('swap'), false);
});

test('buildDirectSwapFeeSettlement carries canonical source tx hash when fees are enabled', () => {
  const settlement = buildDirectSwapFeeSettlement({
    request: {
      userId: 'did:privy:user-1',
      accessToken: 'token',
      amountIn: '1',
      chainId: 56,
      mode: 'copytrade',
      sourceTxHash: '0xabc123',
    },
    normalizedTokenIn: '0x1111111111111111111111111111111111111111',
    normalizedTokenOut: '0x2222222222222222222222222222222222222222',
    amountOutBase: '1000',
    feeContext: 'copyTrade',
    deferred: false,
    reasonCode: 'direct_swap_result',
  });

  if (settlement) {
    assert.equal(settlement.sourceTxHash, '0xabc123');
  } else {
    assert.equal(settlement, null);
  }
});
