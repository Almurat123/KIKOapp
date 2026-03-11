import test from 'node:test';
import assert from 'node:assert/strict';

import {
  partitionConfigsByActiveOrphanBuyGuards,
  type ActiveCopytradeOrphanBuyGuard,
} from '../guards/orphanBuyGuardStore.js';

test('partition configs blocks only configs with active orphan buy guards', () => {
  const configs = [
    { id: 'cfg-1', userId: 'user-1' },
    { id: 'cfg-2', userId: 'user-2' },
    { id: 'cfg-3', userId: 'user-3' },
  ];
  const guards: ActiveCopytradeOrphanBuyGuard[] = [
    {
      positionId: 'pos-1',
      userId: 'user-2',
      configId: 'cfg-2',
      chainId: 56,
      tokenAddress: '0xtoken',
      targetWallet: '0xtarget',
      reasonCode: 'repair_required',
      source: 'attribution_repair',
    },
  ];

  const result = partitionConfigsByActiveOrphanBuyGuards(configs, guards);

  assert.deepEqual(result.allowed.map((config) => config.id), ['cfg-1', 'cfg-3']);
  assert.deepEqual(result.blocked.map((config) => config.id), ['cfg-2']);
  assert.equal(result.guardByConfigId.get('cfg-2')?.[0]?.positionId, 'pos-1');
});
