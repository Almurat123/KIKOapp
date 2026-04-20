// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Rowan
// Reason: ChatStreamBroker records tool traces after local tool execution, but
//         tool-managed side effects such as generated-image execution can
//         complete the same assistant message before the broker writes trace
//         metadata. The status decision is kept in this side-effect-free helper
//         so tests can verify terminal generated-image preservation without
//         importing the full broker and opening Prisma connections.
// Goal: decide the message status to persist when appending broker-owned
//       metadata without downgrading terminal side-effect assistant rows back
//       to streaming.
// Owns: status preservation rules for broker metadata writes.
// Does Not Own: tool execution, assistant data merging, WebSocket broadcasts,
//               or generated-image provider state.
// Design Language:
// - durable terminal message status wins over generic streaming trace writes
// - terminal generated-image payload status is authoritative even when the
//   current row status still says streaming
// - forbidden local patch pattern: treating broker runtime metadata writes as a
//   reason to overwrite completed generated-image rows with streaming state
// Document Provenance:
// - Source: /Users/almurat/Downloads/logs.1776665425918.json
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: preserving generated-image message status after
//   `generate_image_from_intent` returns to the broker
// - Verification: verified in runtime log and targeted test
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-public-image-origin-and-message-preservation.md

import type { OrchestratorToolResult } from './contracts.js';

function normalizeMessageStatus(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function resolveAssistantDataPersistStatus(params: {
  currentStatus?: unknown;
  requestedStatus: 'streaming' | 'complete' | 'error';
  nextData: Record<string, any>;
}): 'streaming' | 'complete' | 'error' {
  const currentStatus = normalizeMessageStatus(params.currentStatus);
  if (currentStatus === 'complete' || currentStatus === 'error') {
    return currentStatus;
  }

  const generatedImageStatus = normalizeMessageStatus(
    params.nextData.generatedImage?.status,
  );
  if (generatedImageStatus === 'complete') return 'complete';
  if (generatedImageStatus === 'failed') return 'error';

  return params.requestedStatus;
}

export function resolveToolTracePersistStatus(params: {
  currentStatus?: unknown;
  nextData: Record<string, any>;
  result: OrchestratorToolResult;
}): 'streaming' | 'complete' | 'error' {
  return resolveAssistantDataPersistStatus({
    currentStatus: params.currentStatus,
    requestedStatus: 'streaming',
    nextData: params.nextData,
  });
}
