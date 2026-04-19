# 2026-04-19 Image Prompt Skill OpenAI Alignment Eval

## Summary

The first live OpenAI-aligned evaluation of KiKo's new `image_prompting` skill
showed the routing and prompt text were not yet sufficient to guarantee that
the main model actually used the skill.

Two concrete failures appeared:

- Chinese edit-prompt wording such as `改图提示词` could miss the
  `image_prompting` route entirely.
- Even when `image_prompting` was selected, the main model often answered
  directly without calling `read_skill_prompts`, which meant the skill
  playbook was not guaranteed to shape the reply.

This correction makes image prompt coaching more explicitly OpenAI-first and
adds a repeatable live eval harness.

## Problem

Before this fix:

- route coverage favored generic `提示词` wording but did not robustly catch
  edit-oriented phrasing such as `改图提示词` or `修图提示词`
- image prompt coaching strategy notes were still too soft, so the model could
  skip `read_skill_prompts`
- prompt coaching replies could drift into generic "other model" suggestions
  such as Midjourney or Stable Diffusion rewrites even though the operator
  asked for OpenAI-style prompting guidance

## Decision

Update the image prompt coaching path in four places:

1. expand `skillIntentMatcher.ts` so Chinese edit-prompt wording routes to
   `image_prompting`
2. strengthen `nodeSkillResolver.ts` strategy notes so prompt-coaching turns
   explicitly call `read_skill_prompts` before answering
3. expand `contextReadTools.ts` so `read_skill_prompts` clearly advertises image
   prompt coaching as a use case
4. tighten `ImagePromptingSkill/prompt.exec.md` so prompt-help answers stay
   copy-ready, use OpenAI-style prompt structure, and avoid unsolicited
   cross-model variants

Add two verification layers:

- `kiko-api/src/jobs/chat/imagePromptingAlignment.test.ts` for deterministic
  routing and strategy regressions
- `kiko-api/src/scripts/evalImagePromptingSkill.ts` for live OpenAI sampling

## Verification

### Runtime observation before the fix

Observed on 2026-04-19 with live OpenAI chat-completions sampling:

- `帮我优化一个图片提示词...Fresh Brew...` routed to `image_prompting` but the
  main model did not call `read_skill_prompts`
- `帮我写一个更准确的改图提示词...` did not route to `image_prompting`
- prompt coaching replies sometimes offered non-OpenAI model variants by
  default

### Verified after the fix

Verified in code:

- Chinese edit-prompt advice now routes to `image_prompting`
- image prompt coaching now explicitly instructs the model to read
  `read_skill_prompts` before replying
- the skill prompt now requires copy-ready OpenAI-first outputs with explicit
  negative constraints and single-variable refinements

Verified with:

- `npx tsx --test --test-force-exit src/jobs/chat/imagePromptingAlignment.test.ts`
- `npx tsx src/scripts/evalImagePromptingSkill.ts`

## Owner Boundaries

Owners:

- `kiko-api/src/jobs/chat/skillIntentMatcher.ts`
- `kiko-api/src/jobs/chat/nodeSkillResolver.ts`
- `kiko-api/src/jobs/chat/contextReadTools.ts`
- `kiko-api/src/skills_exec/ImagePromptingSkill/prompt.exec.md`

Own:

- prompt-coaching route detection
- getting the model to actually load specialist prompt guidance
- OpenAI-first output shape for prompt-help replies
- live eval coverage for image prompt coaching

Do not own:

- image generation execution
- billing or moderation
- provider-specific image HTTP parameters

## Document Provenance

- Source: OpenAI GPT-image-1.5 Prompting Guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: structured prompt order, edit-preserve wording, exact text
    handling, photorealism cues, and small-step iteration rules
  - Verification: verified in docs
- Source: OpenAI Image generation guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: multi-turn prompt refinement framing and prompt revision
    expectations around the image tool
  - Verification: verified in docs
- Source: local OpenAI-aligned live eval of image prompt coaching turns
  - Kind: runtime observation
  - Retrieved: 2026-04-19
  - Applied To: route correction for `改图提示词`, mandatory `read_skill_prompts`
    strategy note, and OpenAI-first output tightening
  - Verification: verified in runtime and code
