from __future__ import annotations

from typing import Any

# CONTEXT MEMORY
# Updated: 2026-04-19
# Author: Rowan
# Reason: Python orchestration now follows the same always-on model-led path as
#         Node chat-v2, so the main model sees the full tool catalog instead of
#         being narrowed by keyword heuristics. This helper centralizes tool-name
#         extraction and model-facing tool guidance so skill resolution and
#         prompt assembly stay aligned.
# Goal: keep the Python orchestration path aligned with model-led tool choice
#       while preserving backend safety and confirmation controls.
# Owns: default model-led enablement, runtime tool-name exposure, and the shared
#       model-led prompt block for Python orchestration.
# Does Not Own: provider transport, tool execution, or business-policy gates.
# Design Language:
# - strong models own semantic tool choice
# - backend policy owns real-world side effects, not ordinary intent guessing
# - model-led visibility is the default path
# Document Provenance:
# - Source: operator architecture review on 2026-04-19
# - Kind: product instruction
# - Retrieved: 2026-04-19
# - Applied To: Python always-on model-led tool visibility and prompt block
# - Verification: verified in code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/adr/2026-04-19-model-led-tool-orchestration.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-model-led-tool-orchestration-default-enable.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-python-model-led-tool-visibility-alignment.md

MODEL_LED_TOOL_ORCHESTRATION_BLOCK = """
[MODEL_LED_TOOL_ORCHESTRATION]
- Registered tools are visible to the main model on this turn.
- Decide directly whether to answer or call tools. Use the minimum tool sequence that finishes the task.
- Backend policy still owns safety, quota, billing, confirmation, and side-effect blocking.
- Do not expose provider-specific request details or hidden routing heuristics.
""".strip()


def is_model_led_tool_orchestration_enabled() -> bool:
    return True


def build_model_led_tool_orchestration_block() -> str:
    return MODEL_LED_TOOL_ORCHESTRATION_BLOCK


def resolve_model_led_tool_names(snapshot: dict[str, Any]) -> list[str]:
    tool_definitions = snapshot.get("toolDefinitions") or []
    names: list[str] = []
    seen: set[str] = set()
    for tool in tool_definitions:
        if not isinstance(tool, dict):
            continue
        name = str(tool.get("name") or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        names.append(name)
    return names
