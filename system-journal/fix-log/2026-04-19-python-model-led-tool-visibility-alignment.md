# 2026-04-19 Python Model-Led Tool Visibility Alignment

## What Changed

- Added a shared Python helper for default model-led enablement and model-facing
  tool guidance.
- Updated Python skill resolution so model-led mode exposes the full registered
  tool catalog instead of the keyword-pruned subset.
- Updated Python prompt assembly so model-led mode emits a `[MODEL_LED_TOOL_ORCHESTRATION]`
  block in the system prompt.

## Why

The Node chat path already moved to model-led tool visibility. The Python
orchestration path still used scoped heuristic pruning, which meant the same
user request could be treated differently depending on which backend path
handled generation. That mismatch defeats the rollout goal: the model should
decide whether to call a tool, while backend policy still owns safety and
execution gating.

## Verification

- Verified in code that `resolve_skills()` now exposes the full registry tool
  list by default.
- Verified in code that `assemble_messages()` now injects the shared
  model-led tool guidance block into the system prompt.
- Verified in code that the new helper keeps default model-led enablement and
  the prompt block in one place for the Python owner layer.

## Document Provenance

- Source: operator architecture review in the local runtime thread
- Kind: product instruction
- Retrieved: 2026-04-19
- Applied To: Python model-led tool visibility alignment
- Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-19-model-led-tool-orchestration.md
- /Users/almurat/KiKo/kiko-python/orchestration/model_led_tool_orchestration.py
- /Users/almurat/KiKo/kiko-python/orchestration/skill_resolver.py
- /Users/almurat/KiKo/kiko-python/orchestration/prompt_assembler.py
