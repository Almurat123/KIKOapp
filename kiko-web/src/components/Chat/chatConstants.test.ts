import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findChatModelOption,
  getChatModelFamilyOptions,
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

test('DeepSeek V4 Flash is selectable without a thinking-strength control', () => {
  const model = findChatModelOption('deepseek-v4-flash');
  const family = getChatModelFamilyOptions().find((item) => item.id === 'deepseek-v4-flash');

  assert.equal(model?.name, 'DeepSeek V4 Flash');
  assert.equal(model?.reasoningLevel, 'fast');
  assert.equal(family?.reasoningOptions.length, 1);
  assert.equal(family?.reasoningOptions[0]?.id, 'fast');
  assert.equal(supportsVisionChatModel('deepseek-v4-flash'), false);
});

test('low-cost image model labels show model names without provider names', () => {
  assert.equal(findChatModelOption('cloudflare-flux-2-klein-4b')?.name, 'FLUX.2 Klein 4B');
  assert.equal(findChatModelOption('runware-flux-2-klein-9b-kv')?.name, 'FLUX.2 Klein 9B KV');

  const familyNames = getChatModelFamilyOptions()
    .filter((family) => family.id === 'cloudflare-flux-2-klein-4b' || family.id === 'runware-flux-2-klein-9b-kv')
    .map((family) => family.name);

  assert.deepEqual(familyNames, ['FLUX.2 Klein 4B', 'FLUX.2 Klein 9B KV']);
});
