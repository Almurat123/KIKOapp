# Image Prompt Guidance

Updated: 2026-04-19

## Purpose

Image prompt quality is a first-class model skill, not an ad hoc adjective dump.
KiKo should decompose image requests into stable visual fields, prefer
OpenAI-style structured prompting when uncertain, and keep prompt-coaching
turns separate from actual image execution turns.

## Canonical Rules

1. Prompt coaching and image execution are separate behaviors.
2. If the user asks how to write or improve a prompt, return prompt guidance
   and do not auto-generate an image.
3. If the user explicitly wants an image now, use the prompt-guidance skill to
   structure the request, then let the image-generation skill decide whether to
   call `generate_image_from_intent`.
4. Default prompt structure should cover subject, scene/background,
   composition, style, lighting, camera/framing, constraints, negative
   constraints, and output use case / aspect ratio.
5. Edits and composites must distinguish what changes from what stays frozen.
6. For natural photorealism, describe the scene like a real capture: lens,
   framing, lighting, texture, and grounded imperfections.
7. For logos, products, UI, infographics, and other precision graphics,
   preserve geometry, text hierarchy, legibility, and layout constraints
   explicitly.
8. Text inside images should stay short, verbatim, and placement-aware.
9. Iteration should be small-step and stateful: change one major variable at a
   time instead of rewriting the whole prompt blindly.
10. Aspect ratio and prompt wording should reflect delivery surface
    (thumbnail, story, banner, portrait, presentation, product mockup).

## Forbidden Local Patch Patterns

- Do not treat “more adjectives” as a substitute for composition and
  constraints.
- Do not auto-call the image tool on turns that are only asking for prompt
  advice.
- Do not describe edit requests without naming preserved elements.
- Do not ask for long decorative text blocks inside images unless the user
  truly needs them.
- Do not let provider-specific parameter names leak into user-facing coaching
  copy unless the user explicitly asks for API-level details.

## Document Provenance

- Source: OpenAI GPT-image-1.5 Prompting Guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: iterative prompting, preserve-vs-change edit phrasing,
    photorealism, compositing, mockup, and text/layout prompt rules
  - Verification: verified in docs
- Source: OpenAI Image generation guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: high-input-fidelity preservation guidance and image-tool
    capability boundaries
  - Verification: verified in docs
- Source: Google Imagen prompt guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: subject/context/style triad, text-length limits, portrait cue,
    parameterized prompt templates, and photography modifiers
  - Verification: verified in docs
- Source: xAI Image Generation guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: multi-turn editing, style-transfer phrasing, and aspect-ratio
    guidance
  - Verification: verified in docs
- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: separating prompt guidance from actual image-tool execution
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/image-prompt-skills.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-provenance.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
