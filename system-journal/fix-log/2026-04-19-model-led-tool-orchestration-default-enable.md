# 2026-04-19 Model-Led Tool Orchestration Default Enable

## What Changed

- Changed Node model-led tool orchestration from an environment-gated rollout to
  the default chat path.
- Changed Python orchestration to use the same default model-led enablement.
- Updated tests so model-led visibility is asserted without setting an
  environment variable.

## Why

The product decision is that current main models should own semantic tool
choice directly. Backend keyword routing and intent gates should not be required
to decide whether a tool is visible. Backend policy still owns safety,
confirmation, quota, billing, and mutation blocking.

## Verification

- Verified in code that the Node helper now returns enabled by default.
- Verified in code that the Python helper now returns enabled by default.
- Updated targeted Node and Python tests that previously set the rollout
  environment variable.

## Document Provenance

- Source: operator instruction in the local runtime thread
- Kind: product instruction
- Retrieved: 2026-04-19
- Applied To: default enablement for model-led tool orchestration
- Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-19-model-led-tool-orchestration.md
- /Users/almurat/KiKo/kiko-api/src/jobs/chat/modelLedToolOrchestration.ts
- /Users/almurat/KiKo/kiko-python/orchestration/model_led_tool_orchestration.py
