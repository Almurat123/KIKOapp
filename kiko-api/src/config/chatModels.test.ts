// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: persisted reasoning strength now depends on model-family inference
//         and normalization at the backend boundary, so this helper needs a
//         regression test to guard the refresh-restoration path.
// Goal: keep model-driven reasoning inference stable for user settings and
//       chat-session persistence.
// Owns: helper-level behavior for reasoning normalization and inference.
// Does Not Own: persistence wiring, route validation, or frontend selection UI.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: reasoning normalization and inference regression coverage

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inferSupportedChatReasoningLevel,
  normalizeSupportedChatReasoningLevel,
} from './chatModels.js';

test('normalizeSupportedChatReasoningLevel lowercases supported values', () => {
  assert.equal(normalizeSupportedChatReasoningLevel('Medium'), 'medium');
});

test('inferSupportedChatReasoningLevel preserves GPT-5.4 mini low effort', () => {
  assert.equal(inferSupportedChatReasoningLevel('gpt-5.4-mini-2026-03-17'), 'low');
});

test('inferSupportedChatReasoningLevel preserves Kimi reasoning mode', () => {
  assert.equal(inferSupportedChatReasoningLevel('kimi-k2-5-reasoning'), 'thinking');
});
