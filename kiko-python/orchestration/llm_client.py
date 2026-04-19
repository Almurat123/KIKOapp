from __future__ import annotations

import json
import os
from typing import Any, AsyncGenerator

import httpx

from service_config import INTERNAL_SERVICE_KEY, LLM_GATEWAY_URL

# CONTEXT MEMORY
# Updated: 2026-04-18
# Author: Rowan
# Reason: orchestration streams provider output from the internal llm gateway
#         into generation/chat services. Runtime failures showed the default
#         60-second read timeout was too short for slower reasoning turns and
#         could surface raw upstream `terminated` failures even when the model
#         would have completed with a larger read budget.
# Goal: keep orchestration-to-gateway stream timeouts explicit, env-driven, and
#       aligned with the llm gateway's own upstream read budget.
# Owns: internal orchestration client request headers and stream timeout policy
#       for llm gateway calls.
# Does Not Own: provider-specific request shaping, SSE normalization, or chat
#               business policy.
# Design Language:
# - internal stream timeouts must be explicit, not library defaults
# - read timeout should be long enough for reasoning turns and configurable from env
# - this layer forwards llm gateway events faithfully and should not rewrite them
# Document Provenance:
# - Source: /Users/almurat/Downloads/logs.1776446315561.json
# - Kind: runtime observation
# - Retrieved: 2026-04-18
# - Applied To: raising and centralizing the orchestration llm-gateway read timeout
# - Verification: verified in runtime and code
# - Source: NVIDIA NIM model page for z-ai/glm5
# - Kind: official API doc
# - Retrieved: 2026-04-18
# - Applied To: allowing longer hosted-GLM reasoning turns without premature internal timeout
# - Verification: inferred from docs, applied in code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-glm-mode-alignment-and-stream-timeout-hardening.md
# - /Users/almurat/KiKo/system-journal/conflicts.md

LLM_GATEWAY_STREAM_CONNECT_TIMEOUT_SEC = max(1.0, float(os.getenv("LLM_GATEWAY_STREAM_CONNECT_TIMEOUT_SEC", "8")))
LLM_GATEWAY_STREAM_READ_TIMEOUT_SEC = max(30.0, float(os.getenv("LLM_GATEWAY_STREAM_READ_TIMEOUT_SEC", "180")))
LLM_GATEWAY_STREAM_WRITE_TIMEOUT_SEC = max(5.0, float(os.getenv("LLM_GATEWAY_STREAM_WRITE_TIMEOUT_SEC", "20")))
LLM_GATEWAY_STREAM_POOL_TIMEOUT_SEC = max(1.0, float(os.getenv("LLM_GATEWAY_STREAM_POOL_TIMEOUT_SEC", "8")))


def _stream_timeout() -> httpx.Timeout:
    return httpx.Timeout(
        connect=LLM_GATEWAY_STREAM_CONNECT_TIMEOUT_SEC,
        read=LLM_GATEWAY_STREAM_READ_TIMEOUT_SEC,
        write=LLM_GATEWAY_STREAM_WRITE_TIMEOUT_SEC,
        pool=LLM_GATEWAY_STREAM_POOL_TIMEOUT_SEC,
    )


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
    async with httpx.AsyncClient(timeout=_stream_timeout()) as client:
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
    async with httpx.AsyncClient(timeout=_stream_timeout()) as client:
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
