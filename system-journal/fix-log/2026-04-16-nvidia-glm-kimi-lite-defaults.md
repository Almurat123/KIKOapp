# 2026-04-16 NVIDIA GLM/Kimi Lite Defaults

## What Changed

- Lowered KiKo's default NVIDIA temperatures for routine GLM/Kimi turns.
- Changed the standard `glm-5` alias to run with:
  - `temperature=0.3`
  - `chat_template_kwargs.enable_thinking=false`
- Preserved an explicit heavier GLM path for reasoning aliases with:
  - `temperature=0.6`
  - `chat_template_kwargs.enable_thinking=true`
  - `chat_template_kwargs.clear_thinking=false`
- Changed Kimi defaults to:
  - `kimi-k2-5-reasoning` -> `temperature=0.6`
  - `kimi-k2-5-instant` -> `temperature=0.4` plus `thinking.type=disabled`
- Updated the direct `/api/ai/chat` fallback route to use the same NVIDIA
  default temperatures and thinking profiles as the Python gateway.

## Why

Runtime review showed KiKo was inheriting provider-default behavior that is
more suitable for showcase or large-task prompting than for short agent turns.
The operator explicitly requested colder, lighter defaults because KiKo's
routine chat, normalize, and social-agent tasks favor speed and stable phrasing
 over open-ended exploration.

## Product Rule

- Routine GLM/Kimi turns should prefer lower temperature than provider-default
  showcase settings.
- The standard `glm-5` alias is the lightweight GLM mode for KiKo, not the
  full preserved-thinking mode.
- If a caller explicitly requests a GLM reasoning alias, KiKo may preserve the
  reasoning trace.
- Kimi instant remains the fastest Kimi mode and must keep thinking disabled.
- Direct-route NVIDIA requests and Python-gateway NVIDIA requests must use the
  same default temperature and thinking policy.

## Verification

- Verified in code that the Python NVIDIA gateway now attaches model-specific
  default temperatures before calling the hosted NVIDIA chat/completions API.
- Verified in code that `glm-5` now resolves to a lightweight no-thinking
  request profile while explicit GLM reasoning aliases keep preserved thinking.
- Verified in code that the direct `/api/ai/chat` fallback route now mirrors
  the same NVIDIA defaults instead of using a single hot `0.8` temperature for
  all models.
- Verified in targeted Python tests that GLM/Kimi request profiles resolve to
  the intended temperature and extra-body combinations.

## Document Provenance

- Source: operator request to make GLM/Kimi faster and less exploratory for
  routine KiKo tasks
  - Kind: product doc
  - Retrieved: 2026-04-16
  - Applied To: choosing colder default temperatures and lightweight GLM mode
  - Verification: verified in code
- Source: NVIDIA NIM model page for `moonshotai/kimi-k2.5`
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: confirming hosted Kimi instant mode uses the `thinking` request
    flag family rather than legacy self-hosted-only parameters
  - Verification: verified in docs and code
- Source: NVIDIA GLM family guidance already referenced by KiKo for preserved
  thinking on hosted NVIDIA/Z.AI deployments
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: keeping explicit GLM reasoning aliases on preserved-thinking
    request flags while allowing the standard alias to run lighter
  - Verification: partially verified in docs, applied in code
- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: motivating lighter defaults after repeated slow small-task
    reasoning traces
  - Verification: verified in runtime

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-glm-preserved-thinking-on-nvidia.md
- /Users/almurat/KiKo/system-journal/conflicts.md
