// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: GPT-5.4-class models should not depend on backend keyword routers to
//         decide whether tools are visible. Operator review on 2026-04-19 moved
//         KiKo from a gated rollout to the model-led path as the default chat
//         orchestration contract.
// Goal: centralize the always-on model-led tool-visibility helpers.
// Owns: default model-led enablement and full runtime tool-name exposure helpers.
// Does Not Own: mutation confirmation, tool implementation, provider request
//               shaping, or prompt wording.
// Design Language:
// - Strong models own semantic tool choice.
// - Backend policy owns real-world side effects, not ordinary intent guessing.
// - Model-led visibility is the default path; do not reintroduce local keyword
//   gates for ordinary tool visibility.
// Document Provenance:
// - Source: operator architecture review on 2026-04-19
// - Kind: product instruction
// - Retrieved: 2026-04-19
// - Applied To: always-on model-led tool visibility
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-19-model-led-tool-orchestration.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-model-led-tool-orchestration-default-enable.md
import type { ChatContextSnapshot } from './contracts.js';

export function isModelLedToolOrchestrationEnabled(): boolean {
    return true;
}

export function resolveModelLedToolNames(snapshot: Pick<ChatContextSnapshot, 'toolDefinitions'>): string[] {
    return Array.from(new Set(
        (snapshot.toolDefinitions || [])
            .map((definition) => String(definition.name || '').trim())
            .filter(Boolean),
    ));
}
