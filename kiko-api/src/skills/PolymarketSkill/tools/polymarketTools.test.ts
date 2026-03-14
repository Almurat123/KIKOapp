import assert from 'node:assert/strict';
import test from 'node:test';

import { __testables } from './polymarketTools.js';

test('formatDateLabel truncates ISO timestamps for display', () => {
  assert.equal(__testables.formatDateLabel('2026-03-15T08:09:10Z'), '2026-03-15');
});

test('formatDateLabel returns null for missing timestamps', () => {
  assert.equal(__testables.formatDateLabel(undefined), null);
  assert.equal(__testables.formatDateLabel(''), null);
  assert.equal(__testables.formatDateLabel('   '), null);
});
