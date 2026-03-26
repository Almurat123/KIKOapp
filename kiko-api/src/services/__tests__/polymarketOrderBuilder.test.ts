import assert from 'node:assert/strict';
import test from 'node:test';

import { __testables } from '../polymarketOrderBuilder.js';

test('shouldUsePrivySigning treats Privy DIDs as user-signing flow', () => {
  assert.equal(__testables.shouldUsePrivySigning('did:privy:123456'), true);
});

test('shouldUsePrivySigning keeps raw wallet addresses on legacy server-key flow', () => {
  assert.equal(__testables.shouldUsePrivySigning('0x1234567890abcdef1234567890abcdef12345678'), false);
});
