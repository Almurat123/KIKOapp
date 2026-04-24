from __future__ import annotations

# CONTEXT MEMORY
# Updated: 2026-04-23
# Author: Rowan
# Reason: KiKo is replacing the old DeepSeek-compatible routing path with the
#         OpenAI provider family for all non-Grok models while preserving the
#         existing provider contract seen by the orchestration layer.
# Goal: keep provider selection deterministic from model id alone so routing,
#       tool policy, and streaming assumptions do not depend on hidden defaults.
# Owns: model-id to provider-family resolution for orchestration.
# Does Not Own: request-shape normalization, SSE parsing, or pricing policy.
# Design Language:
# - Provider routing must be derived from normalized model ids.
# - Unknown non-Grok, non-OpenAI models should fall into the OpenAI family, not
#   a removed DeepSeek fallback.
# - Search/native-response capabilities remain provider-family properties.
# Document Provenance:
# - Kind: product doc
# - Retrieved: 2026-04-23
# - Applied To: routing non-Grok model ids to the OpenAI provider family
# - Verification: verified in code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/conflicts.md

def resolve_provider(model: str) -> dict[str, str | bool]:
    normalized = str(model or "").lower()
    if "grok" in normalized:
        return {
            "provider": "grok",
            "model": model,
            "supportsNativeSearch": True,
            "supportsPreviousResponse": True,
            "searchFlavor": "social_realtime",
        }
    if normalized.startswith("gpt") or normalized.startswith("o"):
        return {
            "provider": "openai",
            "model": model,
            "supportsNativeSearch": False,
            "supportsPreviousResponse": True,
            "searchFlavor": "generic",
        }
    if normalized == "deepseek-v4-flash":
        return {
            "provider": "deepseek",
            "model": model,
            "supportsNativeSearch": False,
            "supportsPreviousResponse": False,
            "searchFlavor": "generic",
        }
    return {
        "provider": "openai",
        "model": model,
        "supportsNativeSearch": False,
        "supportsPreviousResponse": True,
        "searchFlavor": "generic",
    }
