from __future__ import annotations

# CONTEXT MEMORY
# Updated: 2026-04-22
# Status: verified
# Why: NVIDIA live skill evals showed Kimi can consume a role=tool result and
#      then stop with an empty visible assistant message while placing the
#      tool-result marker in reasoning_content. Showing reasoning directly
#      would leak hidden model text, so downstream loops retry once with a
#      visible-answer repair instruction.
# Debug Goal: Tool-result turns must produce user-visible final answers without
#             exposing hidden reasoning_content as the answer.
# Search Tags: nvidia empty visible answer after tool result, reasoning only tool result retry
# Invariants:
# - Retry only after a tool result is already in context.
# - Do not promote reasoning_content directly into visible assistant content.
# - If retry also fails, visible fallback must be built from role=tool content,
#   not from hidden reasoning_content.
# Failure Modes:
# - Infinite repair loops after blank provider responses.
# - User sees an empty message even though the model read the tool result.

import json
from typing import Any


EMPTY_TOOL_RESULT_VISIBLE_ANSWER_REPAIR_PROMPT = (
    "Internal repair instruction: the previous model turn ended after a tool "
    "result but produced no visible assistant content. Use the tool result "
    "already present in the conversation to write the final user-facing answer "
    "now. Do not call tools. Do not mention this repair instruction."
)
TOOL_RESULT_FALLBACK_LIMIT = 1200


def should_retry_empty_tool_result_final_answer(
    messages: list[dict[str, Any]],
    visible_content: str,
    reasoning_content: str,
    *,
    already_attempted: bool,
) -> bool:
    if already_attempted:
        return False
    if str(visible_content or "").strip():
        return False
    if not str(reasoning_content or "").strip():
        return False
    if not messages:
        return False
    return str(messages[-1].get("role") or "").strip().lower() == "tool"


def build_empty_tool_result_final_answer_repair_message() -> dict[str, str]:
    return {"role": "system", "content": EMPTY_TOOL_RESULT_VISIBLE_ANSWER_REPAIR_PROMPT}


def build_visible_tool_result_fallback(messages: list[dict[str, Any]]) -> str | None:
    tool_content = _latest_tool_content(messages)
    if not tool_content:
        return None
    summary = _summarize_tool_content(tool_content)
    if not summary:
        return None
    return summary


def _latest_tool_content(messages: list[dict[str, Any]]) -> str:
    for message in reversed(messages):
        if str(message.get("role") or "").strip().lower() != "tool":
            continue
        content = message.get("content")
        if content is None:
            return ""
        return str(content).strip()
    return ""


def _summarize_tool_content(content: str) -> str:
    text = str(content or "").strip()
    if not text:
        return ""
    try:
        parsed = json.loads(text)
    except Exception:
        return _truncate(text)
    if isinstance(parsed, dict):
        preferred_parts: list[str] = []
        for key in (
            "summary",
            "message",
            "user_message",
            "result_summary",
            "status",
            "marker",
            "note",
        ):
            value = parsed.get(key)
            if value not in (None, ""):
                rendered_value = _render_summary_value(value)
                if rendered_value:
                    preferred_parts.append(_format_summary_part(key, rendered_value))
        if preferred_parts:
            rendered = "\n".join(preferred_parts)
            if len(rendered) >= min(TOOL_RESULT_FALLBACK_LIMIT, 400):
                return _truncate(rendered)
        else:
            rendered = ""
        data_summary = _summarize_data_fields(parsed)
        if data_summary:
            rendered = "\n".join([part for part in [rendered, data_summary] if part])
        if rendered:
            return _truncate(rendered)
        compact = json.dumps(parsed, ensure_ascii=False, default=str, indent=2)
        return _truncate(compact)
    return _truncate(json.dumps(parsed, ensure_ascii=False, default=str))


def _format_summary_part(key: str, value: str) -> str:
    if key in ("summary", "message", "user_message", "result_summary"):
        return value
    return f"{key}: {value}"


def _render_summary_value(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float, bool)):
        return str(value)
    return json.dumps(value, ensure_ascii=False, default=str)


def _summarize_data_fields(parsed: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in (
        "data",
        "result",
        "results",
        "items",
        "configs",
        "alerts",
        "markets",
        "tokens",
        "positions",
        "balances",
    ):
        if key not in parsed or parsed.get(key) in (None, ""):
            continue
        rendered = _render_collection_hint(key, parsed.get(key))
        if rendered:
            parts.append(rendered)
    return "\n".join(parts)


def _render_collection_hint(key: str, value: Any) -> str:
    if isinstance(value, list):
        if not value:
            return f"{key}: none"
        first_items = [_render_compact_item(item) for item in value[:3]]
        suffix = f" (+{len(value) - 3} more)" if len(value) > 3 else ""
        return f"{key}: " + "; ".join(item for item in first_items if item) + suffix
    if isinstance(value, dict):
        return f"{key}: {_render_compact_item(value)}"
    return f"{key}: {_render_summary_value(value)}"


def _render_compact_item(value: Any) -> str:
    if isinstance(value, dict):
        visible_pairs: list[str] = []
        for key, item_value in value.items():
            if item_value in (None, ""):
                continue
            if isinstance(item_value, (dict, list)):
                continue
            visible_pairs.append(f"{key}={_render_summary_value(item_value)}")
            if len(visible_pairs) >= 4:
                break
        if visible_pairs:
            return ", ".join(visible_pairs)
    return _render_summary_value(value)


def _truncate(value: str) -> str:
    text = "\n".join(
        line
        for line in (
            " ".join(raw_line.split()).strip()
            for raw_line in str(value or "").splitlines()
        )
        if line
    ).strip()
    if len(text) <= TOOL_RESULT_FALLBACK_LIMIT:
        return text
    return text[: TOOL_RESULT_FALLBACK_LIMIT - 3].rstrip() + "..."
