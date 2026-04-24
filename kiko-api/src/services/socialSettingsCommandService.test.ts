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
  assert.match(menu, /\/model deepseek flash/);
  assert.match(menu, /balanced GPT reasoning for normal agent tasks and image planning/);
  assert.match(menu, /Grok 4\.1 Fast \/ fast/);
  assert.match(menu, /strong search ability and real-time X data for fast social answers/);
});

test('social model command matches DeepSeek V4 Flash', () => {
  const choice = __socialSettingsCommandTest.matchChatModelChoice('/model deepseek flash');

  assert.equal(choice?.model, 'deepseek-v4-flash');
  assert.equal(choice?.reasoningLevel, 'fast');
});

test('social model command matches Grok fast model', () => {
  const choice = __socialSettingsCommandTest.matchChatModelChoice('/model grok fast');

  assert.equal(choice?.model, 'grok-4-1-fast-non-reasoning');
  assert.equal(choice?.reasoningLevel, 'fast');
});

test('social model command accepts dashed numbers and menu display names', () => {
  const numbered = __socialSettingsCommandTest.matchChatModelChoice('/model -2');
  const named = __socialSettingsCommandTest.matchChatModelChoice('/model Grok 4.1 Fast');

  assert.equal(numbered?.model, 'gpt-5.4-mini-2026-03-17');
  assert.equal(numbered?.reasoningLevel, 'medium');
  assert.equal(named?.model, 'grok-4-1-fast-non-reasoning');
  assert.equal(named?.reasoningLevel, 'fast');
});

test('social image command default resolves to executable image preference', () => {
  const choice = __socialSettingsCommandTest.matchImageModelChoice('/image default');

  assert.equal(choice?.model, 'cloudflare-flux-2-klein-4b');
  assert.equal(choice?.quality, 'normal');
});

test('social image command matches Grok normal preference', () => {
  const choice = __socialSettingsCommandTest.matchImageModelChoice('/image grok normal');

  assert.equal(choice?.model, 'grok-imagine-image');
  assert.equal(choice?.quality, 'normal');
});

test('social image command accepts dashed numbers and menu display names', () => {
  const numbered = __socialSettingsCommandTest.matchImageModelChoice('/image -1');
  const named = __socialSettingsCommandTest.matchImageModelChoice('/image Grok Imagine Pro');

  assert.equal(numbered?.model, 'cloudflare-flux-2-klein-4b');
  assert.equal(numbered?.quality, 'normal');
  assert.equal(named?.model, 'grok-imagine-image-pro');
  assert.equal(named?.quality, 'pro');
});

test('social image command menu and aliases include Grok pro image preference', () => {
  const menu = __socialSettingsCommandTest.buildImageMenu();
  const explicit = __socialSettingsCommandTest.matchImageModelChoice('/image grok pro');
  const providerModel = __socialSettingsCommandTest.matchImageModelChoice('/image grok-imagine-image-pro');
  const compactAlias = __socialSettingsCommandTest.matchImageModelChoice('/image grokpro');

  assert.match(menu, /\/image grok pro/);
  assert.match(menu, /supports edit and reference image input/);
  assert.match(menu, /text-to-image only; no edit\/reference image input/);
  assert.equal(explicit?.model, 'grok-imagine-image-pro');
  assert.equal(explicit?.quality, 'pro');
  assert.equal(providerModel?.model, 'grok-imagine-image-pro');
  assert.equal(providerModel?.quality, 'pro');
  assert.equal(compactAlias?.model, 'grok-imagine-image-pro');
  assert.equal(compactAlias?.quality, 'pro');
});

test('social image command matches Cloudflare and Runware low-cost image preferences', () => {
  const cloudflare = __socialSettingsCommandTest.matchImageModelChoice('/image cloudflare-flux-2-klein-4b');
  const runware = __socialSettingsCommandTest.matchImageModelChoice('/image runware-flux-2-klein-9b-kv');

  assert.equal(cloudflare?.model, 'cloudflare-flux-2-klein-4b');
  assert.equal(cloudflare?.quality, 'normal');
  assert.equal(runware?.model, 'runware-flux-2-klein-9b-kv');
  assert.equal(runware?.quality, 'normal');
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
    replyText: 'Saved image model: Default image model: FLUX.2 Klein 4B / free',
  });
  assert.deepEqual(savedChoices, [
    {
      userId: 'did:test',
      model: 'cloudflare-flux-2-klein-4b',
      quality: 'normal',
    },
  ]);
  assert.equal(pendingMenus.size, 0);
});

test('social settings command resolves Grok pro image from menu number', async () => {
  const pendingMenus = new Map<string, unknown>();
  const savedChoices: Array<{ userId: string; model: string; quality: string | null }> = [];
  const menu = __socialSettingsCommandTest.buildImageMenu();
  const grokProNumber = menu.match(/^(\d+)\. \/image grok pro\b/m)?.[1];

  assert.ok(grokProNumber);

  await __socialSettingsCommandTest.handleSocialSettingsCommand({
    userId: 'did:test',
    text: '/image',
    replyContextKey: 'farcaster:thread-grok-pro',
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
    text: grokProNumber,
    replyContextKey: 'farcaster:thread-grok-pro',
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
    replyText: 'Saved image model: Grok Imagine Pro / pro',
  });
  assert.deepEqual(savedChoices, [
    {
      userId: 'did:test',
      model: 'grok-imagine-image-pro',
      quality: 'pro',
    },
  ]);
  assert.equal(pendingMenus.size, 0);
});

test('social settings command resolves image model display name from pending menu context', async () => {
  const pendingMenus = new Map<string, unknown>();
  const savedChoices: Array<{ userId: string; model: string; quality: string | null }> = [];
  const deps = {
    async getPendingMenu(key: string) {
      return (pendingMenus.get(key) as any) || null;
    },
    async setPendingMenu(key: string, pending: unknown) {
      pendingMenus.set(key, pending);
    },
    async clearPendingMenu(key: string) {
      pendingMenus.delete(key);
    },
    async persistChatModelChoice() {
      throw new Error('unexpected chat persist');
    },
    async persistImageModelChoice(userId: string, choice: { model: string; quality: string | null }) {
      savedChoices.push({ userId, model: choice.model, quality: choice.quality });
    },
  };

  await __socialSettingsCommandTest.handleSocialSettingsCommand({
    userId: 'did:test',
    text: '/image',
    replyContextKey: 'x:conversation-image-name',
    deps,
  });

  const saved = await __socialSettingsCommandTest.handleSocialSettingsCommand({
    userId: 'did:test',
    text: 'Grok Imagine Pro',
    replyContextKey: 'x:conversation-image-name',
    deps,
  });

  assert.deepEqual(saved, {
    handled: true,
    replyText: 'Saved image model: Grok Imagine Pro / pro',
  });
  assert.deepEqual(savedChoices, [
    {
      userId: 'did:test',
      model: 'grok-imagine-image-pro',
      quality: 'pro',
    },
  ]);
  assert.equal(pendingMenus.size, 0);
});
