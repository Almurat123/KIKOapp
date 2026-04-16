from __future__ import annotations

# CONTEXT MEMORY
# Updated: 2026-04-16
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
#         product tuning also showed KiKo does not benefit from provider-default
#         hot temperatures or always-on long reasoning for routine agent turns,
#         so NVIDIA GLM/Kimi defaults now need a colder, lighter profile unless
#         the caller explicitly chooses a reasoning alias. Kimi and Grok
#         social-agent image turns also need provider-specific handling:
#         NVIDIA Kimi can receive OpenAI-style `image_url` content arrays
#         directly, while xAI image turns must be routed through the Grok SDK
#         adapter that converts those arrays to xAI image inputs.
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
#   thinking than provider showcase examples.
# - Removed DeepSeek fallbacks must not silently remain the default provider path.
# - Kimi image arrays may pass through NVIDIA chat/completions unchanged.
# - xAI image turns must use the SDK gateway, not unverified direct chat-completions.
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
# - Source: operator request to make GLM/Kimi faster and less exploratory for
#   routine KiKo tasks
# - Kind: product doc
# - Retrieved: 2026-04-16
# - Applied To: lowering NVIDIA GLM/Kimi default temperatures and disabling GLM
#   thinking for the standard alias
# - Verification: verified in code
# - Source: xAI Image Understanding docs
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: forcing xAI image requests through the SDK gateway where image
#   content is converted to xAI SDK inputs
# - Verification: verified in docs and code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/owner-map/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-kimi-grok-social-image-input.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-lite-defaults.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-glm-preserved-thinking-on-nvidia.md
# - /Users/almurat/KiKo/system-journal/conflicts.md

import asyncio
import json
import os
import re
import time
from typing import AsyncGenerator, Any

import httpx

from grok.message_content import messages_have_image_content

from ..schemas import GatewayEvent, GenerateRequest


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


NVIDIA_KIMI_REASONING_TEMPERATURE = 0.6
NVIDIA_KIMI_INSTANT_TEMPERATURE = 0.4
NVIDIA_GLM_REASONING_TEMPERATURE = 0.6
NVIDIA_GLM_FAST_TEMPERATURE = 0.3


def _resolve_nvidia_request_profile(model: str) -> tuple[str, float | None, dict[str, Any] | None]:
    normalized = _normalized_model(model)
    glm_preserved_thinking = {
        "chat_template_kwargs": {
            "enable_thinking": True,
            "clear_thinking": False,
        }
    }
    glm_fast_thinking = {
        "chat_template_kwargs": {
            "enable_thinking": False,
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
    glm_fast_aliases = {
        "glm-5",
        "glm5",
        "z-ai/glm5",
        "z-ai/glm-5",
    }
    glm_reasoning_aliases = {
        "glm-5-reasoning",
        "glm5-reasoning",
        "z-ai/glm5-reasoning",
        "z-ai/glm-5-reasoning",
    }

    if normalized in kimi_reasoning_aliases:
        return "moonshotai/kimi-k2.5", NVIDIA_KIMI_REASONING_TEMPERATURE, None
    if normalized in kimi_instant_aliases:
        return "moonshotai/kimi-k2.5", NVIDIA_KIMI_INSTANT_TEMPERATURE, {"thinking": {"type": "disabled"}}
    if normalized in glm_fast_aliases:
        return "z-ai/glm5", NVIDIA_GLM_FAST_TEMPERATURE, glm_fast_thinking
    if normalized in glm_reasoning_aliases:
        return "z-ai/glm5", NVIDIA_GLM_REASONING_TEMPERATURE, glm_preserved_thinking
    return model, None, None


def _resolve_nvidia_model(model: str) -> tuple[str, dict[str, Any] | None]:
    resolved_model, _, extra_body = _resolve_nvidia_request_profile(model)
    return resolved_model, extra_body


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
        if part_type in {"reasoning", "thinking"}:
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
        if part_type in {"reasoning", "thinking"}:
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

    body: dict[str, Any] = {
        "model": req.model,
        "messages": [m.model_dump(exclude_none=True) for m in req.messages],
        "stream": True,
        "stream_options": {"include_usage": True},
    }
    # OpenAI chat/completions rejects metadata unless store=true.
    # Keep gateway behavior stable and avoid provider-specific failures.
    if req.tools:
        body["tools"] = req.tools
        body["tool_choice"] = "auto"

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
    if extra_body:
        body["extra_body"] = extra_body

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

    timeout = httpx.Timeout(connect=8, read=70, write=15, pool=8)
    async with httpx.AsyncClient(timeout=timeout) as client:
        retries = 3
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
                if attempt == retries - 1:
                    yield GatewayEvent(event_type="error", provider=provider, payload={"message": str(e)})
                    return
                await asyncio.sleep(backoff)
                backoff *= 2


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
