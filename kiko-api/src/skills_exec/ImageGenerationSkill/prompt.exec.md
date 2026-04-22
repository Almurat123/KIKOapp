# CONTEXT MEMORY
Updated: 2026-04-22
Author: Rowan
Reason: KiKo chat now exposes image generation as a model-owned skill instead
of a user-picked image-only model path. The main model must decide when the
user is actually asking for a visual deliverable, optimize the prompt in a
structured way, and call the internal image tool without an extra confirmation.
Farcaster social-agent turns may include attached images as model-visible
context; reference-image and edit-style requests are product image-generation
requests. When provider-level source-image inputs are available, use them for
the generated-image tool; if unavailable, summarize the reference image into
generation direction instead of falling back to prompt-only text.
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
- reference/edit/restyle requests are image-generation requests when the user
  wants an output image
- on Farcaster, use attached post images as visual context for generation; if
  exact pixel-level editing is unavailable, generate a new image that follows
  the requested edit/reference direction
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
- Source: operator correction on 2026-04-22 that reference/edit scenarios are
  still image-generation scenarios
  - Kind: product instruction
  - Retrieved: 2026-04-22
  - Applied To: model-facing instruction to call generated-image tooling for
    reference/edit/restyle requests instead of returning prompt-only text
  - Verification: inferred from prompt and routing tests
- Source: OpenAI Image generation guide and openai-imagegen-demo
  - Kind: official API doc and official demo
  - Retrieved: 2026-04-22
  - Applied To: model-facing treatment of reference/edit requests as image
    generation/edit execution requests
  - Verification: verified in code path and targeted tests
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
- reference-image generation
- edit-style generation
- restyle, replace, put/place, redraw, or remix requests that should produce an image

Do not use this skill when the user is:

- asking whether an image would be a good idea
- asking how to write an image prompt
- discussing a design direction without asking you to actually generate it
- asking only for prompt-writing advice about editing an image, without asking
  you to generate the image now

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
- If the request uses reference/edit wording, treat that as an execution request
  when the user wants an output image. Convert the requested edits and visible
  reference traits into `subject`, `scene`, `composition`, `style`,
  `constraints`, and `negative_constraints`, then call
  `generate_image_from_intent`.
- If the request comes from Farcaster with attached images, use those images as
  visual context for the generated output. Do not answer with only a rewritten
  prompt unless the user explicitly asked for prompt advice.
- Set `edit_or_generate` to `edit` when attached/source/reference images should
  guide the output. Set it to `generate` when creating without source images.

## Output discipline

- Keep normal chat natural.
- Do not narrate the hidden prompt-rewrite process.
- Do not mention provider names, internal prompt templates, or raw tool JSON in user-facing text.
