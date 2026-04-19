import { coerceSelectableChatModelOption, findChatModelOption, hydrateChatModelOption, type ChatModelOption } from './chatConstants';
import { logger } from '../../utils/logger';

// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Almurat
// Reason: Chat model family and reasoning selection need one shared persistence
//         path so a quick refresh, tab reopen, or welcome->chat handoff does
//         not fall back to the default effort level.
// Goal: preserve the exact model object the user chose, including reasoning
//       strength or image quality, across reloads and same-origin component
//       sync.
// Owns: localStorage serialization, hydration, and broadcast of the selected
//       chat model snapshot.
// Does Not Own: model catalog policy, remote user settings, or backend default
//       chat model writes.
// Design Language:
// - selection persistence should happen at the moment of user choice, not only
//   in a later effect
// - stored model snapshots must round-trip the active reasoning or quality
//   control instead of only the model id
// - a single storage key should own the selected chat model snapshot
// - malformed storage must degrade to the canonical selectable model fallback
// Document Provenance:
// - Source: user bug report about reasoning strength resetting after refresh
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: immediate local persistence and restore of selected chat model
// - Verification: inferred from code and targeted helper tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-model-reasoning-selection-persistence.md
// - /Users/almurat/KiKo/kiko-web/src/components/Chat/chatConstants.ts

export const CHAT_SELECTED_MODEL_STORAGE_KEY = 'kiko-selected-model';

export function parseStoredChatModelSelection(value: unknown): ChatModelOption | undefined {
  const hydrated = hydrateChatModelOption(value);
  if (hydrated) return hydrated;

  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as { id?: string };
  return coerceSelectableChatModelOption(findChatModelOption(candidate.id));
}

export function readStoredChatModelSelection(): ChatModelOption | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const saved = window.localStorage.getItem(CHAT_SELECTED_MODEL_STORAGE_KEY);
    if (!saved) return undefined;
    return parseStoredChatModelSelection(JSON.parse(saved));
  } catch (error) {
    logger.warn('Failed to read selected model from localStorage:', error);
    return undefined;
  }
}

export function persistChatModelSelection(model: ChatModelOption): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CHAT_SELECTED_MODEL_STORAGE_KEY, JSON.stringify(model));
    window.dispatchEvent(new CustomEvent('kiko-model-changed', { detail: model }));
  } catch (error) {
    logger.warn('Failed to persist selected model to localStorage:', error);
  }
}
