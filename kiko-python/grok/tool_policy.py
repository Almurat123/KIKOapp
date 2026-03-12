from typing import Any, Optional


ALLOWED_NATIVE_TOOL_NAMES = {"web_search", "x_search", "code_execution", "collections_search", "mcp"}


def _coerce_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _coerce_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return max(0, int(value))
    except Exception:
        return None


def resolve_requested_tool_policy(
    raw_policy: Optional[dict],
    *,
    enable_search_default: bool,
    allow_extra_sdk_tools_default: bool,
    is_non_reasoning_model: bool,
) -> dict[str, Any]:
    policy = raw_policy if isinstance(raw_policy, dict) else {}
    native_tools = policy.get("native_tools") if isinstance(policy.get("native_tools"), dict) else {}
    execution = policy.get("execution") if isinstance(policy.get("execution"), dict) else {}

    enable_search = _coerce_bool(native_tools.get("enable_search"), enable_search_default)
    enabled_tools_raw = native_tools.get("enabled_tools")
    enabled_tools = enabled_tools_raw if isinstance(enabled_tools_raw, list) else []
    normalized_enabled_tools = []
    for tool_name in enabled_tools:
        normalized = str(tool_name).strip()
        if not normalized or normalized not in ALLOWED_NATIVE_TOOL_NAMES:
            continue
        if normalized == "x_search" and is_non_reasoning_model:
            continue
        normalized_enabled_tools.append(normalized)

    if enable_search and not normalized_enabled_tools:
        normalized_enabled_tools = ["web_search"]
        if not is_non_reasoning_model:
            normalized_enabled_tools.append("x_search")

    if not enable_search:
        normalized_enabled_tools = []

    required = _coerce_bool(native_tools.get("required"), False)
    preferred_required_tool = native_tools.get("preferred_required_tool")
    preferred_required_tool = str(preferred_required_tool).strip() if preferred_required_tool else None
    if preferred_required_tool not in normalized_enabled_tools:
        preferred_required_tool = normalized_enabled_tools[0] if required and normalized_enabled_tools else None

    include_options_raw = native_tools.get("include_options")
    include_options = [
        str(option).strip()
        for option in include_options_raw
        if isinstance(option, str) and str(option).strip()
    ] if isinstance(include_options_raw, list) else []
    if not include_options and normalized_enabled_tools:
        include_options = ["inline_citations"]

    return {
        "native_tools": {
            "enable_search": enable_search,
            "enabled_tools": normalized_enabled_tools,
            "required": required,
            "preferred_required_tool": preferred_required_tool,
            "include_options": include_options,
            "allow_extra_sdk_tools": _coerce_bool(
                native_tools.get("allow_extra_sdk_tools"),
                allow_extra_sdk_tools_default,
            ),
            "reason": str(native_tools.get("reason") or ""),
        },
        "execution": {
            "per_tool_timeout_ms": _coerce_int(execution.get("per_tool_timeout_ms")),
            "total_tool_budget_ms": _coerce_int(execution.get("total_tool_budget_ms")),
        },
    }
