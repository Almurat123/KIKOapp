# ADR: Chat V2 Rewrite Plan

Date: 2026-04-17  
Author: Renata
Updated: 2026-04-17

## Decision

Freeze the current chat orchestration as a compatibility layer and build a
separate `chat v2` pipeline instead of continuing to widen the existing prompt
assembler.

The new architecture keeps Node and Python as distinct service-side owners:

- Node owns turn routing, lean prompt assembly, context-contract enforcement,
  and execution gating.
- Python owns the service-side chat v2 runtime, provider-specific prompt
  modules, execution helpers, and reusable LLM/tool backends.

The v2 design is:

- lean default chat
- explicit context catalog
- required-context contract per task
- skill-scoped tool exposure
- quote-confirm-execute for mutations

## Plan

1. Freeze the current v1 behavior as a fallback path.
   - Keep the old chain available for rollback.
   - Stop adding new business context blocks to the legacy prompt shape.

2. Define the chat v2 contract.
   - Inputs: user query, attachments, surface context, required context, tool
     catalog, execution state, and quote state.
   - Outputs: assistant answer, reasoning surface, citations, tool calls, and
     execution state updates.

3. Rebuild the Node chat orchestration layer around lean prompts.
   - Default turns should not pre-inject wallet, token, launchpad, workflow, or
     skill text.
   - The model should see what it can read, not every cached value.
   - Skill selection should expose only the matched skill boundary.

4. Keep Python as the service-side execution and prompt module owner.
   - Reuse the existing `kiko-python/chat_v2/` service instead of flattening it
     back into Node.
   - Let Python own provider-specific prompt assembly and reusable runtime
     helpers.

5. Preserve the existing quote-confirm-execute flow for trading.
   - User requests a trade.
   - System prepares a quote.
   - User confirms that exact quote.
   - Backend executes directly if the quote binding is still valid.
   - The internal binding hash stays internal; it is not a user-visible
     approval token.

6. Add migration safety.
   - Shadow the new path before making it default.
   - Keep targeted tests for lean chat, specialist skills, images, and quote
     confirmation.
   - Use a feature flag or routing switch for rollout and rollback.

## Non-Goals

- Do not continue expanding the old prompt assembler with more hidden state.
- Do not merge Python and Node responsibilities into one shared prompt blob.
- Do not introduce a user-visible approval-token concept for normal trade
  confirmation.

## Consequences

- v1 remains available as a compatibility fallback.
- New work should land in the v2 boundary instead of adding more branches to the
  old direct-answer path.
- Tool exposure will become more predictable because specialist domains will
  keep their own tool sets instead of inheriting generic market fallbacks.

## Document Provenance

- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodePromptAssembler.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: current Node-side prompt boundary and lean-chat target
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodeSkillResolver.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: skill-scoped tool exposure and local leaderboard gating
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-python/chat_v2/prompt_orchestrator.py`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: Python-side v2 prompt module boundary
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/pythonOrchestratorClient.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: Node-to-Python orchestration split
  - Verification: verified in code
- Source: operator request to freeze the current chain and build a new chat
  architecture instead of patching the old one
  - Kind: runtime observation
  - Retrieved: 2026-04-17
  - Applied To: v1 freeze and chat v2 migration plan
  - Verification: verified in conversation

## See Also

- system-journal/INDEX.md
- system-journal/design-language/chat-direct-response-policy.md
- system-journal/design-language/runtime-plan-visibility.md
- system-journal/fix-log/2026-04-17-lean-chat-context-exposure.md
- system-journal/owner-map/chat-runtime-planning.md
