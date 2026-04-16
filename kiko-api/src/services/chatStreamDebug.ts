// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: chat streaming regressions could not be diagnosed from existing logs
//         because provider deltas, broker chunks, WebSocket broadcasts, and
//         frontend rendering were not correlated by message and chunk counts.
// Goal: provide opt-in full-chain streaming diagnostics without logging raw
//       assistant text or flooding production by default.
// Owns: backend chat streaming diagnostic gating and metadata-only debug emission.
// Does Not Own: provider streaming behavior, WebSocket delivery, or frontend rendering.
// Design Language:
// - diagnostics must log lengths, counts, sequence ids, and timing, not raw message text
// - local development should expose stream diagnostics by default
// - production must require an explicit CHAT_STREAM_DEBUG opt-in
// Document Provenance:
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: identifying direct fast-path output as a single backend chunk
// - Verification: verified in runtime log
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-stream-diagnostics.md
import { LogCode, type LogMetadata } from '../config/logRegistry.js';
import { logger } from '../utils/logger.js';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'debug']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

export function isChatStreamDebugEnabled(): boolean {
    const raw = String(process.env.CHAT_STREAM_DEBUG || process.env.DEBUG_CHAT_STREAM || '').trim().toLowerCase();
    if (TRUE_VALUES.has(raw)) return true;
    if (FALSE_VALUES.has(raw)) return false;
    return process.env.NODE_ENV !== 'production';
}

export function logChatStreamDebug(code: LogCode, message: string, metadata: LogMetadata = {}) {
    if (!isChatStreamDebugEnabled()) return;
    logger.info(code, message, {
        ...metadata,
        streamDebug: true,
    });
}

export function getTextMetrics(text: unknown): { length: number; empty: boolean } {
    const value = String(text || '');
    return {
        length: value.length,
        empty: value.length === 0,
    };
}
