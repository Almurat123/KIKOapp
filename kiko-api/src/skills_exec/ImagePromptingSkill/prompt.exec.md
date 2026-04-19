# CONTEXT MEMORY
Updated: 2026-04-19
Author: Rowan
Reason: KiKo already had an execution-facing image-generation skill, but it
still lacked a durable prompt-writing playbook for the main model. Product now
requires a separate skill that can either coach the user on prompt writing or
quietly strengthen the model's own image prompt decomposition before an image
tool call. This skill is intentionally weighted toward OpenAI guidance, with
Google Imagen and xAI rules added where they sharpen structure, text handling,
iteration, or aspect-ratio choices. OpenAI-aligned live evaluation then showed
the playbook also needs a stricter output contract so replies stay copy-ready,
OpenAI-first, and do not drift into non-OpenAI model variants by default.
Goal: help the model turn vague visual requests into high-quality prompts
without confusing prompt coaching with actual image execution.
Owns: model-facing prompt-writing guidance for image requests, prompt advice,
and pre-tool prompt decomposition.
Does Not Own: provider HTTP parameters, billing, moderation, image storage, or
the final decision to execute image generation.
Design Language:
- separate prompt coaching from actual image execution
- decompose requests into stable visual fields before adding style detail
- prefer OpenAI-style preserve/change phrasing for edits and composites
- use Google's subject/context/style triad as the minimum viable prompt frame
- use xAI's multi-turn editing idea for iterative refinement: one major change per turn
- keep in-image text short, verbatim, and placement-aware
- return copy-ready structured prompts instead of loose adjective suggestions
- keep prompt coaching OpenAI-first and do not volunteer other model variants unless asked
- forbidden local patch pattern: adjective pileups with no composition or constraints
- forbidden local patch pattern: auto-calling the image-generation tool when the user only asked for prompt help
- forbidden local patch pattern: unsolicited Midjourney / Stable Diffusion rewrite variants
Document Provenance:
- Source: OpenAI GPT-image-1.5 Prompting Guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: primary prompt structure, edit preservation rules,
    photorealism, compositing, logo/mockup, and text-heavy asset guidance
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
  - Applied To: subject/context/style baseline, portrait cueing, text limits,
    parameterized prompt templates, and photography modifiers
  - Verification: verified in docs
- Source: xAI Image Generation guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: multi-turn editing, style transfer phrasing, and aspect-ratio
    choices
  - Verification: verified in docs
- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: keeping prompt coaching distinct from the execution-side image-generation tool
  - Verification: verified in code
- Source: local OpenAI-aligned live eval of image prompt coaching turns
  - Kind: runtime observation
  - Retrieved: 2026-04-19
  - Applied To: stricter output contract, OpenAI-first wording, and no unsolicited cross-model prompt variants
  - Verification: verified in runtime
See also:
- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/image-prompt-guidance.md
- /Users/almurat/KiKo/system-journal/owner-map/image-prompt-skills.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-openai-alignment-eval.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-provenance.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md

# Image Prompting

Use this skill in two cases:

- the user wants help writing or improving an image prompt
- the user explicitly wants an image, and you need stronger prompt structure
  before deciding whether to call the image-generation tool

Do not use this skill to answer unrelated design discussion, and do not treat
it as permission to auto-generate an image on prompt-advice-only turns.

## Decision rule

- If the user is asking for prompt help, return a better prompt and a short
  rationale. Do not call the image-generation tool.
- If the user explicitly wants the image now, use this playbook to structure
  the request, then let the image-generation skill decide whether the request
  is clear enough to call the image-generation tool.
- If a real image request is missing one critical visual decision, ask one
  precise clarification only.

## Minimum prompt scaffold

Build prompts in this order:

1. goal / deliverable
2. subject
3. scene / background
4. composition / framing
5. style / medium
6. lighting / time / atmosphere
7. camera / lens / distance when realism matters
8. materials / texture / surface realism when relevant
9. exact text inside image, if any
10. hard constraints
11. negative constraints
12. output use case / aspect ratio

If the user is vague, fill the minimum scaffold first instead of adding more
stylistic adjectives.

## OpenAI-first rules

- For edits, say exactly what changes and what must stay unchanged.
- For compositing, specify:
  - what to transplant
  - where it goes
  - what must remain unchanged
  - how lighting, perspective, scale, and shadows should match
- For natural photorealism, write as if a real photo is being taken now:
  grounded lighting, believable texture, real materials, honest detail,
  photography language, and no accidental cinematic over-stylization unless
  the user asked for it.
- For infographics, UI, posters, and other text-heavy visuals, define the
  layout and hierarchy explicitly. Keep text verbatim.
- For prompt-help answers, prefer short labeled segments or line breaks over a
  single adjective-heavy paragraph.
- For product extractions and mockups, preserve geometry, label legibility, and
  edge quality. If realism matters, ask for no halos/fringing and no restyle
  unless requested.
- Iterate in small steps. If refining an existing prompt or image, change one
  major variable per turn instead of rewriting everything.
- When exact text matters, put it in quotes. If the word is uncommon or
  brand-sensitive, recommend spelling it letter by letter.
- For multi-image composites or edits, label the inputs explicitly as `Image 1`,
  `Image 2`, and describe what each image contributes.
- For photorealism, prefer lens / framing / lighting / texture language over
  generic hype such as `8K` or `ultra-detailed` unless the user explicitly asks.

## Google Imagen rules

- The minimum viable prompt is subject + context/background + style.
- Descriptive clarity beats vague hype words.
- Short prompts are acceptable for exploration; long prompts are for precision.
- If facial detail matters, mention `portrait` or make face detail an explicit
  focus.
- Keep in-image text short. Prefer one short phrase; avoid long paragraphs.
- For repeatable workflows, parameterize prompt slots instead of hand-writing a
  new prompt each time.
- Photography modifiers are useful when they matter:
  - close-up / far away
  - aerial / from below / eye level
  - warm tones / muted palette / shallow depth of field

## xAI rules

- Multi-turn editing is a real workflow: use each round to make one major
  correction or style change.
- Style transfer works best when the target aesthetic is named clearly:
  anime, watercolor, pencil sketch, oil painting, pop art, and so on.
- Pick aspect ratio from the delivery surface instead of leaving it implicit:
  - `1:1` for avatars, thumbnails, square social
  - `16:9` for banners, hero art, widescreen
  - `9:16` for stories, reels, vertical posters
  - `4:3` or `3:4` for presentation / portrait cases

## Response patterns

When the user asks for prompt help only, prefer this response shape:

- `优化后的提示词`
- `负向约束`
- `单变量微调`
- `如果还不够准，我建议你补充什么`

Do not volunteer Midjourney, Stable Diffusion, or other non-OpenAI prompt
variants unless the user explicitly asks for them.

## Output contract for prompt-help turns

- Return one prompt the user can copy directly.
- Keep the prompt structured with labeled segments or line breaks when the
  request is complex.
- If the request is an edit, use `只改 X，其他保持不变` phrasing plus an explicit
  preserve list.
- If the request includes text in the image, quote the exact text and state
  placement / typography constraints.
- Offer only 1-3 single-variable refinements such as lighting, framing, or
  text placement.
- Stay OpenAI-first unless the user explicitly asks for another image model.

When the user wants an image now, silently use this skill to improve the
request, but keep the user-facing reply natural.

## Prompt-writing template

Use this template when you need a clean default:

`Create a [deliverable] featuring [subject] in/on [scene]. Composition: [framing/layout]. Style: [medium/style]. Lighting: [lighting/time]. Camera: [lens/distance/angle if relevant]. Include exactly this text: "[text]" if needed. Constraints: [must-have rules]. Avoid: [negative constraints]. Output should suit [use case/aspect ratio].`
