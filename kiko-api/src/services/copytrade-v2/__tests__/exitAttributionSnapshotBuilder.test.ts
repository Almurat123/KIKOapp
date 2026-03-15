import assert from 'node:assert/strict';
import test from 'node:test';

import { createRpcFactFailure, createRpcFactSuccess } from '../../oracle/rpcFactResult.js';
import { __exitAttributionSnapshotBuilderTest } from '../exit/exitAttributionSnapshotBuilder.js';

test('resolveMirrorSellBalanceReadFastPath returns immediate positive balance from hint', async () => {
  const result = await Promise.race([
    __exitAttributionSnapshotBuilderTest.resolveMirrorSellBalanceReadFastPath({
      balanceReadPromise: new Promise(() => undefined),
      hintedBalanceRaw: 123n,
      isMirrorSell: true,
      positionCount: 1,
      pendingLotCount: 0,
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 25)),
  ]);

  assert.notEqual(result, null);
  assert.equal(result?.status, 'success');
  assert.equal(result?.value, 123n);
  assert.equal(result?.providerSource, 'copytrade:balance_hint');
});

test('resolveMirrorSellBalanceReadFastPath falls back to oracle result when no usable hint exists', async () => {
  const oracleResult = createRpcFactFailure<bigint>(
    'EXIT_BALANCE_RPC_FAILED',
    3,
    'rpc timeout',
    'balanceRpcReader:readEvmTokenBalanceFast',
  );

  const result = await __exitAttributionSnapshotBuilderTest.resolveMirrorSellBalanceReadFastPath({
    balanceReadPromise: Promise.resolve(oracleResult),
    hintedBalanceRaw: 0n,
    isMirrorSell: true,
    positionCount: 1,
    pendingLotCount: 0,
  });

  assert.deepEqual(result, oracleResult);
});

test('coerceMirrorSellBalanceReadWithHint preserves successful oracle reads', () => {
  const oracleResult = createRpcFactSuccess(
    42n,
    'EXIT_BALANCE_CONFIRMED_POSITIVE',
    1,
    'balanceRpcReader:readEvmTokenBalanceFast',
  );

  const result = __exitAttributionSnapshotBuilderTest.coerceMirrorSellBalanceReadWithHint({
    balanceRead: oracleResult,
    hintedBalanceRaw: 999n,
    isMirrorSell: true,
    positionCount: 1,
    pendingLotCount: 0,
  });

  assert.deepEqual(result, oracleResult);
});
