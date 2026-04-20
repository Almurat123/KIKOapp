# 2026-04-20 Specialist Business Fast Path Template

## What Changed

- Updated the core worker prompt in
  `kiko-api/src/services/ai/prompts/v2/CORE.ts` so specialist execution turns
  now explicitly say to keep a fixed template active, gather required context
  once, and avoid re-opening discovery after each tool result.
- Updated `kiko-api/src/skills_exec/SwapSkill/prompt.md` so the swap skill now
  presents a fixed fast-path template: read wallet/context once, bind the
  swap slots once, quote once, then continue toward confirmation or execution.
- Updated `kiko-api/src/jobs/chat/nodeSkillResolver.ts` so swap strategy notes
  now describe the swap path as a fixed business template instead of a
  re-planning loop.
- Updated the targeted swap prompt tests so the model-visible prompt contract
  is asserted instead of being implied only by code comments.

## Why

Natural-language swap turns were still giving the model too much freedom to
re-decide the business flow after each tool result. The desired behavior is a
deterministic specialist template: bind the context once, get the quote once,
then move to the next step without wasting tokens on alternate branches.

## Verification

- Verified with:
  - `cd /Users/almurat/KiKo/kiko-api && npx tsx --test --test-force-exit src/jobs/chat/nodeSkillResolver.test.ts src/jobs/chat/nodePromptAssembler.test.ts`
- All targeted tests passed.

## Document Provenance

- Source: local runtime product-owner instruction to make business logic use a
  fast-path template
  - Kind: product instruction / runtime observation
  - Retrieved: 2026-04-20
  - Applied To: swap prompt wording, core worker protocol wording, and swap
    strategy notes
  - Verification: inferred from prompt design
- Source: `/Users/almurat/KiKo/system-journal/design-language/specialist-business-fast-path-template.md`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: fixed-template design language for specialist execution turns
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/specialist-business-fast-path-template.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-19-model-led-tool-orchestration.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
- /Users/almurat/KiKo/kiko-api/src/services/ai/prompts/v2/CORE.ts
- /Users/almurat/KiKo/kiko-api/src/jobs/chat/nodeSkillResolver.ts
- /Users/almurat/KiKo/kiko-api/src/skills_exec/SwapSkill/prompt.md
