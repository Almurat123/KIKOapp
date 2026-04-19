# CONTEXT MEMORY
Updated: 2026-04-19
Author: Rowan
Reason: KiKo chat now exposes image generation as a model-owned skill instead
of a user-picked image-only model path. The main model must decide when the
user is actually asking for a visual deliverable, optimize the prompt in a
structured way, and call the internal image tool without an extra confirmation.
Farcaster social-agent turns may include attached images as model-visible
context; until true provider-level edit/reference-image execution lands, those
images should be summarized into generation direction rather than passed as a
fake edit flow.
Goal: keep image-generation turns decisive and controlled: optimize first,
generate immediately when constraints are sufficient, and stay in text mode
when the user is only discussing ideas or prompt-writing.
Owns: model-facing prompt rules for deciding when to call
`generate_image_from_intent`.
Does Not Own: provider prompt compilation, billing, safety, or task execution.
Design Language:
- use this skill only for real image requests, not for abstract prompt coaching
- optimize the image direction into structured fields before the tool call
- if one critical visual field is missing, ask exactly one precise clarification
- once the request is clear enough, do not ask for a second confirmation before generating
- do not expose provider-specific parameters to the user
- on Farcaster, use attached post images as visual context for new-image
  generation, but do not claim true image editing/reference-image execution
  until that provider path is wired
Document Provenance:
- Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: direct tool invocation and structured prompt optimization rules
  - Verification: verified in code
- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: chat-v2 image-skill routing and same-turn generated-image execution
  - Verification: verified in code
- Source: operator requirement on 2026-04-19 for Farcaster photo-context image generation
  - Kind: product doc
  - Retrieved: 2026-04-19
  - Applied To: model-facing handling of Farcaster attached images as prompt context
  - Verification: verified in code path for social image visibility; provider edit flow not implemented
See also:
- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md

# Image Generation

Use this skill when the user explicitly wants a new image or visual asset:

- poster
- cover image
- illustration
- concept frame
- ad creative
- visual mockup
- thumbnail
- promo image

Do not use this skill when the user is:

- asking whether an image would be a good idea
- asking how to write an image prompt
- discussing a design direction without asking you to actually generate it
- asking to edit an existing image reference, because true edit flow is not wired yet

## Working rule

- First rewrite the user request into structured image direction.
- Prefer filling these fields when they are knowable:
  - `subject`
  - `scene`
  - `composition`
  - `style`
  - `lighting`
  - `camera`
  - `constraints`
  - `negative_constraints`
- Then call `generate_image_from_intent`.
- If exactly one critical visual field is missing, ask one precise clarification.
- If the request is already clear enough, generate immediately. Do not ask “Do you want me to generate it now?”
- If the request comes from Farcaster with attached images and asks for a new
  image based on them, convert the visible traits, subject, style, composition,
  and constraints from those images into the structured fields. Do not set
  `edit_or_generate` to `edit` unless the tool/runtime explicitly supports it.

## Output discipline

- Keep normal chat natural.
- Do not narrate the hidden prompt-rewrite process.
- Do not mention provider names, internal prompt templates, or raw tool JSON in user-facing text.
