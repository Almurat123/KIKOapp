from __future__ import annotations

import json
from typing import Any, AsyncGenerator

import httpx

from service_config import INTERNAL_SERVICE_KEY, LLM_GATEWAY_URL


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if INTERNAL_SERVICE_KEY:
        headers["X-Service-Key"] = INTERNAL_SERVICE_KEY
        headers["X-Internal-Service-Key"] = INTERNAL_SERVICE_KEY
    return headers


async def stream_llm(messages: list[dict[str, Any]], model: str, tools: list[dict[str, Any]]) -> AsyncGenerator[dict[str, Any], None]:
    body = {
        "model": model,
        "messages": messages,
        "stream": True,
        "tools": tools,
    }
    request_options = {}
    if len(messages) > 0 and isinstance(messages[0], dict):
        request_options = {}
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
        async with client.stream("POST", f"{LLM_GATEWAY_URL.rstrip('/')}/internal/v1/generate", headers=_headers(), json=body) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if not raw or raw == "[DONE]":
                    continue
                try:
                    yield json.loads(raw)
                except Exception:
                    continue


async def stream_llm_with_options(
    *,
    messages: list[dict[str, Any]],
    model: str,
    tools: list[dict[str, Any]],
    metadata: dict[str, Any] | None = None,
    tool_context: dict[str, Any] | None = None,
    tool_policy: dict[str, Any] | None = None,
    tool_config: dict[str, Any] | None = None,
    previous_response_id: str | None = None,
    enable_search: bool | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": True,
        "tools": tools,
    }
    if metadata:
        body["metadata"] = metadata
    if tool_context:
        body["tool_context"] = tool_context
    if tool_policy:
        body["tool_policy"] = tool_policy
    if tool_config:
        body["tool_config"] = tool_config
    if previous_response_id:
        body["previous_response_id"] = previous_response_id
    if enable_search is not None:
        body["enable_search"] = enable_search
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
        async with client.stream("POST", f"{LLM_GATEWAY_URL.rstrip('/')}/internal/v1/generate", headers=_headers(), json=body) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if not raw or raw == "[DONE]":
                    continue
                try:
                    yield json.loads(raw)
                except Exception:
                    continue
