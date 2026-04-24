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
  description: string;
};

type ImageModelChoice = {
  label: string;
  command: string;
  model: string;
  quality: string | null;
  inputSupport: string;
};

const CHAT_MODEL_CHOICES: ChatModelChoice[] = [
  {
    label: 'GPT-5.4 Mini / low',
    command: '/model gpt-5.4-mini low',
    model: 'gpt-5.4-mini-2026-03-17',
    reasoningLevel: 'low',
    description: 'fast GPT reasoning for short replies and simple tool use',
  },
  {
    label: 'GPT-5.4 Mini / medium',
    command: '/model gpt-5.4-mini medium',
    model: 'gpt-5.4-mini-2026-03-17',
    reasoningLevel: 'medium',
    description: 'balanced GPT reasoning for normal agent tasks and image planning',
  },
  {
    label: 'DeepSeek V4 Flash / fast',
    command: '/model deepseek flash',
    model: 'deepseek-v4-flash',
    reasoningLevel: 'fast',
    description: 'low-latency text replies for lightweight questions',
  },
  {
    label: 'Grok 4.1 Fast / fast',
    command: '/model grok fast',
    model: 'grok-4-1-fast-non-reasoning',
    reasoningLevel: 'fast',
    description: 'strong search ability and real-time X data for fast social answers',
  },
  {
    label: 'Grok 4.1 Fast / thinking',
    command: '/model grok thinking',
    model: 'grok-4-1-fast-reasoning',
    reasoningLevel: 'thinking',
    description: 'strong search ability, real-time X data, and deeper reasoning',
  },
];

const IMAGE_MODEL_CHOICES: ImageModelChoice[] = [
  {
    label: 'Default image model: FLUX.2 Klein 4B / free',
    command: '/image default',
    model: 'cloudflare-flux-2-klein-4b',
    quality: 'normal',
    inputSupport: describeImageInputSupport('cloudflare-flux-2-klein-4b'),
  },
  {
    label: 'GPT Image 1 Mini / low',
    command: '/image gpt-image-1-mini low',
    model: 'gpt-image-1-mini',
    quality: 'low',
    inputSupport: describeImageInputSupport('gpt-image-1-mini'),
  },
  {
    label: 'GPT Image 1 Mini / medium',
    command: '/image gpt-image-1-mini medium',
    model: 'gpt-image-1-mini',
    quality: 'medium',
    inputSupport: describeImageInputSupport('gpt-image-1-mini'),
  },
  {
    label: 'GPT Image 2 / medium',
    command: '/image gpt-image-2 medium',
    model: 'gpt-image-2',
    quality: 'medium',
    inputSupport: describeImageInputSupport('gpt-image-2'),
  },
  {
    label: 'Cloudflare FLUX.2 Klein 4B / free',
    command: '/image cloudflare-flux-2-klein-4b',
    model: 'cloudflare-flux-2-klein-4b',
    quality: 'normal',
    inputSupport: describeImageInputSupport('cloudflare-flux-2-klein-4b'),
  },
  {
    label: 'Runware FLUX.2 Klein 9B KV / normal',
    command: '/image runware-flux-2-klein-9b-kv',
    model: 'runware-flux-2-klein-9b-kv',
    quality: 'normal',
    inputSupport: describeImageInputSupport('runware-flux-2-klein-9b-kv'),
  },
  {
    label: 'Grok Imagine / normal',
    command: '/image grok normal',
    model: 'grok-imagine-image',
    quality: 'normal',
    inputSupport: describeImageInputSupport('grok-imagine-image'),
  },
  {
    label: 'Grok Imagine Pro / pro',
    command: '/image grok pro',
    model: 'grok-imagine-image-pro',
    quality: 'pro',
    inputSupport: describeImageInputSupport('grok-imagine-image-pro'),
  },
];

const PENDING_SOCIAL_SETTINGS_MENU_TTL_SECONDS = 10 * 60;

function describeChatModelChoice(
  model?: string | null,
  reasoningLevel?: SupportedChatReasoningLevel | null,
): string {
  const normalized = normalizeSupportedChatModel(model);
  const level = reasoningLevel || inferSupportedChatReasoningLevel(normalized);
  if (normalized === 'gpt-5.4-mini-2026-03-17' && level === 'low') {
    return 'fast GPT reasoning for short replies and simple tool use';
  }
  if (normalized === 'gpt-5.4-mini-2026-03-17') {
    return 'balanced GPT reasoning for normal agent tasks and image planning';
  }
  if (normalized === 'deepseek-v4-flash') {
    return 'low-latency text replies for lightweight questions';
  }
  if (normalized === 'grok-4-1-fast-reasoning') {
    return 'strong search ability, real-time X data, and deeper reasoning';
  }
  if (normalized === 'grok-4-1-fast-non-reasoning') {
    return 'strong search ability and real-time X data for fast social answers';
  }
  return 'general text model for replies and tool use';
}

function describeImageInputSupport(model?: string | null): string {
  const normalized = String(model || '').trim().toLowerCase();
  if (normalized === 'cloudflare-flux-2-klein-4b') {
    return 'text-to-image only; no edit/reference image input';
  }
  if (normalized === 'runware-flux-2-klein-9b-kv') {
    return 'supports reference image input; edit support is provider-limited';
  }
  if (
    normalized === 'gpt-image-1-mini'
    || normalized === 'gpt-image-2'
    || normalized === 'grok-imagine-image'
    || normalized === 'grok-imagine-image-pro'
  ) {
    return 'supports edit and reference image input';
  }
  return 'input support depends on provider';
}

function normalizeCommandText(text: string): string {
  const normalized = String(text || '')
    .replace(/@\w+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return normalized.replace(/^-\s*(?=\/|\d)/, '');
}

function buildModelMenu(): string {
  return [
    'Reply with one model command or just the number:',
    ...CHAT_MODEL_CHOICES.map((choice, index) => `${index + 1}. ${choice.command} — ${choice.label}: ${choice.description}`),
  ].join('\n');
}

function buildImageMenu(): string {
  return [
    'Reply with one image command or just the number:',
    ...IMAGE_MODEL_CHOICES.map((choice, index) => `${index + 1}. ${choice.command} — ${choice.inputSupport}`),
  ].join('\n');
}

function buildPendingMenuCacheKey(replyContextKey: string): string {
  return `social-settings:pending-menu:${replyContextKey}`;
}

function normalizeReplyContextKey(replyContextKey: string | null | undefined): string | null {
  const normalized = String(replyContextKey || '').trim().toLowerCase();
  return normalized || null;
}

function normalizeChoiceLookupText(text: string | null | undefined): string {
  return String(text || '')
    .replace(/^\/(?:model|image)\b/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function matchesChoiceText(
  text: string,
  choice: Pick<ChatModelChoice | ImageModelChoice, 'label' | 'command' | 'model'>,
): boolean {
  const lookup = normalizeChoiceLookupText(text);
  if (!lookup || lookup.length < 4) return false;
  return [choice.label, choice.command, choice.model].some((candidate) => {
    const normalized = normalizeChoiceLookupText(candidate);
    return normalized === lookup || normalized.includes(lookup);
  });
}

function extractMenuChoiceNumber(command: string): number | null {
  const choiceText = command
    .replace(/^\/(?:model|image)\b/, '')
    .trim()
    .replace(/^-\s*/, '')
    .trim();
  if (!/^\d+$/.test(choiceText)) return null;
  const numbered = Number.parseInt(choiceText, 10);
  return Number.isInteger(numbered) && numbered >= 1 ? numbered : null;
}

function matchChatModelChoice(command: string): ChatModelChoice | null {
  const rest = command.replace(/^\/model\b/, '').trim();
  if (!rest) return null;

  const numbered = extractMenuChoiceNumber(command);
  if (numbered !== null && numbered >= 1 && numbered <= CHAT_MODEL_CHOICES.length) {
    return CHAT_MODEL_CHOICES[numbered - 1] || null;
  }

  const namedChoice = CHAT_MODEL_CHOICES.find((choice) => matchesChoiceText(rest, choice));
  if (namedChoice) return namedChoice;

  const reasoningLevel = normalizeSupportedChatReasoningLevel(rest.split(/\s+/).at(-1));
  const modelText = reasoningLevel ? rest.replace(new RegExp(`\\b${reasoningLevel}\\b$`), '').trim() : rest;
  const compact = modelText.replace(/[\s_-]+/g, '-');
  const inferredModel =
    compact.includes('gpt-5.4-mini') || compact.includes('gpt-54-mini') || compact.includes('gpt5.4-mini')
      ? 'gpt-5.4-mini-2026-03-17'
      : compact.includes('deepseek')
        ? 'deepseek-v4-flash'
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
    description: describeChatModelChoice(normalizedModel, normalizedReasoningLevel),
  };
}

function matchImageModelChoice(command: string): ImageModelChoice | null {
  const rest = command.replace(/^\/image\b/, '').trim();
  if (!rest) return null;

  const numbered = extractMenuChoiceNumber(command);
  if (numbered !== null && numbered >= 1 && numbered <= IMAGE_MODEL_CHOICES.length) {
    return IMAGE_MODEL_CHOICES[numbered - 1] || null;
  }

  if (rest === 'default') {
    return IMAGE_MODEL_CHOICES[0] || null;
  }

  const namedChoice = IMAGE_MODEL_CHOICES.find((choice) => matchesChoiceText(rest, choice));
  if (namedChoice) return namedChoice;

  const parts = rest.split(/\s+/).filter(Boolean);
  const quality = parts.at(-1) || null;
  const modelText = quality ? parts.slice(0, -1).join(' ') || rest : rest;
  const compact = modelText.replace(/[\s_-]+/g, '-');
  const requestedModel = compact.includes('cloudflare') || compact.includes('flux-2-klein-4b')
    ? 'cloudflare-flux-2-klein-4b'
    : compact.includes('runware') || compact.includes('flux-2-klein-9b-kv') || compact.includes('flux.2-klein-9b-kv')
      ? 'runware-flux-2-klein-9b-kv'
      : compact.includes('grok-imagine-image-pro') || compact.includes('grok-pro') || compact.includes('grokpro')
        || compact.includes('grok-imagine-pro')
        ? 'grok-imagine-image-pro'
      : compact.includes('grok')
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
    inputSupport: describeImageInputSupport(normalized.model),
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
  if (!replyContextKey) return null;
  const pending = await deps.getPendingMenu(replyContextKey).catch(() => null);
  if (!pending || pending.userId !== userId) return null;
  const numbered = extractMenuChoiceNumber(command);
  const numberedChoice = numbered
    ? pending.kind === 'model'
      ? CHAT_MODEL_CHOICES[numbered - 1] || null
      : IMAGE_MODEL_CHOICES[numbered - 1] || null
    : null;
  const choice = numberedChoice
    || (pending.kind === 'model'
      ? matchChatModelChoice(command.startsWith('/model') ? command : `/model ${command}`)
      : matchImageModelChoice(command.startsWith('/image') ? command : `/image ${command}`));
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
  extractMenuChoiceNumber,
  normalizeReplyContextKey,
  matchChatModelChoice,
  matchImageModelChoice,
  handleSocialSettingsCommand,
};
