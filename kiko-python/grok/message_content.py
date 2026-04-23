from __future__ import annotations

# CONTEXT MEMORY
# Updated: 2026-04-16
# Author: Rowan
# Reason: Grok social-agent turns can now arrive from Node with structured
#         multimodal message content, while xAI's SDK expects user messages to
#         be appended as text plus SDK image content objects. The router needs a
#         small, testable normalization boundary instead of assuming every
#         message content is a string.
# Goal: preserve current-turn post text and image URLs through the Grok adapter
#       without replaying images into generic history strings.
# Owns: provider-neutral extraction of text and image URLs from structured chat
#       message content.
# Does Not Own: xAI SDK object creation, model routing, tool execution, or
#               persistence.
# Design Language:
# - xAI `input_text` + `input_image` parts are accepted at the adapter boundary.
# - Image URLs must be extracted, not stringified into prompt text.
# - Empty image URLs are ignored before provider calls.
# Document Provenance:
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: accepting `content` object lists with `image_url` entries
# - Verification: verified in docs and code
# - Source: xAI Image Understanding docs
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: accepting `input_image` / `input_text` entries before xAI SDK conversion
# - Verification: verified in docs and code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/owner-map/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md

from typing import Any


TEXT_PART_TYPES = {"text", "input_text"}
IMAGE_PART_TYPES = {"image_url", "input_image", "image"}


def _part_type(value: dict[str, Any]) -> str:
    return str(value.get("type") or "").strip().lower()


def _normalize_image_url(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        for key in ("url", "image_url", "src", "image"):
            url = _normalize_image_url(value.get(key))
            if url:
                return url
    return ""


def extract_image_urls(content: Any) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()

    def add(url: str) -> None:
        normalized = url.strip()
        if not normalized or normalized in seen:
            return
        seen.add(normalized)
        urls.append(normalized)

    def walk(value: Any) -> None:
        if isinstance(value, list):
            for item in value:
                walk(item)
            return
        if not isinstance(value, dict):
            return

        part_type = _part_type(value)
        if part_type in IMAGE_PART_TYPES:
            for key in ("image_url", "url", "image", "src"):
                url = _normalize_image_url(value.get(key))
                if url:
                    add(url)
                    return

        for key in ("content", "parts"):
            nested = value.get(key)
            if isinstance(nested, (list, dict)):
                walk(nested)

    walk(content)
    return urls


def extract_text_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [extract_text_content(item).strip() for item in content]
        return "\n".join(part for part in parts if part)
    if isinstance(content, dict):
        part_type = _part_type(content)
        if part_type in IMAGE_PART_TYPES:
            return ""
        if part_type in TEXT_PART_TYPES:
            return extract_text_content(content.get("text") or content.get("content"))
        for key in ("text", "content"):
            text = extract_text_content(content.get(key)).strip()
            if text:
                return text
    return ""


def append_text_content(content: Any, suffix: str) -> Any:
    clean_suffix = str(suffix or "")
    if not clean_suffix:
        return content
    if isinstance(content, list):
        return [*content, {"type": "text", "text": clean_suffix}]
    if isinstance(content, str):
        return f"{content}{clean_suffix}"
    if content is None:
        return clean_suffix
    text = extract_text_content(content)
    return f"{text}{clean_suffix}" if text else clean_suffix


def messages_have_image_content(messages: list[Any]) -> bool:
    for message in messages or []:
        content = message.get("content") if isinstance(message, dict) else getattr(message, "content", None)
        if extract_image_urls(content):
            return True
    return False
