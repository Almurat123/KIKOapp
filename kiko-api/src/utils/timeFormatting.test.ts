import assert from 'node:assert/strict';
import test from 'node:test';

import { __timeFormattingTestables } from './timeFormatting.js';

test('formatZonedDateTime keeps ET midnight as 00 and never 24', () => {
  const value = __timeFormattingTestables.formatZonedDateTime(
    new Date('2026-03-26T04:30:51Z'),
    'America/New_York',
  );

  assert.equal(value, '2026-03-26 00:30:51');
  assert.equal(value.includes('24:'), false);
});

test('formatZonedIsoLike keeps ET midnight as 00 in iso-like output', () => {
  const value = __timeFormattingTestables.formatZonedIsoLike(
    new Date('2026-03-26T04:00:00Z'),
    'America/New_York',
  );

  assert.equal(value, '2026-03-26T00:00:00');
});
