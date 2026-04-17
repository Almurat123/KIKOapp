// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: after adding an explicit runtime mode switch, compatibility mode was
//         still implemented as an inline alias inside `chatRuntimeMode.ts`.
//         That kept the compat policy invisible as an owner layer and would
//         force future fallback work back into the dispatcher instead of a
//         dedicated compatibility boundary.
// Goal: give `compat_fallback` its own owner layer, even while it temporarily
//       delegates to the v2 turn runner.
// Owns: compatibility-mode execution policy and the temporary alias from compat
//       mode to the v2 runner.
// Does Not Own: runtime mode parsing, worker entry dispatch, or v2 execution internals.
// Design Language:
// - compat mode should have its own owner even before it has its own executor
// - temporary compat alias behavior must be explicit and logged
// - future fallback work should land here, not back in the runtime mode dispatcher
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: separating compatibility ownership from runtime mode dispatch
// - Verification: inferred from plan and verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-runtime-mode-switch.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: moving compat alias policy out of the dispatcher and into its own owner
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-compat-runner-owner.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: dedicated compat runner owner for future fallback work
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-runtime-mode-switch.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-compat-runner-owner.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { LogCode } from '../../config/logRegistry.js';
import { logger } from '../../utils/logger.js';
import { runChatV2Turn, type ChatV2TurnRunnerResult } from './chatV2TurnRunner.js';

export type ChatCompatTurnParams = Parameters<typeof runChatV2Turn>[0];

export async function runChatCompatTurn(
    params: ChatCompatTurnParams,
    deps?: {
        runChatV2Turn?: (params: ChatCompatTurnParams) => Promise<ChatV2TurnRunnerResult>;
    },
): Promise<ChatV2TurnRunnerResult> {
    logger.warn(LogCode.AI_ORCHESTRATOR, 'Chat compat runner currently aliases to v2 turn runner', {
        taskId: params.task?.id,
        sessionId: params.task?.sessionId,
        runtimeMode: 'compat_fallback',
    });
    const runner = deps?.runChatV2Turn || runChatV2Turn;
    return runner(params);
}
