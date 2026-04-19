// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan Hale
// Reason: generated-image turns can reach a visible terminal image state through
//         `update_message_data` before the generic `message_complete` or
//         `task_status` cleanup arrives. This owner exists so the chat surface
//         can settle message status and task ownership from the same payload
//         instead of leaving the composer in a permanent loading state.
// Goal: provide one reusable interpretation layer for generated-image terminal
//       payloads so live chat owners can decide when a streamed assistant row is
//       effectively finished and when its bound active task may be cleared.
// Owns: normalizing generated-image payload status, matching active task context
//       to assistant message ids, and detecting whether a streamed assistant row
//       is still effectively active.
// Does Not Own: websocket transport ordering, backend task persistence, or
//       message bubble rendering.
// Design Language:
// - generated-image terminal payloads must be treated as authoritative even if
//   generic completion events arrive later
// - task cleanup must be bound to the assistant message context, not to a broad
//   "any image finished" heuristic
// - generated-image terminal rows must not keep the chat surface in a streaming state
// - forbidden local patch pattern: waiting for a second websocket event to end loading
// Document Provenance:
// - Source: operator screenshot and runtime report on 2026-04-19 showing a
//   generated-image card fully rendered while the composer stayed in loading state
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: treating `update_message_data.generatedImage.status` as a
//   terminal-state source for local chat lifecycle cleanup
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-loading.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-generated-image-client-preview-hydration.md

type UnknownRecord = Record<string, unknown>;

export type ActiveTaskContextLike =
  | {
      id?: unknown;
      messageId?: unknown;
    }
  | null
  | undefined;

export type AssistantMessageLifecycleLike = {
  role?: unknown;
  status?: unknown;
  type?: unknown;
  content?: unknown;
  reasoning_content?: unknown;
  data?: unknown;
};

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function normalizeLowerString(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function hasVisibleText(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0;
}

export function getGeneratedImagePayload(
  messageType: unknown,
  messageData: unknown
): UnknownRecord | null {
  const data = asRecord(messageData);
  if (!data) return null;

  const nestedPayload = asRecord(data.generatedImage);
  if (nestedPayload) {
    return nestedPayload;
  }

  if (normalizeLowerString(messageType) === 'generated-image') {
    return data;
  }

  return null;
}

export function resolveGeneratedImageTerminalStatus(
  messageType: unknown,
  messageData: unknown
): 'complete' | 'failed' | null {
  const payload = getGeneratedImagePayload(messageType, messageData);
  const normalizedStatus = normalizeLowerString(payload?.status);
  if (normalizedStatus === 'complete') return 'complete';
  if (normalizedStatus === 'failed') return 'failed';
  return null;
}

export function resolveGeneratedImageMessageStatus(params: {
  currentStatus?: unknown;
  messageType: unknown;
  messageData: unknown;
}): 'streaming' | 'complete' | 'error' | undefined {
  const terminalStatus = resolveGeneratedImageTerminalStatus(params.messageType, params.messageData);
  if (terminalStatus === 'complete') return 'complete';
  if (terminalStatus === 'failed') return 'error';

  const normalizedCurrentStatus = normalizeLowerString(params.currentStatus);
  if (
    normalizedCurrentStatus === 'streaming' ||
    normalizedCurrentStatus === 'complete' ||
    normalizedCurrentStatus === 'error'
  ) {
    return normalizedCurrentStatus as 'streaming' | 'complete' | 'error';
  }

  return undefined;
}

export function isEffectivelyStreamingAssistantMessage(
  message: AssistantMessageLifecycleLike | null | undefined
): boolean {
  if (normalizeLowerString(message?.role) !== 'assistant') return false;
  if (normalizeLowerString(message?.status) !== 'streaming') return false;

  return resolveGeneratedImageTerminalStatus(message?.type, message?.data) === null;
}

export function assistantMessageHasStreamingContent(
  message: AssistantMessageLifecycleLike | null | undefined
): boolean {
  if (!isEffectivelyStreamingAssistantMessage(message)) return false;

  return hasVisibleText(message?.content) || hasVisibleText(message?.reasoning_content);
}

export function doesActiveTaskMatchMessage(
  activeTask: ActiveTaskContextLike,
  messageId: unknown
): boolean {
  const normalizedMessageId = String(messageId || '').trim();
  if (!normalizedMessageId) return false;

  const task = asRecord(activeTask);
  if (!task) return false;

  const boundMessageId = String(task.messageId || '').trim();
  if (boundMessageId) {
    return boundMessageId === normalizedMessageId;
  }

  const activeTaskId = String(task.id || '').trim();
  if (!activeTaskId) return false;
  if (activeTaskId === `task-${normalizedMessageId}`) return true;
  return activeTaskId.includes(normalizedMessageId);
}

export function shouldClearActiveTaskForGeneratedImageUpdate(params: {
  activeTask: ActiveTaskContextLike;
  targetMessageId: unknown;
  messageType: unknown;
  messageData: unknown;
}): boolean {
  if (!doesActiveTaskMatchMessage(params.activeTask, params.targetMessageId)) {
    return false;
  }

  return resolveGeneratedImageTerminalStatus(params.messageType, params.messageData) !== null;
}
