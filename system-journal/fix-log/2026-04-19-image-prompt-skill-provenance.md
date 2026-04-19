# 2026-04-19 Image Prompt Skill Provenance

## Summary

KiKo now has a dedicated `image_prompting` skill that teaches the model how to
write stronger image prompts and how to distinguish prompt-coaching turns from
actual image-generation turns.

This change also aligns Python skill loading with Node by allowing
`prompt.exec.md` to load as a valid prompt source, so existing image skills do
not disappear on the Python orchestration path.

## Problem

Before this change:

- KiKo had an execution-facing `image_generation` skill, but no durable
  cross-provider prompt-writing skill for the model.
- Prompt-advice turns like “告诉我怎么写一个图片提示词” intentionally avoided the
  image tool, but then fell back to generic behavior instead of image-specific
  guidance.
- The Python orchestration loader only accepted `prompt.md`, which meant skills
  that existed only as `prompt.exec.md` could be missing from that path.

## Decision

Add a new `image_prompting` skill that:

1. teaches a stable prompt schema for image work
2. emphasizes OpenAI guidance first when uncertain
3. keeps Google Imagen and xAI guidance as supporting rules
4. loads on real image-generation requests as a supporting playbook
5. loads on prompt-coaching-only requests without auto-triggering image
   generation

The third company in the original operator request was implemented as
Grok / xAI because the repository already exposes `grok-imagine-image` as the
active image provider surface.

## Owner Boundaries

### Routing owners

Owners:
- `kiko-api/src/jobs/chat/skillIntentMatcher.ts`
- `kiko-api/src/jobs/chat/nodeSkillResolver.ts`
- `kiko-python/orchestration/skill_resolver.py`

Own:
- detecting image-generation versus prompt-coaching turns
- selecting `image_generation` and `image_prompting`
- keeping prompt-advice turns out of auto-generation
- keeping prompt-file loading consistent enough across Node and Python

Do not own:
- provider prompts after server normalization
- moderation, billing, or image storage

### Prompt-guidance owner

Owner:
- `kiko-api/src/skills_exec/ImagePromptingSkill/prompt.exec.md`

Owns:
- model-facing prompt structure
- cross-provider prompting heuristics
- edit-versus-preserve wording guidance

Does not own:
- actual tool invocation policy for every turn
- provider-specific HTTP parameters

## Verification

Verified in code:

- Node skill routing now selects `image_prompting` for prompt-advice turns and
  keeps `image_generation` reserved for real image requests.
- Real image requests can load both `image_generation` and `image_prompting`.
- Python orchestration now accepts `prompt.exec.md` as a prompt source and can
  select the same image prompt skill family.

Verified with:

- `npx tsx --test --test-force-exit src/jobs/chat/nodeSkillResolver.test.ts`
- `PYTHONPATH=kiko-python python3 -m unittest kiko-python/tests/test_orchestration_model_led_tool_visibility.py`
- `npm run test:tools`

## Document Provenance

- Source: OpenAI GPT-image-1.5 Prompting Guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: the primary prompt schema, iterative refinement guidance,
    preserve-vs-change edits, photorealism, compositing, logo/mockup, and
    text-heavy asset rules
  - Verification: verified in docs
- Source: OpenAI Image generation guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: high input fidelity and image-generation tool capability
    boundaries
  - Verification: verified in docs
- Source: Google Imagen prompt guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: subject/context/style structure, prompt parameterization,
    portrait cueing, and in-image text limits
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
  - Applied To: separating prompt guidance from execution-side image-tool use
  - Verification: verified in code
- Source: repo runtime inspection of configured image provider ids
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: resolving the request’s “group” wording to Grok / xAI
  - Verification: inferred from code

## See Also

- [System Journal Index](../INDEX.md)
- [Design Language: Image Prompt Guidance](../design-language/image-prompt-guidance.md)
- [Owner Map: Image Prompt Skills](../owner-map/image-prompt-skills.md)
- [2026-04-18 Chat V2 Model-Owned Image Generation Tool](./2026-04-18-chat-v2-model-owned-image-generation-tool.md)
