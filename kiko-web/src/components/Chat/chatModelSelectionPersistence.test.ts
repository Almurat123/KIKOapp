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

test('parseStoredChatModelSelection preserves a saved Grok reasoning variant id', () => {
  const result = parseStoredChatModelSelection({
    id: 'grok-4-1-fast-reasoning',
    reasoningLevel: 'thinking',
  });

  assert.equal(result?.id, 'grok-4-1-fast-reasoning');
  assert.equal(result?.reasoningLevel, 'thinking');
  assert.equal(result?.reasoningLabel, 'Thinking');
});

test('parseStoredChatModelSelectionState preserves per-family control memory', () => {
  const result = parseStoredChatModelSelectionState({
    selectedModel: {
      id: 'gpt-5.4-mini-2026-03-17',
      reasoningEffort: 'medium',
      reasoningLevel: 'medium',
    },
    familyControlLevelsByFamilyId: {
      'gpt-5.4-mini': 'medium',
    },
  });

  assert.equal(result?.selectedModel.id, 'gpt-5.4-mini-2026-03-17');
  assert.equal(result?.selectedModel.reasoningLevel, 'medium');
  assert.equal(result?.familyControlLevelsByFamilyId['gpt-5.4-mini'], 'medium');
});
