from __future__ import annotations

# CONTEXT MEMORY
# Updated: 2026-04-16
# Author: Rowan
# Reason: KiKo is replacing the old DeepSeek-compatible routing path with an
#         NVIDIA-hosted model family path for GLM and Kimi while preserving the
#         existing provider contract seen by the orchestration layer.
# Goal: keep provider selection deterministic from model id alone so routing,
#       tool policy, and streaming assumptions do not depend on hidden defaults.
# Owns: model-id to provider-family resolution for orchestration.
# Does Not Own: request-shape normalization, SSE parsing, or pricing policy.
# Design Language:
# - Provider routing must be derived from normalized model ids.
# - Kimi and GLM belong to the NVIDIA/OpenAI-compatible provider family.
# - Unknown non-Grok, non-OpenAI models should fall into the NVIDIA family, not
#   a removed DeepSeek fallback.
# - Search/native-response capabilities remain provider-family properties.
# Document Provenance:
# - Source: NVIDIA NIM model pages for moonshotai/kimi-k2-5 and z-ai/glm5
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: routing Kimi/GLM model ids to the NVIDIA provider family
# - Verification: verified in code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
# - /Users/almurat/KiKo/system-journal/conflicts.md

def _is_nvidia_model(model: str) -> bool:
    normalized = str(model or "").lower().strip()
    if not normalized:
        return False
    return any(token in normalized for token in [
        "kimi",
        "glm",
        "moonshotai/",
        "z-ai/",
    ])


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
            "supportsPreviousResponse": False,
            "searchFlavor": "generic",
        }
    if _is_nvidia_model(normalized):
        return {
            "provider": "nvidia",
            "model": model,
            "supportsNativeSearch": False,
            "supportsPreviousResponse": False,
            "searchFlavor": "generic",
        }
    return {
        "provider": "nvidia",
        "model": model,
        "supportsNativeSearch": False,
        "supportsPreviousResponse": False,
        "searchFlavor": "generic",
    }
