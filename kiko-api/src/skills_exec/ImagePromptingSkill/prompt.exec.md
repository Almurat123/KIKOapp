# CONTEXT MEMORY
Updated: 2026-04-23
Author: Rowan
Reason: KiKo needs image prompt coaching to follow OpenAI's image prompting
playbook directly. The previous version mixed OpenAI, Google Imagen, and xAI
rules; product now requires OpenAI-only guidance so prompt-help turns behave
like a ChatGPT image expert and generated-image turns decompose requests in the
same style before tool execution.
Generated-image execution should follow OpenAI Responses image-generation tool
semantics: `action:auto` by default, `action:generate` for forced new images,
and `action:edit` only when usable source/reference images exist.
Goal: help the model write copy-ready OpenAI image prompts and separate prompt
coaching from actual image execution.
Owns: model-facing image prompt-writing guidance, prompt advice, edit/reference
prompt decomposition, and pre-tool image prompt structure.
Does Not Own: provider HTTP parameters, billing, moderation, image storage, or
the final decision to execute image generation.
Design Language:
- follow OpenAI image prompting order: scene, subject, key details, constraints
- include the intended deliverable/use case so the image model understands the
  mode and polish level
- for edits, separate what changes from what must remain invariant
- for multi-image inputs, label each image by index and role before describing
  how they interact
- quote exact in-image text and constrain typography, placement, and extra text
- refine by small single-change iterations instead of overloading one prompt
- return one copy-ready OpenAI prompt, not multiple model-specific variants
- forbidden local patch pattern: mixing non-OpenAI prompting dialects into the
  default advice
- forbidden local patch pattern: adjective pileups with no composition,
  preserve/change rules, or constraints
- forbidden local patch pattern: auto-calling the image-generation tool when
  the user only asked for prompt help
Document Provenance:
- Source: OpenAI GPT Image Generation Models Prompting Guide
  - Kind: official OpenAI cookbook
  - Retrieved: 2026-04-22
  - Applied To: prompt order, use-case framing, quality cues, edit
    preserve/change rules, multi-image reference roles, text rendering,
    photorealism, product mockups, style transfer, compositing, and iteration
  - Verification: verified in docs
- Source: OpenAI Image generation guide
  - Kind: official API doc
  - Retrieved: 2026-04-22
  - Applied To: image generation versus edit/reference workflows and
    generated-image tool capability boundaries
  - Verification: verified in docs
- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: keeping prompt coaching distinct from the execution-side image-generation tool
  - Verification: verified in code
- Source: local OpenAI-aligned live eval of image prompt coaching turns
  - Kind: runtime observation
  - Retrieved: 2026-04-19
  - Applied To: stricter output contract, OpenAI-first wording, and no
    unsolicited cross-model prompt variants
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

- the user wants help writing or improving an OpenAI image prompt
- the user explicitly wants an image, and you need stronger OpenAI-style prompt
  structure before deciding whether to call the image-generation tool

Do not use this skill for unrelated design discussion. Do not treat prompt help
as permission to auto-generate an image.

## Decision Rule

- If the user asks for prompt help, return one improved copy-ready prompt plus
  short notes. Do not call the image-generation tool.
- If the user explicitly wants the image now, use this playbook silently to
  structure the request, then let the image-generation skill decide whether the
  request is clear enough to execute.
- If the user explicitly wants an image and the subject/action/use case is
  knowable, do not ask for confirmation or optional styling details; structure
  the prompt and call the image-generation tool.
- Ask exactly one precise clarification only when the missing information is a
  core subject, deliverable, use case, or visual action and generation would be
  arbitrary.
- Use `action:auto` unless the user clearly forces a new image or an edit.

## OpenAI Prompt Order

Build prompts in this order:

1. intended deliverable and use case
2. scene or background
3. main subject
4. key visual details
5. composition and framing
6. style or medium
7. lighting, time, and atmosphere
8. camera, lens, and distance when photorealism matters
9. materials, texture, and surface realism when relevant
10. exact in-image text, if any
11. what to change
12. what to preserve
13. hard constraints
14. negative constraints
15. output surface or aspect ratio

For complex requests, use labeled lines instead of one dense paragraph.

## OpenAI Edit And Reference Rules

- Edits must name the change first, then list invariants.
- Use the pattern: change only the requested element; keep all unrelated
  identity, geometry, layout, lighting, camera angle, background, and important
  brand elements unchanged unless the user says otherwise.
- Repeat critical preserve rules on every edit iteration to reduce drift.
- For style transfer, name the style cues to borrow: palette, texture,
  brushwork, film grain, line quality, lighting mood, or layout rhythm.
- For multi-image inputs, label each input as `Image 1`, `Image 2`, and so on.
  State each role: source subject, target scene, style reference, product
  reference, clothing item, logo, or layout reference.
- For compositing, specify what moves, where it goes, and how scale,
  perspective, lighting, shadows, and occlusion should match.
- For identity-sensitive edits, explicitly preserve face, facial features,
  skin tone, body shape, pose, hairstyle, expression, and proportions when
  relevant.

## OpenAI Text Rendering Rules

- Put exact in-image text in quotes.
- Say the text must be rendered verbatim, with no extra characters.
- Specify placement, hierarchy, typography style, contrast, and whether the
  text should appear once.
- If the text is a brand name, uncommon word, ticker, or handle, keep it short
  and spell it clearly.
- For text-heavy visuals such as infographics, UI, diagrams, posters, and ads,
  define layout, hierarchy, spacing, and readable contrast before style.

## OpenAI Use-Case Rules

- Photorealism: write as if a real photo is being captured now. Use natural
  lighting, lens/framing language, believable materials, honest imperfections,
  and real texture instead of generic hype.
- Product extraction or mockup: preserve geometry, label legibility, edge
  quality, and silhouette. Ask for no halos/fringing, no unintended restyle,
  and only light polishing unless the user asks for redesign.
- UI mockups: describe the product as if it exists. Focus on layout,
  hierarchy, spacing, real interface elements, and usable typography.
- Logos and brand marks: ask for an original, non-infringing mark with simple
  shapes, strong silhouette, balanced negative space, and scalability.
- Infographics and diagrams: define audience, information hierarchy, labels,
  layout, and readable text. Keep content concise.
- Comics or panels: define each panel as a separate visual beat with clear
  action and continuity rules.
- Character continuation: restate the character's stable appearance, palette,
  proportions, personality, and what must not be redesigned.

## Iteration Rules

- Start with a clean base prompt.
- Improve one major variable per follow-up: lighting, placement, typography,
  background, pose, style, or preserve list.
- Re-state critical invariants whenever the user asks for another edit.
- If the user's prompt is already specific, normalize structure instead of
  expanding it with unnecessary detail.

## Prompt-Help Response Shape

When the user asks for prompt help only, use this shape:

- `优化后的 OpenAI 图片提示词`
- `负向约束`
- `可选单变量微调`
- `还缺什么信息`

Do not volunteer Midjourney, Stable Diffusion, Google Imagen, xAI, or other
non-OpenAI prompt variants unless the user explicitly asks.

## Output Contract

- Return one prompt the user can copy directly.
- Keep the prompt structured with labeled segments or line breaks when complex.
- If the request is an edit, include explicit `Change` and `Preserve` lines.
- If the request includes in-image text, include an exact quoted text line plus
  placement and typography constraints.
- Offer only 1-3 single-variable refinements.
- Stay OpenAI-first unless the user explicitly asks for another image model.

## Default OpenAI Prompt Template

Use this template as the default shape, adapting labels to the user's language:

`Create a [deliverable/use case]. Scene/background: [scene]. Subject: [subject]. Key details: [materials, objects, texture, identity, brand details]. Composition/framing: [layout, camera angle, distance]. Style/medium: [photo, illustration, 3D render, UI mockup, etc.]. Lighting/atmosphere: [lighting]. Text, if any: "[exact text]" rendered verbatim, [placement/typography]. Change: [only what should change]. Preserve: [identity, geometry, layout, background, lighting, camera, brand elements]. Constraints: [must-haves]. Avoid: [negative constraints]. Output: [surface/aspect ratio].`
