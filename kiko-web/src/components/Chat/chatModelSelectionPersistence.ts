import {
  coerceSelectableChatModelOption,
  findChatModelOption,
  findChatModelOptionByFamilyAndReasoning,
  hydrateChatModelOption,
  type ChatModelControlLevel,
  type ChatModelFamilyId,
  type ChatModelOption,
} from './chatConstants';
import { logger } from '../../utils/logger';

// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Almurat
// Reason: the welcome shell owns the persisted home/default model, while the
//         active conversation route may mirror a different session model. The
//         shared snapshot still needs to remember the last control level per
//         family, but chat-route hydration must not overwrite the homepage
//         default when those scopes diverge.
// Goal: preserve the exact model object the user chose for the home/default
//       surface plus the last control level used for each family across
//       reloads and same-origin welcome-shell sync.
// Owns: localStorage serialization, hydration, and broadcast of the
//       home/default selected chat model snapshot plus per-family control
//       memory.
// Does Not Own: active conversation model hydration, model catalog policy,
//       remote user settings, or backend default chat model writes.
// Design Language:
// - selection persistence should happen at the moment of user choice, not only
//   in a later effect
// - active conversation model changes must not rewrite the home/default
//   snapshot
// - stored snapshots must round-trip the active reasoning or quality control
//   and remember the last control level for each family
// - a single storage key should own both the home/default snapshot and the
//   family control memory
// - malformed storage must degrade to the canonical selectable model fallback
// Document Provenance:
// - Source: user bug report about reasoning strength resetting after refresh
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: immediate local persistence and restore of the home/default
//   selected chat model
// - Verification: inferred from code and targeted helper tests
// - Source: user bug report about reasoning strength resetting after switching
//   away from a family and back again
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-20
// - Applied To: storing the last control level per family in the same snapshot
// - Verification: inferred from code
// - Source: current bug report that chat-route model sync must not overwrite
//   the homepage default model snapshot
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: keeping the persisted snapshot scoped to the welcome/home
//   default model rather than the active conversation model
// - Verification: inferred from code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-model-reasoning-selection-persistence.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-chat-model-family-control-memory.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-chat-home-default-and-session-model-separation.md
// - /Users/almurat/KiKo/kiko-web/src/components/Chat/chatConstants.ts

export const CHAT_SELECTED_MODEL_STORAGE_KEY = 'kiko-selected-model';

export interface ChatModelSelectionState {
  selectedModel: ChatModelOption;
  familyControlLevelsByFamilyId: Partial<Record<ChatModelFamilyId, ChatModelControlLevel>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseStoredFamilyControlLevels(
  value: unknown
): Partial<Record<ChatModelFamilyId, ChatModelControlLevel>> {
  if (!isRecord(value)) return {};

  const result: Partial<Record<ChatModelFamilyId, ChatModelControlLevel>> = {};
  for (const [familyId, level] of Object.entries(value)) {
    if (typeof level !== 'string') continue;
    result[familyId as ChatModelFamilyId] = level.trim().toLowerCase() as ChatModelControlLevel;
  }
  return result;
}

export function parseStoredChatModelSelectionState(
  value: unknown
): ChatModelSelectionState | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    const selectedModel = coerceSelectableChatModelOption(findChatModelOption(value));
    if (!selectedModel) return undefined;
    return {
      selectedModel,
      familyControlLevelsByFamilyId: {
        [selectedModel.familyId]: selectedModel.reasoningLevel,
      },
    };
  }

  if (!isRecord(value)) return undefined;

  const candidate = value as {
    id?: string;
    selectedModel?: unknown;
    model?: unknown;
    familyControlLevelsByFamilyId?: unknown;
    familyControlLevels?: unknown;
    familyReasoningByFamilyId?: unknown;
    reasoningByFamilyId?: unknown;
  };

  const rawSelectedModel = candidate.selectedModel ?? candidate.model ?? value;
  const selectedModelId = isRecord(rawSelectedModel)
    ? (rawSelectedModel.id as string | null | undefined)
    : candidate.id;
  const hydratedSelectedModel =
    hydrateChatModelOption(rawSelectedModel) ||
    coerceSelectableChatModelOption(findChatModelOption(selectedModelId));

  if (!hydratedSelectedModel) return undefined;

  const familyControlLevelsByFamilyId = parseStoredFamilyControlLevels(
    candidate.familyControlLevelsByFamilyId ??
      candidate.familyControlLevels ??
      candidate.familyReasoningByFamilyId ??
      candidate.reasoningByFamilyId
  );

  const restoredControlLevel =
    familyControlLevelsByFamilyId[hydratedSelectedModel.familyId] ||
    hydratedSelectedModel.reasoningLevel;
  const restoredSelectedModel =
    findChatModelOptionByFamilyAndReasoning(
      hydratedSelectedModel.familyId,
      restoredControlLevel
    ) || hydratedSelectedModel;

  return {
    selectedModel: coerceSelectableChatModelOption(restoredSelectedModel),
    familyControlLevelsByFamilyId: {
      ...familyControlLevelsByFamilyId,
      [restoredSelectedModel.familyId]: restoredSelectedModel.reasoningLevel,
    },
  };
}

export function parseStoredChatModelSelection(value: unknown): ChatModelOption | undefined {
  return parseStoredChatModelSelectionState(value)?.selectedModel;
}

export function readStoredChatModelSelectionState(): ChatModelSelectionState | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const saved = window.localStorage.getItem(CHAT_SELECTED_MODEL_STORAGE_KEY);
    if (!saved) return undefined;
    return parseStoredChatModelSelectionState(JSON.parse(saved));
  } catch (error) {
    logger.warn('Failed to read selected model from localStorage:', error);
    return undefined;
  }
}

export function readStoredChatModelSelection(): ChatModelOption | undefined {
  return readStoredChatModelSelectionState()?.selectedModel;
}

export function persistChatModelSelection(model: ChatModelOption): void {
  if (typeof window === 'undefined') return;

  try {
    const currentState = readStoredChatModelSelectionState();
    const nextState: ChatModelSelectionState = {
      selectedModel: model,
      familyControlLevelsByFamilyId: {
        ...(currentState?.familyControlLevelsByFamilyId || {}),
        [model.familyId]: model.reasoningLevel,
      },
    };
    window.localStorage.setItem(CHAT_SELECTED_MODEL_STORAGE_KEY, JSON.stringify(nextState));
    window.dispatchEvent(new CustomEvent('kiko-model-changed', { detail: model }));
  } catch (error) {
    logger.warn('Failed to persist selected model to localStorage:', error);
  }
}

export function getStoredChatModelControlLevelForFamily(
  familyId?: string | null
): ChatModelControlLevel | undefined {
  const normalizedFamilyId = String(familyId || '').trim().toLowerCase();
  if (!normalizedFamilyId) return undefined;

  return readStoredChatModelSelectionState()?.familyControlLevelsByFamilyId[
    normalizedFamilyId as ChatModelFamilyId
  ];
}
