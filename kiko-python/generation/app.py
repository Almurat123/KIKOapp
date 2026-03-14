from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import Depends, FastAPI
from fastapi.responses import StreamingResponse

from service_auth import require_internal_service
from orchestration.llm_client import stream_llm_with_options

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
        tool_call_signal_sent = False
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
                if provider_request_id:
                    yield encode_event("provider_state", {"previous_response_id": provider_request_id})
                salvage_tool_call_arguments(tool_deltas)
                for tool_call in tool_deltas.values():
                    tool_name = str(((tool_call.get("function") or {}).get("name")) or "").strip()
                    if not tool_name:
                        logger.warning(
                            "generation.ignoring_empty_tool_call session_id=%s task_id=%s payload=%s",
                            body.metadata.get("session_id"),
                            body.metadata.get("task_id"),
                            tool_call,
                        )
                        continue
                    arguments = ((tool_call.get("function") or {}).get("arguments")) or "{}"
                    try:
                        parsed_arguments = json.loads(arguments)
                    except Exception:
                        parsed_arguments = {}
                    yield encode_event("tool_call", {
                        "id": str(tool_call.get("id") or ""),
                        "name": tool_name,
                        "arguments": parsed_arguments,
                    })
                yield encode_event("message_complete", {})
                return

    return StreamingResponse(event_stream(), media_type="text/event-stream")


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
