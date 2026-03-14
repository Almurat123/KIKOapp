from __future__ import annotations

import asyncio
import json
import os
import time
from typing import AsyncGenerator, Any

import httpx

from ..schemas import GatewayEvent, GenerateRequest


OPENAI_API_URL = os.getenv("OPENAI_API_URL", "https://api.openai.com/v1/chat/completions")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
GROK_SERVICE_URL = os.getenv("GROK_SERVICE_URL", "http://localhost:8000/grok")
XAI_API_URL = os.getenv("XAI_API_URL", "https://api.x.ai/v1/chat/completions")
GROK_PREFER_SDK_GATEWAY = os.getenv("GROK_PREFER_SDK_GATEWAY", "true").lower() not in {"0", "false", "no"}

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")
XAI_API_KEY = os.getenv("XAI_API_KEY", "")


def resolve_provider(model: str) -> str:
    m = (model or "").lower()
    if m.startswith("gpt") or m.startswith("o"):
        return "openai"
    if "grok" in m:
        return "xai"
    return "deepseek"


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
    elif provider == "deepseek":
        async for ev in _stream_deepseek(req, provider):
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


async def _stream_deepseek(req: GenerateRequest, provider: str):
    if not DEEPSEEK_API_KEY:
        yield GatewayEvent(event_type="error", provider="deepseek", payload={"message": "DEEPSEEK_API_KEY missing"})
        return

    body: dict[str, Any] = {
        "model": req.model,
        "messages": [m.model_dump(exclude_none=True) for m in req.messages],
        "stream": True,
    }
    if req.tools:
        body["tools"] = req.tools
        body["tool_choice"] = "auto"

    async for ev in _stream_sse(
        provider=provider,
        url=DEEPSEEK_API_URL,
        headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
        body=body,
    ):
        yield ev


async def _stream_xai(req: GenerateRequest, provider: str):
    if GROK_PREFER_SDK_GATEWAY:
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
                            yield GatewayEvent(event_type="done", provider=provider, provider_request_id=provider_request_id, payload={})
                            return
                        try:
                            data = json.loads(raw)
                        except Exception:
                            continue

                        if data.get("id") and provider_request_id is None:
                            provider_request_id = str(data.get("id"))
                        if data.get("response_id") and provider_request_id is None:
                            provider_request_id = str(data.get("response_id"))

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

                        txt = delta.get("content")
                        if txt:
                            if first_token_at is None:
                                first_token_at = int((time.time() - started_at) * 1000)
                            yield GatewayEvent(event_type="delta_text", provider=provider, provider_request_id=provider_request_id, payload={"text": str(txt)})

                        rc = delta.get("reasoning_content")
                        if rc:
                            if first_token_at is None:
                                first_token_at = int((time.time() - started_at) * 1000)
                            yield GatewayEvent(event_type="delta_reasoning", provider=provider, provider_request_id=provider_request_id, payload={"text": str(rc)})

                        tool_calls = delta.get("tool_calls")
                        if tool_calls:
                            yield GatewayEvent(event_type="tool_call", provider=provider, provider_request_id=provider_request_id, payload={"tool_calls": tool_calls})

                        usage = data.get("usage")
                        if usage:
                            yield GatewayEvent(event_type="usage", provider=provider, provider_request_id=provider_request_id, payload={"usage": usage})

                        msg = choice.get("message") or {}
                        citations = msg.get("citations")
                        if citations:
                            yield GatewayEvent(event_type="citation", provider=provider, provider_request_id=provider_request_id, payload={"citations": citations})
                    total_ms = int((time.time() - started_at) * 1000)
                    yield GatewayEvent(event_type="latency_metrics", provider=provider, provider_request_id=provider_request_id, payload={"end_to_end_ms": total_ms, "first_token_ms": first_token_at})
                    yield GatewayEvent(event_type="done", provider=provider, provider_request_id=provider_request_id, payload={})
                    return
            except Exception as e:
                if attempt == retries - 1:
                    yield GatewayEvent(event_type="error", provider=provider, payload={"message": str(e)})
                    return
                await asyncio.sleep(backoff)
                backoff *= 2
