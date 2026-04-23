import test from 'node:test';
import assert from 'node:assert/strict';

import {
  supportsGeneratedImageInputModel,
  supportsVisionChatModel,
} from './chatConstants';

test('GPT image models accept uploaded image inputs for edit flows', () => {
  assert.equal(supportsGeneratedImageInputModel('gpt-image-1-mini'), true);
  assert.equal(supportsGeneratedImageInputModel('gpt-image-2'), true);
  assert.equal(supportsGeneratedImageInputModel('grok-imagine-image'), true);
  assert.equal(supportsGeneratedImageInputModel('grok-imagine-image-pro'), true);
});

test('text-chat vision helper stays broader than GPT image edit support', () => {
  assert.equal(supportsVisionChatModel('gpt-5.4-mini-2026-03-17'), true);
  assert.equal(supportsVisionChatModel('grok-4-1-fast-reasoning'), true);
  assert.equal(supportsGeneratedImageInputModel('gpt-5.4-mini-2026-03-17'), false);
});
