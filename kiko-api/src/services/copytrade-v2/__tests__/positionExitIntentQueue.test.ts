import assert from 'node:assert/strict';
import test from 'node:test';

import { __testOnly } from '../exit/positionExitIntentQueue.js';

test('position exit intent queue key is namespaced by lane', () => {
  const evm = __testOnly.laneQueueKey('evm-exit');
  const confirm = __testOnly.laneQueueKey('confirmation-reconcile');

  assert.match(evm, /copytrade:exit-intent-queue:v1:evm-exit$/);
  assert.match(confirm, /copytrade:exit-intent-queue:v1:confirmation-reconcile$/);
  assert.notEqual(evm, confirm);
});
