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

  assert.match(menu, /just the number/i);
  assert.match(menu, /\/model gpt-5\.4-mini low/);
  assert.match(menu, /\/model gpt-5\.4-mini medium/);
});

test('social model command matches Grok fast model', () => {
  const choice = __socialSettingsCommandTest.matchChatModelChoice('/model grok fast');

  assert.equal(choice?.model, 'grok-4-1-fast-non-reasoning');
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

test('social settings command resolves bare model number from pending menu context', async () => {
  const pendingMenus = new Map<string, unknown>();
  const savedChoices: Array<{ userId: string; model: string; reasoningLevel: string }> = [];

  const result = await __socialSettingsCommandTest.handleSocialSettingsCommand({
    userId: 'did:test',
    text: '2',
    replyContextKey: 'x:conversation-1',
    deps: {
      async getPendingMenu(key) {
        return (pendingMenus.get(key) as any) || null;
      },
      async setPendingMenu(key, pending) {
        pendingMenus.set(key, pending);
      },
      async clearPendingMenu(key) {
        pendingMenus.delete(key);
      },
      async persistChatModelChoice(userId, choice) {
        savedChoices.push({ userId, model: choice.model, reasoningLevel: choice.reasoningLevel });
      },
      async persistImageModelChoice() {
        throw new Error('unexpected image persist');
      },
    },
  });

  assert.equal(result.handled, false);

  await __socialSettingsCommandTest.handleSocialSettingsCommand({
    userId: 'did:test',
    text: '/model',
    replyContextKey: 'x:conversation-1',
    deps: {
      async getPendingMenu(key) {
        return (pendingMenus.get(key) as any) || null;
      },
      async setPendingMenu(key, pending) {
        pendingMenus.set(key, pending);
      },
      async clearPendingMenu(key) {
        pendingMenus.delete(key);
      },
      async persistChatModelChoice(userId, choice) {
        savedChoices.push({ userId, model: choice.model, reasoningLevel: choice.reasoningLevel });
      },
      async persistImageModelChoice() {
        throw new Error('unexpected image persist');
      },
    },
  });

  const saved = await __socialSettingsCommandTest.handleSocialSettingsCommand({
    userId: 'did:test',
    text: '2',
    replyContextKey: 'x:conversation-1',
    deps: {
      async getPendingMenu(key) {
        return (pendingMenus.get(key) as any) || null;
      },
      async setPendingMenu(key, pending) {
        pendingMenus.set(key, pending);
      },
      async clearPendingMenu(key) {
        pendingMenus.delete(key);
      },
      async persistChatModelChoice(userId, choice) {
        savedChoices.push({ userId, model: choice.model, reasoningLevel: choice.reasoningLevel });
      },
      async persistImageModelChoice() {
        throw new Error('unexpected image persist');
      },
    },
  });

  assert.deepEqual(saved, {
    handled: true,
    replyText: 'Saved reply model: GPT-5.4 Mini / medium',
  });
  assert.deepEqual(savedChoices, [
    {
      userId: 'did:test',
      model: 'gpt-5.4-mini-2026-03-17',
      reasoningLevel: 'medium',
    },
  ]);
  assert.equal(pendingMenus.size, 0);
});

test('social settings command resolves bare image number from pending menu context', async () => {
  const pendingMenus = new Map<string, unknown>();
  const savedChoices: Array<{ userId: string; model: string; quality: string | null }> = [];

  await __socialSettingsCommandTest.handleSocialSettingsCommand({
    userId: 'did:test',
    text: '/image',
    replyContextKey: 'farcaster:thread-1',
    deps: {
      async getPendingMenu(key) {
        return (pendingMenus.get(key) as any) || null;
      },
      async setPendingMenu(key, pending) {
        pendingMenus.set(key, pending);
      },
      async clearPendingMenu(key) {
        pendingMenus.delete(key);
      },
      async persistChatModelChoice() {
        throw new Error('unexpected chat persist');
      },
      async persistImageModelChoice(userId, choice) {
        savedChoices.push({ userId, model: choice.model, quality: choice.quality });
      },
    },
  });

  const saved = await __socialSettingsCommandTest.handleSocialSettingsCommand({
    userId: 'did:test',
    text: '1',
    replyContextKey: 'farcaster:thread-1',
    deps: {
      async getPendingMenu(key) {
        return (pendingMenus.get(key) as any) || null;
      },
      async setPendingMenu(key, pending) {
        pendingMenus.set(key, pending);
      },
      async clearPendingMenu(key) {
        pendingMenus.delete(key);
      },
      async persistChatModelChoice() {
        throw new Error('unexpected chat persist');
      },
      async persistImageModelChoice(userId, choice) {
        savedChoices.push({ userId, model: choice.model, quality: choice.quality });
      },
    },
  });

  assert.deepEqual(saved, {
    handled: true,
    replyText: 'Saved image model: Default image model: GPT Image 1 Mini / medium',
  });
  assert.deepEqual(savedChoices, [
    {
      userId: 'did:test',
      model: 'gpt-image-1-mini',
      quality: 'medium',
    },
  ]);
  assert.equal(pendingMenus.size, 0);
});
