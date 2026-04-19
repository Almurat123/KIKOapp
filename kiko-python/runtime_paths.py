from __future__ import annotations

from functools import lru_cache
from pathlib import Path


# CONTEXT MEMORY
# Updated: 2026-04-19
# Author: Rowan
# Reason: Python service owners need one shared source-root resolver so they
#         can locate the `kiko-api/src` tree across repo layouts and container
#         layouts without turning a missing optional skills directory into a
#         startup failure.
# Goal: resolve the Python-side `kiko-api/src` root defensively and keep
#       optional directories optional.
# Owns: shared source-root discovery for Python service owners.
# Does Not Own: tool execution, model prompting policy, or mount-time service
#               registration.
# Design Language:
# - discover shared roots from the runtime layout, not a single absolute path
# - prefer real repo layouts when present
# - keep deterministic fallback paths even when optional directories are absent
# Document Provenance:
# - Source: local runtime log /Users/almurat/Downloads/logs.1776576842894.json
# - Kind: runtime observation
# - Retrieved: 2026-04-19
# - Applied To: Python source-root resilience for orchestration and chat prompt
#               assembly
# - Verification: verified in code and targeted tests
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-python-orchestration-skill-root-resilience.md


def _candidate_kiko_api_src_roots(anchor: Path) -> list[Path]:
    candidates: list[Path] = []
    seen: set[Path] = set()
    for base in anchor.parents:
        for candidate in (base / "kiko-api" / "src", base / "src"):
            if candidate in seen:
                continue
            seen.add(candidate)
            candidates.append(candidate)
    return candidates


def _looks_like_kiko_api_src(root: Path) -> bool:
    return root.is_dir() and (
        (root / "chat_v2").is_dir()
        or (root / "orchestration").is_dir()
        or (root / "services").is_dir()
        or (root / "skills_exec").is_dir()
    )


@lru_cache(maxsize=1)
def resolve_kiko_api_src_root(anchor: Path | None = None) -> Path:
    probe = anchor or Path(__file__).resolve()
    candidates = _candidate_kiko_api_src_roots(probe)
    for candidate in candidates:
        if _looks_like_kiko_api_src(candidate):
            return candidate
    return candidates[0]
