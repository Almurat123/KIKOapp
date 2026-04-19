# Generated Image Loading

Updated: 2026-04-18

## Purpose

Generated-image loading is a transcript-local reveal problem, not a decorative
loading stack. The frame should stay quiet and let blur carry the progress
signal, with one soft fluid gradient wash tuned per theme to keep it from
feeling dead. Light mode must still read as visible pastel pink/lavender/blue
rather than collapsing into an almost-white plate. A centered model name may
appear beneath the loading icon, but percentage and stage labels must stay out
of the frame. The icon and label may breathe slowly as a single soft loading
cue. When the image is ready, the same frame can open the shared NativeLightbox
viewer used by chat-uploaded images and the social page.

## Canonical Rules

1. Generated-image loading must stay inside the normal transcript frame.
2. The loading state must be blur-only.
3. No fog, mesh, particle, mask, or veil layers are allowed in the
   generated-image loading treatment.
4. The frame should avoid generic progress text while loading; the only allowed
   label is the model name under the loading icon before preview pixels appear.
5. Progress may only change blur strength or reveal timing.
6. Final image reveal must reuse the same frame without layout shift.
7. Theme surfaces should stay plain and neutral, not material or decorative.
8. One soft fluid gradient wash is allowed in each theme, but it must stay
   low-contrast and slow.
9. Dark mode should collapse to a single fluid wash over a flat dark base; do
   not stack multiple radial washes there.
10. Light mode should use the same wash family with a pale base and lower
    saturation, but it must still show a readable pastel pink/lavender/blue
    pairing.
11. The loading icon and model label may breathe slowly, but the motion must
    stay soft and low contrast.
12. Ready generated images may open the shared NativeLightbox viewer used by
    chat-uploaded images and the social page.
13. Once a blurred preview image is visible, the centered loading icon and
    model label must disappear; the preview image alone carries the progress.
14. Preview blur must stay visibly strong until final completion; do not let
    the image become almost sharp while the card is still in a non-complete
    status.

## Forbidden Local Patch Patterns

- Do not reintroduce particle, fog, mesh, mask, or decorative stack treatments.
- Do not add status labels inside the frame.
- Do not turn the loading state into a material demo, even if it looks richer.
- Do not add more than one soft fluid gradient wash layer.
- Do not let the motion become high-contrast or fast.
- Do not use drift bands in dark mode.
- Do not stack multiple radial washes in dark mode.
- Do not let generated-image loading inherit the full transcript column width.

## Document Provenance

- Source: operator request on 2026-04-18 to simplify generated-image UI
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: the blur-only loading contract and the removal of decorative
    loading layers
  - Verification: verified in code
- Source: OpenAI Image generation guide (streaming)
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: allowing OpenAI partial-image progress to influence blur timing
  - Verification: verified in docs
- Source: OpenAI `/v1/images/generations` OpenAPI spec
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: treating partial-image milestones as reveal timing only
  - Verification: verified in docs
- Source: xAI Streaming guide
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: keeping Grok on a no-stream image reveal path
  - Verification: verified in docs
- Source: operator UI correction on 2026-04-19 that blurred preview should not
  keep the centered loading icon and should remain visibly blurred until final
  completion
  - Kind: product doc
  - Retrieved: 2026-04-19
  - Applied To: hiding the badge once preview pixels exist and strengthening
    preview blur
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/chat-image-viewing.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-local-ui-test-mode.md
