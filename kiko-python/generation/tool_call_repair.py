# CONTEXT MEMORY
# Updated: 2026-04-20
# Author: Rowan
# Reason: provider streaming can occasionally emit a tool call with arguments
#         but no function name, which creates noisy warnings even when the
#         arguments clearly match one allowed tool. A later NVIDIA/GLM image
#         generation trace showed some providers can also emit malformed
#         argument fragments such as a leading-comma JSON body without braces,
#         which prevented both argument recovery and empty-name repair.
# Goal: recover empty tool-call names deterministically from the declared tool
#       schema so generation and orchestration can keep the round stable and log
#       an explicit repair instead of silently dropping a valid call. Recover
#       malformed argument fragments into structured JSON before name inference.
# Owns: tool-name inference from structured function-tool schemas and argument keys,
#       plus lightweight repair of malformed JSON argument fragments.
# Does Not Own: provider streaming, tool execution, or chat routing policy.
# Design Language:
# - repair empty tool names only when the schema match is strong enough
# - prefer deterministic argument-key matching over heuristic prose parsing
# - repair malformed tool-call arguments only when the fragment can be turned
#   into valid structured JSON without guessing semantic values
# - leave unresolved calls empty rather than guessing loosely
# Document Provenance:
# - Source: runtime generation log showing an empty-name tool call carrying
#   address/chain/days arguments for a wallet PnL query
# - Kind: runtime observation
# - Retrieved: 2026-04-16
# - Applied To: generation/orchestration empty tool-call repair
# - Verification: verified in runtime logs and targeted tests
# - Source: /Users/almurat/Downloads/logs.1776663333220.json
# - Kind: runtime observation
# - Retrieved: 2026-04-20
# - Applied To: repairing malformed leading-comma JSON fragments for NVIDIA/GLM
#   image-tool calls before empty-name inference
# - Verification: verified in runtime log and targeted tests
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-generation-empty-tool-call-repair.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-tool-call-repair-and-farcaster-wait-window.md
# - /Users/almurat/KiKo/system-journal/conflicts.md

from __future__ import annotations

import json
from typing import Any


def parse_tool_arguments(raw_args: Any) -> dict[str, Any]:
    if isinstance(raw_args, dict):
        return raw_args
    if raw_args in (None, ""):
        return {}

    if not isinstance(raw_args, str):
        try:
            return dict(raw_args)
        except Exception:
            return {}

    for candidate in _iter_argument_parse_candidates(raw_args):
        try:
            parsed = json.loads(candidate)
        except Exception:
            continue
        if isinstance(parsed, dict):
            return parsed
    return {}


def infer_tool_name_from_arguments(tools: list[dict[str, Any]], args: dict[str, Any]) -> str | None:
    arg_keys = [str(key) for key in (args or {}).keys() if str(key)]
    if not arg_keys:
        return None

    candidates = []
    for tool in _extract_function_tools(tools):
        score = _score_tool_argument_match(tool, arg_keys)
        if score > 0:
            candidates.append((tool, score))

    if not candidates:
        return None

    candidates.sort(key=lambda item: (-item[1], item[0]["index"]))
    if len(candidates) == 1:
        return str(candidates[0][0]["name"])

    best, second = candidates[0], candidates[1]
    if best[1] == second[1]:
        return str(best[0]["name"]) if best[1] >= 10 else None
    if best[1] - second[1] < 2 and second[0]["index"] < best[0]["index"]:
        return None
    return str(best[0]["name"])


def _extract_function_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for index, tool in enumerate(tools or []):
        function = tool.get("function") or {}
        name = str(function.get("name") or "").strip()
        if not name:
            continue
        parameters = function.get("parameters") if isinstance(function.get("parameters"), dict) else {}
        properties = parameters.get("properties") if isinstance(parameters.get("properties"), dict) else {}
        required = parameters.get("required") if isinstance(parameters.get("required"), list) else []
        result.append(
            {
                "name": name,
                "properties": set(str(key) for key in properties.keys()),
                "required": set(str(item) for item in required),
                "index": index,
            }
        )
    return result


def _score_tool_argument_match(tool: dict[str, Any], arg_keys: list[str]) -> int:
    matched = 0
    missing_required = 0
    extra = 0

    for key in arg_keys:
        if key in tool["properties"]:
            matched += 1
        else:
            extra += 1

    for key in tool["required"]:
        if key not in arg_keys:
            missing_required += 1

    if matched == 0:
        return 0

    score = matched * 10
    score -= extra * 6
    score -= missing_required * 12

    if missing_required == 0:
        score += 4
    if extra == 0:
        score += 2
    if matched == len(arg_keys) and len(tool["required"]) > 0:
        score += 1

    return score


def _iter_argument_parse_candidates(raw_args: str) -> list[str]:
    trimmed = str(raw_args or "").strip()
    if not trimmed:
        return []

    candidates: list[str] = []

    def append(value: str):
        candidate = value.strip()
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    append(trimmed)

    leading_comma_stripped = trimmed.lstrip(", \t\r\n")
    append(leading_comma_stripped)

    body = leading_comma_stripped
    if body and not body.startswith("{"):
        append("{" + body.rstrip(", \t\r\n") + "}")
    elif body.startswith("{") and not body.endswith("}"):
        append(body + "}")

    return candidates
