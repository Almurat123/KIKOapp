import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldDeferBackgroundCycle } from '../exit/exitHotPathPressure.js';

test('background cycles defer when live exit intents are active', () => {
  assert.equal(shouldDeferBackgroundCycle({
    activeIntentCount: 1,
    claimedIntentCount: 0,
    recentActivityCount: 0,
  }), true);
});

test('background cycles defer when worker activity is recent even without active count', () => {
  assert.equal(shouldDeferBackgroundCycle({
    activeIntentCount: 0,
    claimedIntentCount: 1,
    recentActivityCount: 0,
  }), true);
});

test('background cycles proceed when no live exit pressure exists', () => {
  assert.equal(shouldDeferBackgroundCycle({
    activeIntentCount: 0,
    claimedIntentCount: 0,
    recentActivityCount: 0,
  }), false);
});
