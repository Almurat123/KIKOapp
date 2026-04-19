# 2026-04-18 Generated Image Chat Execution And UI

## What Changed

- Added a dedicated generated-image chat turn that creates a normal user
  message plus an assistant `generated-image` transcript row instead of routing
  image generation through the text worker path.
- Kept generated-image assistant state in structured message data so the row
  can move through queued, generating, moderation, saving, failed, and complete
  phases without pretending it is markdown text.
- Refined the generated-image loading UI so pending states render inside one
  stable image frame with a plain blurred preview, not a static white placeholder.
- Normalized internal execution phases into product-facing loading copy so
  transcript UI no longer exposes backend stage labels like `Safety check` or
  `Saving` verbatim.
- Collapsed visible provider/quality chrome out of the rendered card so the
  transcript row reads like one image frame instead of a provider status card.
- Added ratio-aware frame sizing from known image `width`/`height` and kept
  the reveal logic limited to blur-only transitions.
- Removed the earlier particle, mist, mesh, and veil treatments so the
  loading frame now stays plain and text-free.
- Kept the loading frame theme-aware with simple neutral surfaces and one
  subtle ambient drift layer instead of special compositing or texture layers.
- Simplified dark mode further to a single fluid gradient wash over a flat
  dark base so the frame stops reading like stacked wave ripples.
- Matched light mode to the same fluid-wash family with a pale base and lower
  saturation, but kept the pastel pink/lavender/blue pairing visible so the
  card does not flatten into a white plate.
- Added a centered loading icon with the model name beneath it so the frame can
  keep a Doubao-like loading cue without exposing percentages or backend stage
  labels.
- Added a slow breathing loop to the loading icon and model label so the badge
  feels alive without introducing a busy loading stack.
- Kept generated-image renders inline, but wired the final image to the shared
  NativeLightbox viewer so it matches the chat-uploaded image preview path.
- Removed label text from the synthetic local preview image asset so test mode
  does not reintroduce visible letters inside the loading/reveal states.
- Switched the generated-image frame to a viewport-clamped responsive width so
  desktop does not sprawl and mobile keeps safe side margins.
- Tightened the desktop clamp again after visual review so the square test case
  reads as a compact card instead of a dominant block.
- Replaced the generic `Creating image` copy with provider-true progress
  semantics: OpenAI now advances through real partial-image milestones, while
  Grok stays on KiKo-owned queue/generate/check/save phases.
- Wired the OpenAI Images API owner to `stream: true` and `partial_images: 2`
  so the transcript can receive real `image_generation.partial_image` progress
  events instead of fake refinement labels.
- Kept strict image safety by refusing to show unmoderated partial-image bytes;
  OpenAI partial events now drive progress copy only, while the blurred preview
  only appears after the final image has passed output moderation.
- Updated the local generated-image dev test mode so OpenAI simulates partial
  milestones and Grok no longer pretends to stream image progress.
- Changed the loading reveal from a flat blank state to a progressive blur
  semantic so blur strength and reveal timing now advance with generation
  state instead of staying constant.
- Removed all visible loading labels from the generated-image frame so the
  generation state is now carried only by blur and reveal timing.
- Split the loading frame by theme so light mode uses a pale neutral surface
  while dark mode keeps a quiet dark surface; neither mode uses decorative
  material layers.

## Why

Generated-image turns do not behave like text completions. They need strict
prompt/output moderation, separate billing, and a transcript presentation that
can carry image-specific metadata. The original loading state was technically
correct but product-wrong: it surfaced internal moderation language and used a
blank static box that made the row feel stalled. The frontend owner needs one
active loading surface that feels alive even before the first image bytes
arrive, while still respecting provider differences.

## Product Rule

- Generated-image replies live inside the normal transcript.
- Internal pipeline phases are not user-facing copy.
- Pending image states must feel active before any image is available.
- OpenAI loading may surface real partial-image milestone progress, because the
  official Images API supports streamed partial images.
- OpenAI partial-image bytes must not render in the transcript before output
  moderation passes.
- Grok loading must not pretend to stream partial images that the provider path
  does not actually emit.
- Once image dimensions are known, the frame should follow those dimensions
  instead of forcing a square wrapper.
- Pre-complete reveal should show a blurred incoming image without any extra
  poster chrome, but only after moderation has passed.
- The loading state must stay blur-first; no fog, particle, mesh, or mask layers.
- The loading state may add only one subtle ambient drift layer.
- The loading state must only reduce blur progressively as generation advances.
- The frame must stay text-free and let blur carry the progress semantics.
- The frame surfaces should adapt to the resolved theme instead of using one
  hardcoded neutral for every surface.
- The loading surface should stay plain and unobtrusive, not decorative.
- The generated-image frame width must clamp by viewport instead of inheriting
  the entire transcript column.
- The desktop clamp should stay compact enough that square test states do not
  dominate the chat view.

## Verification

- Verified in code that generated-image assistant rows use structured
  `data.generatedImage` state instead of text chunks.
- Verified in code that pending UI no longer renders raw `Safety check`
  or `Saving` labels.
- Verified in code that the loading frame now renders a blur-to-clear reveal
  with only one subtle ambient drift layer.
- Verified in code that the synthetic local preview image asset contains no
  label text.
- Verified in code that the generated-image frame width uses viewport clamping
  instead of inheriting the entire transcript column.
- Verified in code that the desktop clamp was tightened after screenshot review.
- Verified in code that OpenAI image generation now requests SSE partial-image
  events from `/v1/images/generations`.
- Verified in code that OpenAI partial-image events update transcript progress
  semantics without exposing unmoderated preview bytes.
- Verified in code that Grok remains a no-stream image path and only surfaces
  KiKo-owned queue/generate/check/save phases.
- Verified in code that the blurred preview only appears in the saving phase
  after output moderation passes.
- Verified in code that local generated-image test commands now mirror the
  provider-aware progress contract.
- Verified in code that preview blur is driven by a shared progress value
  derived from generation state.
- Verified in code that the frame renders no visible loading text.
- Verified in runtime screenshots that the generated-image frame now renders
  in the live transcript for both `generating` and `refining` local test
  states, with no label text inside the synthetic preview asset.
- Verified in runtime that the loading frame exposes animated ambient drift and
  sweep layers in computed styles.
- Verified in runtime screenshots that dark mode now keeps a single fluid
  wash instead of stacked ripple bands.
- Verified in code that light mode uses the same fluid-wash family with lower
  saturation, a pale base, and visible pastel color pairings.
- Verified in code that the loading frame can show the model name beneath a
  centered loading icon while omitting percentage and stage labels.
- Verified in code that the loading icon and model label use a slow breathing
  animation and respect reduced-motion settings.
- Verified in code that generated-image frames open the shared NativeLightbox
  viewer instead of a custom chat-only preview modal.
- Verified `npm exec tsc --noEmit --pretty false` in `kiko-web`.

## Document Provenance

- Source: operator request on 2026-04-18 to keep generated-image UI plain
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: removing the fog/mesh loading systems and using blur only
  - Verification: verified in code
- Source: OpenAI Image generation guide, Streaming section
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: grounding the OpenAI loading state in partial-image streaming
    support and an interactive generation experience
  - Verification: verified in docs
- Source: OpenAI `/v1/images/generations` OpenAPI spec
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: using `text/event-stream` plus
    `image_generation.partial_image` / `image_generation.completed`
    as the real OpenAI image progress contract
  - Verification: verified in docs
- Source: xAI Streaming guide
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: keeping Grok image generation on a no-stream progress contract
  - Verification: verified in docs
- Source: MDN clamp() reference
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: viewport-clamped responsive width for the generated-image frame
  - Verification: verified in code
- Source: operator screenshot on 2026-04-18 showing a static loading frame
  - Kind: runtime observation
  - Retrieved: 2026-04-18
  - Applied To: replacing the stalled loading state with a blur-to-clear reveal
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
- /Users/almurat/KiKo/system-journal/owner-map/generated-image-safety.md
- /Users/almurat/KiKo/system-journal/owner-map/generated-image-billing.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-generated-image-safety-gate.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-billing-and-gating.md
- /Users/almurat/KiKo/system-journal/conflicts.md
