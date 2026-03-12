from __future__ import annotations


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
    return {
        "provider": "deepseek",
        "model": model,
        "supportsNativeSearch": False,
        "supportsPreviousResponse": False,
        "searchFlavor": "generic",
    }
