# 2026-04-18 Generated Image Local UI Test Mode

## What Changed

- Added a dev-only local chat command path for generated-image cards inside
  `ChatInterface`.
- Local commands can now inject transcript-native generated-image assistant
  rows without calling provider APIs or moderation endpoints.
- The injected payload supports the main image-card UI states:
  `queued`, `generating`, `moderating`, `saving`, `refining`, `finalizing`,
  `failed`, `complete`, and a `multi` completed grid.
- Local commands also support aspect presets so the same card can be exercised
  as `square`, `portrait`, or `landscape` without waiting for real provider
  output.
- The local payload now mirrors the production progress contract instead of the
  old fake stage labels: OpenAI simulates partial-image milestones, while Grok
  stays on KiKo-owned queue/generate/check/save phases.
- The generated-image canvas is text-free in both production and test mode;
  local stages only drive motion, blur, and reveal timing.
- When the local image test runs from the welcome shell without auth, it now
  promotes the chat surface immediately so the injected transcript row is
  actually visible instead of being hidden behind the welcome screen.
- Added a chat-box full-flow replay command for generated-image UI debugging:
  `/test-generated-image flow` and `/test-generated-image-flow`.
- The flow replay binds the stable already-generated public test asset at
  `/news-covers/zora-canvas-1772115882998.png`, then advances the real
  transcript card through queued, generating, blurred preview, saving, and
  complete states.
- The flow replay supports `stale` / `downgrade` / `flash` to intentionally
  send a late empty generating payload after completion, reproducing the
  suspected flash-back-to-loading parent-state overwrite path.
- Generated-image frontend diagnostics now log the update-message-data merge
  boundary, card render shape, image load, and viewer open attempt.
- The generated-image card accepts `publicUrl` and `url` in addition to
  `previewUrl` so production social/public image rows do not disappear just
  because the durable URL field differs from the private preview field.

## Why

Generated-image loading UI is hard to iterate when it depends on live provider
latency, moderation timing, billing gates, and websocket sequencing. The
frontend owner needs a deterministic local path that reproduces card states
inside the real transcript container so loading, motion, spacing, and final
reveal can be checked quickly.

## Product Rule

- This path is local-only and must never become a production-visible control.
- The test mode must inject the same `generated-image` message shape used by
  the transcript, not a separate preview shell.
- Local test images may use synthetic data URLs because the goal is UI state
  verification, not provider output validation.
- Local test mode should be able to verify ratio changes and blurred pre-
  complete reveal states, not only square placeholders.
- Local test mode must not simulate provider progress that the real provider
  does not emit.
- Local test mode must not reintroduce visible loading labels.
- Full-flow replay must run in the actual chat transcript, not a detached
  `/test` route, because the failure class depends on parent message state
  updates and card hydration.
- The `stale` flow option is intentionally a negative test: it should make a
  bad parent-state downgrade visible and logged, not represent expected
  production behavior.

## Verification

- Verified in code that `handleSend` intercepts local generated-image test
  commands before auth and backend send logic.
- Verified in code that injected assistant messages use `type:
  'generated-image'` with structured `data.generatedImage`.
- Verified in code that OpenAI test states now expose `partialImageIndex` /
  `partialImageCount`, while Grok test states do not fake streamed progress.
- Verified in code that the unauthenticated welcome-shell local test path sets
  `chatStarted` before returning so the injected message list is visible.
- Verified in code that `/test-generated-image flow` injects one
  `generated-image` assistant row and then mutates the same row through timed
  payload updates.
- Verified in code that `/test-generated-image flow stale` appends a late
  empty generating payload after completion to reproduce the suspected
  downgrade.
- Verified in code that generated-image UI diagnostics log state shape,
  image-load, and open-viewer boundaries without logging raw image bytes.
- Verified `npm exec tsc --noEmit --pretty false` in `kiko-web`.

## Document Provenance

- Source: operator request on 2026-04-18 for a test mode to inspect generated-image card states
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: adding a local generated-image card injector in the chat owner
  - Verification: verified in code
- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: matching the existing transcript-native generated-image message contract
  - Verification: verified in code
- Source: OpenAI `/v1/images/generations` OpenAPI spec and image generation guide
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: simulating OpenAI partial-image milestone progress in local test mode
  - Verification: verified in docs and code
- Source: xAI Streaming guide
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: avoiding fake streamed-progress test states for Grok image cards
  - Verification: verified in docs and code
- Source: operator runtime request on 2026-04-19 to test the generated-image
  full chain from the chat input using an existing generated image
  - Kind: runtime observation
  - Retrieved: 2026-04-19
  - Applied To: adding `/test-generated-image flow`, stale-downgrade replay,
    and generated-image frontend diagnostics
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
- /Users/almurat/KiKo/system-journal/conflicts.md
