# Specialist Business Fast Path Template

Updated: 2026-04-20

## Purpose

Define the model-visible rule for specialist execution turns such as swap,
copytrade, and other deterministic business flows.

## Canonical Rules

1. Once the model has matched a specialist execution mode, it should treat the
   task as a fixed template rather than a fresh reasoning problem after each
   tool result.
2. The template should read required context once, bind the missing slots once,
   then advance toward quote, preflight, confirmation, or execution without
   reopening discovery unless a hard blocker appears.
3. Tool results should move the worker to the next deterministic step. They
   should not trigger a new "should I do something else?" loop when the
   business path is already known.
4. For swaps, the common path is wallet/context resolution, one quote or
   preflight, then confirmation or execution.
5. Missing hard fields should be clarified once. Soft preference changes should
   not restart the template.

## Forbidden Local Patch Patterns

- Rewriting specialist turns as open-ended analysis prompts.
- Re-running the same discovery branch after each tool result when the template
  already resolved the path.
- Treating quote generation as an invitation to re-plan the whole task.
- Hiding the template only in backend code while leaving the model-visible
  prompt vague.

## Document Provenance

- Source: local runtime product-owner instruction that many business tasks need
  a fast-path template after model selection
  - Kind: product instruction / runtime observation
  - Retrieved: 2026-04-20
  - Applied To: swap and other specialist business prompt templates
  - Verification: inferred from prompt design and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/nodeSkillResolver.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: strategy-note guidance for specialist execution turns
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/services/ai/prompts/v2/CORE.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: worker protocol wording about fixed templates and single-pass
    context gathering
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-19-model-led-tool-orchestration.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-specialist-business-fast-path-template.md
