import test from 'node:test';
import assert from 'node:assert/strict';

import { parseStoredChatModelSelection } from './chatModelSelectionPersistence';

test('parseStoredChatModelSelection preserves saved reasoning strength', () => {
  const result = parseStoredChatModelSelection({
    id: 'gpt-5.4-mini-2026-03-17',
    reasoningEffort: 'medium',
  });

  assert.equal(result?.id, 'gpt-5.4-mini-2026-03-17');
  assert.equal(result?.reasoningEffort, 'medium');
  assert.equal(result?.reasoningLevel, 'medium');
  assert.equal(result?.reasoningLabel, 'Medium');
});

test('parseStoredChatModelSelection preserves a saved thinking variant id', () => {
  const result = parseStoredChatModelSelection({
    id: 'kimi-k2-5-reasoning',
    reasoningLevel: 'thinking',
  });

  assert.equal(result?.id, 'kimi-k2-5-reasoning');
  assert.equal(result?.reasoningLevel, 'thinking');
  assert.equal(result?.reasoningLabel, 'Thinking');
});
