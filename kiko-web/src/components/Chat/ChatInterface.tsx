import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { toast } from '../Toast';
import { WelcomeScreen } from './WelcomeScreen';
import type { SuggestionItem } from './ChatInputSuggestions';
import { useSmartSuggestions } from './useSmartSuggestions.tsx';
import { useSidebar } from '../Layout/Layout';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useChain } from '../../contexts/ChainContext';
import type { TradingStrategy } from '../../hooks/useStrategies';
import { useSafariKeyboardFix } from '../../hooks/useSafariKeyboardFix';
import styles from './Chat.module.css';
import { chatApi } from '../../services/api';
import { getWalletBalance } from '../../services/walletApi';
import { chatWSClient, type ChatEvent } from '../../utils/chatWebSocket';
import { clearActiveTask } from '../../utils/taskLifecycle';
import type { Conversation, Message } from '../../hooks/useConversations';
import { useConversationContext } from '../../contexts/ConversationContext';
import { useFarcasterContext } from '../../contexts/FarcasterContext';
import { moderationService } from '../../services/moderation';
import { logger } from '../../utils/logger';
import { getStoredSlippageBps } from '@/config/slippageConfig';
import { getUserSettings, saveUserSettings } from '../../services/userSettingsApi';
import { ChatMessageList } from './ChatMessageList';
import { ChatComposer } from './ChatComposer';
import {
  readStoredChatModelSelection,
  readStoredChatModelSelectionState,
} from './chatModelSelectionPersistence';
import {
  assistantMessageHasStreamingContent,
  isEffectivelyStreamingAssistantMessage,
  resolveGeneratedImageMessageStatus,
  shouldClearActiveTaskForGeneratedImageUpdate,
} from './generatedImageTaskState';
import {
  ACTION_CARD_TYPE_MAP,
  COMMON_TOKENS,
  type ChatModelOption,
  coerceSelectableChatModelOption,
  findChatModelOption,
  getDefaultChatModelOption,
  hydrateChatModelOption,
  isTextChatModelOption,
  supportsGeneratedImageInputModel,
  supportsVisionChatModel,
} from './chatConstants';
import {
  createComposerImageDraft,
  MAX_COMPOSER_IMAGE_COUNT,
  type ComposerImageDraft,
  toComposerImageAttachment,
  validateComposerImageFile,
} from './chatImageDrafts';
import {
  requiresContractAddressInFastMode,
  resolveNativeToken,
  resolveTokenForChat,
  resolveTokenForFastSwap,
} from './chatTokenResolution';
import { mergeTransactionCardData } from '../../utils/transactionCardState';
import type { ChatStrategyRuntimeState } from './ChatStrategyRuntime';

const LazyCustomAISettingsModal = React.lazy(() =>
  import('./CustomAISettingsModal').then((m) => ({ default: m.CustomAISettingsModal }))
);
const LazyChatStrategyRuntime = React.lazy(() =>
  import('./ChatStrategyRuntime').then((m) => ({ default: m.ChatStrategyRuntime }))
);

// CONTEXT MEMORY
// Updated: 2026-04-21
// Author: Rowan
// Reason: First-send interaction and live assistant-card rendering both depend
//         on this owner preserving a single in-place chat surface while websocket
//         events arrive out of order. The same owner now also has to preserve
//         local image-draft state across the welcome shell -> live chat
//         transition so first-send attachment previews do not disappear before
//         the upload pipeline runs, and it now owns selection-time image upload
//         plus upload-phase interaction locking before the backend task starts.
//         The borderless model/reasoning picker chrome moved into ChatComposer
//         and WelcomeScreen; this owner now coordinates the session bootstrap
//         around the active model choice, including reasoning strength when
//         the selected family exposes multiple effort levels.
//         The welcome/home default still writes to shared localStorage
//         immediately on user choice so a fast refresh does not lose the
//         reasoning state before the next effect flush. The active
//         conversation route may mirror a session model for sending, but it
//         must not overwrite the welcome-shell default snapshot when the two
//         diverge. The shared snapshot still remembers the last control level
//         per family so switching away and back restores the same reasoning
//         or quality choice instead of the family default.
//         Generated-image selections can now persist locally in the same picker
//         state, but must not overwrite the authenticated user's default chat
//         model because the backend chat setting only owns text models.
//         Generated-image prompts now also execute through a dedicated backend
//         route, so this owner must branch send-time behavior between text chat
//         and image generation while keeping one transcript surface. The dev
//         test mode also needs to follow the real generated-image progress
//         contract now, because fake provider stages were diverging from the
//         production payload. The local test path now also owns a chat-box
//         full-flow replay command that binds a stable already-generated image
//         and logs each state transition so flash-to-loading regressions can be
//         separated from component rendering bugs. Production Farcaster logs on
//         2026-04-21 showed live-chat image-model picker changes were only
//         local, so explicit picker clicks now also persist the matching remote
//         text or generated-image default without letting route hydration write
//         back old conversation models.
// Goal: keep `ChatInterface` as the stable owner for welcome -> send ->
//       conversation creation and live card presentation, rendering the chat
//       surface immediately and attaching assistant cards even if their client
//       actions arrive before the text placeholder, while carrying local image
//       drafts through the same single-owner flow, exposing upload progress in
//       the composer, turning drafts into backend-prepared upload ids before
//       send, and routing generated-image prompts into the same transcript.
// Owns: chat runtime bootstrapping, first-send/session behavior, local image
//       draft lifecycle, selection-time image upload orchestration, active
//       conversation model selection, local generated-image quality selection,
//       user-initiated remote model preference writes, text-vs-image send
//       branching, and live assistant card attachment in the active conversation
//       view.
// Does Not Own: the welcome-shell default model snapshot, route/session
//       hydration writes back into user defaults, route-level shell experiments,
//       or the borderless picker chrome now owned by ChatComposer and WelcomeScreen.
// Design Language:
// - first-send flow should stay inside one chat owner
// - the primary message list is part of the core chat surface, not a deferred
//   post-send chunk
// - pending session creation may lock duplicate sends, but must not render a
//   standalone loading spinner before assistant/task state exists
// - prompt prefills may populate input, but should not introduce a second boot path
// - rich assistant client actions must survive websocket event reordering inside
//   the active conversation view
// - local image drafts belong to the chat owner until backend upload starts
// - image uploads should start when the user selects files, not when the model task starts
// - prepared upload ids are local draft state until send and must be discarded if never sent
// - refreshed image history must come from backend-signed attachments, not local object URLs
// - text-only models must not silently accept image turns
// - generated-image model selections may live in local picker state, but must
//   not be saved as remote default chat models
// - user-initiated live picker changes may update remote defaults, but
//   conversation/session hydration must not write remote defaults
// - disabled image variants must never be restored as the active selection from
//   local persistence
// - generated-image prompts should use the dedicated image route, not the text send route
// - only GPT image models may accept reference-image drafts; unsupported image families must block before send
// - local generated-image test commands must mirror the real provider progress
//   contract, not obsolete fake stage labels
// - local generated-image test injections must promote the welcome shell into
//   the live chat surface even before a conversation exists, or the injected
//   transcript row will stay hidden behind the welcome screen
// - local generated-image flow replay must use the real transcript card and
//   timed state transitions, not a detached route or fake preview surface
// - local generated-image flow replay may intentionally simulate a stale
//   downgrade after completion when requested so parent-state overwrite bugs
//   can be reproduced in the same chat surface
// - generated-image data updates must preserve the visible image message type
//   even if hydration arrives before or after message_start
// - generated-image terminal payloads must settle message status and active
//   task cleanup even if `message_complete` or `task_status` arrive late
// - forbidden local patch patterns: route-wrapper handoff logic that auto-submits through remount
// Document Provenance:
// - Source: Runtime observation of repeated loading and streaming UI churn after first send
// - Kind: runtime observation
// - Retrieved: 2026-04-12
// - Applied To: remove home-shell handoff auto-submit behavior and restore single-owner flow
// - Verification: verified in runtime
// - Source: Git comparison against ca8163b from 2026-03-12
// - Kind: repo history
// - Retrieved: 2026-04-12
// - Applied To: restore eager primary message-list rendering and remove visible first-send loading
// - Verification: verified in code
// - Source: Runtime observation of copytrade cards only appearing after re-entering the conversation
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: ensure `show_strategy_card` can create the live assistant card message when the placeholder has not been inserted yet
// - Verification: verified in code
// - Source: /Users/almurat/Downloads/logs.1776742368695.json
// - Kind: runtime observation
// - Retrieved: 2026-04-21
// - Applied To: persisting live-chat image-model picker changes to
//   `defaultGeneratedImageModel` for Farcaster social image turns
// - Verification: verified in runtime log and code
// - Source: user-provided local UI requirement and screenshot review on 2026-04-16
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: preserving local image draft previews across welcome -> chat transition and optimistic user messages
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: selection-time image upload before send and image-capable model gating
// - Verification: verified in code
// - Source: operator correction that refreshed chat history must preserve image bubbles
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: separating optimistic local image previews from durable backend-signed history attachments
// - Verification: verified in code
// - Source: user screenshot request showing borderless model and reasoning controls
// - Kind: product doc
// - Retrieved: 2026-04-17
// - Applied To: moving model/reasoning picker chrome out of ChatInterface and into ChatComposer
// - Verification: inferred
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-input-borderless-model-reasoning-selector.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: documenting that ChatInterface no longer owns the picker chrome
// - Verification: inferred
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-image-model-selector-sections.md
// - Kind: repo doc
// - Retrieved: 2026-04-18
// - Applied To: keeping generated-image picker selections out of remote chat defaults
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: local-first restore and remote persistence of selected reasoning level
// - Verification: verified in code
// - Source: current bug report that the homepage model should not inherit the
//   active conversation model after exiting chat
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: scoping model sync so the welcome/home snapshot is not
//   overwritten by chat-route hydration
// - Verification: inferred from code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-billing-and-gating.md
// - Kind: repo doc
// - Retrieved: 2026-04-18
// - Applied To: coercing disabled image variants back to a selectable local model
// - Verification: verified in code
// - Source: operator request on 2026-04-18 to execute generated-image replies inside chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: branching send-time execution between text chat and image generation
// - Verification: verified in code
// - Source: operator request on 2026-04-18 for a local generated-image card
//           UI test mode
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: adding a dev-only local transcript injector for generated-image
//   card state testing without hitting provider APIs
// - Verification: verified in code
// - Source: OpenAI `/v1/images/generations` OpenAPI spec and image generation guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: local OpenAI generated-image test states that simulate
//   partial-image milestone updates
// - Verification: verified in docs and code
// - Source: xAI Streaming guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: local Grok generated-image test states avoid fake streamed
//   progress phases
// - Verification: verified in docs and code
// - Source: operator runtime request on 2026-04-19 for chat-box full-chain
//           generated-image replay using an existing generated image
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: adding `/test-generated-image flow` with timed transcript
//   state updates and console diagnostics
// - Verification: verified in code
// - Source: operator screenshot and runtime report on 2026-04-19 showing a
//   generated-image card rendered while the composer kept loading
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: binding generated-image terminal `update_message_data` payloads
//   to assistant message status repair and task cleanup
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-chat-home-shell-regression-revert.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-first-send-no-loading-chat-entry.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-copytrade-card-live-hydration.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-input-borderless-model-reasoning-selector.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-model-reasoning-selection-persistence.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-image-model-selector-sections.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-billing-and-gating.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-chat-home-default-and-session-model-separation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-local-ui-test-mode.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-generated-image-client-preview-hydration.md
// - /Users/almurat/KiKo/kiko-web/src/components/Chat/chatModelSelectionPersistence.ts

interface TaskState {
  id: string;
  status: string;
  messageId?: string | null;
  [key: string]: unknown;
}

const normalizeUiTaskStatus = (
  status: unknown
): 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'queued') return 'queued';
  if (normalized === 'pending') return 'pending';
  if (normalized === 'running') return 'running';
  if (normalized === 'completed' || normalized === 'done') return 'completed';
  if (normalized === 'failed' || normalized === 'error') return 'failed';
  return 'cancelled';
};

type PendingChunk = {
  content: string;
  reasoning: string;
};

interface ChatInterfaceProps {
  conversationId?: string | null;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  onNewConversation?: (title: string) => Promise<string | null>;
  conversationTitle?: string;
  onNewChat?: () => void;
  pendingAIPrompt?: string | null;
  onAIPromptSet?: () => void;
  activeTask?: TaskState | null;
  onTaskUpdate?: (task: TaskState | null) => void;
}

const extractAddresses = (text: string): string[] => {
  const matches = text.match(/0x[a-fA-F0-9]{40}/gi);
  return matches ? Array.from(new Set(matches)) : [];
};

const replaceMessageAtIndex = (
  messages: Message[],
  idx: number,
  nextMessage: Message
): Message[] => {
  if (idx < 0 || idx >= messages.length) return messages;
  if (messages[idx] === nextMessage) return messages;
  const updated = [...messages];
  updated[idx] = nextMessage;
  return updated;
};

const mergeRenderContracts = (existing: any, incoming: any): any[] => {
  const current = Array.isArray(existing) ? existing : existing ? [existing] : [];
  const next = Array.isArray(incoming) ? incoming : incoming ? [incoming] : [];
  const merged = [...current];
  for (const contract of next) {
    if (!contract || typeof contract !== 'object') continue;
    const incomingId = String(contract.id || '').trim();
    const idx = merged.findIndex(
      (item) => String(item?.id || '').trim() === incomingId && incomingId
    );
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...contract };
    } else {
      merged.push(contract);
    }
  }
  return merged;
};

const LOCAL_TX_CARD_TEST_COMMANDS = new Set([
  '/test-tx-card',
  '/tx-card-test',
  'test tx card',
  'tx card test',
]);

const LOCAL_GENERATED_IMAGE_TEST_PREFIXES = [
  '/test-image-card',
  '/image-card-test',
  '/test-generated-image',
  '/test-generated-image-flow',
];

const isLocalUiTestEnvironment = () =>
  import.meta.env.DEV ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const isLocalTxCardTestCommand = (text: string) =>
  LOCAL_TX_CARD_TEST_COMMANDS.has(text.trim().toLowerCase());

type LocalGeneratedImageTestVariant =
  | 'queued'
  | 'generating'
  | 'moderating'
  | 'saving'
  | 'refining'
  | 'finalizing'
  | 'failed'
  | 'complete'
  | 'multi'
  | 'flow';

type LocalGeneratedImageTestProvider = 'openai' | 'xai';

type LocalGeneratedImageTestConfig = {
  provider: LocalGeneratedImageTestProvider;
  variant: LocalGeneratedImageTestVariant;
  frameAspectRatio: number;
  imageUrl?: string;
  simulateStaleDowngrade?: boolean;
};

type LocalGeneratedImageFlowPhase =
  | 'queued'
  | 'generating'
  | 'preview'
  | 'saving'
  | 'complete'
  | 'stale-downgrade';

const LOCAL_GENERATED_IMAGE_FLOW_DEFAULT_IMAGE_URL = '/news-covers/zora-canvas-1772115882998.png';
const LOCAL_GENERATED_IMAGE_FLOW_DEFAULT_SIZE = {
  width: 3454,
  height: 1656,
};

const LOCAL_GENERATED_IMAGE_VARIANT_ALIASES: Record<string, LocalGeneratedImageTestVariant> = {
  queued: 'queued',
  queue: 'queued',
  generating: 'generating',
  loading: 'generating',
  moderating: 'moderating',
  moderation: 'moderating',
  safety: 'moderating',
  saving: 'saving',
  refine: 'refining',
  refining: 'refining',
  finalize: 'finalizing',
  finalizing: 'finalizing',
  failed: 'failed',
  error: 'failed',
  complete: 'complete',
  done: 'complete',
  multi: 'multi',
  grid: 'multi',
  flow: 'flow',
  replay: 'flow',
  sequence: 'flow',
};

const LOCAL_GENERATED_IMAGE_PROVIDER_ALIASES: Record<string, LocalGeneratedImageTestProvider> = {
  openai: 'openai',
  gpt: 'openai',
  gptimage: 'openai',
  xai: 'xai',
  grok: 'xai',
  grokimagine: 'xai',
};

const LOCAL_GENERATED_IMAGE_ASPECT_ALIASES: Record<string, number> = {
  square: 1,
  portrait: 0.7,
  vertical: 0.7,
  tall: 0.7,
  landscape: 1.6,
  wide: 1.6,
  horizontal: 1.6,
};

function parseLocalGeneratedImageUrlToken(token: string): string | null {
  const value = token.replace(/^url=/i, '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return value;
  return null;
}

function parseLocalGeneratedImageTestCommand(
  rawText: string
): LocalGeneratedImageTestConfig | null {
  const normalized = rawText.trim().toLowerCase();
  const matchedPrefix = LOCAL_GENERATED_IMAGE_TEST_PREFIXES.find(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix} `)
  );
  if (!matchedPrefix) return null;

  const tokens = normalized.slice(matchedPrefix.length).trim().split(/\s+/).filter(Boolean);

  let provider: LocalGeneratedImageTestProvider = 'openai';
  let variant: LocalGeneratedImageTestVariant =
    matchedPrefix === '/test-generated-image-flow' ? 'flow' : 'generating';
  let frameAspectRatio = 1;
  let imageUrl: string | undefined;
  let simulateStaleDowngrade = false;

  for (const token of tokens) {
    const imageUrlToken = parseLocalGeneratedImageUrlToken(token);
    if (imageUrlToken) {
      imageUrl = imageUrlToken;
      continue;
    }
    if (token === 'stale' || token === 'downgrade' || token === 'flash') {
      simulateStaleDowngrade = true;
      continue;
    }
    const providerAlias = LOCAL_GENERATED_IMAGE_PROVIDER_ALIASES[token];
    if (providerAlias) {
      provider = providerAlias;
      continue;
    }
    const aspectAlias = LOCAL_GENERATED_IMAGE_ASPECT_ALIASES[token];
    if (aspectAlias) {
      frameAspectRatio = aspectAlias;
      continue;
    }
    const variantAlias = LOCAL_GENERATED_IMAGE_VARIANT_ALIASES[token];
    if (variantAlias) {
      variant = variantAlias;
    }
  }

  if (variant === 'refining') provider = 'openai';
  if (variant === 'finalizing') provider = 'xai';
  if (variant === 'flow' && !imageUrl) {
    imageUrl = LOCAL_GENERATED_IMAGE_FLOW_DEFAULT_IMAGE_URL;
    frameAspectRatio = LOCAL_GENERATED_IMAGE_FLOW_DEFAULT_SIZE.width / LOCAL_GENERATED_IMAGE_FLOW_DEFAULT_SIZE.height;
  }

  return { provider, variant, frameAspectRatio, imageUrl, simulateStaleDowngrade };
}

function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createLocalGeneratedImagePreviewUrl(_label: string, accent: string): string {
  const safeAccent = escapeSvgText(accent);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none">
  <defs>
    <linearGradient id="bg" x1="96" y1="64" x2="928" y2="960" gradientUnits="userSpaceOnUse">
      <stop stop-color="${safeAccent}" />
      <stop offset="1" stop-color="#0F172A" />
    </linearGradient>
    <linearGradient id="shine" x1="144" y1="176" x2="880" y2="848" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF" stop-opacity="0.84" />
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.04" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="64" fill="url(#bg)" />
  <circle cx="792" cy="248" r="188" fill="#FFFFFF" fill-opacity="0.12" />
  <circle cx="248" cy="768" r="224" fill="#FFFFFF" fill-opacity="0.08" />
  <path d="M132 724C233 580 338 508 448 508C558 508 642 566 734 648C792 700 849 726 904 726V896H132V724Z" fill="#FFFFFF" fill-opacity="0.12" />
  <rect x="128" y="128" width="768" height="768" rx="44" fill="url(#shine)" opacity="0.18" />
</svg>`.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildLocalGeneratedImageTestPayload(config: LocalGeneratedImageTestConfig) {
  const isOpenAi = config.provider === 'openai';
  const accent = isOpenAi ? '#3B82F6' : '#7C3AED';
  const providerLabel = isOpenAi ? 'GPT Image 2' : 'Grok Imagine';
  const aspectRatio = Number.isFinite(config.frameAspectRatio) ? config.frameAspectRatio : 1;
  const imageHeight = aspectRatio >= 1 ? 1024 : 1440;
  const imageWidth = Math.round(imageHeight * aspectRatio);
  const makeImage = (suffix: string) => ({
    id: `local-generated-image-${config.variant}-${suffix}`,
    previewUrl: createLocalGeneratedImagePreviewUrl(`${providerLabel} ${suffix}`, accent),
    name: `${providerLabel} ${suffix}`,
    width: imageWidth,
    height: imageHeight,
  });

  const payload: Record<string, unknown> = {
    provider: isOpenAi ? 'openai' : 'xai',
    providerModel: isOpenAi ? 'gpt-image-2' : 'grok-imagine-image',
    quality: isOpenAi ? 'high' : 'normal',
    supportsProgressiveReveal: isOpenAi,
    partialImageIndex: null,
    partialImageCount: isOpenAi ? 2 : null,
    frameAspectRatio: aspectRatio,
    images: [],
    errorMessage: null,
  };

  switch (config.variant) {
    case 'queued':
      payload.status = 'queued';
      payload.stageLabel = 'Queued';
      break;
    case 'moderating':
      payload.status = 'moderating';
      payload.stageLabel = 'Checking image safety';
      break;
    case 'saving':
      payload.status = 'saving';
      payload.stageLabel = 'Saving';
      payload.images = [makeImage('Preview')];
      break;
    case 'refining':
      payload.status = 'generating';
      payload.stageLabel = 'Refining preview';
      payload.supportsProgressiveReveal = true;
      payload.partialImageIndex = 1;
      payload.partialImageCount = 2;
      payload.provider = 'openai';
      payload.providerModel = 'gpt-image-2';
      payload.quality = 'high';
      break;
    case 'finalizing':
      payload.status = 'saving';
      payload.stageLabel = 'Saving';
      payload.images = [makeImage('Preview')];
      payload.supportsProgressiveReveal = false;
      payload.partialImageCount = null;
      payload.provider = 'xai';
      payload.providerModel = 'grok-imagine-image';
      payload.quality = 'normal';
      break;
    case 'failed':
      payload.status = 'failed';
      payload.stageLabel = 'Failed';
      payload.errorMessage = 'Local generated-image UI test error.';
      break;
    case 'complete':
      payload.status = 'complete';
      payload.stageLabel = 'Complete';
      payload.images = [makeImage('Complete')];
      break;
    case 'multi':
      payload.status = 'complete';
      payload.stageLabel = 'Complete';
      payload.images = [makeImage('One'), makeImage('Two')];
      break;
    case 'generating':
    default:
      payload.status = 'generating';
      payload.stageLabel = 'Generating';
      break;
  }

  return payload;
}

function buildLocalGeneratedImageFlowPayload(
  config: LocalGeneratedImageTestConfig,
  phase: LocalGeneratedImageFlowPhase
) {
  const isOpenAi = config.provider === 'openai';
  const imageUrl = config.imageUrl || LOCAL_GENERATED_IMAGE_FLOW_DEFAULT_IMAGE_URL;
  const aspectRatio = Number.isFinite(config.frameAspectRatio)
    ? config.frameAspectRatio
    : LOCAL_GENERATED_IMAGE_FLOW_DEFAULT_SIZE.width / LOCAL_GENERATED_IMAGE_FLOW_DEFAULT_SIZE.height;
  const image = {
    id: 'local-generated-image-flow-main',
    previewUrl: imageUrl,
    publicUrl: imageUrl,
    url: imageUrl,
    name: 'Local generated-image flow replay',
    width: LOCAL_GENERATED_IMAGE_FLOW_DEFAULT_SIZE.width,
    height: LOCAL_GENERATED_IMAGE_FLOW_DEFAULT_SIZE.height,
  };
  const payload: Record<string, unknown> = {
    provider: isOpenAi ? 'openai' : 'xai',
    providerModel: isOpenAi ? 'gpt-image-2' : 'grok-imagine-image',
    quality: isOpenAi ? 'high' : 'normal',
    supportsProgressiveReveal: isOpenAi,
    partialImageIndex: null,
    partialImageCount: isOpenAi ? 2 : null,
    frameAspectRatio: aspectRatio,
    images: [],
    errorMessage: null,
  };

  if (phase === 'queued') {
    payload.status = 'queued';
    payload.stageLabel = 'Queued';
  } else if (phase === 'generating') {
    payload.status = 'generating';
    payload.stageLabel = 'Generating';
  } else if (phase === 'preview') {
    payload.status = 'generating';
    payload.stageLabel = 'Preview ready';
    payload.images = [image];
    payload.partialImageIndex = 0;
  } else if (phase === 'saving') {
    payload.status = 'saving';
    payload.stageLabel = 'Saving';
    payload.images = [image];
    payload.partialImageIndex = isOpenAi ? 1 : null;
  } else if (phase === 'stale-downgrade') {
    payload.status = 'generating';
    payload.stageLabel = 'Stale generating event';
    payload.images = [];
    payload.partialImageIndex = null;
  } else {
    payload.status = 'complete';
    payload.stageLabel = 'Complete';
    payload.images = [image];
    payload.partialImageIndex = isOpenAi ? 1 : null;
  }

  return payload;
}

function summarizeLocalGeneratedImagePayload(payload: Record<string, unknown>) {
  const images = Array.isArray(payload.images) ? payload.images : [];
  return {
    status: payload.status,
    stageLabel: payload.stageLabel,
    imageCount: images.length,
    imageUrls: images.map((image: any) => {
      const url = String(image?.previewUrl || image?.publicUrl || image?.url || '');
      if (url.startsWith('data:')) return `data:${url.length}`;
      return url.length > 120 ? `${url.slice(0, 88)}...${url.slice(-16)}` : url;
    }),
  };
}

function logLocalGeneratedImageFlow(stage: string, metadata: Record<string, unknown>) {
  if (!isLocalUiTestEnvironment()) return;
  console.info(`[GeneratedImageTestFlow:${stage}]`, metadata);
}

type PreparedDraftUpload = {
  draftId: string;
  uploadId: string;
  expiresAt?: string;
  contentType?: string;
  size?: number;
  width?: number | null;
  height?: number | null;
};

function discardPreparedUploadIdsQuietly(uploadIds: string[], reason: string): void {
  const uniqueUploadIds = Array.from(
    new Set(uploadIds.map((uploadId) => String(uploadId || '').trim()).filter(Boolean))
  );
  if (uniqueUploadIds.length === 0) return;
  chatApi.discardImageUploads(uniqueUploadIds).catch((error) => {
    logger.warn('[chat.image] failed to discard prepared image uploads', {
      reason,
      uploadCount: uniqueUploadIds.length,
      error,
    });
  });
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  initialMessages = [],
  pendingAIPrompt: propPendingPrompt,
  onAIPromptSet,
  activeTask: propActiveTask,
  onTaskUpdate,
}) => {
  const {
    conversations,
    activeConversationId,
    updateConversation,
    createConversation,
    loadConversation,
    isLoading,
    registerPendingLocalUserMessage,
  } = useConversationContext();

  const { user, authenticated, ready, login, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const farcasterContext = useFarcasterContext();
  const { currentChain, switchChain } = useChain();
  const sidebar = useSidebar();
  const { resolvedTheme } = useThemeContext();
  const safariKeyboard = useSafariKeyboardFix();

  const chainId = currentChain.id;

  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const routeConversationId = params.conversationId || null;
  const isChatRoute = location.pathname.startsWith('/chat/');
  const conversationId = isChatRoute ? routeConversationId || activeConversationId || null : null;
  const currentConv = conversations.find((c) => c.id === conversationId);
  const messages = currentConv?.messages || initialMessages;
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const hasStreamingAssistant = messages.some((m) => isEffectivelyStreamingAssistantMessage(m));
  const hasStreamingAssistantContent = messages.some((m) => assistantMessageHasStreamingContent(m));
  const activeTask = currentConv?.activeTask || null;
  const activeTaskStatus = (activeTask?.status as string | undefined) || '';
  const hasActiveTaskInProgress =
    activeTaskStatus === 'queued' ||
    activeTaskStatus === 'pending' ||
    activeTaskStatus === 'running' ||
    activeTaskStatus === 'streaming';
  const isStreaming = hasStreamingAssistantContent || activeTaskStatus === 'streaming';
  const isThinking =
    !isStreaming &&
    (hasActiveTaskInProgress || (hasStreamingAssistant && !hasStreamingAssistantContent));
  const activeTaskId = activeTask?.id || null;
  const activeTaskRef = useRef<Conversation['activeTask'] | null>(activeTask);
  useEffect(() => {
    activeTaskRef.current = activeTask;
  }, [activeTask]);
  const activeTaskIdRef = useRef<string | null>(activeTaskId);
  useEffect(() => {
    activeTaskIdRef.current = activeTaskId;
  }, [activeTaskId]);
  const walletAddress = useMemo(() => {
    if (currentChain.id === 900) {
      const solLink = user?.linkedAccounts?.find(
        (acc): acc is WalletWithMetadata =>
          acc.type === 'wallet' && acc.chainType === 'solana' && acc.walletClientType === 'privy'
      );
      if (solLink) return solLink.address;
      const solWallet = wallets.find((w) => w.walletClientType === 'solana');
      return solWallet?.address || '';
    }
    const embeddedEVM = user?.linkedAccounts?.find(
      (acc): acc is WalletWithMetadata =>
        acc.type === 'wallet' && acc.chainType === 'ethereum' && acc.walletClientType === 'privy'
    );
    if (embeddedEVM) return embeddedEVM.address;

    const evmWallet = wallets.find((w) => w.walletClientType !== 'solana');
    return evmWallet?.address || user?.wallet?.address || '';
  }, [wallets, user, currentChain.id]);

  // const chainName = chainNameMap[chainId] || `Chain ${chainId}`;

  // State for user balances (common tokens)
  const [userBalances, setUserBalances] = useState<Record<string, string>>({});
  const [input, setInput] = useState('');
  const [isStopping, setIsStopping] = useState(false);
  const [selectedImageDrafts, setSelectedImageDrafts] = useState<ComposerImageDraft[]>([]);
  const selectedImageDraftsRef = useRef<ComposerImageDraft[]>([]);
  const retainedPreviewUrlsRef = useRef<Set<string>>(new Set());
  const imageDraftOwnerMountedRef = useRef(true);
  const isUploadingImages = selectedImageDrafts.some((draft) => draft.uploadState === 'uploading');
  const hasImageDraftErrors = selectedImageDrafts.some((draft) => draft.uploadState === 'error');
  const hasUnpreparedImageDrafts = selectedImageDrafts.some(
    (draft) => draft.uploadState !== 'error' && !draft.uploadId
  );
  const isImageSendBlocked =
    selectedImageDrafts.length > 0 &&
    (isUploadingImages || hasImageDraftErrors || hasUnpreparedImageDrafts);

  useEffect(() => {
    selectedImageDraftsRef.current = selectedImageDrafts;
  }, [selectedImageDrafts]);

  useEffect(() => {
    imageDraftOwnerMountedRef.current = true;
    return () => {
      imageDraftOwnerMountedRef.current = false;
      for (const previewUrl of retainedPreviewUrlsRef.current) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch (error) {
          logger.warn('Failed to revoke local image preview URL during cleanup', error);
        }
      }
      retainedPreviewUrlsRef.current.clear();
      discardPreparedUploadIdsQuietly(
        selectedImageDraftsRef.current
          .map((draft) => draft.uploadId)
          .filter((uploadId): uploadId is string => Boolean(uploadId)),
        'chat_interface_unmount'
      );
    };
  }, []);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  // chatStarted lives in Layout (SidebarContext); we read via sidebar?.chatStarted and write via sidebar?.setChatStarted
  const [thinkingText, setThinkingText] = useState('Thinking');
  const [thinkingStartTime, setThinkingStartTime] = useState<number>(0);
  const [firstSendPending, setFirstSendPending] = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const isTextSelectionActiveRef = useRef(false);
  const lastCompositionEndRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [welcomePendingMessages, setWelcomePendingMessages] = useState<Message[]>([]);
  const localGeneratedImageFlowTimersRef = useRef<number[]>([]);
  const hasAnyAssistantMessage = useMemo(
    () => messages.some((message) => message.role === 'assistant'),
    [messages]
  );
  const displayMessages = useMemo(() => {
    if (conversationId || welcomePendingMessages.length === 0) return messages;
    const existingIds = new Set(messages.map((m) => m.id));
    const append = welcomePendingMessages.filter((m) => !existingIds.has(m.id));
    return append.length > 0 ? [...messages, ...append] : messages;
  }, [conversationId, messages, welcomePendingMessages]);
  const isBusy = isThinking || isStreaming || firstSendPending;

  const clearLocalGeneratedImageFlowTimers = useCallback(() => {
    for (const timerId of localGeneratedImageFlowTimersRef.current) {
      window.clearTimeout(timerId);
    }
    localGeneratedImageFlowTimersRef.current = [];
  }, []);

  useEffect(() => clearLocalGeneratedImageFlowTimers, [clearLocalGeneratedImageFlowTimers]);

  // Load selected model from localStorage or use default
  const getInitialModel = () => {
    return readStoredChatModelSelection() || getDefaultChatModelOption();
  };

  const [selectedModel, setSelectedModel] = useState(getInitialModel);

  const persistUserSelectedModelPreference = useCallback(async (model: ChatModelOption) => {
    if (!authenticated) return;

    try {
      const token = await getAccessToken();
      if (!token) return;
      if (isTextChatModelOption(model)) {
        await saveUserSettings(token, {
          defaultChatModel: model.id,
          defaultChatReasoningLevel: model.reasoningLevel,
        });
        return;
      }
      await saveUserSettings(token, {
        defaultGeneratedImageModel: model.id,
        defaultGeneratedImageQuality: model.imageQuality || String(model.reasoningLevel || ''),
      });
    } catch (error) {
      logger.warn('Failed to persist selected model preference:', error);
    }
  }, [authenticated, getAccessToken]);

  // Suggestions State (Managed by Hook)
  const {
    suggestions,
    showSuggestions,
    detectIntent,
    closeSuggestions,
    suppressSuggestions,
    resumeSuggestions,
  } = useSmartSuggestions(
    () => {}, // onSend is unused in hook now
    (nextInput: string) => {
      setInput(nextInput);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          autoResizeTextarea(textareaRef.current);
        }
      });
    }
  );

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customSettings, setCustomSettings] = useState<Record<string, unknown> | null>(null);
  const [strategyRuntime, setStrategyRuntime] = useState<ChatStrategyRuntimeState>({
    strategies: [],
    refreshUserStrategies: undefined,
    deleteStrategy: undefined,
    toggleStrategyStatus: undefined,
  });
  const pendingChunksRef = useRef<Map<string, PendingChunk>>(new Map());
  const chunkFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const syncTextSelectionState = () => {
      const selection = window.getSelection();
      isTextSelectionActiveRef.current =
        !!selection && !selection.isCollapsed && selection.toString().length > 0;
    };

    const handleSelectionIntent = (event: MouseEvent | PointerEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-kiko-message-selection-target="true"]')) {
        isTextSelectionActiveRef.current = true;
      }
    };

    document.addEventListener('mousedown', handleSelectionIntent, true);
    document.addEventListener('pointerdown', handleSelectionIntent, true);
    document.addEventListener('selectionchange', syncTextSelectionState);
    window.addEventListener('mouseup', syncTextSelectionState);
    window.addEventListener('pointerup', syncTextSelectionState);
    window.addEventListener('touchend', syncTextSelectionState);

    return () => {
      document.removeEventListener('mousedown', handleSelectionIntent, true);
      document.removeEventListener('pointerdown', handleSelectionIntent, true);
      document.removeEventListener('selectionchange', syncTextSelectionState);
      window.removeEventListener('mouseup', syncTextSelectionState);
      window.removeEventListener('pointerup', syncTextSelectionState);
      window.removeEventListener('touchend', syncTextSelectionState);
      isTextSelectionActiveRef.current = false;
    };
  }, []);

  const flushPendingChunks = useCallback(() => {
    // Deprecated: Chunks are now handled globally by RootLayout.
    pendingChunksRef.current.clear();
  }, []);

  const scheduleChunkFlush = useCallback(() => {
    // Deprecated
  }, []);

  const disableChatTransitions = true;

  // Load custom settings
  useEffect(() => {
    const loadCustomSettings = () => {
      try {
        const saved = localStorage.getItem('kiko-custom-ai-settings');
        if (saved) {
          setCustomSettings(JSON.parse(saved));
        }
      } catch (e) {
        logger.warn('Failed to load custom settings:', e);
      }
    };

    loadCustomSettings();

    const handleCustomSettingsChange = (event: CustomEvent) => {
      setCustomSettings(event.detail);
    };

    window.addEventListener('kiko-custom-ai-changed', handleCustomSettingsChange as EventListener);
    return () => {
      window.removeEventListener(
        'kiko-custom-ai-changed',
        handleCustomSettingsChange as EventListener
      );
    };
  }, []);

  // WebSocket listener for real-time updates
  // NOTE: We only SUBSCRIBE here - App.tsx controls the WebSocket CONNECTION
  // This ensures generating conversations aren't interrupted when switching conversations
  useEffect(() => {
    if (!conversationId) return;

    // Track mounted state to prevent state updates after unmount
    let isMounted = true;

    logger.debug(`Subscribing to conversation ${conversationId}`);
    // DO NOT call chatWSClient.connect() here - App.tsx manages connections
    // to ensure generating conversation is not overridden

    const unsubscribe = chatWSClient.subscribe((event: ChatEvent) => {
      // CRITICAL: Check if still mounted before any state updates
      // This prevents crashes when quickly switching conversations
      if (!isMounted) return;
      if (event.sessionId !== conversationId) return;

      switch (event.type) {
        // chunk, task_status, usage, citations, message_start, message_complete
        // are now handled by RootLayout.tsx globally

        case 'client_action': {
          // Backward compatibility: some backends emit {type,payload} directly
          const normalizedAction =
            event.data?.action ||
            (event.data?.type
              ? {
                  type: event.data.type,
                  data: event.data.data ?? event.data.payload,
                  payload: event.data.payload ?? event.data.data,
                }
              : null);
          if (!normalizedAction?.type) {
            logger.warn('Received malformed client_action event:', event.data);
            break;
          }
          logger.debug('Received client action:', normalizedAction);

          if (normalizedAction.type === 'switch_chain') {
            const actionData = normalizedAction.payload || normalizedAction.data;
            const targetChainId = actionData.chainId || actionData.chain_id;
            const targetTaskId = actionData.taskId || actionData.task_id || activeTaskIdRef.current;
            if (targetChainId) {
              void (async () => {
                try {
                  await switchChain(targetChainId);
                } catch (error: any) {
                  const switchFailedMessage =
                    error?.message ||
                    `Failed to switch to ${actionData.chainName || 'target chain'}.`;
                  if (targetTaskId) {
                    try {
                      await chatApi.reportChainSwitchResult(targetTaskId, {
                        chainId: targetChainId,
                        chainName: actionData.chainName,
                        status: 'failed',
                        error: switchFailedMessage,
                      });
                    } catch (ackError) {
                      logger.warn('Failed to report chain switch failure to backend:', ackError);
                    }
                  }
                  toast.error(switchFailedMessage);
                  return;
                }

                if (targetTaskId) {
                  try {
                    await chatApi.reportChainSwitchResult(targetTaskId, {
                      chainId: targetChainId,
                      chainName: actionData.chainName,
                      status: 'success',
                    });
                  } catch (ackError: any) {
                    const ackMessage =
                      ackError?.message ||
                      'Wallet switched, but KiKo failed to sync the new chain state.';
                    logger.warn('Failed to report chain switch success to backend:', ackError);
                    toast.error(ackMessage);
                    return;
                  }
                }

                toast.success(`Switched to ${actionData.chainName || 'target chain'}.`);
              })();
            }
            break;
          }

          if (normalizedAction.type === 'execute_swap_instant') {
            // DIRECT SERVER EXECUTION - NO UI CARD
            // This bypasses SwapCard completely for instant/allowance trades
            const actionData = normalizedAction.payload || normalizedAction.data;
            const targetChainId = actionData.chainId || actionData.chain_id || chainId;
            const amountIn = actionData.amountIn || actionData.amount_in;
            const slippageBps =
              actionData.slippageBps ??
              actionData.slippage_bps ??
              (actionData.slippage
                ? Math.round(Number(actionData.slippage) * 100)
                : getStoredSlippageBps());
            const targetMessageId =
              event.data?.message_id || event.data?.messageId || `tx-${Date.now()}`;

            const patchTransactionCard = (patch: Record<string, unknown>) => {
              if (!conversationId) return;
              const currentMessages = messagesRef.current;
              const idx = currentMessages.findIndex((m) => m.id === targetMessageId);
              if (idx === -1) return;
              const current = currentMessages[idx];
              const nextMessage: Message = {
                ...current,
                type: 'transaction-status-card',
                data: mergeTransactionCardData(current.data || {}, patch),
              };
              const updated = replaceMessageAtIndex(currentMessages, idx, nextMessage);
              messagesRef.current = updated;
              updateConversation(conversationId, { messages: updated });
            };

            const getFallbackSymbol = (
              token: string | { symbol?: string; name?: string } | null | undefined
            ): string => {
              if (typeof token === 'string') {
                const t = token.trim();
                if (/^0x[eE]{40}$/.test(t)) return 'ETH';
                if (/^0x[0-9a-fA-F]{40}$/.test(t)) return `${t.slice(0, 6)}...${t.slice(-4)}`;
                return t;
              }
              return token?.symbol || token?.name || 'Unknown';
            };

            void (async () => {
              const rawTokenIn = actionData.tokenIn || actionData.token_in;
              const rawTokenOut = actionData.tokenOut || actionData.token_out;
              const resolveToken = customSettings?.fastSwapMode
                ? resolveTokenForFastSwap
                : resolveTokenForChat;
              const disallowedAddresses = walletAddress ? [walletAddress] : [];
              const [resolvedIn, resolvedOut] = await Promise.all([
                resolveNativeToken(
                  targetChainId,
                  typeof rawTokenIn === 'string' ? rawTokenIn : rawTokenIn?.symbol
                ) || (await resolveToken(rawTokenIn, targetChainId, { disallowedAddresses })),
                resolveNativeToken(
                  targetChainId,
                  typeof rawTokenOut === 'string' ? rawTokenOut : rawTokenOut?.symbol
                ) || (await resolveToken(rawTokenOut, targetChainId, { disallowedAddresses })),
              ]);

              const tokenInAddress = resolvedIn?.address || '';
              const tokenOutAddress = resolvedOut?.address || '';

              if (!tokenInAddress || !tokenOutAddress) {
                const failedTxCardMsg: Message = {
                  id: targetMessageId,
                  role: 'assistant',
                  content: '',
                  reasoning_content: '',
                  status: 'complete',
                  timestamp: new Date().toISOString(),
                  type: 'transaction-status-card',
                  data: {
                    status: 'failed',
                    tokenInSymbol: resolvedIn?.symbol || getFallbackSymbol(rawTokenIn),
                    tokenOutSymbol: resolvedOut?.symbol || getFallbackSymbol(rawTokenOut),
                    tokenInLogoURI: resolvedIn?.logoURI,
                    tokenOutLogoURI: resolvedOut?.logoURI,
                    chainId: targetChainId,
                    amountIn: String(amountIn),
                    isLoading: false,
                    errorMessage: customSettings?.fastSwapMode
                      ? 'Fast Swap Mode requires contract addresses for non-whitelisted tokens.'
                      : 'Unable to resolve token metadata for this trade.',
                  },
                };

                if (conversationId) {
                  const currentMessages = messagesRef.current;
                  const idx = currentMessages.findIndex((m) => m.id === targetMessageId);
                  const updated =
                    idx >= 0
                      ? currentMessages.map((m, i) =>
                          i === idx ? { ...m, ...failedTxCardMsg } : m
                        )
                      : [...currentMessages, failedTxCardMsg];
                  messagesRef.current = updated;
                  updateConversation(conversationId, {
                    messages: updated,
                    activeTask: null,
                  });
                }
                return;
              }

              logger.debug('Executing instant swap:', {
                tokenIn: tokenInAddress,
                tokenOut: tokenOutAddress,
                amountIn,
                chainId: targetChainId,
                slippageBps,
              });

              const txCardMsg: Message = {
                id: targetMessageId,
                role: 'assistant',
                content: '',
                reasoning_content: '',
                status: 'complete',
                timestamp: new Date().toISOString(),
                type: 'transaction-status-card',
                data: {
                  status: 'building',
                  tokenInSymbol: resolvedIn?.symbol || getFallbackSymbol(rawTokenIn),
                  tokenOutSymbol: resolvedOut?.symbol || getFallbackSymbol(rawTokenOut),
                  tokenInLogoURI: resolvedIn?.logoURI,
                  tokenOutLogoURI: resolvedOut?.logoURI,
                  tokenInAddress,
                  tokenOutAddress,
                  amountIn: String(amountIn),
                  chainId: targetChainId,
                  isLoading: true,
                },
              };

              if (conversationId) {
                const currentMessages = messagesRef.current;
                const idx = currentMessages.findIndex((m) => m.id === targetMessageId);
                const updated =
                  idx >= 0
                    ? currentMessages.map((m, i) => (i === idx ? { ...m, ...txCardMsg } : m))
                    : [...currentMessages, txCardMsg];
                messagesRef.current = updated;
                updateConversation(conversationId, {
                  messages: updated,
                  activeTask: null,
                });
              }

              const { executeSwapInstant } = await import('../../services/swapService');

              patchTransactionCard({ status: 'sending' });

              const swapPromise = executeSwapInstant({
                tokenIn: tokenInAddress,
                tokenOut: tokenOutAddress,
                amountIn: String(amountIn),
                chainId: targetChainId,
                slippageBps,
              });

              patchTransactionCard({ status: 'pending' });

              swapPromise
                .then((result) => {
                  if (result.success && result.txHash) {
                    patchTransactionCard({
                      status: 'success',
                      txHash: result.txHash,
                      isLoading: false,
                    });
                  } else {
                    patchTransactionCard({
                      status: 'failed',
                      errorMessage: result.error,
                      isLoading: false,
                    });
                  }
                })
                .catch((err) => {
                  patchTransactionCard({
                    status: 'failed',
                    errorMessage: err.message,
                    isLoading: false,
                  });
                });
            })();

            // DEPRECATED: show_swap_card removed from chat interface (kept in WalletPage)
          } else if (normalizedAction.type === 'show_strategy_card') {
            // Card has arrived: hard-stop any residual thinking/streaming state
            if (conversationId) {
              clearActiveTask(conversationId, updateConversation, 'strategy_card');
            }
            if (onTaskUpdate) {
              onTaskUpdate(null);
            }

            // For strategy cards, trigger an immediate refresh of the strategies list
            // This helps avoid the "deleted" race condition
            if (strategyRuntime.refreshUserStrategies) {
              logger.debug('Triggering immediate strategy refresh for new card');
              strategyRuntime.refreshUserStrategies();
            }

            const targetMessageId = event.data.message_id || event.data.messageId;
            if (conversationId) {
              // CRITICAL: use ref snapshot, not stale closure `messages`,
              // otherwise late card events can overwrite the conversation with old state.
              let updated = [...messagesRef.current];
              const targetIdx = targetMessageId
                ? updated.findIndex((m) => m.id === targetMessageId)
                : -1;
              if (targetIdx !== -1) {
                updated = updated.map((m, idx) =>
                  idx === targetIdx
                    ? {
                        ...m,
                        type: 'strategy-card',
                        data: event.data.action.data,
                      }
                    : m
                );
              } else if (targetMessageId) {
                updated.push({
                  id: targetMessageId,
                  role: 'assistant',
                  content: '',
                  reasoning_content: '',
                  status: 'complete',
                  timestamp: new Date().toISOString(),
                  type: 'strategy-card',
                  data: event.data.action.data,
                } as Message);
              } else {
                // Fallback to last assistant message if ID not found
                const lastAssistantIdx = [...updated]
                  .reverse()
                  .findIndex((m) => m.role === 'assistant');
                if (lastAssistantIdx !== -1) {
                  const actualIdx = updated.length - 1 - lastAssistantIdx;
                  updated = updated.map((m, idx) =>
                    idx === actualIdx
                      ? {
                          ...m,
                          type: 'strategy-card',
                          data: event.data.action.data,
                        }
                      : m
                  );
                }
              }
              messagesRef.current = updated;
              updateConversation(conversationId, { messages: updated });
            }
          } else if (
            [
              'show_chart_card',
              'show_transaction_status_card',
              'show_cross_chain_status_card',
              'show_polymarket_card',
            ].includes(normalizedAction.type)
          ) {
            const targetMessageId =
              event.data.targetMessageId || event.data.message_id || event.data.messageId;
            const actionType = normalizedAction.type;
            const actionData = normalizedAction.data || normalizedAction.payload || {};
            const newCardType = ACTION_CARD_TYPE_MAP[actionType] || 'text';
            const isPolymarketPreview =
              actionType === 'show_polymarket_card' && Boolean(actionData.preview);

            if (conversationId) {
              // CRITICAL: Use messagesRef.current for fresh state, not stale `messages` closure.
              // The effect closure captures `messages` at creation time. Without the ref,
              // every card update would push a NEW card because the closure never sees the card we just added.
              const freshMessages = messagesRef.current;
              let updated = [...freshMessages];
              const targetIdx = targetMessageId
                ? updated.findIndex((m) => m.id === targetMessageId)
                : -1;

              logger.debug('[Card] show_card received', {
                type: actionType,
                conversationId,
                targetMessageId,
                messageCount: freshMessages.length,
                targetIdx,
                action:
                  targetIdx !== -1
                    ? 'update_existing'
                    : targetMessageId
                      ? 'push_new'
                      : 'skip_no_target',
                status: actionData?.status,
              });

              if (targetIdx !== -1) {
                // Merge new data into existing card data so we don't lose symbols/amounts from earlier events
                const existingData = updated[targetIdx].data || {};
                updated = replaceMessageAtIndex(updated, targetIdx, {
                  ...updated[targetIdx],
                  type: newCardType as Message['type'],
                  data:
                    newCardType === 'transaction-status-card'
                      ? mergeTransactionCardData(existingData, actionData)
                      : { ...existingData, ...actionData },
                });
                logger.debug('[Card] Replaced message at index', { targetIdx, newCardType });
              } else if (targetMessageId) {
                updated.push({
                  id: targetMessageId,
                  role: 'assistant',
                  content: '',
                  reasoning_content: '',
                  status: 'complete',
                  timestamp: new Date().toISOString(),
                  type: newCardType as Message['type'],
                  data: actionData,
                } as Message);
                logger.debug('[Card] Pushed new card message', {
                  targetMessageId,
                  newCardType,
                  newLength: updated.length,
                });
              }
              // CRITICAL: Immediately update messagesRef so the NEXT event in the same tick
              // sees the card we just added/updated. Without this, rapid-fire events
              // (e.g., two client_actions in the same microtask) both read stale messagesRef
              // and push duplicate cards.
              messagesRef.current = updated;
              const nextConversationPatch: Partial<Conversation> = { messages: updated };
              if (!isPolymarketPreview) {
                nextConversationPatch.activeTask = null;
              }
              updateConversation(conversationId, nextConversationPatch);
            }
          } else if (normalizedAction.type === 'update_message_data') {
            const targetMessageId =
              event.data.targetMessageId || event.data.message_id || event.data.messageId;
            const actionData = normalizedAction.data || normalizedAction.payload || {};
            if (conversationId && targetMessageId) {
              const freshMessages = messagesRef.current;
              const targetIdx = freshMessages.findIndex((m) => m.id === targetMessageId);
              if (targetIdx !== -1) {
                const existingData = freshMessages[targetIdx].data || {};
                const shouldPromoteGeneratedImage =
                  freshMessages[targetIdx].type === 'generated-image' ||
                  Boolean(actionData.generatedImage);
                if (shouldPromoteGeneratedImage) {
                  logLocalGeneratedImageFlow('update-message-data', {
                    conversationId,
                    targetMessageId,
                    existingType: freshMessages[targetIdx].type,
                    incomingHasGeneratedImage: Boolean(actionData.generatedImage),
                    existingGeneratedImage: existingData.generatedImage
                      ? summarizeLocalGeneratedImagePayload(existingData.generatedImage)
                      : null,
                    incomingGeneratedImage: actionData.generatedImage
                      ? summarizeLocalGeneratedImagePayload(actionData.generatedImage)
                      : null,
                  });
                }
                const mergedData = {
                  ...existingData,
                  ...actionData,
                  renderContracts: mergeRenderContracts(
                    existingData.renderContracts,
                    actionData.renderContracts
                  ),
                };
                const nextType = shouldPromoteGeneratedImage
                  ? 'generated-image'
                  : freshMessages[targetIdx].type;
                const nextStatus =
                  resolveGeneratedImageMessageStatus({
                    currentStatus: freshMessages[targetIdx].status,
                    messageType: nextType,
                    messageData: mergedData,
                  }) ?? freshMessages[targetIdx].status;
                const nextMessage: Message = {
                  ...freshMessages[targetIdx],
                  type: nextType,
                  data: mergedData,
                  status: nextStatus,
                };
                const updated = replaceMessageAtIndex(freshMessages, targetIdx, nextMessage);
                messagesRef.current = updated;
                const shouldClearTask = shouldClearActiveTaskForGeneratedImageUpdate({
                  activeTask: activeTaskRef.current,
                  targetMessageId,
                  messageType: nextMessage.type,
                  messageData: nextMessage.data,
                });
                updateConversation(conversationId, {
                  messages: updated,
                  activeTask: shouldClearTask ? null : activeTaskRef.current,
                });
                if (shouldClearTask && onTaskUpdate) {
                  onTaskUpdate(null);
                }
              }
            }
          }
          break;
        }
        case 'transaction_update':
        case 'transaction_confirmed':
        case 'transaction_complete':
          // Handled by updating context
          if (conversationId && (event.data.messageId || event.data.message_id)) {
            const mid = event.data.messageId || event.data.message_id;
            const freshMsgs = messagesRef.current;
            const updated = freshMsgs.map((m) => {
              if (m.id === mid && m.type === 'transaction-status-card') {
                const mergedData = mergeTransactionCardData(m.data || {}, {
                  ...event.data,
                  isLoading:
                    !['transaction_complete', 'transaction_confirmed'].includes(event.type) &&
                    !['success', 'failed'].includes(event.data.status),
                });
                return {
                  ...m,
                  data: mergedData,
                };
              }
              return m;
            });
            const found = freshMsgs.some(
              (m) => m.id === mid && m.type === 'transaction-status-card'
            );
            logger.debug('[Card] transaction status event', {
              eventType: event.type,
              messageId: mid,
              foundCard: found,
            });
            messagesRef.current = updated;
            // card_displayed: activeTask cleared with messages
            updateConversation(conversationId, {
              messages: updated,
              activeTask: null,
            });
          }
          break;
      }
    });

    return () => {
      flushPendingChunks();
      isMounted = false; // Mark as unmounted BEFORE unsubscribe
      unsubscribe();
      // We don't necessarily want to close WS here if it's used elsewhere,
      // but for simplicity we can
      // chatWSClient.close();
    };
  }, [conversationId, flushPendingChunks, scheduleChunkFlush]);

  const isHomeModelSyncActive = !(conversationId || (sidebar?.chatStarted ?? false));

  // Sync with localStorage on mount and when the welcome shell changes the
  // home/default model. Active conversations own their live model choice and
  // must not feed back into the shared home snapshot.
  useEffect(() => {
    if (!isHomeModelSyncActive) return;

    const syncModelFromStorage = () => {
      try {
        const found = readStoredChatModelSelectionState()?.selectedModel;
        if (found) {
          setSelectedModel((current) => {
            const sameSelection =
              found.id === current.id &&
              found.reasoningLevel === current.reasoningLevel &&
              found.reasoningEffort === current.reasoningEffort &&
              found.kind === current.kind;
            if (!sameSelection) {
              logger.debug('Syncing model from localStorage:', found.id);
              return found;
            }
            return current;
          });
        }
      } catch (e) {
        logger.warn('Failed to sync model from localStorage:', e);
      }
    };

    // Check on mount
    syncModelFromStorage();

    // Listen for custom event from WelcomeScreen
    const handleModelChange = (event: CustomEvent) => {
      const newModel = event.detail;
      const found =
        hydrateChatModelOption(newModel) ||
        coerceSelectableChatModelOption(findChatModelOption(newModel.id));
      if (found) {
        setSelectedModel((current) => {
          const sameSelection =
            found.id === current.id &&
            found.reasoningLevel === current.reasoningLevel &&
            found.reasoningEffort === current.reasoningEffort &&
            found.kind === current.kind;
          if (!sameSelection) {
            logger.debug('Model changed via event:', found.id);
            return found;
          }
          return current;
        });
      }
    };

    window.addEventListener('kiko-model-changed', handleModelChange as EventListener);

    // Also listen for storage events (from other tabs)
    window.addEventListener('storage', syncModelFromStorage);

    return () => {
      window.removeEventListener('kiko-model-changed', handleModelChange as EventListener);
      window.removeEventListener('storage', syncModelFromStorage);
    };
  }, [isHomeModelSyncActive]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    if (readStoredChatModelSelection()) return;
    let cancelled = false;
    const loadSavedModel = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const settings = await getUserSettings(token);
        const found =
          hydrateChatModelOption({
            id: settings?.defaultChatModel,
            reasoningLevel: settings?.defaultChatReasoningLevel,
          }) ||
          findChatModelOption(settings?.defaultChatModel);
        if (!cancelled && found && isTextChatModelOption(found)) {
          setSelectedModel((current) => {
            if (!isTextChatModelOption(current)) {
              return current;
            }
            if (current.id === found.id) {
              return current;
            }
            return found;
          });
        }
      } catch (error) {
        logger.warn('Failed to load saved default chat model:', error);
      }
    };
    void loadSavedModel();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  useEffect(() => {
    if (!conversationId || !currentConv?.model) return;
    const currentSessionModel = findChatModelOption(currentConv.model);
    const found =
      currentSessionModel?.kind === 'text'
        ? hydrateChatModelOption({
            id: currentConv.model,
            reasoningLevel: currentConv.reasoningLevel,
          }) || currentSessionModel
        : currentSessionModel;
    if (!found) return;
    setSelectedModel((current) => {
      if (current.id === found.id) return current;
      logger.debug('Syncing model from current conversation:', found.id);
      return found;
    });
  }, [conversationId, currentConv?.model, currentConv?.reasoningLevel]);

  useEffect(() => {
    return () => {
      if (chunkFlushTimerRef.current) {
        clearTimeout(chunkFlushTimerRef.current);
        chunkFlushTimerRef.current = null;
      }
    };
  }, []);

  // Start from null so first mount on /chat/:id is treated as a switch and triggers loadConversation.
  const currentConversationIdRef = useRef<string | null>(null);
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const inputAreaRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const userScrolledUpRef = useRef(false);
  const lastScrollTopRef = useRef<number>(0);
  const justSwitchedConversationRef = useRef(false);
  const pendingScrollToLatestRef = useRef(false);
  const isSendingRef = useRef(false); // Flag to prevent stopGeneration during active send
  const sendAbortControllerRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);

  const syncScrollPaddingWithComposer = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const scrollEl = scrollContainerRef.current;
    const composerEl = inputAreaRef.current;

    if (!composerEl) {
      scrollEl.style.paddingBottom = '';
      return;
    }

    const scrollRect = scrollEl.getBoundingClientRect();
    const composerRect = composerEl.getBoundingClientRect();
    const overlap = Math.max(0, scrollRect.bottom - composerRect.top);
    const bottomReserve = Math.ceil(overlap + 16);
    scrollEl.style.paddingBottom = `${bottomReserve}px`;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (isTextSelectionActiveRef.current) {
      return;
    }
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      scrollContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  useEffect(() => {
    syncScrollPaddingWithComposer();
    const composerEl = inputAreaRef.current;
    if (!composerEl || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      syncScrollPaddingWithComposer();
    });
    observer.observe(composerEl);
    window.addEventListener('resize', syncScrollPaddingWithComposer);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncScrollPaddingWithComposer);
    };
  }, [
    syncScrollPaddingWithComposer,
    showSuggestions,
    input,
    safariKeyboard.inputTop,
    safariKeyboard.isKeyboardVisible,
  ]);

  // Sync chatStarted with Layout on mount (single source: Layout's chatStarted)
  useEffect(() => {
    sidebar?.setChatStarted(initialMessages.length > 0 || !!conversationId || isLoading);
  }, []);

  /** Scenario A: Sending first message, URL just navigated to new conversation — no load, no clear. */
  const handleNewConversationNavigation = useCallback((newId: string) => {
    logger.debug('Skipping stopGeneration - active send in progress');
    currentConversationIdRef.current = newId || null;
    setIsLoadingConversation(false);
  }, []);

  /** Scenario B: User switched to another conversation or opened /chat/:id — load if needed, clear prev task, reset UI. */
  const handleConversationSwitch = useCallback(
    async (prevId: string | null, newId: string | null) => {
      logger.debug('⚠️ CONVERSATION CHANGED:', { prevId, newId });
      if (!newId) {
        if (prevId) {
          const prevConv = conversations.find((c) => c.id === prevId);
          if (prevConv?.activeTask)
            clearActiveTask(prevId, updateConversation, 'conversation_switch_to_welcome');
        }
        setThinkingText('Thinking');
        setThinkingStartTime(0);
        setFirstSendPending(false);
        setInput('');
        processedMessagesRef.current.clear();
        currentConversationIdRef.current = null;
        if (onTaskUpdate) onTaskUpdate(null);
        sidebar?.setChatStarted(false);
        requestAnimationFrame(() => setIsLoadingConversation(false));
        return;
      }

      setIsLoadingConversation(true);
      let loadPromise: Promise<unknown> | null = null;

      if (prevId) {
        const prevConv = conversations.find((c) => c.id === prevId);
        if (prevConv?.activeTask)
          clearActiveTask(prevId, updateConversation, 'conversation_switch');
      }

      if (newId && (!currentConv || !currentConv.messages || currentConv.messages.length === 0)) {
        loadPromise = loadConversation(newId);
      }

      logger.debug('Resetting UI states (backend continues generating)...');
      const lastAssistantMsg = initialMessages.filter((m) => m.role === 'assistant').pop();
      const isTargetStreaming = lastAssistantMsg?.status === 'streaming';

      if (isTargetStreaming && newId) {
        logger.debug('Target conversation has streaming message, ensuring activeTask state');
        if (!currentConv?.activeTask) {
          updateConversation(newId, {
            activeTask: {
              id: lastAssistantMsg!.id,
              messageId: lastAssistantMsg!.id,
              status: 'streaming' as any,
            },
          });
        }
      } else if (newId && currentConv?.activeTask) {
        processedMessagesRef.current.clear();
      }

      setThinkingText('Thinking');
      setThinkingStartTime(0);
      setFirstSendPending(false);
      setInput('');
      userScrolledUpRef.current = false;
      isAtBottomRef.current = true;
      setShowJumpToBottom(false);
      const hasMessages = (currentConv?.messages?.length ?? initialMessages.length) > 0;
      sidebar?.setChatStarted(!!newId || isLoading || isSendingRef.current || hasMessages);
      processedMessagesRef.current.clear();
      currentConversationIdRef.current = newId || null;
      if (onTaskUpdate) onTaskUpdate(null);
      initialMessages.forEach((msg) => processedMessagesRef.current.add(msg.id));
      justSwitchedConversationRef.current = true;
      pendingScrollToLatestRef.current = true;
      try {
        if (loadPromise) {
          await Promise.race([
            loadPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('load_conversation_timeout')), 8000)
            ),
          ]);
        }
      } catch (error) {
        logger.warn('[ChatInterface] conversation switch load failed:', error);
        toast.warning('Loading this chat is taking longer than expected. Please try again.');
      } finally {
        requestAnimationFrame(() => setIsLoadingConversation(false));
        requestAnimationFrame(() => scrollToBottom(false));
        logger.debug(
          'Conversation switch complete. New ID:',
          newId,
          'Marked',
          initialMessages.length,
          'messages as processed'
        );
      }
    },
    [
      conversations,
      currentConv,
      initialMessages,
      updateConversation,
      loadConversation,
      sidebar,
      isLoading,
      onTaskUpdate,
    ]
  );

  /** Scenario C: Same conversationId, background message sync from loadConversation or streaming. */
  const handleBackgroundMessageSync = useCallback(() => {
    if (initialMessages.length === 0) return;
    if (messages.length === 0 && initialMessages.length > 0) {
      logger.debug('Syncing - local empty but props has messages');
      sidebar?.setChatStarted(true);
      initialMessages.forEach((msg) => processedMessagesRef.current.add(msg.id));
      return;
    }
    if (activeTaskId || isStreaming || isThinking) return;
    if (!isStreaming && !isThinking) {
      const lastLocal = messages[messages.length - 1];
      const lastInitial = initialMessages[initialMessages.length - 1];
      const hasSubstantialDiff =
        messages.length !== initialMessages.length ||
        (lastLocal?.id === lastInitial?.id &&
          (lastLocal?.status !== lastInitial?.status ||
            (lastInitial?.content || '').length > (lastLocal?.content || '').length));
      if (hasSubstantialDiff) {
        logger.debug('Syncing messages from props - background update detected');
        sidebar?.setChatStarted(initialMessages.length > 0);
      }
    }
  }, [initialMessages, messages, activeTaskId, isStreaming, isThinking, sidebar]);

  // Sync messages when conversationId or initialMessages change
  useEffect(() => {
    const prevId = currentConversationIdRef.current;
    const newId = conversationId;

    if (prevId === newId) {
      handleBackgroundMessageSync();
      return;
    }
    if (isSendingRef.current && newId) {
      handleNewConversationNavigation(newId);
      return;
    }
    handleConversationSwitch(prevId, newId || null);
  }, [
    conversationId,
    handleNewConversationNavigation,
    handleConversationSwitch,
    handleBackgroundMessageSync,
  ]);

  // Safety net: if we're on "/", there is no conversation, and nothing is pending, force welcome state.
  useEffect(() => {
    if (conversationId) return;
    if (isThinking || isStreaming || firstSendPending) return;
    if (messages.length > 0 || welcomePendingMessages.length > 0) return;
    sidebar?.setChatStarted(false);
  }, [
    conversationId,
    isThinking,
    isStreaming,
    firstSendPending,
    messages.length,
    welcomePendingMessages.length,
    sidebar,
  ]);

  useEffect(() => {
    if (conversationId) {
      setWelcomePendingMessages([]);
    }
  }, [conversationId]);

  // Reliability: after auth becomes ready, ensure direct /chat/:id refresh always loads history.
  useEffect(() => {
    if (!ready || !authenticated || !conversationId) return;
    const conv = conversations.find((c) => c.id === conversationId);
    if ((conv?.messages?.length ?? 0) > 0) return;
    setIsLoadingConversation(true);
    Promise.race([
      loadConversation(conversationId),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('load_conversation_timeout')), 8000)
      ),
    ])
      .catch((error) => {
        logger.warn('[ChatInterface] reliability load failed:', error);
      })
      .finally(() => setIsLoadingConversation(false));
  }, [ready, authenticated, conversationId, conversations, loadConversation]);

  // Failsafe: never keep interaction blocked in loading overlay forever.
  useEffect(() => {
    if (!isLoadingConversation) return;
    const timer = setTimeout(() => {
      logger.warn('[ChatInterface] forcing loading overlay reset after timeout');
      setIsLoadingConversation(false);
    }, 12000);
    return () => clearTimeout(timer);
  }, [isLoadingConversation]);

  // Sync thinking text with active task message
  useEffect(() => {
    if (currentConv?.activeTask?.message) {
      setThinkingText(currentConv.activeTask.message);
    } else if (!isBusy) {
      setThinkingText('Thinking');
    }
  }, [currentConv?.activeTask?.message, isBusy]);

  useEffect(() => {
    if (!conversationId) {
      if (onTaskUpdate) {
        onTaskUpdate(null);
      }
      return;
    }

    // Check if we have activeTask from props (loaded by App.tsx)
    if (propActiveTask) {
      const task = propActiveTask;
      const taskMessageId = String(task.messageId || task['message_id'] || '').trim() || null;

      // If task is still running, ensure context matches
      if (task.status === 'queued' || task.status === 'pending' || task.status === 'running') {
        if (conversationId && !currentConv?.activeTask) {
          updateConversation(conversationId, {
            activeTask: {
              id: task.id,
              messageId: taskMessageId,
              status: task.status as any,
            },
          });
        }
      } else {
        // Task is done/failed/cancelled, clear UI state
        if (conversationId && currentConv?.activeTask) {
          clearActiveTask(conversationId, updateConversation, 'prop_task_done');
        }
        if (onTaskUpdate) {
          onTaskUpdate(null);
        }
        logger.debug('Task is complete, clearing UI state:', task.id, task.status);
      }
    } else {
      // No active task from props, ensure onTaskUpdate matches context
      if (onTaskUpdate) {
        onTaskUpdate(currentConv?.activeTask || null);
      }
    }
  }, [
    conversationId,
    propActiveTask,
    messages,
    currentConv?.activeTask,
    onTaskUpdate,
    updateConversation,
  ]);

  useEffect(() => {
    if (!firstSendPending) return;
    if (!hasAnyAssistantMessage) return;
    setFirstSendPending(false);
  }, [firstSendPending, hasAnyAssistantMessage]);

  useEffect(() => {
    if (isBusy) {
      if (!thinkingStartTime) {
        setThinkingStartTime(Date.now());
      }
      return;
    }
    if (thinkingStartTime !== 0) {
      setThinkingStartTime(0);
    }
  }, [isBusy, thinkingStartTime]);

  useEffect(() => {
    if (!pendingScrollToLatestRef.current) return;
    if (isLoadingConversation) return;
    requestAnimationFrame(() => {
      userScrolledUpRef.current = false;
      isAtBottomRef.current = true;
      setShowJumpToBottom(false);
      scrollToBottom(false);
      pendingScrollToLatestRef.current = false;
    });
  }, [conversationId, isLoadingConversation, messages.length, scrollToBottom]);

  // Fetch user balances for common tokens AND tokens mentioned in chat
  useEffect(() => {
    if (!walletAddress || !authenticated || chainId === 0) return;

    const fetchBalances = async () => {
      // Loading state handled internally
      try {
        // Dynamically import to avoid circular dependencies if any
        const { getWalletPortfolio } = await import('../../services/swapService');
        const balances: Record<string, string> = {};

        // First, get native balance (ETH, BNB, etc.)
        // Chain-specific native token symbols
        const NATIVE_SYMBOLS: Record<number, string> = {
          1: 'ETH', // Ethereum
          8453: 'ETH', // Base
          10: 'ETH', // Optimism
          42161: 'ETH', // Arbitrum
          56: 'BNB', // BSC
          137: 'MATIC', // Polygon
          900: 'SOL', // Solana
        };

        const chainNameMap: Record<number, string> = {
          1: 'eth',
          8453: 'base',
          10: 'optimism',
          42161: 'arbitrum',
          56: 'bsc',
          137: 'polygon',
          900: 'solana',
        };
        const chainName = chainNameMap[chainId] || 'eth';
        const nativeBalance = await getWalletBalance(walletAddress, chainName);
        if (nativeBalance?.ethBalanceFormatted !== undefined) {
          const nativeSymbol = NATIVE_SYMBOLS[chainId] || 'ETH';
          // IMPORTANT: Always include native balance (even 0) so AI knows we checked
          balances[nativeSymbol] = (nativeBalance.ethBalanceFormatted || 0).toFixed(8);
        }

        // Call the unified portfolio API - returns ALL tokens with known metadata/decimals
        // This solves the issue of needing to guess decimals for new tokens
        const portfolio = await getWalletPortfolio(walletAddress, chainId);

        // Map portfolio items to balances
        if (portfolio) {
          portfolio.forEach((token) => {
            // Prefer formatted balance directly from API as it handles decimals correctly
            // But API returns string like "123.456"
            const balanceVal = parseFloat(token.formatted);
            // IMPORTANT: Include tokens with 0 balance so AI knows we checked and found 0
            if (balanceVal >= 0 && !isNaN(balanceVal)) {
              balances[token.symbol] = token.formatted;
              // Also store by address for context awareness
              if (token.contractAddress) {
                balances[token.contractAddress.toLowerCase()] = token.formatted;
              }
            }
          });
        }

        // Ensure Common Tokens and Context Tokens have entries (even if 0)
        // This helps AI know that we CHECKED and found 0, vs unknown
        const commonTokens = COMMON_TOKENS[chainId] || [];
        // Only process last 10 messages for performance
        const recentMessages = messages.slice(-10);
        const contextAddresses = recentMessages.flatMap((msg) => extractAddresses(msg.content));

        // Set of addresses to ensure we have coverage for
        const targetAddresses = new Set([
          ...commonTokens.map((t) => t.address.toLowerCase()),
          ...contextAddresses.map((a) => a.toLowerCase()),
        ]);

        targetAddresses.forEach((addr) => {
          // Check if we have it by address
          if (!balances[addr]) {
            // Check if we have it by symbol (for common tokens)
            const common = commonTokens.find((t) => t.address.toLowerCase() === addr);
            if (common && balances[common.symbol]) {
              // We have it by symbol, ensure address key points to same value
              balances[addr] = balances[common.symbol];
            } else {
              // Truly missing/zero
              balances[addr] = '0';
              if (common) {
                balances[common.symbol] = '0';
              }
            }
          }
        });

        setUserBalances(balances);
      } catch (error) {
        logger.error('Error fetching balances:', error);
      }
    };

    fetchBalances();
  }, [walletAddress, authenticated, chainId, messages.length]); // Re-run when new messages arrive

  // Auto-send for pending user messages (e.g., from AI report button)
  useEffect(() => {
    // Skip if just switched conversation - prevents firing API calls for loaded history
    if (justSwitchedConversationRef.current) {
      logger.debug('Skipping auto-send - just switched conversation');
      justSwitchedConversationRef.current = false;
      return;
    }

    if (isBusy || messages.length === 0) return;

    // Only check if we have messages and conversation is active
    if (!conversationId) return;

    // Check if the last message is a user message that hasn't been processed yet
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage &&
      lastMessage.role === 'user' &&
      !processedMessagesRef.current.has(lastMessage.id)
    ) {
      // Check if there's already an AI response (if so, don't auto-send)
      // This handles the case where messages were loaded from storage
      const hasAIResponse = messages.some(
        (msg, idx) => idx > messages.indexOf(lastMessage) && msg.role === 'assistant'
      );

      if (!hasAIResponse) {
        // Mark as processed to avoid duplicate sends
        processedMessagesRef.current.add(lastMessage.id);

        // Auto-send after a short delay to ensure state is updated
        // Use requestAnimationFrame to ensure we're not in render phase
        requestAnimationFrame(() => {
          setTimeout(() => {
            handleSend(lastMessage.content, lastMessage.id);
          }, 100);
        });
      }
    }
  }, [messages, conversationId, isBusy]);

  // Auto-save messages removed - handled by updateConversation in event handlers

  // Sync on unmount only
  useEffect(() => {
    return () => {
      if (messagesRef.current.length > 0 && currentConversationIdRef.current) {
        // Determine if we need to sync on unmount.
        // Usually context handles this live, but strict safeguard:
        if (activeConversationId && activeConversationId === currentConversationIdRef.current) {
          updateConversation(activeConversationId, { messages: messagesRef.current });
        }
      }
    };
  }, []); // Empty dependency array = runs only on mount/unmount

  // Safety timeout removed: No timeouts during AI response to ensure uninterrupted flow

  // Smart scroll on new messages - follow output if user is at bottom
  useEffect(() => {
    if (userScrolledUpRef.current) {
      return;
    }
    if (isTextSelectionActiveRef.current) {
      return;
    }
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    if (scrollContainerRef.current && (messages.length > 0 || firstSendPending)) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottom = distanceFromBottom < 100; // Increased threshold for stability

      // Only auto-scroll if we are sending, thinking, or streaming AND near bottom
      const shouldScroll = (firstSendPending || isThinking || isStreaming) && isNearBottom;

      if (shouldScroll) {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current && !userScrolledUpRef.current) {
            const currentSelection = window.getSelection();
            if (!currentSelection || currentSelection.toString().length === 0) {
              scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
              isAtBottomRef.current = true;
              lastScrollTopRef.current = scrollContainerRef.current.scrollTop;
            }
          }
        });
      }
    }
  }, [messages.length, isThinking, isStreaming, firstSendPending, scrollToBottom]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isAtBottom = distanceFromBottom < 50; // Match threshold used in auto-scroll

      // IMPORTANT: During streaming, don't interfere with auto-scroll
      // Only detect user scroll when NOT streaming to avoid false positives
      if (!isStreaming) {
        // Detect scroll direction - if scrollTop increased, user scrolled up
        const scrollDelta = scrollTop - lastScrollTopRef.current;
        const isScrollingUp = scrollDelta > 0; // Positive delta means scrolling up

        // If user scrolled up (even slightly), immediately stop auto-scrolling
        if (isScrollingUp && scrollDelta > 1) {
          // Threshold of 1px to catch any upward movement
          userScrolledUpRef.current = true;
        }

        // Track if user manually scrolled up (away from bottom)
        const wasAtBottom = isAtBottomRef.current;

        if (!isAtBottom && wasAtBottom) {
          // User was at bottom but scrolled up - stop auto-scrolling
          userScrolledUpRef.current = true;
        } else if (isAtBottom && !isScrollingUp) {
          // User scrolled DOWN to bottom - resume auto-scrolling
          userScrolledUpRef.current = false;
        }
      } else {
        // During streaming: detect user scrolling UP (scrollDelta < 0 means scrollTop decreased)
        // Auto-scroll causes scrollTop to increase (scrollDelta > 0), so we only stop on negative delta
        const scrollDelta = scrollTop - lastScrollTopRef.current;

        // User scrolled UP (scrollTop decreased) - stop auto-scrolling immediately
        if (scrollDelta < 0) {
          userScrolledUpRef.current = true;
        } else if (scrollDelta > 0 && isAtBottom) {
          // User scrolled DOWN and reached bottom - resume auto-scrolling
          userScrolledUpRef.current = false;
        }
      }

      // Update last scroll position
      lastScrollTopRef.current = scrollTop;
      isAtBottomRef.current = isAtBottom;
      setShowJumpToBottom(!isAtBottom);
    }
  };

  const handleInputFocus = () => {
    // Only auto-scroll if user is already at bottom or near bottom
    // This prevents the "jump to bottom" when clicking to copy text or reading history
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0;

    if (scrollContainerRef.current && !userScrolledUpRef.current && !hasSelection) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom < 100) {
        scrollToBottom();
      }
    }

    // Only trigger suggestions if there is input (user preference: strictly on matching)
    if (input && input.trim().length > 0) {
      detectIntent(input);
    }
  };

  // silentMode: if true, doesn't trigger visual stopping state (for conversation switches)
  const stopGeneration = async (silentMode = false) => {
    logger.debug('Stop requested', {
      conversationId,
      activeTaskId,
      activeTaskStatus: currentConv?.activeTask?.status,
      firstSendPending,
      isThinking,
      isStreaming,
    });

    if (!isThinking && !isStreaming && !firstSendPending) return;

    if (firstSendPending && !isThinking && !isStreaming) {
      setFirstSendPending(false);
      return;
    }

    stopRequestedRef.current = true;

    if (!silentMode) {
      setIsStopping(true);
    }

    if (conversationId && currentConv?.activeTask) {
      updateConversation(conversationId, {
        activeTask: {
          ...currentConv.activeTask,
          stopRequested: true,
        },
      });
    }

    if (sendAbortControllerRef.current) {
      sendAbortControllerRef.current.abort();
      sendAbortControllerRef.current = null;
    }

    let realTaskId = activeTaskId && !activeTaskId.startsWith('task-') ? activeTaskId : null;

    if (!realTaskId && conversationId) {
      try {
        logger.debug('No real task id in UI state, fetching session to resolve activeTask', {
          conversationId,
        });
        const sessionResp = await chatApi.getSession(conversationId);
        const resolvedTaskId = sessionResp.activeTask?.id;
        if (resolvedTaskId && !String(resolvedTaskId).startsWith('task-')) {
          realTaskId = resolvedTaskId;
          updateConversation(conversationId, {
            activeTask: {
              ...(currentConv?.activeTask || {}),
              ...(sessionResp.activeTask || {}),
              id: resolvedTaskId,
              status: normalizeUiTaskStatus(sessionResp.activeTask?.status),
              stopRequested: true,
            },
          });
        }
      } catch (err) {
        logger.warn('Failed to resolve active task before stopping', err);
      }
    }

    if (realTaskId) {
      try {
        logger.debug('Stopping real task:', realTaskId);
        await chatApi.stopTask(realTaskId);
      } catch (err) {
        logger.error('Failed to stop task:', err);
      }
    } else if (conversationId && currentConv?.activeTask) {
      clearActiveTask(conversationId, updateConversation, 'user_stop_without_task_id');
    }

    setTimeout(() => {
      stopRequestedRef.current = false;
      setIsStopping(false);
    }, 300);
  };

  // Flag to prevent double submission (race condition)
  const isSubmittingRef = useRef(false);

  const revokeRetainedPreviewUrl = useCallback((previewUrl: string) => {
    if (!previewUrl) return;
    try {
      URL.revokeObjectURL(previewUrl);
    } catch (error) {
      logger.warn('Failed to revoke local image preview URL', error);
    }
    retainedPreviewUrlsRef.current.delete(previewUrl);
  }, []);

  const updateSelectedImageDrafts = useCallback(
    (updater: (current: ComposerImageDraft[]) => ComposerImageDraft[]) => {
      const nextDrafts = updater(selectedImageDraftsRef.current);
      selectedImageDraftsRef.current = nextDrafts;
      setSelectedImageDrafts(nextDrafts);
      return nextDrafts;
    },
    []
  );

  const handleRemoveSelectedImage = useCallback(
    (draftId: string) => {
      if (isUploadingImages) return;
      updateSelectedImageDrafts((current) => {
        const draft = current.find((item) => item.id === draftId);
        if (draft) {
          revokeRetainedPreviewUrl(draft.previewUrl);
          if (draft.uploadId) {
            discardPreparedUploadIdsQuietly([draft.uploadId], 'draft_removed');
          }
        }
        return current.filter((item) => item.id !== draftId);
      });
    },
    [isUploadingImages, revokeRetainedPreviewUrl, updateSelectedImageDrafts]
  );

  const uploadDraftsForSend = useCallback(
    async (drafts: ComposerImageDraft[]): Promise<PreparedDraftUpload[]> => {
      if (drafts.length === 0) return [];

      logger.debug('[chat.image] preparing image uploads', {
        count: drafts.length,
        files: drafts.map((draft) => ({
          id: draft.id,
          name: draft.name,
          size: draft.size,
          type: draft.type,
        })),
      });

      let preparedUploadIds: string[] = [];
      try {
        const prepared = await chatApi.prepareImageUploads(
          drafts.map((draft) => ({
            fileName: draft.name,
            contentType: draft.type,
            size: draft.size,
          }))
        );

        const intents = Array.isArray(prepared?.uploads) ? prepared.uploads : [];
        if (intents.length !== drafts.length) {
          throw new Error('Image upload preparation returned an unexpected response.');
        }
        preparedUploadIds = intents.map((intent) => intent.uploadId);

        logger.debug('[chat.image] upload intents ready', {
          count: intents.length,
          uploadIds: preparedUploadIds,
        });

        await Promise.all(
          intents.map(async (intent, index) => {
            const draft = drafts[index];
            logger.debug('[chat.image] browser upload start', {
              draftId: draft.id,
              uploadId: intent.uploadId,
              fileName: draft.name,
              size: draft.size,
              type: draft.type,
            });
            const response = await fetch(intent.uploadUrl, {
              method: intent.method || 'PUT',
              headers: {
                ...intent.headers,
                'Content-Type': draft.type,
              },
              body: draft.file,
            });

            if (!response.ok) {
              throw new Error(`Image upload failed with HTTP ${response.status}.`);
            }

            logger.debug('[chat.image] browser upload complete', {
              draftId: draft.id,
              uploadId: intent.uploadId,
              fileName: draft.name,
            });
          })
        );

        logger.debug('[chat.image] finalizing image uploads', {
          count: preparedUploadIds.length,
          uploadIds: preparedUploadIds,
        });
        const finalized = await chatApi.finalizeImageUploads(preparedUploadIds);
        const finalizedUploads = Array.isArray(finalized?.uploads) ? finalized.uploads : [];
        if (finalizedUploads.length !== intents.length) {
          throw new Error('Image upload finalization returned an unexpected response.');
        }
        const finalizedByUploadId = new Map(
          finalizedUploads.map((upload) => [upload.uploadId, upload])
        );

        return intents.map((intent, index) => {
          const finalizedUpload = finalizedByUploadId.get(intent.uploadId);
          return {
            draftId: drafts[index].id,
            uploadId: intent.uploadId,
            expiresAt: intent.expiresAt,
            contentType: finalizedUpload?.contentType,
            size: finalizedUpload?.size,
            width: finalizedUpload?.width,
            height: finalizedUpload?.height,
          };
        });
      } catch (error) {
        discardPreparedUploadIdsQuietly(preparedUploadIds, 'browser_upload_failed');
        throw error;
      }
    },
    []
  );

  const uploadSelectedImageDrafts = useCallback(
    (drafts: ComposerImageDraft[]) => {
      void (async () => {
        try {
          const preparedDraftUploads = await uploadDraftsForSend(drafts);
          if (!imageDraftOwnerMountedRef.current) {
            discardPreparedUploadIdsQuietly(
              preparedDraftUploads.map((upload) => upload.uploadId),
              'draft_owner_unmounted_before_upload_complete'
            );
            return;
          }
          const uploadByDraftId = new Map(
            preparedDraftUploads.map((upload) => [upload.draftId, upload])
          );
          const nextDrafts = updateSelectedImageDrafts((current) =>
            current.map((draft) => {
              const upload = uploadByDraftId.get(draft.id);
              if (!upload) return draft;
              return {
                ...draft,
                uploadState: 'idle' as const,
                uploadId: upload.uploadId,
                uploadExpiresAt: upload.expiresAt,
                type: upload.contentType || draft.type,
                size: upload.size || draft.size,
                width: upload.width,
                height: upload.height,
              };
            })
          );
          const retainedDraftIds = new Set(nextDrafts.map((draft) => draft.id));
          const orphanUploadIds = preparedDraftUploads
            .filter((upload) => !retainedDraftIds.has(upload.draftId))
            .map((upload) => upload.uploadId);
          discardPreparedUploadIdsQuietly(orphanUploadIds, 'draft_removed_before_upload_complete');
        } catch (error) {
          if (!imageDraftOwnerMountedRef.current) return;
          logger.error('Image upload failed after selection:', error);
          const failedDraftIds = new Set(drafts.map((draft) => draft.id));
          updateSelectedImageDrafts((current) =>
            current.map((draft) =>
              failedDraftIds.has(draft.id)
                ? {
                    ...draft,
                    uploadState: 'error' as const,
                    uploadId: undefined,
                    uploadExpiresAt: undefined,
                  }
                : draft
            )
          );
          toast.error('Image upload failed. Please remove it and try again.');
        }
      })();
    },
    [updateSelectedImageDrafts, uploadDraftsForSend]
  );

  const handleSelectImages = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      if (!authenticated) {
        try {
          login();
        } catch (error) {
          logger.warn('Failed to trigger login before image upload:', error);
        }
        return;
      }
      const supportsSelectedModelImageInput = isTextChatModelOption(selectedModel)
        ? supportsVisionChatModel(selectedModel?.id)
        : supportsGeneratedImageInputModel(selectedModel?.id);
      if (!supportsSelectedModelImageInput) {
        toast.error('The selected model does not support image input yet.');
        return;
      }

      const current = selectedImageDraftsRef.current;
      if (current.length >= MAX_COMPOSER_IMAGE_COUNT) {
        toast.error(`You can attach up to ${MAX_COMPOSER_IMAGE_COUNT} images.`);
        return;
      }

      const rejectedMessages: string[] = [];
      const remainingSlots = Math.max(0, MAX_COMPOSER_IMAGE_COUNT - current.length);
      const draftsToUpload: ComposerImageDraft[] = [];

      files.slice(0, remainingSlots).forEach((file) => {
        const validationError = validateComposerImageFile(file);
        if (validationError) {
          rejectedMessages.push(validationError);
          return;
        }
        const draft = {
          ...createComposerImageDraft(file),
          uploadState: 'uploading' as const,
        };
        retainedPreviewUrlsRef.current.add(draft.previewUrl);
        draftsToUpload.push(draft);
      });

      if (files.length > remainingSlots) {
        rejectedMessages.push(`Only ${MAX_COMPOSER_IMAGE_COUNT} images can be attached at once.`);
      }

      if (rejectedMessages.length > 0) {
        toast.error(rejectedMessages[0]);
      }

      if (draftsToUpload.length === 0) return;

      updateSelectedImageDrafts((latest) => [...latest, ...draftsToUpload]);
      uploadSelectedImageDrafts(draftsToUpload);
    },
    [authenticated, login, selectedModel?.id, updateSelectedImageDrafts, uploadSelectedImageDrafts]
  );

  // Always-fresh ref so event listeners can call handleSend without stale closure
  const handleSendRef = useRef<(text: string) => void>(() => {});

  const injectLocalTransactionCardTest = useCallback(
    async (rawText: string, existingMessageId?: string) => {
      const now = new Date();
      const userMsg: Message = {
        id: existingMessageId || `local-test-user-${Date.now()}`,
        role: 'user',
        content: rawText,
        clientCreatedAt: now.toISOString(),
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: now.toISOString().split('T')[0],
        type: 'text',
      };

      const txCardMsg: Message = {
        id: `local-test-tx-${Date.now()}`,
        role: 'assistant',
        content: '',
        reasoning_content: '',
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: now.toISOString().split('T')[0],
        status: 'complete',
        type: 'transaction-status-card',
        data: {
          status: 'success',
          tokenInSymbol: 'USDC',
          tokenOutSymbol: 'WETH',
          amountIn: '5',
          amountOut: '0.002517491981002632',
          chainId,
          isLoading: false,
          txHash: '0xf0905b7c6df0b3ed9328',
        },
      };

      processedMessagesRef.current.add(userMsg.id);
      sidebar?.setChatStarted(true);
      suppressSuggestions();
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      await stopGeneration(true);
      setFirstSendPending(false);

      let targetConversationId = conversationId;
      if (!targetConversationId) {
        targetConversationId = await createConversation('Local UI Test', selectedModel.id, selectedModel.reasoningLevel);
        if (!targetConversationId) {
          toast.error('Unable to create a chat for the local transaction card test.');
          return;
        }
        currentConversationIdRef.current = targetConversationId;
        navigate(`/chat/${targetConversationId}`);
      }

      const nextMessages = [
        ...messagesRef.current.filter((m) => m.id !== userMsg.id),
        userMsg,
        txCardMsg,
      ];
      messagesRef.current = nextMessages;
      registerPendingLocalUserMessage(targetConversationId, userMsg);
      updateConversation(targetConversationId, {
        messages: nextMessages,
        activeTask: null,
      });

      userScrolledUpRef.current = false;
      isAtBottomRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToBottom(false));
      });
      toast.success('Local transaction card test injected.');
    },
    [
      chainId,
      conversationId,
      createConversation,
      navigate,
      registerPendingLocalUserMessage,
      scrollToBottom,
      selectedModel.id,
      sidebar,
      suppressSuggestions,
      updateConversation,
    ]
  );

  const updateLocalGeneratedImageFlowMessage = useCallback(
    (
      targetConversationId: string | null,
      assistantMessageId: string,
      payload: Record<string, unknown>,
      phase: LocalGeneratedImageFlowPhase
    ) => {
      const nextStatus =
        payload.status === 'complete' ? 'complete' : payload.status === 'failed' ? 'error' : 'streaming';
      const patchMessage = (message: Message): Message =>
        message.id === assistantMessageId
          ? {
              ...message,
              status: nextStatus,
              type: 'generated-image',
              data: {
                ...(message.data || {}),
                generatedImage: payload,
              },
            }
          : message;

      logLocalGeneratedImageFlow('advance', {
        targetConversationId,
        assistantMessageId,
        phase,
        nextStatus,
        payload: summarizeLocalGeneratedImagePayload(payload),
      });

      if (!targetConversationId) {
        setWelcomePendingMessages((current) => {
          const found = current.some((message) => message.id === assistantMessageId);
          if (!found) {
            logLocalGeneratedImageFlow('advance-missed-welcome', {
              assistantMessageId,
              phase,
              currentCount: current.length,
            });
            return current;
          }
          return current.map(patchMessage);
        });
        return;
      }

      const freshMessages = messagesRef.current;
      const found = freshMessages.some((message) => message.id === assistantMessageId);
      if (!found) {
        logLocalGeneratedImageFlow('advance-missed-conversation', {
          targetConversationId,
          assistantMessageId,
          phase,
          currentCount: freshMessages.length,
        });
        return;
      }

      const updated = freshMessages.map(patchMessage);
      messagesRef.current = updated;
      updateConversation(targetConversationId, { messages: updated, activeTask: null });
    },
    [updateConversation]
  );

  const injectLocalGeneratedImageFlowTest = useCallback(
    async (rawText: string, config: LocalGeneratedImageTestConfig, existingMessageId?: string) => {
      clearLocalGeneratedImageFlowTimers();

      const now = new Date();
      const assistantMessageId = `local-generated-image-flow-${Date.now()}`;
      const userMsg: Message = {
        id: existingMessageId || `local-generated-image-flow-user-${Date.now()}`,
        role: 'user',
        content: rawText,
        clientCreatedAt: now.toISOString(),
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: now.toISOString().split('T')[0],
        type: 'text',
      };
      const assistantMsg: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        reasoning_content: '',
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: now.toISOString().split('T')[0],
        status: 'streaming',
        type: 'generated-image',
        data: {
          generatedImage: buildLocalGeneratedImageFlowPayload(config, 'queued'),
        },
      };

      processedMessagesRef.current.add(userMsg.id);
      sidebar?.setChatStarted(true);
      suppressSuggestions();
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      await stopGeneration(true);
      setFirstSendPending(false);

      let targetConversationId: string | null = conversationId || null;
      if (!authenticated && !targetConversationId) {
        setWelcomePendingMessages([userMsg, assistantMsg]);
      } else {
        if (!targetConversationId) {
          targetConversationId = await createConversation('Local Image Flow Test', selectedModel.id, selectedModel.reasoningLevel);
          if (!targetConversationId) {
            toast.error('Unable to create a chat for the local image flow test.');
            return;
          }
          currentConversationIdRef.current = targetConversationId;
          navigate(`/chat/${targetConversationId}`);
        }

        const nextMessages = [
          ...messagesRef.current.filter((m) => m.id !== userMsg.id),
          userMsg,
          assistantMsg,
        ];
        messagesRef.current = nextMessages;
        registerPendingLocalUserMessage(targetConversationId, userMsg);
        updateConversation(targetConversationId, {
          messages: nextMessages,
          activeTask: null,
        });
      }

      logLocalGeneratedImageFlow('insert', {
        targetConversationId,
        assistantMessageId,
        provider: config.provider,
        imageUrl: config.imageUrl || LOCAL_GENERATED_IMAGE_FLOW_DEFAULT_IMAGE_URL,
        simulateStaleDowngrade: Boolean(config.simulateStaleDowngrade),
      });

      const phases: Array<{ phase: LocalGeneratedImageFlowPhase; delayMs: number }> = [
        { phase: 'generating', delayMs: 700 },
        { phase: 'preview', delayMs: 1700 },
        { phase: 'saving', delayMs: 2900 },
        { phase: 'complete', delayMs: 4300 },
      ];
      if (config.simulateStaleDowngrade) {
        phases.push({ phase: 'stale-downgrade', delayMs: 5400 });
      }

      for (const { phase, delayMs } of phases) {
        const timerId = window.setTimeout(() => {
          const payload = buildLocalGeneratedImageFlowPayload(config, phase);
          updateLocalGeneratedImageFlowMessage(
            targetConversationId,
            assistantMessageId,
            payload,
            phase
          );
        }, delayMs);
        localGeneratedImageFlowTimersRef.current.push(timerId);
      }

      userScrolledUpRef.current = false;
      isAtBottomRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToBottom(false));
      });
      toast.success('Local image flow test started.');
    },
    [
      authenticated,
      clearLocalGeneratedImageFlowTimers,
      conversationId,
      createConversation,
      navigate,
      registerPendingLocalUserMessage,
      scrollToBottom,
      selectedModel.id,
      sidebar,
      suppressSuggestions,
      updateConversation,
      updateLocalGeneratedImageFlowMessage,
    ]
  );

  const injectLocalGeneratedImageTest = useCallback(
    async (rawText: string, config: LocalGeneratedImageTestConfig, existingMessageId?: string) => {
      clearLocalGeneratedImageFlowTimers();
      const now = new Date();
      const userMsg: Message = {
        id: existingMessageId || `local-generated-image-user-${Date.now()}`,
        role: 'user',
        content: rawText,
        clientCreatedAt: now.toISOString(),
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: now.toISOString().split('T')[0],
        type: 'text',
      };

      const isTerminal =
        config.variant === 'failed' || config.variant === 'complete' || config.variant === 'multi';
      const assistantMsg: Message = {
        id: `local-generated-image-${Date.now()}`,
        role: 'assistant',
        content: '',
        reasoning_content: '',
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: now.toISOString().split('T')[0],
        status: isTerminal ? 'complete' : 'streaming',
        type: 'generated-image',
        data: {
          generatedImage: buildLocalGeneratedImageTestPayload(config),
        },
      };

      processedMessagesRef.current.add(userMsg.id);
      sidebar?.setChatStarted(true);
      suppressSuggestions();
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      await stopGeneration(true);
      setFirstSendPending(false);

      if (!authenticated && !conversationId) {
        sidebar?.setChatStarted(true);
        setWelcomePendingMessages([userMsg, assistantMsg]);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollToBottom(false));
        });
        toast.success(`Local image card test injected: ${config.variant}.`);
        return;
      }

      let targetConversationId = conversationId;
      if (!targetConversationId) {
        targetConversationId = await createConversation('Local Image UI Test', selectedModel.id, selectedModel.reasoningLevel);
        if (!targetConversationId) {
          toast.error('Unable to create a chat for the local image card test.');
          return;
        }
        currentConversationIdRef.current = targetConversationId;
        navigate(`/chat/${targetConversationId}`);
      }

      const nextMessages = [
        ...messagesRef.current.filter((m) => m.id !== userMsg.id),
        userMsg,
        assistantMsg,
      ];
      messagesRef.current = nextMessages;
      registerPendingLocalUserMessage(targetConversationId, userMsg);
      updateConversation(targetConversationId, {
        messages: nextMessages,
        activeTask: null,
      });

      userScrolledUpRef.current = false;
      isAtBottomRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToBottom(false));
      });
      toast.success(`Local image card test injected: ${config.variant}.`);
    },
    [
      authenticated,
      clearLocalGeneratedImageFlowTimers,
      conversationId,
      createConversation,
      navigate,
      registerPendingLocalUserMessage,
      scrollToBottom,
      selectedModel.id,
      sidebar,
      suppressSuggestions,
      updateConversation,
    ]
  );

  const handleSend = async (text: string = input, existingMessageId?: string) => {
    if (isLocalUiTestEnvironment() && isLocalTxCardTestCommand(text)) {
      await injectLocalTransactionCardTest(text, existingMessageId);
      return;
    }
    if (isLocalUiTestEnvironment()) {
      const localGeneratedImageTest = parseLocalGeneratedImageTestCommand(text);
      if (localGeneratedImageTest) {
        if (localGeneratedImageTest.variant === 'flow') {
          await injectLocalGeneratedImageFlowTest(text, localGeneratedImageTest, existingMessageId);
          return;
        }
        await injectLocalGeneratedImageTest(text, localGeneratedImageTest, existingMessageId);
        return;
      }
    }
    if (!authenticated) {
      try {
        login();
      } catch (e) {
        logger.warn('Failed to trigger login:', e);
      }
      return;
    }
    if (isSubmittingRef.current) return;
    const draftSnapshot = selectedImageDraftsRef.current;
    const trimmedText = text.trim();
    const hasImageDrafts = draftSnapshot.length > 0;
    if (!trimmedText && !hasImageDrafts) return;
    const supportsSelectedModelImageInput = isTextChatModelOption(selectedModel)
      ? supportsVisionChatModel(selectedModel?.id)
      : supportsGeneratedImageInputModel(selectedModel?.id);
    if (hasImageDrafts && !supportsSelectedModelImageInput) {
      toast.error('The selected model does not support image input yet.');
      return;
    }
    if (hasImageDrafts && selectedModel.kind === 'image' && !trimmedText) {
      toast.error('Add instructions for the image edit before sending.');
      return;
    }
    if (hasImageDrafts) {
      const blockedDraft = draftSnapshot.find(
        (draft) =>
          draft.uploadState === 'uploading' || draft.uploadState === 'error' || !draft.uploadId
      );
      if (blockedDraft) {
        toast.error(
          blockedDraft.uploadState === 'error'
            ? 'Image upload failed. Please remove it and try again.'
            : 'Image is still uploading. Please wait.'
        );
        return;
      }
    }
    const attachmentSnapshot = draftSnapshot.map(toComposerImageAttachment);
    if (
      trimmedText &&
      customSettings?.fastSwapMode &&
      requiresContractAddressInFastMode(trimmedText, chainId)
    ) {
      toast.error('Fast Swap Mode requires a contract address for non-whitelisted tokens.');
      return;
    }
    const preparedImageUploadIds = draftSnapshot
      .map((draft) => draft.uploadId)
      .filter((uploadId): uploadId is string => Boolean(uploadId));

    isSubmittingRef.current = true;
    let currentConvId = conversationId;
    let optimisticUserMsg: Message | null = null;

    try {
      // Perform client-side moderation check
      const moderationResult = await moderationService.checkInput(
        trimmedText,
        conversationId,
        selectedModel?.id
      );
      if (!moderationResult.safe) {
        toast.error(moderationResult.reason || 'Message blocked by safety policy');
        return;
      }

      // Set flag to prevent conversation-change useEffect from interrupting
      isSendingRef.current = true;

      // LOGGING: Log the chain context before sending
      logger.debug(`Sending message on chain: ${currentChain.name} (${currentChain.id})`);

      // Prevent sending new messages while stopping
      if (isStopping) {
        logger.debug('Blocked send - currently stopping');
        if (conversationId) clearActiveTask(conversationId, updateConversation, 'user_stop');
        return;
      }

      // Use the live UI selection as the send source of truth.
      const modelToUse = selectedModel;

      // Uploads already completed during image selection; sending only
      // creates the session/task and passes prepared upload ids.
      if (!currentConvId) {
        const newId = await createConversation(
          trimmedText || 'Image upload',
          modelToUse.id,
          modelToUse.reasoningLevel
        );
        if (newId) {
          currentConvId = newId;
          currentConversationIdRef.current = newId;
        }
      }

      if (!currentConvId) {
        if (!authenticated) {
          toast.error('Session expired. Login to KIKO to create chat session.');
        } else {
          toast.error('Unable to create chat session. Please refresh and try again.');
        }
        return;
      }

      if (!conversationId) {
        setFirstSendPending(true);
      }

      sidebar?.setChatStarted(true);

      const now = new Date();
      const optimisticTask = { id: `task-${Date.now()}`, status: 'pending' as const };
      const userMsg: Message = {
        id: existingMessageId || Date.now().toString(),
        role: 'user',
        content: trimmedText,
        clientCreatedAt: now.toISOString(),
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: now.toISOString().split('T')[0],
        type: 'text',
        data: attachmentSnapshot.length > 0 ? { attachments: attachmentSnapshot } : undefined,
      };
      optimisticUserMsg = userMsg;

      processedMessagesRef.current.add(userMsg.id);

      if (!existingMessageId) {
        if (conversationId) {
          const currentMessages = messagesRef.current;
          const placeholderIdx = currentMessages.findIndex((message) =>
            message.id.startsWith('pending-user-')
          );
          const nextMessages =
            placeholderIdx >= 0
              ? currentMessages.map((message, index) =>
                  index === placeholderIdx ? userMsg : message
                )
              : [...currentMessages, userMsg];
          messagesRef.current = nextMessages;
          updateConversation(currentConvId, {
            messages: nextMessages,
            activeTask: optimisticTask,
          });
          registerPendingLocalUserMessage(currentConvId, userMsg);
        } else {
          messagesRef.current = [userMsg];
          updateConversation(currentConvId, {
            messages: [userMsg],
            activeTask: optimisticTask,
            pendingAIPrompt: undefined,
          });
          registerPendingLocalUserMessage(currentConvId, userMsg);
          setWelcomePendingMessages([userMsg]);
          navigate(`/chat/${currentConvId}`);
        }
      } else {
        updateConversation(currentConvId, {
          activeTask: optimisticTask,
          pendingAIPrompt: undefined,
        });
      }

      setInput('');
      updateSelectedImageDrafts(() => []);

      setThinkingText('Thinking');
      setThinkingStartTime(Date.now());
      suppressSuggestions();

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      userScrolledUpRef.current = false;
      isAtBottomRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToBottom(false));
      });

      const sendAbortController = new AbortController();
      sendAbortControllerRef.current = sendAbortController;
      stopRequestedRef.current = false;

      // 3. WebSocket is already connected globally in App.tsx
      // checks are handled by handleGlobalChatEvent

      // 4. Call backend API
      logger.debug('Sending message with walletAddress:', walletAddress, 'chainId:', chainId);
      const nativeSymbolMap: Record<number, string> = {
        1: 'ETH',
        8453: 'ETH',
        10: 'ETH',
        42161: 'ETH',
        56: 'BNB',
        137: 'MATIC',
        900: 'SOL',
      };
      const nativeSymbol = nativeSymbolMap[chainId] || 'ETH';
      const nativeBalance = userBalances[nativeSymbol];
      const contextPayload = {
        walletAddress,
        chainId,
        chainName: currentChain.name,
        isWalletConnected: !!walletAddress,
        balance: userBalances,
        nativeBalance,
        currentPage: window.location.pathname,
        pageContext: `${document.title || 'KiKo'} | ${window.location.pathname}`,
        farcaster: {
          followsKiko: farcasterContext.followsKiko,
          followStatus: farcasterContext.followStatus,
          checkedAt: farcasterContext.checkedAt,
          kikoHandle: 'kikoapp',
          profileUrl: farcasterContext.profileUrl,
        },
      };
      const resp =
        modelToUse.kind === 'image'
          ? await chatApi.generateImage(currentConvId, trimmedText, {
              model: modelToUse.id,
              imageQuality: modelToUse.imageQuality,
              imageUploadIds: preparedImageUploadIds,
              signal: sendAbortController.signal,
            })
          : await chatApi.sendMessage(currentConvId, trimmedText, {
              model: modelToUse.id,
              reasoningEffort: modelToUse.reasoningEffort,
              walletAddress: walletAddress,
              chainId: chainId,
              toolConfig: customSettings,
              allowanceMode: customSettings?.fastSwapMode ? 'instant' : 'confirm',
              nativeBalance,
              currentPage: window.location.pathname,
              pageContext: `${document.title || 'KiKo'} | ${window.location.pathname}`,
              balance: userBalances,
              farcaster: contextPayload.farcaster,
              context: contextPayload,
              imageUploadIds: preparedImageUploadIds,
              signal: sendAbortController.signal,
            });

      if (resp.success) {
        const { assistantMessage, task } = resp;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kiko-usage-refresh'));
        }

        // Add assistant message placeholder
        const createdAt =
          (assistantMessage as any).created_at ?? assistantMessage.timestamp ?? Date.now();
        const aiMsg: Message = {
          id: assistantMessage.id,
          role: 'assistant',
          content: assistantMessage.content || '',
          reasoning_content: assistantMessage.reasoning_content || '',
          timestamp: new Date(createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          date: new Date(createdAt).toISOString().split('T')[0],
          type: (assistantMessage.type as any) || 'text',
          data: assistantMessage.data,
          status: (assistantMessage.status as any) || 'streaming',
        };

        const currentMessages = messagesRef.current;
        const exists = currentMessages.some((m) => m.id === assistantMessage.id);
        const nextMessages = exists ? currentMessages : [...currentMessages, aiMsg];
        messagesRef.current = nextMessages;

        const normalizedTaskStatus = String(task.status || '').toLowerCase();
        const taskMessageId =
          String(
            (task as { messageId?: unknown; message_id?: unknown }).messageId ||
              (task as { messageId?: unknown; message_id?: unknown }).message_id ||
              assistantMessage.id ||
              ''
          ).trim() || null;
        updateConversation(currentConvId, {
          messages: nextMessages,
          activeTask:
            normalizedTaskStatus === 'done' || normalizedTaskStatus === 'completed'
              ? null
              : { id: task.id, messageId: taskMessageId, status: task.status as any },
        });

        // Update task state in parent component
        if (onTaskUpdate) {
          if (normalizedTaskStatus === 'done' || normalizedTaskStatus === 'completed') {
            onTaskUpdate(null);
          } else {
            onTaskUpdate({
              id: task.id,
              messageId: taskMessageId,
              status: task.status as any,
            });
          }
        }
        // WebSocket will handle the chunks and status updates
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorMessage =
          (resp as any).error || (resp as any).message || 'Failed to send message';
        throw new Error(errorMessage);
      }
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Error sending message:', err);
      setFirstSendPending(false);

      const wasStoppedByUser = err.name === 'AbortError' || stopRequestedRef.current;
      if (hasImageDrafts) {
        discardPreparedUploadIdsQuietly(
          preparedImageUploadIds,
          wasStoppedByUser ? 'send_aborted' : 'send_failed'
        );
      }
      if (wasStoppedByUser) {
        if (currentConvId) {
          clearActiveTask(currentConvId, updateConversation, 'send_aborted');
        } else if (conversationId) {
          clearActiveTask(conversationId, updateConversation, 'send_aborted');
        }
        return;
      }

      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to connect to backend'}`,
        status: 'error',
        type: 'text',
        timestamp: new Date().toLocaleTimeString(),
      };
      if (currentConvId) {
        const currentMessages = messagesRef.current;
        const nextMessages = [...currentMessages, errorMsg];
        messagesRef.current = nextMessages;
        updateConversation(currentConvId, {
          messages: nextMessages,
          activeTask: null,
        });
      } else if (conversationId) {
        const currentMessages = messagesRef.current;
        const nextMessages = [...currentMessages, errorMsg];
        messagesRef.current = nextMessages;
        updateConversation(conversationId, {
          messages: nextMessages,
          activeTask: null,
        });
      }
      if (hasImageDrafts && optimisticUserMsg) {
        updateSelectedImageDrafts(() =>
          draftSnapshot.map((draft) => ({
            ...draft,
            uploadState: 'error' as const,
            uploadId: undefined,
            uploadExpiresAt: undefined,
          }))
        );
      }
    } finally {
      sendAbortControllerRef.current = null;
      // Clear sending flag
      isSendingRef.current = false;
      // Clear submission lock
      isSubmittingRef.current = false;
    }
  };

  // Keep handleSendRef always pointing at the latest handleSend
  useEffect(() => {
    handleSendRef.current = (text: string) => handleSend(text);
  });

  // Listen for cross-page input prefill events (e.g. Buy/Sell from TokenDetailPage)
  // Does NOT auto-send — user reviews and sends manually
  // Strategy: sessionStorage (for lazy-mount case) + window event (for already-mounted case)
  useEffect(() => {
    // 1. On mount: check if there's a queued prefill from sessionStorage
    const stored = sessionStorage.getItem('kiko-prefill-prompt');
    if (stored) {
      sessionStorage.removeItem('kiko-prefill-prompt');
      setInput(stored);
      setTimeout(() => textareaRef.current?.focus(), 80);
    }

    // 2. Also listen via event for when component is already mounted
    const handler = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt: string }>).detail?.prompt;
      if (prompt) {
        setInput(prompt);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    };
    window.addEventListener('kiko-prefill-input', handler);
    return () => window.removeEventListener('kiko-prefill-input', handler);
  }, []);

  // Context Gathering (Handled by Hook now)

  // Intent Detection (Handled by Hook)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isCurrentlyComposing =
      isComposing || (e.nativeEvent as unknown as { isComposing?: boolean }).isComposing;

    if (e.key === 'Enter' && !e.shiftKey) {
      // 1. Check if we're currently in IME composition
      if (isCurrentlyComposing) {
        return; // Let IME handle it
      }

      // 2. Check if composition JUST ended (within 100ms)
      // Some browsers (like Safari) might fire a KeyDown for Enter immediately after compositionEnd
      if (Date.now() - lastCompositionEndRef.current < 100) {
        e.preventDefault();
        return;
      }

      if (isBusy || isStopping) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      handleSend();
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    // Track the exact time composition ended
    lastCompositionEndRef.current = Date.now();
    // Delay clearing the state slightly to ensure any trailing KeyDown events are caught
    setTimeout(() => {
      setIsComposing(false);
    }, 50);
  };

  // Auto-resize textarea like ChatGPT/Gemini
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    resumeSuggestions();
    setInput(newValue);
    autoResizeTextarea(e.target);
    detectIntent(newValue);
  };

  const autoResizeTextarea = (textarea: HTMLTextAreaElement) => {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set new height based on content, with min and max limits (5 lines max = ~120px)
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 120);
    textarea.style.height = `${newHeight}px`;

    // Update message list padding to ensure content is not hidden behind input
    // Base padding needs to account for: input area + action buttons (~40px extra)
    if (scrollContainerRef.current) {
      requestAnimationFrame(() => {
        syncScrollPaddingWithComposer();
      });
    }
  };

  // Auto-resize when input is set programmatically (e.g., from AI analyze or suggestions)
  useEffect(() => {
    if (textareaRef.current && input) {
      autoResizeTextarea(textareaRef.current);
    }
    if (!input) {
      requestAnimationFrame(() => syncScrollPaddingWithComposer());
    }
  }, [input, syncScrollPaddingWithComposer]);

  // Use propPendingPrompt or local state logic
  useEffect(() => {
    if (propPendingPrompt) {
      setInput(propPendingPrompt);
      if (onAIPromptSet) onAIPromptSet();
    }
  }, [onAIPromptSet, propPendingPrompt]);

  // Handle pending AI prompt from other pages (legacy prop cleanup)
  useEffect(() => {
    // Handled via kiko-auto-send window event now (see above)
  }, []);

  // Feedback handler lifted to parent to persist state across remounts
  const handleMessageFeedback = useCallback(
    (messageId: string, feedback: 'like' | 'dislike' | null) => {
      const updated = messages.map((msg) => (msg.id === messageId ? { ...msg, feedback } : msg));
      if (conversationId) updateConversation(conversationId, updated);
    },
    [messages, conversationId, updateConversation]
  );

  // Process messages with strategy data - MOVED to top level to avoid conditional hook call
  const enrichedMessages = useMemo(() => {
    return displayMessages.map((msg) => {
      if (msg.type === 'strategy-card' && msg.data?.id) {
        const liveStrat = strategyRuntime.strategies.find(
          (s: TradingStrategy) => s.id === msg.data.id
        );
        if (liveStrat) {
          return { ...msg, data: liveStrat };
        } else {
          // IMPORTANT: Don't mark as deleted if it was just created (< 30s ago)
          // This prevents the race condition where the card shows up before the poll returns it
          const isNew = msg.timestamp && Date.now() - new Date(msg.timestamp).getTime() < 30000;
          if (isNew) {
            return msg;
          }
          // Strategy was actually deleted (or didn't load after 30s)
          return { ...msg, data: { ...msg.data, status: 'deleted' } };
        }
      }
      return msg;
    });
  }, [displayMessages, strategyRuntime.strategies]);

  const shouldLoadStrategyRuntime =
    (sidebar?.chatStarted ?? false) || messages.length > 0 || !!conversationId;

  return (
    <div className={`${styles.chatContainer} ${styles[resolvedTheme]}`}>
      {/* Hero / Welcome Content with Exit Animation */}
      {/* Hero / Welcome Content with Jelly Exit Animation */}
      {/* Remove mode="wait" to allow overlapping animations (Jelly effect) */}
      <AnimatePresence initial={false}>
        {!(sidebar?.chatStarted ?? false) && (
          <motion.div
            key="welcome-screen"
            initial={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              disableChatTransitions
                ? {
                    opacity: 0,
                    transition: { duration: 0.01 },
                  }
                : {
                    opacity: 0,
                    y: -120, // Move up significantly
                    scale: 0.95, // Slight shrink
                    filter: 'blur(10px)', // Blur effect for smooth exit
                    pointerEvents: 'none', // Prevent interaction during exit
                    transition: {
                      duration: 0.5,
                      ease: [0.32, 0.72, 0, 1], // Custom ease for "Jelly" feel
                    },
                  }
            }
            style={{
              position: 'absolute', // Absolute position to overlap with chat
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10, // Above chat until gone
            }}
          >
            <WelcomeScreen
              onSuggestionClick={handleSend}
              isUploadingImages={isUploadingImages}
              isImageSendBlocked={isImageSendBlocked}
              selectedImageDrafts={selectedImageDrafts}
              onSelectImages={handleSelectImages}
              onRemoveImage={handleRemoveSelectedImage}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {shouldLoadStrategyRuntime && (
        <React.Suspense fallback={null}>
          <LazyChatStrategyRuntime
            messages={messages}
            conversationId={conversationId}
            onStateChange={setStrategyRuntime}
          />
        </React.Suspense>
      )}

      <ChatMessageList
        chatStarted={sidebar?.chatStarted ?? false}
        disableChatTransitions={disableChatTransitions}
        scrollContainerRef={scrollContainerRef}
        messagesEndRef={messagesEndRef}
        enrichedMessages={enrichedMessages}
        handleScroll={handleScroll}
        thinkingText={thinkingText}
        thinkingStartTime={thinkingStartTime}
        isBusy={isBusy}
        walletAddress={walletAddress}
        chainId={chainId}
        conversationId={conversationId}
        selectedModelId={selectedModel?.id}
        onFeedback={handleMessageFeedback}
        onCardAction={(action, data, msg) => {
          if (action === 'swap-cancel') {
            const updated = messages.map((m) =>
              m.id === msg.id ? { ...m, transactionStatus: 'cancelled' as const } : m
            );
            if (conversationId) updateConversation(conversationId, updated);
          } else if (action === 'swap-success') {
            const txHash = (data as { txHash: string }).txHash;
            const updated = messages.map((m) =>
              m.id === msg.id
                ? {
                    ...m,
                    transactionStatus: 'success' as const,
                    transactionHash: txHash,
                  }
                : m
            );
            if (conversationId) updateConversation(conversationId, updated);
          } else if (action === 'swap-error') {
            const updated = messages.map((m) =>
              m.id === msg.id ? { ...m, transactionStatus: 'failed' as const } : m
            );
            if (conversationId) updateConversation(conversationId, updated);
          } else if (action === 'strategy-delete') {
            const strategyId = data as string;
            strategyRuntime.deleteStrategy?.(strategyId);
            const updated = messages.map((m) =>
              m.type === 'strategy-card' && m.data?.id === strategyId
                ? { ...m, type: 'text' as const, data: undefined }
                : m
            );
            if (conversationId) updateConversation(conversationId, updated);
          } else if (action === 'strategy-toggle') {
            const strategyId = data as string;
            strategyRuntime.toggleStrategyStatus?.(strategyId);
            const updated = messages.map((m) => {
              if (m.type === 'strategy-card' && m.data?.id === strategyId) {
                const newStatus = m.data.status === 'active' ? 'paused' : 'active';
                return { ...m, data: { ...m.data, status: newStatus } };
              }
              return m;
            });
            if (conversationId) updateConversation(conversationId, updated);
          }
        }}
      />

      <ChatComposer
        chatStarted={sidebar?.chatStarted ?? false}
        disableChatTransitions={disableChatTransitions}
        showJumpToBottom={showJumpToBottom}
        showSuggestions={showSuggestions}
        suggestions={suggestions}
        input={input}
        selectedModel={selectedModel}
        isBusy={isBusy}
        isStopping={isStopping}
        isUploadingImages={isUploadingImages}
        isImageSendBlocked={isImageSendBlocked}
        selectedImageDrafts={selectedImageDrafts}
        inputTop={safariKeyboard.inputTop}
        isKeyboardVisible={safariKeyboard.isKeyboardVisible}
        textareaRef={textareaRef}
        inputAreaRef={inputAreaRef}
        closeSuggestions={closeSuggestions}
        onScrollToBottom={() => scrollToBottom()}
        onSelectSuggestion={(item: SuggestionItem) => {
          item.action();
          textareaRef.current?.focus();
        }}
        onInputChange={handleInputChange}
        onInputKeyDown={handleKeyDown}
        onInputFocus={handleInputFocus}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onSelectModel={(model) => {
          setSelectedModel(model);
          void persistUserSelectedModelPreference(model);
          logger.debug('Model changed to:', model.id);
        }}
        onSelectImages={handleSelectImages}
        onRemoveImage={handleRemoveSelectedImage}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onPrimaryAction={() => (isBusy ? stopGeneration() : handleSend())}
      />

      {isSettingsOpen && (
        <React.Suspense fallback={null}>
          <LazyCustomAISettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </React.Suspense>
      )}
    </div>
  );
};
