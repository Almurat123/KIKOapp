# 2026-04-19 Python Orchestration Skill Root Resilience

## What Changed

- Added a shared Python source-root resolver for `kiko-api/src`.
- Updated Python orchestration skill loading to treat a missing `skills_exec`
  directory as an empty registry instead of a startup failure.
- Updated Python chat prompt assembly to use the same shared source-root
  resolver.
- Added tests for both source-root layouts and for the missing-directory
  fallback.

## Why

The runtime log showed orchestration startup failing during import because the
skill loader assumed `skills_exec` always existed at a fixed path. That made an
optional catalog directory behave like a required boot dependency. The owner
layers should still work when the skill catalog is absent, even if they expose
fewer prompts.

## Verification

- Verified in code that `runtime_paths.resolve_kiko_api_src_root()` finds both
  `kiko-api/src` and plain `src` layouts.
- Verified in code that `orchestration.skill_resolver._load_skills()` returns
  an empty list when the skill catalog directory is absent.
- Verified in code that `chat_v2.prompt_orchestrator` now uses the same shared
  source-root resolver.
- Added targeted Python tests for the two root layouts and the missing skills
  directory case.

## Document Provenance

- Source: /Users/almurat/Downloads/logs.1776576842894.json
- Kind: runtime observation
- Retrieved: 2026-04-19
- Applied To: Python orchestration startup resilience and shared source-root
  resolution
- Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/kiko-python/runtime_paths.py
- /Users/almurat/KiKo/kiko-python/orchestration/skill_resolver.py
- /Users/almurat/KiKo/kiko-python/chat_v2/prompt_orchestrator.py
