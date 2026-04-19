import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseStoredChatModelSelection,
  parseStoredChatModelSelectionState,
} from './chatModelSelectionPersistence';

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

test('parseStoredChatModelSelectionState preserves per-family control memory', () => {
  const result = parseStoredChatModelSelectionState({
    selectedModel: {
      id: 'kimi-k2-5-reasoning',
      reasoningLevel: 'thinking',
    },
    familyControlLevelsByFamilyId: {
      'kimi-k2-5': 'thinking',
      'gpt-5.4-mini': 'medium',
    },
  });

  assert.equal(result?.selectedModel.id, 'kimi-k2-5-reasoning');
  assert.equal(result?.selectedModel.reasoningLevel, 'thinking');
  assert.equal(result?.familyControlLevelsByFamilyId['kimi-k2-5'], 'thinking');
  assert.equal(result?.familyControlLevelsByFamilyId['gpt-5.4-mini'], 'medium');
});
