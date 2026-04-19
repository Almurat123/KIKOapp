# Owner Map: Image Prompt Skills

Updated: 2026-04-19
Author: Rowan

## Owners

- `kiko-api/src/jobs/chat/skillIntentMatcher.ts` owns query-signal detection for
  real image requests versus image-prompt coaching requests.
- `kiko-api/src/jobs/chat/nodeSkillResolver.ts` owns selected-skill ordering for
  `image_generation` and `image_prompting` on the Node chat-v2 path.
- `kiko-python/orchestration/skill_resolver.py` owns legacy Python
  orchestration skill selection and prompt-file loading parity for the same
  image prompt skills.
- `kiko-api/src/skills_exec/ImagePromptingSkill/prompt.exec.md` owns the
  model-facing prompt-writing playbook and the cross-provider guidance derived
  from OpenAI, Google, and xAI docs.
- `kiko-api/src/skills_exec/ImageGenerationSkill/prompt.exec.md` owns the
  execution-side rule that only explicit image requests may call
  `generate_image_from_intent`.
- `kiko-api/src/services/generatedImagePromptOptimizer.ts` owns server-side
  normalization from structured image intent into provider prompts.

## Non-Owners

- The image prompt skills do not own provider HTTP request shapes.
- The image prompt skills do not own moderation, billing, storage, or public
  publication gates.
- The image prompt skills do not own frontend rendering or generated-image UI
  loading behavior.
- The image prompt skills do not own final user-visible image execution
  confirmation policy.

## Document Provenance

- Source: OpenAI GPT-image-1.5 Prompting Guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: prompt-guidance owner boundaries around iteration, preserve
    rules, and grounded photorealism
  - Verification: verified in docs and mapped to code owners
- Source: Google Imagen prompt guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: prompt-guidance owner boundaries around subject/context/style
    and parameterized templates
  - Verification: verified in docs and mapped to code owners
- Source: xAI Image Generation guide
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: prompt-guidance owner boundaries around multi-turn editing and
    aspect-ratio selection
  - Verification: verified in docs and mapped to code owners
- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: separation between prompt guidance and actual image-tool
    execution
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/image-prompt-guidance.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-provenance.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
