from __future__ import annotations

# CONTEXT MEMORY
# Updated: 2026-04-23
# Status: mixed
# Why: This gateway normalizes OpenAI and xAI streaming responses into KiKo's
#   internal event protocol while preserving reasoning, tool, usage, and
#   citation events for downstream orchestration.
# Debug Goal: Keep provider-specific request shaping isolated here and keep the
#   public event stream stable across OpenAI and xAI.
# Search Tags: openai request shape diagnostics, xai image gateway, reasoning delta extraction, provider request id promotion
# Invariants:
# - Plain assistant text must not be promoted into reasoning deltas.
# - GPT-5.4 tool calls with reasoning effort must keep the current omission rule.
# - xAI image turns should prefer the SDK gateway when needed.
# Failure Modes:
# - Provider request ids regress to suspicious chunk ids.
# - Tool schema logging leaks prompt text or unsupported request fields.

import asyncio
import json
import logging
import os
import re
import time
from typing import AsyncGenerator, Any

import httpx

from grok.message_content import messages_have_image_content

from ..schemas import GatewayEvent, GenerateRequest

logger = logging.getLogger(__name__)

OPENAI_API_URL = os.getenv("OPENAI_API_URL", "https://api.openai.com/v1/chat/completions")
OPENAI_RESPONSES_API_URL = os.getenv("OPENAI_RESPONSES_API_URL", "https://api.openai.com/v1/responses")
GROK_SERVICE_URL = os.getenv("GROK_SERVICE_URL", "http://localhost:8000/grok")
XAI_API_URL = os.getenv("XAI_API_URL", "https://api.x.ai/v1/chat/completions")
GROK_PREFER_SDK_GATEWAY = os.getenv("GROK_PREFER_SDK_GATEWAY", "true").lower() not in {"0", "false", "no"}

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")
XAI_API_KEY = os.getenv("XAI_API_KEY", "")


def _normalized_model(model: str) -> str:
    return str(model or "").strip().lower()


OPENAI_REASONING_EFFORTS = {"none", "minimal", "low", "medium", "high", "xhigh"}
OPENAI_TOOL_DESCRIPTION_WARN_LIMIT = 1024
OPENAI_TOOL_LOG_SAMPLE_LIMIT = 12
STREAM_CONNECT_TIMEOUT_SEC = max(1.0, float(os.getenv("LLM_GATEWAY_STREAM_CONNECT_TIMEOUT_SEC", "8")))
STREAM_READ_TIMEOUT_SEC = max(30.0, float(os.getenv("LLM_GATEWAY_STREAM_READ_TIMEOUT_SEC", "180")))
STREAM_WRITE_TIMEOUT_SEC = max(5.0, float(os.getenv("LLM_GATEWAY_STREAM_WRITE_TIMEOUT_SEC", "20")))
STREAM_POOL_TIMEOUT_SEC = max(1.0, float(os.getenv("LLM_GATEWAY_STREAM_POOL_TIMEOUT_SEC", "8")))
STREAM_MAX_RETRIES = max(1, int(os.getenv("LLM_GATEWAY_STREAM_MAX_RETRIES", "3")))


def _normalize_reasoning_effort(value: Any) -> str | None:
    normalized = str(value or "").strip().lower()
    if not normalized:
        return None
    if normalized in OPENAI_REASONING_EFFORTS:
        return normalized
    return None


def _should_omit_openai_reasoning_effort_for_chat_tools(
    model: str,
    tools: list[dict[str, Any]] | None,
    reasoning_effort: str | None,
) -> bool:
    if not reasoning_effort or not tools:
        return False
    return _normalized_model(model).startswith("gpt-5.4")


def _normalize_openai_api_mode(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"responses", "chat_completions"}:
        return normalized
    return "chat_completions"


def _build_openai_request_body(req: GenerateRequest) -> tuple[dict[str, Any], str | None]:
    reasoning_effort = _normalize_reasoning_effort(
        (req.tool_context or {}).get("reasoningEffort") or (req.tool_context or {}).get("reasoning_effort"),
    )
    tools = req.tools or []
    omit_reasoning_effort = _should_omit_openai_reasoning_effort_for_chat_tools(
        req.model,
        tools,
        reasoning_effort,
    )
    body: dict[str, Any] = {
        "model": req.model,
        "messages": [m.model_dump(exclude_none=True) for m in req.messages],
        "stream": True,
        "stream_options": {"include_usage": True},
    }
    if reasoning_effort and not omit_reasoning_effort:
        body["reasoning_effort"] = reasoning_effort
    # OpenAI chat/completions rejects metadata unless store=true.
    # Keep gateway behavior stable and avoid provider-specific failures.
    if tools:
        body["tools"] = tools
        body["tool_choice"] = req.tool_choice or "auto"
    return body, reasoning_effort if omit_reasoning_effort else None


def _coerce_responses_input_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:
        return str(value)


def _coerce_responses_image_url(value: Any) -> str | None:
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None
    if isinstance(value, dict):
        for key in ("url", "image_url"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
            if isinstance(candidate, dict):
                nested = _coerce_responses_image_url(candidate)
                if nested:
                    return nested
    return None


def _responses_text_part_type_for_role(role: str) -> str:
    return "output_text" if role == "assistant" else "input_text"


def _convert_message_content_to_responses_parts(content: Any, *, role: str = "user") -> list[dict[str, Any]]:
    if content is None:
        return []
    text_part_type = _responses_text_part_type_for_role(role)
    if isinstance(content, str):
        text = content.strip()
        return [{"type": text_part_type, "text": content}] if text else []
    if isinstance(content, list):
        parts: list[dict[str, Any]] = []
        for item in content:
            parts.extend(_convert_message_content_to_responses_parts(item, role=role))
        return parts
    if isinstance(content, dict):
        part_type = str(content.get("type") or "").strip().lower()
        if part_type in {"input_text", "text", "output_text"}:
            text = _coerce_responses_input_text(content.get("text"))
            return [{"type": text_part_type, "text": text}] if text.strip() else []
        if role == "assistant" and part_type == "refusal":
            text = _coerce_responses_input_text(content.get("refusal") or content.get("text") or content.get("content"))
            return [{"type": "refusal", "refusal": text}] if text.strip() else []
        if part_type in {"image_url", "input_image"}:
            image_url = _coerce_responses_image_url(content.get("image_url") if "image_url" in content else content)
            if not image_url:
                return []
            if role == "assistant":
                return [{"type": "output_text", "text": image_url}]
            part: dict[str, Any] = {"type": "input_image", "image_url": image_url}
            detail = content.get("detail")
            if isinstance(detail, str) and detail.strip():
                part["detail"] = detail.strip()
            return [part]
        if part_type == "input_file":
            part: dict[str, Any] = {"type": "input_file"}
            if content.get("file_id"):
                part["file_id"] = str(content.get("file_id"))
            elif content.get("file_url"):
                part["file_url"] = str(content.get("file_url"))
            else:
                return []
            return [part]
        if "text" in content:
            text = _coerce_responses_input_text(content.get("text"))
            return [{"type": text_part_type, "text": text}] if text.strip() else []
    text = _coerce_responses_input_text(content)
    return [{"type": text_part_type, "text": text}] if text.strip() else []


def _normalize_responses_role(role: str) -> str:
    normalized = str(role or "").strip().lower()
    if normalized == "system":
        return "developer"
    if normalized in {"developer", "user", "assistant"}:
        return normalized
    return normalized


def _convert_messages_to_responses_input(messages: list[Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for message in messages:
        role = _normalize_responses_role(getattr(message, "role", None) or (message.get("role") if isinstance(message, dict) else None))
        content = getattr(message, "content", None) if not isinstance(message, dict) else message.get("content")
        tool_call_id = getattr(message, "tool_call_id", None) if not isinstance(message, dict) else message.get("tool_call_id")
        if role == "tool":
            call_id = str(tool_call_id or "").strip()
            if not call_id:
                continue
            items.append({
                "type": "function_call_output",
                "call_id": call_id,
                "output": _coerce_responses_input_text(content),
            })
            continue
        if role not in {"developer", "user", "assistant"}:
            continue
        parts = _convert_message_content_to_responses_parts(content, role=role)
        if not parts:
            continue
        items.append({
            "role": role,
            "content": parts,
        })
    return items


def _schema_allows_null(schema: Any) -> bool:
    if not isinstance(schema, dict):
        return False
    schema_type = schema.get("type")
    if schema_type == "null":
        return True
    if isinstance(schema_type, list) and "null" in schema_type:
        return True
    for keyword in ("anyOf", "oneOf"):
        variants = schema.get(keyword)
        if isinstance(variants, list) and any(_schema_allows_null(variant) for variant in variants):
            return True
    enum_values = schema.get("enum")
    if isinstance(enum_values, list) and None in enum_values:
        return True
    return False


def _make_schema_nullable(schema: Any) -> Any:
    if not isinstance(schema, dict):
        return schema
    if _schema_allows_null(schema):
        return schema
    cloned: dict[str, Any] = {**schema}
    schema_type = cloned.get("type")
    if isinstance(schema_type, str) and schema_type != "null":
        cloned["type"] = [schema_type, "null"]
    elif isinstance(schema_type, list):
        normalized_types = [item for item in schema_type if item != "null"]
        normalized_types.append("null")
        cloned["type"] = normalized_types
    elif isinstance(cloned.get("anyOf"), list):
        cloned["anyOf"] = [*cloned["anyOf"], {"type": "null"}]
    elif isinstance(cloned.get("oneOf"), list):
        cloned["oneOf"] = [*cloned["oneOf"], {"type": "null"}]
    else:
        cloned["anyOf"] = [schema, {"type": "null"}]
    if isinstance(cloned.get("enum"), list) and None not in cloned["enum"]:
        cloned["enum"] = [*cloned["enum"], None]
    return cloned


def _normalize_schema_for_openai_strict(schema: Any) -> Any:
    if not isinstance(schema, dict):
        return schema

    cloned: dict[str, Any] = {**schema}

    for keyword in ("anyOf", "oneOf", "allOf"):
        variants = cloned.get(keyword)
        if isinstance(variants, list):
            cloned[keyword] = [
                _normalize_schema_for_openai_strict(variant)
                for variant in variants
            ]

    if isinstance(cloned.get("items"), dict):
        cloned["items"] = _normalize_schema_for_openai_strict(cloned["items"])
    elif isinstance(cloned.get("items"), list):
        cloned["items"] = [
            _normalize_schema_for_openai_strict(item)
            for item in cloned["items"]
        ]

    if isinstance(cloned.get("not"), dict):
        cloned["not"] = _normalize_schema_for_openai_strict(cloned["not"])

    properties = cloned.get("properties")
    is_object_schema = (
        cloned.get("type") == "object"
        or isinstance(properties, dict)
        or isinstance(cloned.get("required"), list)
        or "additionalProperties" in cloned
    )

    if is_object_schema:
        property_map = properties if isinstance(properties, dict) else {}
        original_required = set(
            str(item) for item in cloned.get("required", [])
            if isinstance(item, str)
        )
        normalized_properties: dict[str, Any] = {}
        for name, value in property_map.items():
            normalized_value = _normalize_schema_for_openai_strict(value)
            if name not in original_required:
                normalized_value = _make_schema_nullable(normalized_value)
            normalized_properties[name] = normalized_value
        cloned["type"] = "object"
        cloned["properties"] = normalized_properties
        cloned["required"] = list(normalized_properties.keys())
        cloned["additionalProperties"] = False
        return cloned

    return cloned


def _normalize_parameters_for_openai_responses_strict(parameters: Any) -> dict[str, Any]:
    if not isinstance(parameters, dict):
        parameters = {"type": "object", "properties": {}}
    base = {**parameters}
    if not isinstance(base.get("properties"), dict):
        base["properties"] = {}
    return _normalize_schema_for_openai_strict(base)


def _convert_chat_tools_to_responses_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    converted: list[dict[str, Any]] = []
    for tool in tools:
        if not isinstance(tool, dict):
            continue
        if str(tool.get("type") or "").strip() != "function":
            converted.append(tool)
            continue
        function = tool.get("function")
        if not isinstance(function, dict):
            continue
        name = str(function.get("name") or "").strip()
        if not name:
            continue
        strict = function.get("strict")
        strict_enabled = strict is not False
        parameters = function.get("parameters") if isinstance(function.get("parameters"), dict) else {"type": "object", "properties": {}}
        if strict_enabled:
            parameters = _normalize_parameters_for_openai_responses_strict(parameters)
        converted.append({
            "type": "function",
            "name": name,
            "description": str(function.get("description") or ""),
            "parameters": parameters,
            "strict": strict_enabled,
        })
    return converted


def _convert_tool_choice_to_responses(tool_choice: Any) -> Any:
    if isinstance(tool_choice, str):
        normalized = tool_choice.strip().lower()
        if normalized in {"auto", "required", "none"}:
            return normalized
        return "auto"
    if isinstance(tool_choice, dict):
        tool_type = str(tool_choice.get("type") or "").strip().lower()
        if tool_type == "function":
            name = ""
            function = tool_choice.get("function")
            if isinstance(function, dict):
                name = str(function.get("name") or "").strip()
            if not name:
                name = str(tool_choice.get("name") or "").strip()
            if name:
                return {"type": "function", "name": name}
    return "auto"


def _build_openai_responses_request_body(req: GenerateRequest) -> dict[str, Any]:
    reasoning_effort = _normalize_reasoning_effort(
        (req.tool_context or {}).get("reasoningEffort") or (req.tool_context or {}).get("reasoning_effort"),
    )
    body: dict[str, Any] = {
        "model": req.model,
        "input": _convert_messages_to_responses_input(req.messages),
        "stream": True,
        "store": True,
    }
    metadata = normalize_metadata(req.metadata)
    if metadata:
        body["metadata"] = metadata
    if reasoning_effort:
        body["reasoning"] = {"effort": reasoning_effort}
    if req.tools:
        body["tools"] = _convert_chat_tools_to_responses_tools(req.tools)
        body["tool_choice"] = _convert_tool_choice_to_responses(req.tool_choice)
    if req.previous_response_id:
        body["previous_response_id"] = req.previous_response_id
    return body


def _summarize_openai_request_shape(body: dict[str, Any]) -> dict[str, Any]:
    tools = body.get("tools") if isinstance(body.get("tools"), list) else []
    input_value = body.get("messages") if isinstance(body.get("messages"), list) else body.get("input")
    if isinstance(input_value, list):
        message_count = len(input_value)
    elif input_value in (None, ""):
        message_count = 0
    else:
        message_count = 1
    invalid_names: list[dict[str, Any]] = []
    long_descriptions: list[dict[str, Any]] = []
    non_object_parameters: list[dict[str, Any]] = []
    total_tool_schema_bytes = 0
    first_tool_names: list[str] = []

    for index, tool in enumerate(tools):
        if not isinstance(tool, dict):
            continue
        function = tool.get("function") if isinstance(tool.get("function"), dict) else tool
        if not isinstance(function, dict):
            continue
        name = str(function.get("name") or "")
        if len(first_tool_names) < OPENAI_TOOL_LOG_SAMPLE_LIMIT:
            first_tool_names.append(name)
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", name):
            invalid_names.append({"index": index, "name": name[:96], "name_len": len(name)})
        description = str(function.get("description") or "")
        if len(description) > OPENAI_TOOL_DESCRIPTION_WARN_LIMIT:
            long_descriptions.append({
                "index": index,
                "name": name[:96],
                "description_len": len(description),
            })
        parameters = function.get("parameters")
        if parameters is not None and not isinstance(parameters, dict):
            non_object_parameters.append({
                "index": index,
                "name": name[:96],
                "parameters_type": type(parameters).__name__,
            })
        try:
            total_tool_schema_bytes += len(json.dumps(tool, ensure_ascii=False, default=str))
        except Exception:
            total_tool_schema_bytes += len(str(tool))

    return {
        "request_keys": sorted(body.keys()),
        "message_count": message_count,
        "tool_count": len(tools),
        "first_tool_names": first_tool_names,
        "reasoning_effort": body.get("reasoning_effort") or ((body.get("reasoning") or {}).get("effort") if isinstance(body.get("reasoning"), dict) else None),
        "has_reasoning_object": isinstance(body.get("reasoning"), dict),
        "stream": body.get("stream"),
        "tool_choice": body.get("tool_choice"),
        "stream_options_keys": sorted((body.get("stream_options") or {}).keys()) if isinstance(body.get("stream_options"), dict) else [],
        "total_tool_schema_bytes": total_tool_schema_bytes,
        "invalid_tool_names": invalid_names[:OPENAI_TOOL_LOG_SAMPLE_LIMIT],
        "invalid_tool_name_count": len(invalid_names),
        "long_tool_descriptions": long_descriptions[:OPENAI_TOOL_LOG_SAMPLE_LIMIT],
        "long_tool_description_count": len(long_descriptions),
        "non_object_tool_parameters": non_object_parameters[:OPENAI_TOOL_LOG_SAMPLE_LIMIT],
        "non_object_tool_parameter_count": len(non_object_parameters),
    }


def _coerce_text_content(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            text = _coerce_text_content(item)
            if text:
                parts.append(text)
        return "".join(parts)
    if isinstance(value, dict):
        part_type = str(value.get("type") or "").strip().lower()
        if part_type in {"reasoning", "reasoning_content", "reasoning_text", "thinking"}:
            return ""
        for key in ("text", "content"):
            text = _coerce_text_content(value.get(key))
            if text:
                return text
    return ""


def _coerce_reasoning_content(value: Any, *, allow_plain_string: bool = False) -> str:
    if isinstance(value, str):
        return value if allow_plain_string else ""
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            text = _coerce_reasoning_content(item, allow_plain_string=allow_plain_string)
            if text:
                parts.append(text)
        return "".join(parts)
    if isinstance(value, dict):
        part_type = str(value.get("type") or "").strip().lower()
        if part_type in {"reasoning", "reasoning_content", "reasoning_text", "thinking"}:
            for key in ("text", "content", "reasoning_content", "reasoning", "reasoning_text", "thinking"):
                text = _coerce_reasoning_content(value.get(key), allow_plain_string=True)
                if text:
                    return text
        for key in ("reasoning_content", "reasoning", "reasoning_text", "thinking"):
            text = _coerce_reasoning_content(value.get(key), allow_plain_string=True)
            if text:
                return text
    return ""


def _extract_text_delta(data: dict[str, Any], choice: dict[str, Any], delta: dict[str, Any]) -> str:
    for candidate in (
        delta.get("content"),
        choice.get("message", {}).get("content"),
        choice.get("content"),
        data.get("content"),
    ):
        text = _coerce_text_content(candidate)
        if text:
            return text
    return ""


def _extract_reasoning_delta(data: dict[str, Any], choice: dict[str, Any], delta: dict[str, Any]) -> str:
    for candidate, allow_plain_string in (
        (delta.get("reasoning_content"), True),
        (delta.get("reasoning"), True),
        (delta.get("reasoning_text"), True),
        (delta.get("thinking"), True),
        (delta.get("content"), False),
        (choice.get("reasoning_content"), True),
        (choice.get("message", {}).get("reasoning_content"), True),
        (choice.get("message", {}).get("reasoning"), True),
        (choice.get("message", {}).get("reasoning_text"), True),
        (choice.get("message", {}).get("thinking"), True),
        (data.get("reasoning_content"), True),
        (data.get("reasoning"), True),
        (data.get("reasoning_text"), True),
        (data.get("thinking"), True),
    ):
        text = _coerce_reasoning_content(
            candidate,
            allow_plain_string=allow_plain_string,
        )
        if text:
            return text
    return ""


def resolve_provider(model: str) -> str:
    m = _normalized_model(model)
    if "grok" in m:
        return "xai"
    if m.startswith("gpt") or m.startswith("o"):
        return "openai"
    return "openai"


def normalize_metadata(metadata: dict[str, Any] | None) -> dict[str, str]:
    if not metadata:
        return {}
    out: dict[str, str] = {}
    for k, v in metadata.items():
        if v is None:
            continue
        out[str(k)] = str(v)
    return out


async def stream_generate(req: GenerateRequest) -> AsyncGenerator[GatewayEvent, None]:
    provider = resolve_provider(req.model)
    if provider == "openai":
        async for ev in _stream_openai(req, provider):
            yield ev
    else:
        async for ev in _stream_xai(req, provider):
            yield ev


async def _stream_openai(req: GenerateRequest, provider: str):
    if not OPENAI_API_KEY:
        yield GatewayEvent(event_type="error", provider="openai", payload={"message": "OPENAI_API_KEY missing"})
        return

    api_mode = _normalize_openai_api_mode(req.api_mode)
    if api_mode == "responses":
        body = _build_openai_responses_request_body(req)
        request_shape = _summarize_openai_request_shape(body)
        logger.info("llm_gateway.openai_request_shape %s", {**request_shape, "api_mode": "responses"})
        async for ev in _stream_openai_responses_sse(
            provider=provider,
            url=OPENAI_RESPONSES_API_URL,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
            body=body,
        ):
            yield ev
        return

    body, omitted_reasoning_effort = _build_openai_request_body(req)
    if omitted_reasoning_effort:
        logger.warning(
            "llm_gateway.openai_reasoning_effort_omitted_for_tools model=%s reasoning_effort=%s tool_count=%s endpoint=chat_completions reason=%s",
            req.model,
            omitted_reasoning_effort,
            len(req.tools or []),
            "OpenAI rejects function tools with reasoning_effort for GPT-5.4 chat/completions; use Responses API for tool+reasoning.",
        )
    request_shape = _summarize_openai_request_shape(body)
    logger.info("llm_gateway.openai_request_shape %s", {**request_shape, "api_mode": "chat_completions"})
    if (
        request_shape["invalid_tool_name_count"]
        or request_shape["long_tool_description_count"]
        or request_shape["non_object_tool_parameter_count"]
    ):
        logger.warning("llm_gateway.openai_tool_schema_suspect %s", request_shape)

    async for ev in _stream_sse(
        provider=provider,
        url=OPENAI_API_URL,
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        body=body,
    ):
        yield ev


async def _stream_openai_responses_sse(provider: str, url: str, headers: dict[str, str], body: dict[str, Any]):
    started_at = time.time()
    first_token_at = None
    started_sent = False
    provider_request_id = None
    function_calls: dict[str, dict[str, Any]] = {}

    timeout = _build_stream_timeout()
    async with httpx.AsyncClient(timeout=timeout) as client:
        retries = STREAM_MAX_RETRIES
        backoff = 1
        for attempt in range(retries):
            try:
                async with client.stream("POST", url, headers=headers, json=body) as resp:
                    if resp.status_code >= 400:
                        txt = await resp.aread()
                        raw_text = txt.decode("utf-8", errors="ignore")[:2000]
                        yield GatewayEvent(
                            event_type="error",
                            provider=provider,
                            payload={
                                "message": f"HTTP {resp.status_code}",
                                "code": f"HTTP_{resp.status_code}",
                                "raw": raw_text,
                            },
                        )
                        return

                    current_event_type = None
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("event: "):
                            current_event_type = line[7:].strip()
                            continue
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if not raw or raw == "[DONE]":
                            continue
                        try:
                            data = json.loads(raw)
                        except Exception:
                            continue

                        event_type = str(data.get("type") or current_event_type or "").strip()
                        response = data.get("response") if isinstance(data.get("response"), dict) else {}
                        provider_request_id = promote_provider_request_id(
                            provider_request_id,
                            data.get("response_id"),
                            provider=provider,
                            prefer=True,
                        )
                        provider_request_id = promote_provider_request_id(
                            provider_request_id,
                            response.get("id"),
                            provider=provider,
                            prefer=True,
                        )

                        top_level_error = data.get("error") if isinstance(data.get("error"), dict) else {}
                        response_error = response.get("error") if isinstance(response.get("error"), dict) else {}
                        if top_level_error or response_error:
                            err = top_level_error or response_error
                            yield GatewayEvent(
                                event_type="error",
                                provider=provider,
                                provider_request_id=provider_request_id,
                                payload={
                                    "message": str(err.get("message") or "Provider stream error"),
                                    "code": str(err.get("code") or "") or None,
                                    "raw": json.dumps(err, ensure_ascii=False)[:2000],
                                },
                            )
                            return

                        if not started_sent:
                            started_sent = True
                            yield GatewayEvent(event_type="message_start", provider=provider, provider_request_id=provider_request_id, payload={})

                        if event_type == "response.output_text.delta":
                            delta = str(data.get("delta") or "")
                            if delta:
                                if first_token_at is None:
                                    first_token_at = int((time.time() - started_at) * 1000)
                                yield GatewayEvent(
                                    event_type="delta_text",
                                    provider=provider,
                                    provider_request_id=provider_request_id,
                                    payload={"text": delta},
                                )
                            continue

                        if event_type.endswith(".delta") and "reasoning" in event_type and "function_call_arguments" not in event_type:
                            delta = str(data.get("delta") or "")
                            if delta:
                                if first_token_at is None:
                                    first_token_at = int((time.time() - started_at) * 1000)
                                yield GatewayEvent(
                                    event_type="delta_reasoning",
                                    provider=provider,
                                    provider_request_id=provider_request_id,
                                    payload={"text": delta},
                                )
                            continue

                        if event_type == "response.output_item.added":
                            item = data.get("item") if isinstance(data.get("item"), dict) else {}
                            if str(item.get("type") or "").strip() == "function_call":
                                item_id = str(item.get("id") or "").strip()
                                if item_id:
                                    function_calls[item_id] = {
                                        "id": item_id,
                                        "call_id": str(item.get("call_id") or "").strip(),
                                        "name": str(item.get("name") or "").strip(),
                                        "arguments": str(item.get("arguments") or ""),
                                        "output_index": data.get("output_index"),
                                    }
                            continue

                        if event_type == "response.function_call_arguments.delta":
                            item_id = str(data.get("item_id") or "").strip()
                            if not item_id:
                                continue
                            call = function_calls.setdefault(item_id, {
                                "id": item_id,
                                "call_id": "",
                                "name": "",
                                "arguments": "",
                                "output_index": data.get("output_index"),
                            })
                            call["arguments"] = f"{call.get('arguments', '')}{str(data.get('delta') or '')}"
                            if data.get("output_index") is not None:
                                call["output_index"] = data.get("output_index")
                            continue

                        if event_type == "response.function_call_arguments.done":
                            item = data.get("item") if isinstance(data.get("item"), dict) else {}
                            item_id = str(item.get("id") or data.get("item_id") or "").strip()
                            if not item_id:
                                continue
                            call = function_calls.setdefault(item_id, {
                                "id": item_id,
                                "call_id": "",
                                "name": "",
                                "arguments": "",
                                "output_index": data.get("output_index"),
                            })
                            call["call_id"] = str(item.get("call_id") or call.get("call_id") or "").strip()
                            call["name"] = str(item.get("name") or call.get("name") or "").strip()
                            call["arguments"] = str(item.get("arguments") or call.get("arguments") or "")
                            if data.get("output_index") is not None:
                                call["output_index"] = data.get("output_index")
                            tool_call_id = call["call_id"] or call["id"]
                            yield GatewayEvent(
                                event_type="tool_call",
                                provider=provider,
                                provider_request_id=provider_request_id,
                                payload={
                                    "tool_calls": [
                                        {
                                            "index": int(call.get("output_index") or 0),
                                            "id": tool_call_id,
                                            "type": "function",
                                            "function": {
                                                "name": call["name"],
                                                "arguments": call["arguments"],
                                            },
                                        },
                                    ],
                                },
                            )
                            continue

                        if event_type == "response.completed":
                            usage = response.get("usage")
                            if usage:
                                yield GatewayEvent(
                                    event_type="usage",
                                    provider=provider,
                                    provider_request_id=provider_request_id,
                                    payload={"usage": usage},
                                )
                            total_ms = int((time.time() - started_at) * 1000)
                            yield GatewayEvent(
                                event_type="latency_metrics",
                                provider=provider,
                                provider_request_id=provider_request_id,
                                payload={"end_to_end_ms": total_ms, "first_token_ms": first_token_at},
                            )
                            yield GatewayEvent(
                                event_type="done",
                                provider=provider,
                                provider_request_id=provider_request_id,
                                payload={"finish_reason": None},
                            )
                            return
                    total_ms = int((time.time() - started_at) * 1000)
                    yield GatewayEvent(
                        event_type="latency_metrics",
                        provider=provider,
                        provider_request_id=provider_request_id,
                        payload={"end_to_end_ms": total_ms, "first_token_ms": first_token_at},
                    )
                    yield GatewayEvent(
                        event_type="done",
                        provider=provider,
                        provider_request_id=provider_request_id,
                        payload={"finish_reason": None},
                    )
                    return
            except Exception as e:
                code, message, retriable = _classify_stream_exception(e)
                if attempt == retries - 1 or not retriable:
                    yield GatewayEvent(
                        event_type="error",
                        provider=provider,
                        payload={
                            "message": message,
                            "code": code,
                        },
                    )
                    return
                await asyncio.sleep(backoff)
                backoff *= 2


async def _stream_xai(req: GenerateRequest, provider: str):
    has_image_input = messages_have_image_content(req.messages)
    if GROK_PREFER_SDK_GATEWAY or has_image_input:
        url = GROK_SERVICE_URL.rstrip("/") + "/v1/chat/completions"
        headers = {"Content-Type": "application/json"}
        if INTERNAL_SERVICE_KEY:
            headers["x-service-key"] = INTERNAL_SERVICE_KEY
    elif XAI_API_KEY:
        url = XAI_API_URL
        headers = {"Authorization": f"Bearer {XAI_API_KEY}", "Content-Type": "application/json"}
    else:
        url = GROK_SERVICE_URL.rstrip("/") + "/v1/chat/completions"
        headers = {"Content-Type": "application/json"}
        if INTERNAL_SERVICE_KEY:
            headers["x-service-key"] = INTERNAL_SERVICE_KEY

    body: dict[str, Any] = {
        "model": req.model,
        "messages": [m.model_dump(exclude_none=True) for m in req.messages],
        "stream": True,
        "stream_options": {"include_usage": True},
        "enable_search": True if req.enable_search is None else bool(req.enable_search),
    }
    if req.tools:
        body["tools"] = req.tools
    if req.tool_context:
        body["tool_context"] = req.tool_context
    if req.tool_policy:
        body["tool_policy"] = req.tool_policy
    if req.tool_config:
        body["tool_config"] = req.tool_config
    if req.previous_response_id:
        body["previous_response_id"] = req.previous_response_id
    async for ev in _stream_sse(provider=provider, url=url, headers=headers, body=body):
        yield ev


async def _stream_sse(provider: str, url: str, headers: dict[str, str], body: dict[str, Any]):
    started_at = time.time()
    first_token_at = None
    started_sent = False
    provider_request_id = None
    last_finish_reason = None

    timeout = _build_stream_timeout()
    async with httpx.AsyncClient(timeout=timeout) as client:
        retries = STREAM_MAX_RETRIES
        backoff = 1
        for attempt in range(retries):
            try:
                async with client.stream("POST", url, headers=headers, json=body) as resp:
                    if resp.status_code >= 400:
                        txt = await resp.aread()
                        raw_text = txt.decode("utf-8", errors="ignore")[:2000]
                        yield GatewayEvent(
                            event_type="error",
                            provider=provider,
                            payload={
                                "message": f"HTTP {resp.status_code}",
                                "code": f"HTTP_{resp.status_code}",
                                "raw": raw_text,
                            },
                        )
                        return

                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if raw == "[DONE]":
                            total_ms = int((time.time() - started_at) * 1000)
                            yield GatewayEvent(event_type="latency_metrics", provider=provider, provider_request_id=provider_request_id, payload={"end_to_end_ms": total_ms, "first_token_ms": first_token_at})
                            yield GatewayEvent(
                                event_type="done",
                                provider=provider,
                                provider_request_id=provider_request_id,
                                payload={"finish_reason": last_finish_reason},
                            )
                            return
                        try:
                            data = json.loads(raw)
                        except Exception:
                            continue

                        provider_request_id = promote_provider_request_id(
                            provider_request_id,
                            data.get("id"),
                            provider=provider,
                            prefer=False,
                        )
                        provider_request_id = promote_provider_request_id(
                            provider_request_id,
                            data.get("response_id"),
                            provider=provider,
                            prefer=True,
                        )

                        top_level_error = data.get("error")
                        if isinstance(top_level_error, dict) and top_level_error:
                            yield GatewayEvent(
                                event_type="error",
                                provider=provider,
                                provider_request_id=provider_request_id,
                                payload={
                                    "message": str(top_level_error.get("message") or "Provider stream error"),
                                    "code": str(top_level_error.get("code") or "") or None,
                                    "raw": json.dumps(top_level_error, ensure_ascii=False)[:2000],
                                },
                            )
                            return

                        if not started_sent:
                            started_sent = True
                            yield GatewayEvent(event_type="message_start", provider=provider, provider_request_id=provider_request_id, payload={})

                        choice = (data.get("choices") or [{}])[0]
                        finish_reason = choice.get("finish_reason")
                        if finish_reason is not None:
                            last_finish_reason = str(finish_reason)
                        choice_error = choice.get("error")
                        if isinstance(choice_error, dict) and choice_error:
                            yield GatewayEvent(
                                event_type="error",
                                provider=provider,
                                provider_request_id=provider_request_id,
                                payload={
                                    "message": str(choice_error.get("message") or "Provider stream error"),
                                    "code": str(choice_error.get("code") or "") or None,
                                    "raw": json.dumps(choice_error, ensure_ascii=False)[:2000],
                                },
                            )
                            return

                        delta = choice.get("delta") or {}

                        txt = _extract_text_delta(data, choice, delta)
                        if txt:
                            if first_token_at is None:
                                first_token_at = int((time.time() - started_at) * 1000)
                            yield GatewayEvent(event_type="delta_text", provider=provider, provider_request_id=provider_request_id, payload={"text": str(txt)})

                        rc = _extract_reasoning_delta(data, choice, delta)
                        if rc:
                            if first_token_at is None:
                                first_token_at = int((time.time() - started_at) * 1000)
                            yield GatewayEvent(event_type="delta_reasoning", provider=provider, provider_request_id=provider_request_id, payload={"text": str(rc)})

                        tool_status = delta.get("tool_status")
                        if tool_status:
                            if first_token_at is None:
                                first_token_at = int((time.time() - started_at) * 1000)
                            yield GatewayEvent(
                                event_type="delta_reasoning",
                                provider=provider,
                                provider_request_id=provider_request_id,
                                payload={"text": str(tool_status)},
                            )

                        tool_batch = data.get("tool_batch")
                        if tool_batch:
                            yield GatewayEvent(
                                event_type="tool_progress",
                                provider=provider,
                                provider_request_id=provider_request_id,
                                payload={
                                    "tool_batch": tool_batch,
                                    "status": str(tool_status) if tool_status else "",
                                },
                            )

                        tool_calls = delta.get("tool_calls")
                        if tool_calls:
                            yield GatewayEvent(event_type="tool_call", provider=provider, provider_request_id=provider_request_id, payload={"tool_calls": tool_calls})

                        client_actions = delta.get("client_actions") or data.get("client_actions")
                        if client_actions:
                            yield GatewayEvent(
                                event_type="client_action",
                                provider=provider,
                                provider_request_id=provider_request_id,
                                payload={"client_actions": client_actions},
                            )

                        usage = data.get("usage")
                        if usage:
                            yield GatewayEvent(event_type="usage", provider=provider, provider_request_id=provider_request_id, payload={"usage": usage})

                        msg = choice.get("message") or {}
                        citations = msg.get("citations")
                        if citations:
                            yield GatewayEvent(event_type="citation", provider=provider, provider_request_id=provider_request_id, payload={"citations": citations})
                        inline_citations = msg.get("inline_citations") or data.get("inline_citations")
                        if inline_citations:
                            yield GatewayEvent(event_type="citation", provider=provider, provider_request_id=provider_request_id, payload={"citations": inline_citations})
                    total_ms = int((time.time() - started_at) * 1000)
                    yield GatewayEvent(event_type="latency_metrics", provider=provider, provider_request_id=provider_request_id, payload={"end_to_end_ms": total_ms, "first_token_ms": first_token_at})
                    yield GatewayEvent(
                        event_type="done",
                        provider=provider,
                        provider_request_id=provider_request_id,
                        payload={"finish_reason": last_finish_reason},
                    )
                    return
            except Exception as e:
                code, message, retriable = _classify_stream_exception(e)
                if attempt == retries - 1 or not retriable:
                    yield GatewayEvent(
                        event_type="error",
                        provider=provider,
                        payload={
                            "message": message,
                            "code": code,
                        },
                    )
                    return
                await asyncio.sleep(backoff)
                backoff *= 2


def _build_stream_timeout() -> httpx.Timeout:
    return httpx.Timeout(
        connect=STREAM_CONNECT_TIMEOUT_SEC,
        read=STREAM_READ_TIMEOUT_SEC,
        write=STREAM_WRITE_TIMEOUT_SEC,
        pool=STREAM_POOL_TIMEOUT_SEC,
    )


def _classify_stream_exception(error: Exception) -> tuple[str | None, str, bool]:
    message = str(error or "").strip()
    lower = message.lower()
    if (
        isinstance(error, httpx.ReadTimeout)
        or isinstance(error, httpx.TimeoutException)
        or lower == "terminated"
        or "readtimeout" in lower
        or "timed out" in lower
        or "timeout" in lower
    ):
        return "UPSTREAM_TIMEOUT", f"Upstream model stream timed out after {int(STREAM_READ_TIMEOUT_SEC)}s", True
    if (
        isinstance(error, httpx.TransportError)
        or "socket" in lower
        or "closed" in lower
        or "connection reset" in lower
        or "econnreset" in lower
        or "network" in lower
    ):
        return "UPSTREAM_CONNECTION_INTERRUPTED", "Upstream model stream was interrupted", True
    return None, message or error.__class__.__name__, False


def is_suspicious_provider_request_id(value: Any, provider: str) -> bool:
    normalized = str(value or "").strip()
    if not normalized:
        return True
    if provider != "xai":
        return False
    return bool(re.fullmatch(r"chatcmpl-?-?\d+", normalized))


def promote_provider_request_id(
    current: str | None,
    candidate: Any,
    *,
    provider: str,
    prefer: bool,
) -> str | None:
    normalized = str(candidate or "").strip()
    if not normalized:
        return current
    if is_suspicious_provider_request_id(normalized, provider):
        return current
    if prefer:
        return normalized
    if not current or is_suspicious_provider_request_id(current, provider):
        return normalized
    return current
