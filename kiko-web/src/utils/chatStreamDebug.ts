// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: chat streaming regressions need frontend-side proof of whether chunks
//         arrived over WebSocket, were buffered by RootLayout, or were rendered
//         by MessageBubble.
// Goal: provide gated frontend stream diagnostics that can be enabled locally
//       or in production without exposing raw message content by default.
// Owns: browser chat-stream debug gating and console emission.
// Does Not Own: WebSocket transport, conversation state merging, or message UI.
// Design Language:
// - local dev logs stream diagnostics by default
// - production logs only when localStorage/query/global flag opts in
// - diagnostics should log lengths, counts, sequence ids, and timing, not raw text
// Document Provenance:
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: correlating backend stream logs with frontend receive/render logs
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-stream-diagnostics.md
import { redact } from './logger';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'debug']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

declare global {
  interface Window {
    __KIKO_CHAT_STREAM_DEBUG__?: boolean;
  }
}

function readFlag(value: unknown): boolean | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

function getBrowserDebugFlag(): boolean | null {
  if (typeof window === 'undefined') return null;
  if (typeof window.__KIKO_CHAT_STREAM_DEBUG__ === 'boolean') {
    return window.__KIKO_CHAT_STREAM_DEBUG__;
  }
  try {
    const queryFlag = readFlag(new URLSearchParams(window.location.search).get('chatStreamDebug'));
    if (queryFlag !== null) {
      window.localStorage.setItem('kiko.chatStreamDebug', queryFlag ? '1' : '0');
      return queryFlag;
    }
    return readFlag(window.localStorage.getItem('kiko.chatStreamDebug'));
  } catch {
    return null;
  }
}

export function isChatStreamDebugEnabled(): boolean {
  const envFlag = readFlag((import.meta as any)?.env?.VITE_CHAT_STREAM_DEBUG);
  if (envFlag !== null) return envFlag;
  const browserFlag = getBrowserDebugFlag();
  if (browserFlag !== null) return browserFlag;
  return Boolean((import.meta as any)?.env?.DEV);
}

export function chatStreamDebug(stage: string, metadata: Record<string, unknown> = {}) {
  if (!isChatStreamDebugEnabled()) return;
  console.info(`[ChatStream:${stage}]`, redact({
    ...metadata,
    atMs: Math.round(performance.now()),
  }));
}
