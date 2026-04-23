import prisma from '../db/prisma.js';
import cacheClient from '../cache/cacheClient.js';
import {
  inferSupportedChatReasoningLevel,
  normalizeSupportedChatModel,
  normalizeSupportedChatReasoningLevel,
  type SupportedChatReasoningLevel,
} from '../config/chatModels.js';
import { normalizeGeneratedImagePreference } from './generatedImageBilling.js';

// CONTEXT MEMORY
// Updated: 2026-04-22
// Status: mixed
// Why: Social model/image menus now support follow-up replies with just a number.
// Debug Goal: Keep X and Farcaster menu selection usable on mobile without forcing full command re-entry.
// Search Tags: social model menu number reply social image menu number reply pending settings command
// Invariants:
// - `/model 2` and `/image 1` must still work directly.
// - Bare numeric replies only resolve when a pending menu exists for the same user and social thread.
// Failure Modes:
// - Menu state leaks across threads and applies the wrong selection.
// - Cache failure silently blocks bare-number replies but must not break explicit commands.

type SocialSettingsCommandResult =
  | { handled: false }
  | { handled: true; replyText: string };

type SocialSettingsMenuKind = 'model' | 'image';

type PendingSocialSettingsMenu = {
  userId: string;
  kind: SocialSettingsMenuKind;
};

type SocialSettingsCommandDeps = {
  getPendingMenu: (replyContextKey: string) => Promise<PendingSocialSettingsMenu | null>;
  setPendingMenu: (replyContextKey: string, pending: PendingSocialSettingsMenu) => Promise<void>;
  clearPendingMenu: (replyContextKey: string) => Promise<void>;
  persistChatModelChoice: (userId: string, choice: ChatModelChoice) => Promise<void>;
  persistImageModelChoice: (userId: string, choice: ImageModelChoice) => Promise<void>;
};

type ChatModelChoice = {
  label: string;
  command: string;
  model: string;
  reasoningLevel: SupportedChatReasoningLevel;
};

type ImageModelChoice = {
  label: string;
  command: string;
  model: string;
  quality: string | null;
};

const CHAT_MODEL_CHOICES: ChatModelChoice[] = [
  {
    label: 'GPT-5.4 Mini / low',
    command: '/model gpt-5.4-mini low',
    model: 'gpt-5.4-mini-2026-03-17',
    reasoningLevel: 'low',
  },
  {
    label: 'GPT-5.4 Mini / medium',
    command: '/model gpt-5.4-mini medium',
    model: 'gpt-5.4-mini-2026-03-17',
    reasoningLevel: 'medium',
  },
  {
    label: 'Grok 4.1 Fast / fast',
    command: '/model grok fast',
    model: 'grok-4-1-fast-non-reasoning',
    reasoningLevel: 'fast',
  },
  {
    label: 'Grok 4.1 Fast / thinking',
    command: '/model grok thinking',
    model: 'grok-4-1-fast-reasoning',
    reasoningLevel: 'thinking',
  },
];

const IMAGE_MODEL_CHOICES: ImageModelChoice[] = [
  {
    label: 'Default image model: GPT Image 1 Mini / medium',
    command: '/image default',
    model: 'gpt-image-1-mini',
    quality: 'medium',
  },
  {
    label: 'GPT Image 1 Mini / low',
    command: '/image gpt-image-1-mini low',
    model: 'gpt-image-1-mini',
    quality: 'low',
  },
  {
    label: 'GPT Image 1 Mini / medium',
    command: '/image gpt-image-1-mini medium',
    model: 'gpt-image-1-mini',
    quality: 'medium',
  },
  {
    label: 'GPT Image 2 / medium',
    command: '/image gpt-image-2 medium',
    model: 'gpt-image-2',
    quality: 'medium',
  },
  {
    label: 'Grok Imagine / normal',
    command: '/image grok normal',
    model: 'grok-imagine-image',
    quality: 'normal',
  },
];

const PENDING_SOCIAL_SETTINGS_MENU_TTL_SECONDS = 10 * 60;

function normalizeCommandText(text: string): string {
  return String(text || '')
    .replace(/@\w+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildModelMenu(): string {
  return [
    'Reply with one model command or just the number:',
    ...CHAT_MODEL_CHOICES.map((choice, index) => `${index + 1}. ${choice.command}`),
  ].join('\n');
}

function buildImageMenu(): string {
  return [
    'Reply with one image command or just the number:',
    ...IMAGE_MODEL_CHOICES.map((choice, index) => `${index + 1}. ${choice.command}`),
  ].join('\n');
}

function buildPendingMenuCacheKey(replyContextKey: string): string {
  return `social-settings:pending-menu:${replyContextKey}`;
}

function normalizeReplyContextKey(replyContextKey: string | null | undefined): string | null {
  const normalized = String(replyContextKey || '').trim().toLowerCase();
  return normalized || null;
}

function extractBareNumberChoice(command: string): number | null {
  if (!/^\d+$/.test(command)) return null;
  const numbered = Number.parseInt(command, 10);
  return Number.isInteger(numbered) && numbered >= 1 ? numbered : null;
}

function matchChatModelChoice(command: string): ChatModelChoice | null {
  const rest = command.replace(/^\/model\b/, '').trim();
  if (!rest) return null;

  const numbered = Number.parseInt(rest, 10);
  if (Number.isInteger(numbered) && numbered >= 1 && numbered <= CHAT_MODEL_CHOICES.length) {
    return CHAT_MODEL_CHOICES[numbered - 1] || null;
  }

  const reasoningLevel = normalizeSupportedChatReasoningLevel(rest.split(/\s+/).at(-1));
  const modelText = reasoningLevel ? rest.replace(new RegExp(`\\b${reasoningLevel}\\b$`), '').trim() : rest;
  const compact = modelText.replace(/[\s_-]+/g, '-');
  const inferredModel =
    compact.includes('gpt-5.4-mini') || compact.includes('gpt-54-mini') || compact.includes('gpt5.4-mini')
      ? 'gpt-5.4-mini-2026-03-17'
      : compact.includes('grok') && (reasoningLevel === 'thinking' || compact.includes('reason'))
        ? 'grok-4-1-fast-reasoning'
        : compact.includes('grok')
          ? 'grok-4-1-fast-non-reasoning'
          : null;
  if (!inferredModel) return null;
  const normalizedModel = normalizeSupportedChatModel(inferredModel);
  const normalizedReasoningLevel = reasoningLevel || inferSupportedChatReasoningLevel(normalizedModel);
  return {
    label: `${normalizedModel} / ${normalizedReasoningLevel}`,
    command,
    model: normalizedModel,
    reasoningLevel: normalizedReasoningLevel,
  };
}

function matchImageModelChoice(command: string): ImageModelChoice | null {
  const rest = command.replace(/^\/image\b/, '').trim();
  if (!rest) return null;

  const numbered = Number.parseInt(rest, 10);
  if (Number.isInteger(numbered) && numbered >= 1 && numbered <= IMAGE_MODEL_CHOICES.length) {
    return IMAGE_MODEL_CHOICES[numbered - 1] || null;
  }

  if (rest === 'default') {
    return IMAGE_MODEL_CHOICES[0] || null;
  }

  const parts = rest.split(/\s+/).filter(Boolean);
  const quality = parts.at(-1) || null;
  const modelText = quality ? parts.slice(0, -1).join(' ') || rest : rest;
  const compact = modelText.replace(/[\s_-]+/g, '-');
  const requestedModel = compact.includes('grok')
    ? 'grok-imagine-image'
    : compact.includes('gpt-image-2')
      ? 'gpt-image-2'
      : compact.includes('gpt-image-1-mini') || compact.includes('gpt-image-mini') || compact.includes('mini')
        ? 'gpt-image-1-mini'
        : modelText;
  const normalized = normalizeGeneratedImagePreference(requestedModel, quality);
  if (!normalized.model) return null;
  return {
    label: `${normalized.model} / ${normalized.quality || 'default'}`,
    command,
    model: normalized.model,
    quality: normalized.quality,
  };
}

async function persistChatModelChoice(userId: string, choice: ChatModelChoice): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    update: {
      defaultChatModel: choice.model,
      defaultChatReasoningLevel: choice.reasoningLevel,
    },
    create: {
      userId,
      defaultChatModel: choice.model,
      defaultChatReasoningLevel: choice.reasoningLevel,
    },
  });
}

async function persistImageModelChoice(userId: string, choice: ImageModelChoice): Promise<void> {
  const normalized = normalizeGeneratedImagePreference(choice.model, choice.quality);
  if (!normalized.model) {
    throw new Error('unsupported_generated_image_preference');
  }
  await prisma.userSettings.upsert({
    where: { userId },
    update: {
      defaultGeneratedImageModel: normalized.model,
      defaultGeneratedImageQuality: normalized.quality,
    },
    create: {
      userId,
      defaultGeneratedImageModel: normalized.model,
      defaultGeneratedImageQuality: normalized.quality,
    },
  });
}

const socialSettingsCommandDeps: SocialSettingsCommandDeps = {
  async getPendingMenu(replyContextKey) {
    return cacheClient.getJson<PendingSocialSettingsMenu>(buildPendingMenuCacheKey(replyContextKey));
  },
  async setPendingMenu(replyContextKey, pending) {
    await cacheClient.setJson(
      buildPendingMenuCacheKey(replyContextKey),
      pending,
      PENDING_SOCIAL_SETTINGS_MENU_TTL_SECONDS,
    );
  },
  async clearPendingMenu(replyContextKey) {
    await cacheClient.del(buildPendingMenuCacheKey(replyContextKey));
  },
  persistChatModelChoice,
  persistImageModelChoice,
};

async function storePendingMenu(
  replyContextKey: string | null,
  userId: string,
  kind: SocialSettingsMenuKind,
  deps: SocialSettingsCommandDeps,
): Promise<void> {
  if (!replyContextKey) return;
  await deps.setPendingMenu(replyContextKey, { userId, kind }).catch(() => undefined);
}

async function clearPendingMenu(replyContextKey: string | null, deps: SocialSettingsCommandDeps): Promise<void> {
  if (!replyContextKey) return;
  await deps.clearPendingMenu(replyContextKey).catch(() => undefined);
}

async function resolvePendingBareNumberChoice(
  userId: string,
  command: string,
  replyContextKey: string | null,
  deps: SocialSettingsCommandDeps,
): Promise<{ kind: SocialSettingsMenuKind; choice: ChatModelChoice | ImageModelChoice } | null> {
  const numbered = extractBareNumberChoice(command);
  if (!numbered || !replyContextKey) return null;
  const pending = await deps.getPendingMenu(replyContextKey).catch(() => null);
  if (!pending || pending.userId !== userId) return null;
  const choice =
    pending.kind === 'model'
      ? CHAT_MODEL_CHOICES[numbered - 1] || null
      : IMAGE_MODEL_CHOICES[numbered - 1] || null;
  if (!choice) return null;
  return { kind: pending.kind, choice };
}

export async function handleSocialSettingsCommand(params: {
  userId: string;
  text: string;
  replyContextKey?: string | null;
  deps?: SocialSettingsCommandDeps;
}): Promise<SocialSettingsCommandResult> {
  const deps = params.deps || socialSettingsCommandDeps;
  const command = normalizeCommandText(params.text);
  const replyContextKey = normalizeReplyContextKey(params.replyContextKey);
  const pendingChoice = await resolvePendingBareNumberChoice(params.userId, command, replyContextKey, deps);
  if (!command.startsWith('/model') && !command.startsWith('/image') && !pendingChoice) {
    return { handled: false };
  }

  if (pendingChoice?.kind === 'model') {
    await deps.persistChatModelChoice(params.userId, pendingChoice.choice as ChatModelChoice);
    await clearPendingMenu(replyContextKey, deps);
    return {
      handled: true,
      replyText: `Saved reply model: ${pendingChoice.choice.label}`,
    };
  }

  if (pendingChoice?.kind === 'image') {
    await deps.persistImageModelChoice(params.userId, pendingChoice.choice as ImageModelChoice);
    await clearPendingMenu(replyContextKey, deps);
    return {
      handled: true,
      replyText: `Saved image model: ${pendingChoice.choice.label}`,
    };
  }

  if (command === '/model') {
    await storePendingMenu(replyContextKey, params.userId, 'model', deps);
    return { handled: true, replyText: buildModelMenu() };
  }
  if (command.startsWith('/model')) {
    const choice = matchChatModelChoice(command);
    if (!choice) {
      await storePendingMenu(replyContextKey, params.userId, 'model', deps);
      return { handled: true, replyText: `${buildModelMenu()}\n\nReply with one exact command above or just the number.` };
    }
    await deps.persistChatModelChoice(params.userId, choice);
    await clearPendingMenu(replyContextKey, deps);
    return {
      handled: true,
      replyText: `Saved reply model: ${choice.label}`,
    };
  }

  if (command === '/image') {
    await storePendingMenu(replyContextKey, params.userId, 'image', deps);
    return { handled: true, replyText: buildImageMenu() };
  }

  const choice = matchImageModelChoice(command);
  if (!choice) {
    await storePendingMenu(replyContextKey, params.userId, 'image', deps);
    return { handled: true, replyText: `${buildImageMenu()}\n\nReply with one exact command above or just the number.` };
  }
  await deps.persistImageModelChoice(params.userId, choice);
  await clearPendingMenu(replyContextKey, deps);
  return {
    handled: true,
    replyText: `Saved image model: ${choice.label}`,
  };
}

export const __socialSettingsCommandTest = {
  buildModelMenu,
  buildImageMenu,
  extractBareNumberChoice,
  normalizeReplyContextKey,
  matchChatModelChoice,
  matchImageModelChoice,
  handleSocialSettingsCommand,
};
