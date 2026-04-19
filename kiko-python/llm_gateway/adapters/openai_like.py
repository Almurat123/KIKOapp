from __future__ import annotations

# CONTEXT MEMORY
# Updated: 2026-04-20
# Author: Rowan
# Reason: KiKo is removing the old DeepSeek gateway path and replacing it with
#         NVIDIA-hosted Kimi and GLM models while keeping the existing internal
#         streaming contract (`delta_text`, `delta_reasoning`, tool deltas,
#         usage, citations) stable for downstream orchestration. NVIDIA's
#         official hosted Kimi API requires different model ids and instant-mode
#         parameters than the self-hosted vLLM examples, and GLM reasoning can
#         arrive through more than one response field shape. A later regression
#         also showed that generic `content` strings must never be promoted into
#         the reasoning channel, or assistant text gets duplicated into both
#         visible output surfaces. Runtime inspection also showed that GLM
#         welcome/meta turns were returning plain assistant text without any
#         preserved reasoning trace, so the gateway now has to request
#         preserved thinking explicitly for NVIDIA-hosted GLM aliases. Later
#         official NVIDIA doc verification showed the hosted GLM-5 page only
#         documents thinking-mode support, not a Fast/Instant product mode, so
#         the synthetic GLM Fast path has to be removed while older
#         `glm-5-reasoning` aliases continue normalizing to the same canonical
#         preserved-thinking request. Runtime failures also showed upstream
#         stream read timeouts can collapse into raw `terminated` errors, so the
#         gateway now has to classify timeout/transport failures into stable
#         error codes instead of leaking provider transport strings downstream.
#         Kimi and Grok
#         social-agent image turns also need provider-specific handling:
#         NVIDIA Kimi can receive OpenAI-style `image_url` content arrays
#         directly, while xAI image turns must be routed through the Grok SDK
#         adapter that converts those arrays to xAI image inputs. OpenAI chat
#         completions now also needs an explicit `reasoning_effort` when KiKo
#         passes GPT-5-family effort hints through the shared tool context. A
#         live GLM-5 regression showed no `reasoning_delta` reached Node because
#         the raw HTTP gateway serialized SDK-only `extra_body` as a nested JSON
#         field; NVIDIA expects those provider-specific options in the actual
#         request body when KiKo is not using the OpenAI SDK. OpenAI 400
#         incidents now also need provider-side request-shape diagnostics so
#         local and production logs can identify rejected request fields without
#         changing model-led intent or tool exposure policy. The raw OpenAI
#         error later proved GPT-5.4 chat/completions rejects function tools
#         when `reasoning_effort` is present, so this adapter must omit that
#         unsupported parameter combination while preserving the existing full
#         tool catalog.
# Goal: normalize NVIDIA Kimi/GLM requests and reasoning deltas into the same
#       gateway event protocol already consumed by KiKo's Node/Python runtimes.
# Owns: provider-family resolution, provider request shaping, SSE normalization,
#       and provider request-id promotion inside the Python llm gateway.
# Does Not Own: orchestration policy, model allowlists, or UI-facing model names.
# Design Language:
# - The gateway must normalize provider differences at the edge.
# - Kimi Reasoning/Instant are aliases over one NVIDIA model plus request flags.
# - GLM/Kimi reasoning deltas must reuse the existing `delta_reasoning` event.
# - Generic assistant content must never be mirrored into the reasoning channel.
# - Official NVIDIA-hosted API conventions take precedence over self-hosted examples.
# - GLM preserved thinking should be requested explicitly instead of relying on
#   hosted-runtime defaults.
# - Everyday agent defaults should prefer colder temperatures and lighter
#   thinking than provider showcase examples where the docs define such modes.
# - OpenAI reasoning effort must be forwarded from shared tool context instead
#   of being guessed from the selected model string.
# - Removed DeepSeek fallbacks must not silently remain the default provider path.
# - Kimi image arrays may pass through NVIDIA chat/completions unchanged.
# - xAI image turns must use the SDK gateway, not unverified direct chat-completions.
# - Upstream timeout and transport failures must surface stable codes, not raw
#   `terminated` strings.
# - SDK-only `extra_body` wrappers must be flattened before direct HTTP calls.
# - OpenAI diagnostics may log request keys and tool schema summaries, but must
#   not log prompt text, image URLs, secrets, or full tool schemas.
# - GPT-5.4 chat/completions with function tools must not include
#   `reasoning_effort`; Responses API is the future path for tool+reasoning.
# Document Provenance:
# - Source: NVIDIA NIM model pages for moonshotai/kimi-k2-5 and z-ai/glm5
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: NVIDIA request routing and Kimi/GLM reasoning normalization
# - Verification: verified in code
# - Source: /Users/almurat/KiKo/test.txt
# - Kind: runtime observation
# - Retrieved: 2026-04-16
# - Applied To: preventing assistant text from being duplicated into reasoning deltas
# - Verification: verified in code
# - Source: NVIDIA GLM-4.7 model reference and Z.AI GLM-5 API guide
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: enabling preserved thinking for NVIDIA-hosted GLM requests
# - Verification: verified in docs, applied in code
# - Source: NVIDIA NIM moonshotai/kimi-k2.5 inference docs
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: forwarding structured Kimi `image_url` message content through
#   the NVIDIA chat/completions request body
# - Verification: verified in docs and code
# - Source: operator request to make Kimi faster and less exploratory for
#   routine KiKo instant tasks
# - Kind: product doc
# - Retrieved: 2026-04-16
# - Applied To: lowering Kimi instant temperature while preserving GLM thinking
#   for the canonical hosted GLM alias
# - Verification: verified in code
# - Source: xAI Image Understanding docs
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: forcing xAI image requests through the SDK gateway where image
#   content is converted to xAI SDK inputs
# - Verification: verified in docs and code
# - Source: NVIDIA NIM model page for z-ai/glm5
# - Kind: official API doc
# - Retrieved: 2026-04-18
# - Applied To: removing the synthetic GLM Fast alias and collapsing legacy GLM
#   reasoning aliases into one preserved-thinking profile
# - Verification: verified in docs and code
# - Source: /Users/almurat/Downloads/logs.1776446315561.json
# - Kind: runtime observation
# - Retrieved: 2026-04-18
# - Applied To: classifying upstream stream timeout failures so downstream users
#   no longer see raw `terminated`
# - Verification: verified in runtime and code
# - Source: /Users/almurat/KiKo/test.txt
# - Kind: runtime observation
# - Retrieved: 2026-04-18
# - Applied To: flattening NVIDIA `extra_body` SDK options into direct HTTP body
#   fields so GLM/Kimi reasoning-mode controls can take effect
# - Verification: verified in code and targeted tests
# - Source: NVIDIA NIM reasoning model docs and moonshotai/kimi-k2.5 model page
# - Kind: official API doc
# - Retrieved: 2026-04-18
# - Applied To: distinguishing SDK `extra_body` examples from raw HTTP body
#   shaping for `chat_template_kwargs` and Kimi `thinking` controls
# - Verification: verified in docs and targeted tests
# - Source: /Users/almurat/Downloads/logs.1776615188393.json
# - Kind: runtime observation
# - Retrieved: 2026-04-20
# - Applied To: adding OpenAI request-shape diagnostics for HTTP 400s that
#   previously logged only provider status and raw body length downstream
# - Verification: verified from existing runtime logs and local request-shape tests
# - Source: OpenAI Chat Completions API reference and GPT-5.4 latest-model guide
# - Kind: official API doc
# - Retrieved: 2026-04-20
# - Applied To: logging tool schema and reasoning parameter shape instead of
#   changing KiKo tool exposure policy
# - Verification: verified in docs, applied in code
# - Source: /Users/almurat/KiKo/test.txt
# - Kind: runtime observation
# - Retrieved: 2026-04-20
# - Applied To: omitting `reasoning_effort` for GPT-5.4 chat/completions
#   requests that include function tools
# - Verification: verified from raw OpenAI error excerpt and local unit tests
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-openai-400-request-shape-diagnostics.md
# - /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/owner-map/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-kimi-grok-social-image-input.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-glm-preserved-thinking-on-nvidia.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-glm-mode-alignment-and-stream-timeout-hardening.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-nvidia-extra-body-flattening.md
# - /Users/almurat/KiKo/system-journal/conflicts.md

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
NVIDIA_API_URL = os.getenv("NVIDIA_API_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
GROK_SERVICE_URL = os.getenv("GROK_SERVICE_URL", "http://localhost:8000/grok")
XAI_API_URL = os.getenv("XAI_API_URL", "https://api.x.ai/v1/chat/completions")
GROK_PREFER_SDK_GATEWAY = os.getenv("GROK_PREFER_SDK_GATEWAY", "true").lower() not in {"0", "false", "no"}

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")
XAI_API_KEY = os.getenv("XAI_API_KEY", "")


def _normalized_model(model: str) -> str:
    return str(model or "").strip().lower()


OPENAI_REASONING_EFFORTS = {"none", "minimal", "low", "medium", "high", "xhigh"}
OPENAI_TOOL_DESCRIPTION_WARN_LIMIT = 1024
OPENAI_TOOL_LOG_SAMPLE_LIMIT = 12
NVIDIA_KIMI_REASONING_TEMPERATURE = 0.6
NVIDIA_KIMI_INSTANT_TEMPERATURE = 0.4
NVIDIA_GLM_TEMPERATURE = 0.6
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
        body["tool_choice"] = "auto"
    return body, reasoning_effort if omit_reasoning_effort else None


def _summarize_openai_request_shape(body: dict[str, Any]) -> dict[str, Any]:
    tools = body.get("tools") if isinstance(body.get("tools"), list) else []
    invalid_names: list[dict[str, Any]] = []
    long_descriptions: list[dict[str, Any]] = []
    non_object_parameters: list[dict[str, Any]] = []
    total_tool_schema_bytes = 0
    first_tool_names: list[str] = []

    for index, tool in enumerate(tools):
        if not isinstance(tool, dict):
            continue
        function = tool.get("function")
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
        "message_count": len(body.get("messages") or []),
        "tool_count": len(tools),
        "first_tool_names": first_tool_names,
        "reasoning_effort": body.get("reasoning_effort"),
        "has_reasoning_object": isinstance(body.get("reasoning"), dict),
        "stream": body.get("stream"),
        "stream_options_keys": sorted((body.get("stream_options") or {}).keys()) if isinstance(body.get("stream_options"), dict) else [],
        "total_tool_schema_bytes": total_tool_schema_bytes,
        "invalid_tool_names": invalid_names[:OPENAI_TOOL_LOG_SAMPLE_LIMIT],
        "invalid_tool_name_count": len(invalid_names),
        "long_tool_descriptions": long_descriptions[:OPENAI_TOOL_LOG_SAMPLE_LIMIT],
        "long_tool_description_count": len(long_descriptions),
        "non_object_tool_parameters": non_object_parameters[:OPENAI_TOOL_LOG_SAMPLE_LIMIT],
        "non_object_tool_parameter_count": len(non_object_parameters),
    }


def _resolve_nvidia_request_profile(model: str) -> tuple[str, float | None, dict[str, Any] | None]:
    normalized = _normalized_model(model)
    glm_preserved_thinking = {
        "chat_template_kwargs": {
            "enable_thinking": True,
            "clear_thinking": False,
        }
    }

    kimi_reasoning_aliases = {
        "kimi-k2-5",
        "kimi-k2-5-reasoning",
        "kimi-k2-5-thinking",
        "kimi-k2.5",
        "kimi-k2.5-reasoning",
        "kimi-k2.5-thinking",
        "moonshotai/kimi-k2-5",
        "moonshotai/kimi-k2.5",
        "moonshotai/kimi-k2-5-reasoning",
        "moonshotai/kimi-k2.5-reasoning",
        "moonshotai/kimi-k2-5-thinking",
        "moonshotai/kimi-k2.5-thinking",
    }
    kimi_instant_aliases = {
        "kimi-k2-5-fast",
        "kimi-k2-5-instant",
        "kimi-k2.5-fast",
        "kimi-k2.5-instant",
        "moonshotai/kimi-k2-5-fast",
        "moonshotai/kimi-k2-5-instant",
        "moonshotai/kimi-k2.5-fast",
        "moonshotai/kimi-k2.5-instant",
    }
    glm_aliases = {
        "glm-5",
        "glm5",
        "z-ai/glm5",
        "z-ai/glm-5",
        "glm-5-reasoning",
        "glm5-reasoning",
        "z-ai/glm5-reasoning",
        "z-ai/glm-5-reasoning",
    }

    if normalized in kimi_reasoning_aliases:
        return "moonshotai/kimi-k2.5", NVIDIA_KIMI_REASONING_TEMPERATURE, None
    if normalized in kimi_instant_aliases:
        return "moonshotai/kimi-k2.5", NVIDIA_KIMI_INSTANT_TEMPERATURE, {"thinking": {"type": "disabled"}}
    if normalized in glm_aliases:
        return "z-ai/glm5", NVIDIA_GLM_TEMPERATURE, glm_preserved_thinking
    return model, None, None


def _resolve_nvidia_model(model: str) -> tuple[str, dict[str, Any] | None]:
    resolved_model, _, extra_body = _resolve_nvidia_request_profile(model)
    return resolved_model, extra_body


def _merge_extra_body_into_request_body(body: dict[str, Any], extra_body: dict[str, Any] | None) -> None:
    if not extra_body:
        return
    body.update(extra_body)


def _build_nvidia_request_body(req: GenerateRequest) -> dict[str, Any]:
    resolved_model, resolved_temperature, extra_body = _resolve_nvidia_request_profile(req.model)
    body: dict[str, Any] = {
        "model": resolved_model,
        "messages": [m.model_dump(exclude_none=True) for m in req.messages],
        "stream": True,
    }
    if resolved_temperature is not None:
        body["temperature"] = resolved_temperature
    if req.tools:
        body["tools"] = req.tools
        body["tool_choice"] = "auto"
    _merge_extra_body_into_request_body(body, extra_body)
    return body


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
    if m.startswith("gpt") or m.startswith("o"):
        return "openai"
    if "grok" in m:
        return "xai"
    return "nvidia"


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
    elif provider == "nvidia":
        async for ev in _stream_nvidia(req, provider):
            yield ev
    else:
        async for ev in _stream_xai(req, provider):
            yield ev


async def _stream_openai(req: GenerateRequest, provider: str):
    if not OPENAI_API_KEY:
        yield GatewayEvent(event_type="error", provider="openai", payload={"message": "OPENAI_API_KEY missing"})
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
    logger.info("llm_gateway.openai_request_shape %s", request_shape)
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


async def _stream_nvidia(req: GenerateRequest, provider: str):
    if not NVIDIA_API_KEY:
        yield GatewayEvent(event_type="error", provider="nvidia", payload={"message": "NVIDIA_API_KEY missing"})
        return

    body = _build_nvidia_request_body(req)

    async for ev in _stream_sse(
        provider=provider,
        url=NVIDIA_API_URL,
        headers={"Authorization": f"Bearer {NVIDIA_API_KEY}", "Content-Type": "application/json"},
        body=body,
    ):
        yield ev


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
