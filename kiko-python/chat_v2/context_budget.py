from __future__ import annotations

from dataclasses import dataclass
from typing import Any


DEFAULT_RECENT_WINDOW = 12
DEFAULT_MAX_INPUT_TOKENS = 16000
DEFAULT_RESERVED_OUTPUT = 3500


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return (len(text) + 3) // 4


def message_tokens(msg: dict[str, Any]) -> int:
    base = estimate_tokens(str(msg.get("content") or ""))
    reasoning = estimate_tokens(str(msg.get("reasoning_content") or ""))
    tool_payload = estimate_tokens(str(msg.get("tool_calls") or "")) if msg.get("tool_calls") else 0
    return base + reasoning + tool_payload + 8


def is_low_value_history_message(msg: dict[str, Any]) -> bool:
    if msg.get("role") == "tool":
        return True
    text = str(msg.get("content") or "").lower()
    if not text:
        return True
    if "processing tool results" in text:
        return True
    if "thinking" in text:
        return True
    if "task status" in text:
        return True
    if len(text) < 8 and msg.get("role") != "user":
        return True
    return False


def summarize_history(messages: list[dict[str, Any]]) -> str:
    facts: list[str] = []
    open_loops: list[str] = []
    preferences: list[str] = []
    tool_state: list[str] = []

    user_msgs = [m for m in messages if m.get("role") == "user"][-8:]
    assistant_msgs = [m for m in messages if m.get("role") == "assistant"][-8:]

    for msg in user_msgs:
        t = str(msg.get("content") or "").strip()
        if not t:
            continue
        if any(x in t.lower() for x in ["prefer", "always", "never", "don't", "do not", "请", "不要", "总是", "偏好"]):
            preferences.append(t[:200])
        else:
            facts.append(t[:180])

    for msg in assistant_msgs:
        t = str(msg.get("content") or "").strip()
        if not t:
            continue
        lower = t.lower()
        if any(x in lower for x in ["confirm", "confirmation", "需要确认", "请确认", "pending", "awaiting"]):
            open_loops.append(t[:180])
        if any(x in lower for x in ["tool", "swap", "transaction", "simulate", "quote", "risk", "launchpad"]):
            tool_state.append(t[:180])

    return "\n".join(
        [
            "[COMPACTED_HISTORY]",
            f"facts={facts[-8:]}",
            f"open_loops={open_loops[-6:]}",
            f"preferences={preferences[-6:]}",
            f"tool_state={tool_state[-8:]}",
        ]
    )


@dataclass
class ContextBudgetResult:
    messages: list[dict[str, Any]]
    compacted_summary: str | None
    input_tokens_estimated: int
    history_kept: int
    history_compacted: int


class ContextBudgetManager:
    def apply_budget(
        self,
        full_messages: list[dict[str, Any]],
        *,
        recent_window: int = DEFAULT_RECENT_WINDOW,
        max_input_tokens: int = DEFAULT_MAX_INPUT_TOKENS,
        reserved_output_tokens: int = DEFAULT_RESERVED_OUTPUT,
    ) -> ContextBudgetResult:
        usable_budget = max(1000, max_input_tokens - reserved_output_tokens)
        messages = list(full_messages)
        total_estimate = sum(message_tokens(m) for m in messages)

        if total_estimate <= usable_budget:
            return ContextBudgetResult(
                messages=messages,
                compacted_summary=None,
                input_tokens_estimated=total_estimate,
                history_kept=len(messages),
                history_compacted=0,
            )

        recent = messages[-recent_window:]
        older = messages[: max(0, len(messages) - recent_window)]
        older_high_value = [m for m in older if not is_low_value_history_message(m)]

        compacted_summary = summarize_history(older_high_value) if older_high_value else None
        next_messages = list(recent)
        next_estimate = sum(message_tokens(m) for m in next_messages) + estimate_tokens(compacted_summary or "")

        while len(next_messages) > 4 and next_estimate > usable_budget:
            next_messages.pop(0)
            next_estimate = sum(message_tokens(m) for m in next_messages) + estimate_tokens(compacted_summary or "")

        return ContextBudgetResult(
            messages=next_messages,
            compacted_summary=compacted_summary,
            input_tokens_estimated=next_estimate,
            history_kept=len(next_messages),
            history_compacted=len(messages) - len(next_messages),
        )


context_budget_manager = ContextBudgetManager()
