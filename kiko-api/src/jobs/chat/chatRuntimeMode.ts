// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: the chat v2 rewrite plan requires an explicit runtime mode boundary
//         so `chatWorker` can route through a named mode owner instead of
//         silently assuming one hard-coded chat path. The repository does not
//         yet preserve a separate live v1 chat executor, so compatibility mode
//         currently needs to be explicit and observable while delegating through
//         a dedicated compat runner owner until a real fallback executor exists.
// Goal: make the chat runtime entrypoint configurable and auditable, while
//       keeping the current default on `v2_primary`.
// Owns: chat runtime mode resolution and mode-to-runner dispatch.
// Does Not Own: turn execution internals, task lifecycle, or provider routing.
// Design Language:
// - chat runtime mode must be explicit and named at the worker entry boundary
// - `v2_primary` is the default path until a real legacy executor exists
// - compatibility mode dispatch belongs to a compat runner owner, not inline dispatcher logic
// - runtime mode resolution should accept old compatibility spellings without reopening hidden branches
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: explicit chat runtime mode boundary and rollout switch
// - Verification: inferred from plan and verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-entry-boundary.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: placing runtime-mode dispatch above the v2 turn runner owner
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-runtime-mode-switch.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: explicit `CHAT_RUNTIME_MODE` switch and runtime-mode dispatch boundary
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-compat-runner-owner.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: moving compatibility alias behavior into its own compat runner owner
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-compat-runner-owner.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-entry-boundary.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-runtime-mode-switch.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { runChatCompatTurn } from './chatCompatTurnRunner.js';
import { runChatV2Turn, type ChatV2TurnRunnerResult } from './chatV2TurnRunner.js';

export type ChatRuntimeMode = 'v2_primary' | 'compat_fallback';

type ChatRuntimeTurnParams = Parameters<typeof runChatV2Turn>[0];

const COMPAT_MODE_VALUES = new Set([
    'compat',
    'compat_fallback',
    'legacy',
    'legacy_compat',
    'v1',
    'v1_compat',
]);

export function resolveChatRuntimeMode(raw = process.env.CHAT_RUNTIME_MODE): ChatRuntimeMode {
    const normalized = String(raw || '').trim().toLowerCase();
    if (COMPAT_MODE_VALUES.has(normalized)) {
        return 'compat_fallback';
    }
    return 'v2_primary';
}

export async function runChatTurnByRuntimeMode(
    params: ChatRuntimeTurnParams & {
        runtimeMode?: ChatRuntimeMode;
    },
    deps?: {
        runChatCompatTurn?: (params: ChatRuntimeTurnParams) => Promise<ChatV2TurnRunnerResult>;
        runChatV2Turn?: (params: ChatRuntimeTurnParams) => Promise<ChatV2TurnRunnerResult>;
    },
): Promise<ChatV2TurnRunnerResult & { runtimeMode: ChatRuntimeMode }> {
    const runtimeMode = params.runtimeMode || resolveChatRuntimeMode();
    const { runtimeMode: _ignored, ...runnerParams } = params;
    const result = runtimeMode === 'compat_fallback'
        ? await (deps?.runChatCompatTurn || runChatCompatTurn)(runnerParams)
        : await (deps?.runChatV2Turn || runChatV2Turn)(runnerParams);
    return {
        ...result,
        runtimeMode,
    };
}
