import assert from 'node:assert/strict';
import test from 'node:test';

import { __socialSettingsCommandTest } from './socialSettingsCommandService.js';

test('social model command matches GPT-5.4 mini medium effort', () => {
  const choice = __socialSettingsCommandTest.matchChatModelChoice('/model gpt-5.4-mini medium');

  assert.equal(choice?.model, 'gpt-5.4-mini-2026-03-17');
  assert.equal(choice?.reasoningLevel, 'medium');
});

test('social model command menu includes low and medium GPT choices', () => {
  const menu = __socialSettingsCommandTest.buildModelMenu();

  assert.match(menu, /\/model gpt-5\.4-mini low/);
  assert.match(menu, /\/model gpt-5\.4-mini medium/);
});

test('social model command matches Kimi fast default model', () => {
  const choice = __socialSettingsCommandTest.matchChatModelChoice('/model kimi fast');

  assert.equal(choice?.model, 'kimi-k2-5-instant');
  assert.equal(choice?.reasoningLevel, 'fast');
});

test('social image command default resolves to executable image preference', () => {
  const choice = __socialSettingsCommandTest.matchImageModelChoice('/image default');

  assert.equal(choice?.model, 'gpt-image-1-mini');
  assert.equal(choice?.quality, 'medium');
});

test('social image command matches Grok normal preference', () => {
  const choice = __socialSettingsCommandTest.matchImageModelChoice('/image grok normal');

  assert.equal(choice?.model, 'grok-imagine-image');
  assert.equal(choice?.quality, 'normal');
});
