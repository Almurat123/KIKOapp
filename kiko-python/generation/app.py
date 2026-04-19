from __future__ import annotations

# CONTEXT MEMORY
# Updated: 2026-04-18
# Author: Rowan
# Reason: the generation SSE owner has to survive partial provider tool-call
#         deltas where arguments arrive but the function name is blank, because
#         dropping those calls creates noisy false negatives in downstream chat
#         orchestration logs. Runtime failures later showed upstream llm-client
#         exceptions can tear down the SSE stream and leak raw `terminated`
#         transport strings downstream, so this owner now also has to catch
#         upstream timeout/transport failures and convert them into stable
#         generation error events.
# Goal: preserve a clean generation stream contract that can repair strongly
#       identifiable empty-name tool calls before emitting final SSE events.
# Owns: conversion from provider streaming events into generation SSE events.
# Does Not Own: provider routing, tool execution, or chat business policy.
# Design Language:
# - emit provider deltas faithfully unless a deterministic repair is available
# - repair empty tool names only from declared tool schemas and parsed arguments
# - unresolved empty tool calls may be dropped, but only after explicit logging
# - upstream stream failures must become structured SSE error events, not abrupt disconnects
# Document Provenance:
# - Source: production/runtime log showing an empty-name wallet PnL tool call
# - Kind: runtime observation
# - Retrieved: 2026-04-16
# - Applied To: generation empty tool-call repair before SSE emission
# - Verification: verified in runtime logs, code, and targeted tests
# - Source: /Users/almurat/Downloads/logs.1776446315561.json
# - Kind: runtime observation
# - Retrieved: 2026-04-18
# - Applied To: converting upstream timeout/transport failures into structured
#   generation error events instead of raw `terminated`
# - Verification: verified in runtime and code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-generation-empty-tool-call-repair.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-glm-mode-alignment-and-stream-timeout-hardening.md
# - /Users/almurat/KiKo/system-journal/conflicts.md

import json
import logging
from typing import Any

import httpx
from fastapi import Depends, FastAPI
from fastapi.responses import StreamingResponse

from service_auth import require_internal_service
from orchestration.llm_client import stream_llm_with_options
from generation.tool_call_repair import infer_tool_name_from_arguments

from .schemas import GenerationRequest

logger = logging.getLogger(__name__)

app = FastAPI(title="kiko-generation", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "generation"}


@app.post("/internal/v1/stream", dependencies=[Depends(require_internal_service)])
async def stream_generation(body: GenerationRequest):
    logger.info(
        "generation.stream_start session_id=%s task_id=%s model=%s message_count=%s tool_count=%s",
        body.metadata.get("session_id"),
        body.metadata.get("task_id"),
        body.model,
        len(body.messages),
        len(body.tools),
    )

    async def event_stream():
        tool_deltas: dict[str, dict[str, Any]] = {}
        provider_request_id: str | None = None
        finish_reason: str | None = None
        tool_call_signal_sent = False
        try:
            async for event in stream_llm_with_options(
                messages=[item.model_dump(exclude_none=True) for item in body.messages],
                model=body.model,
                tools=body.tools,
                metadata=body.provider_options.get("metadata") or body.metadata,
                tool_context=body.provider_options.get("tool_context"),
                tool_policy=body.provider_options.get("tool_policy"),
                tool_config=body.provider_options.get("tool_config"),
                previous_response_id=body.provider_options.get("previous_response_id"),
                enable_search=body.provider_options.get("enable_search"),
            ):
                event_type = event.get("event_type")
                payload = event.get("payload") or {}
                provider_request_id = str(event.get("provider_request_id") or provider_request_id or "") or provider_request_id

                if event_type == "delta_text":
                    yield encode_event("assistant_delta", {"text": payload.get("text", "")})
                elif event_type == "delta_reasoning":
                    yield encode_event("reasoning_delta", {"text": payload.get("text", "")})
                elif event_type == "usage":
                    logger.info(
                        "generation.usage session_id=%s task_id=%s model=%s usage=%s",
                        body.metadata.get("session_id"),
                        body.metadata.get("task_id"),
                        body.model,
                        payload.get("usage", payload),
                    )
                    yield encode_event("usage", {"usage": payload.get("usage", payload)})
                elif event_type == "citation":
                    yield encode_event("citation", {"citation": payload.get("citations", payload)})
                elif event_type == "tool_call":
                    merge_tool_call_deltas(tool_deltas, payload.get("tool_calls") or [])
                    if not tool_call_signal_sent:
                        tool_call_signal_sent = True
                        yield encode_event("tool_call_signal", {})
                elif event_type == "tool_progress":
                    yield encode_event("tool_progress", {
                        "tool_batch": payload.get("tool_batch") or {},
                        "status": payload.get("status") or "",
                    })
                elif event_type == "client_action":
                    yield encode_event("client_action", {
                        "client_actions": payload.get("client_actions") or [],
                    })
                elif event_type == "error":
                    raw_detail = payload.get("raw")
                    request_tail = payload.get("request_tail")
                    error_code = payload.get("code")
                    request_tail_size = len(request_tail) if isinstance(request_tail, list) else 0
                    logger.error(
                        "generation.gateway_error session_id=%s task_id=%s model=%s provider_request_id=%s code=%s message=%s raw_len=%s request_tail_size=%s",
                        body.metadata.get("session_id"),
                        body.metadata.get("task_id"),
                        body.model,
                        provider_request_id,
                        error_code,
                        payload.get("message", "LLM gateway error"),
                        len(str(raw_detail or "")),
                        request_tail_size,
                    )
                    yield encode_event("error", {
                        "message": payload.get("message", "LLM gateway error"),
                        "code": error_code,
                    })
                    return
                elif event_type == "done":
                    raw_finish_reason = payload.get("finish_reason")
                    finish_reason = str(raw_finish_reason) if raw_finish_reason not in (None, "") else None
                    if provider_request_id:
                        yield encode_event(
                            "provider_state",
                            {
                                "previous_response_id": provider_request_id,
                                "finish_reason": finish_reason,
                            },
                        )
                    elif finish_reason:
                        yield encode_event("provider_state", {"finish_reason": finish_reason})
                    salvage_tool_call_arguments(tool_deltas)
                    for tool_call in tool_deltas.values():
                        arguments = ((tool_call.get("function") or {}).get("arguments")) or "{}"
                        try:
                            parsed_arguments = json.loads(arguments)
                        except Exception:
                            parsed_arguments = {}
                        tool_name = str(((tool_call.get("function") or {}).get("name")) or "").strip()
                        if not tool_name:
                            inferred_name = infer_tool_name_from_arguments(body.tools, parsed_arguments)
                            if inferred_name:
                                tool_name = inferred_name
                                logger.warning(
                                    "generation.repaired_empty_tool_call session_id=%s task_id=%s inferred_name=%s payload=%s",
                                    body.metadata.get("session_id"),
                                    body.metadata.get("task_id"),
                                    inferred_name,
                                    tool_call,
                                )
                            else:
                                logger.warning(
                                    "generation.ignoring_empty_tool_call session_id=%s task_id=%s payload=%s",
                                    body.metadata.get("session_id"),
                                    body.metadata.get("task_id"),
                                    tool_call,
                                )
                                continue
                        yield encode_event("tool_call", {
                            "id": str(tool_call.get("id") or ""),
                            "name": tool_name,
                            "arguments": parsed_arguments,
                        })
                    yield encode_event("message_complete", {})
                    return
                elif event_type == "latency_metrics":
                    yield encode_event("latency_metrics", payload)
        except Exception as exc:
            error_code, error_message = classify_generation_stream_exception(exc)
            logger.exception(
                "generation.upstream_stream_failure session_id=%s task_id=%s model=%s code=%s message=%s",
                body.metadata.get("session_id"),
                body.metadata.get("task_id"),
                body.model,
                error_code,
                error_message,
            )
            yield encode_event("error", {
                "message": error_message,
                "code": error_code,
            })
            return

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def classify_generation_stream_exception(exc: Exception) -> tuple[str, str]:
    message = str(exc or "").strip()
    lower = message.lower()
    if (
        isinstance(exc, httpx.ReadTimeout)
        or isinstance(exc, httpx.TimeoutException)
        or lower == "terminated"
        or "readtimeout" in lower
        or "timed out" in lower
        or "timeout" in lower
    ):
        return "UPSTREAM_TIMEOUT", "Upstream model stream timed out before completion"
    if (
        isinstance(exc, httpx.TransportError)
        or "socket" in lower
        or "closed" in lower
        or "connection reset" in lower
        or "econnreset" in lower
        or "network" in lower
    ):
        return "UPSTREAM_CONNECTION_INTERRUPTED", "Upstream model stream was interrupted"
    return "GENERATION_STREAM_ERROR", message or exc.__class__.__name__


def merge_tool_call_deltas(acc: dict[str, dict[str, Any]], deltas: list[dict[str, Any]]):
    for i, tc in enumerate(deltas):
        idx = tc.get("index")
        key = str(tc.get("id") or (f"idx:{idx}" if idx is not None else f"idx:{i}"))
        current = acc.get(key)
        if not current:
            current = {"id": tc.get("id") or key, "function": {"name": "", "arguments": ""}}
            acc[key] = current
        fn = tc.get("function") or {}
        name = fn.get("name")
        if isinstance(name, str) and name:
            current["function"]["name"] = name
        args = fn.get("arguments")
        if isinstance(args, str) and args:
            existing = current["function"]["arguments"]
            if not existing:
                current["function"]["arguments"] = args
            elif args.startswith(existing):
                current["function"]["arguments"] = args
            elif not existing.endswith(args):
                current["function"]["arguments"] += args


def salvage_tool_call_arguments(acc: dict[str, dict[str, Any]]):
    named_calls: list[dict[str, Any]] = []
    arg_only_calls: list[dict[str, Any]] = []

    for call in acc.values():
        function = call.get("function") or {}
        name = str(function.get("name") or "").strip()
        arguments = str(function.get("arguments") or "").strip()
        if name:
            named_calls.append(call)
        elif arguments:
            arg_only_calls.append(call)

    if not named_calls or not arg_only_calls:
        return

    for named in named_calls:
        fn = named.setdefault("function", {})
        current_arguments = str(fn.get("arguments") or "").strip()
        if current_arguments and current_arguments not in ("{}", "null"):
            continue

        for arg_only in list(arg_only_calls):
            candidate = str((arg_only.get("function") or {}).get("arguments") or "").strip()
            if not candidate or candidate in ("{}", "null"):
                continue
            fn["arguments"] = candidate
            arg_only_calls.remove(arg_only)
            break


def encode_event(event_type: str, payload: dict[str, Any]) -> str:
    return f"data: {json.dumps({'type': event_type, 'payload': payload}, ensure_ascii=False)}\n\n"
