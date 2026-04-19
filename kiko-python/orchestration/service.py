from __future__ import annotations

# CONTEXT MEMORY
# Updated: 2026-04-19
# Author: Rowan
# Reason: orchestration can also receive merged tool deltas with a blank
#         function name even though the argument shape clearly maps to one
#         allowed tool; dropping those calls creates avoidable routing noise,
#         and the service now threads skill-resolution guidance into prompt
#         assembly so Python stays aligned with the model-led tool rollout.
# Goal: keep orchestration rounds stable by repairing empty tool names whenever
#       the allowed tool schema makes the match deterministic and by preserving
#       the same model-led guidance surface as the Node path.
# Owns: orchestration-round assembly, provider event adaptation, and tool-call
#       forwarding inside the Python orchestration service.
# Does Not Own: final chat rendering, provider SDK behavior, or external tool handlers.
# Design Language:
# - tool-call repair should be deterministic and schema-based
# - unresolved empty names must stay visible in logs instead of being guessed
# - orchestration should preserve the same repair behavior as generation SSE
# Document Provenance:
# - Source: production/runtime log showing an empty-name wallet PnL tool call
# - Kind: runtime observation
# - Retrieved: 2026-04-16
# - Applied To: orchestration empty tool-call repair
# - Verification: verified in runtime logs and code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-generation-empty-tool-call-repair.md
# - /Users/almurat/KiKo/system-journal/conflicts.md

import asyncio
from datetime import datetime, timedelta, timezone
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from .llm_client import stream_llm_with_options
from .prompt_assembler import assemble_messages
from .provider_router import resolve_provider
from .schemas import ChatContextSnapshotModel, OrchestrationEvent, ToolResultModel
from .skill_resolver import resolve_skills
from generation.tool_call_repair import infer_tool_name_from_arguments

logger = logging.getLogger(__name__)

def _merge_tool_call_deltas(acc: dict[str, dict[str, Any]], deltas: list[dict[str, Any]]):
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


PROVIDER_MANAGED_NATIVE_TOOLS = {"web_search", "x_search", "code_execution", "collections_search", "mcp"}


def _extract_x_handles(value: Any) -> list[str]:
    seen: set[str] = set()
    found: list[str] = []

    def visit(node: Any):
        if node is None:
            return
        if isinstance(node, str):
            text = node.strip()
            if not text:
                return
            lower = text.lower()
            if "x.com/" in lower or "twitter.com/" in lower:
                parts = [part for part in text.split("/") if part]
                if parts:
                    candidate = parts[-1].split("?")[0].replace("@", "").strip()
                    if candidate and candidate.lower() not in {"status", "i"}:
                        normalized = candidate.lower()
                        if normalized not in seen:
                            seen.add(normalized)
                            found.append(normalized)
                return
            if text.startswith("@") and len(text) > 1 and text[1:].replace("_", "").isalnum():
                normalized = text[1:].lower()
                if normalized not in seen:
                    seen.add(normalized)
                    found.append(normalized)
                return
        if isinstance(node, dict):
            for key, item in node.items():
                key_lower = str(key).lower()
                if key_lower in {"twitter", "twitterusername", "twitter_username", "xhandle", "x_handle", "handle"} and isinstance(item, str):
                    candidate = item.strip().replace("@", "")
                    if candidate and candidate.replace("_", "").isalnum():
                        normalized = candidate.lower()
                        if normalized not in seen:
                            seen.add(normalized)
                            found.append(normalized)
                        continue
                visit(item)
            return
        if isinstance(node, list):
            for item in node:
                visit(item)

    visit(value)
    return found[:5]


def _build_provider_options(snapshot: dict[str, Any], provider_info: dict[str, Any], query: str) -> dict[str, Any]:
    if provider_info.get("provider") != "grok":
        return {
            "metadata": {"session_id": str(snapshot.get("sessionId") or ""), "task_id": str(snapshot.get("taskId") or "")},
            "tool_context": (snapshot.get("runtime") or {}).get("toolContext") or {},
            "enable_search": False,
        }

    lower = query.lower()
    requires_realtime_social_search = any(word in lower for word in [
        "trending", "trend", "latest", "today", "current", "farcaster", "twitter", "x.com", "social", "sentiment", "hot",
    ]) or any(word in query for word in ["趋势", "今天", "现在", "社交", "情绪"])
    tool_policy = {
        "control_plane": "node",
        "native_tools": {
            "enable_search": True,
            "enabled_tools": ["web_search", "x_search"],
            "required": requires_realtime_social_search,
            "preferred_required_tool": "x_search" if requires_realtime_social_search else None,
            "include_options": ["inline_citations"] + (["web_search_call_output", "x_search_call_output"] if requires_realtime_social_search else []),
            "allow_extra_sdk_tools": False,
            "reason": "required_realtime_social_search" if requires_realtime_social_search else "native_search_available",
        },
        "execution": {
            "per_tool_timeout_ms": 20000,
            "total_tool_budget_ms": 45000,
        },
    }
    runtime = (snapshot.get("runtime") or {})
    x_seed_handles = _extract_x_handles([
        runtime.get("farcaster"),
        runtime.get("launchpad"),
        runtime.get("tokenSnapshot"),
        runtime.get("pageContext"),
    ])
    from_date = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
    tool_config = {
        "web_search": {},
        "x_search": {
            "from_date": from_date,
            **({"allowed_x_handles": x_seed_handles} if x_seed_handles else {}),
        },
    }
    return {
        "metadata": {"session_id": str(snapshot.get("sessionId") or ""), "task_id": str(snapshot.get("taskId") or "")},
        "tool_context": runtime.get("toolContext") or {},
        "tool_policy": tool_policy,
        "tool_config": tool_config,
        "previous_response_id": snapshot.get("previousResponseId"),
        "enable_search": True,
    }


@dataclass
class RunState:
    snapshot: ChatContextSnapshotModel
    run_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    events: asyncio.Queue[dict[str, Any]] = field(default_factory=asyncio.Queue)
    tool_results: asyncio.Queue[ToolResultModel] = field(default_factory=asyncio.Queue)
    task: asyncio.Task | None = None


class OrchestrationService:
    def __init__(self):
        self._runs: dict[str, RunState] = {}

    async def start_run(self, snapshot: ChatContextSnapshotModel) -> str:
        state = RunState(snapshot=snapshot)
        state.task = asyncio.create_task(self._run(state))
        state.task.add_done_callback(lambda task, run_id=state.run_id: self._on_run_done(run_id, task))
        self._runs[state.run_id] = state
        return state.run_id

    def get_state(self, run_id: str) -> RunState | None:
        return self._runs.get(run_id)

    async def push_tool_result(self, run_id: str, tool_result: ToolResultModel):
        state = self.get_state(run_id)
        if not state:
            raise KeyError(run_id)
        await state.tool_results.put(tool_result)

    async def stream_events(self, run_id: str):
        state = self.get_state(run_id)
        if not state:
            raise KeyError(run_id)
        while True:
            event = await state.events.get()
            yield event
            if event["type"] in {"message_complete", "error"}:
                self._runs.pop(run_id, None)
                return

    async def _run(self, state: RunState):
        try:
            snapshot = state.snapshot.model_dump()
            provider_info = resolve_provider(snapshot.get("model") or "glm-5")
            trading_intent = None
            skill_resolution = resolve_skills(snapshot, trading_intent)
            logger.info(
                "orchestration.run_start run_id=%s session_id=%s task_id=%s provider=%s model=%s intent=%s skills=%s",
                state.run_id,
                snapshot.get("sessionId"),
                snapshot.get("taskId"),
                provider_info.get("provider"),
                provider_info.get("model"),
                (trading_intent or {}).get("type"),
                skill_resolution.get("selectedSkills"),
            )
            allowed_tool_names = set(skill_resolution["allowedTools"])
            tools = [
                {
                    "type": "function",
                    "function": {
                        "name": item["name"],
                        "description": item["description"],
                        "parameters": item["parameters"],
                    },
                }
                for item in snapshot.get("toolDefinitions") or []
                if item["name"] in allowed_tool_names
            ]
            messages = assemble_messages(snapshot, skill_resolution["skillPrompts"], provider_info, skill_resolution)
            logger.info(
                "orchestration.run_prepared run_id=%s tool_count=%s message_count=%s allowed_tools=%s",
                state.run_id,
                len(tools),
                len(messages),
                sorted(allowed_tool_names),
            )

            for _round in range(8):
                round_index = _round + 1
                tool_deltas: dict[str, dict[str, Any]] = {}
                assistant_text_parts: list[str] = []
                assistant_reasoning_parts: list[str] = []
                latest_provider_request_id: str | None = None
                saw_gateway_event = False
                logger.info("orchestration.round_start run_id=%s round=%s", state.run_id, round_index)
                async for event in stream_llm_with_options(
                    messages=messages,
                    model=str(provider_info["model"]),
                    tools=tools,
                    **_build_provider_options(snapshot, provider_info, str(snapshot.get("lastUserMessage") or "")),
                ):
                    event_type = event.get("event_type")
                    payload = event.get("payload") or {}
                    provider_request_id = event.get("provider_request_id")
                    if provider_request_id:
                        latest_provider_request_id = str(provider_request_id)
                    if not saw_gateway_event:
                        saw_gateway_event = True
                        logger.info(
                            "orchestration.first_gateway_event run_id=%s round=%s type=%s provider_request_id=%s",
                            state.run_id,
                            round_index,
                            event_type,
                            latest_provider_request_id,
                        )
                    if event_type == "delta_text":
                        text = payload.get("text", "")
                        if text:
                            assistant_text_parts.append(str(text))
                        await state.events.put(OrchestrationEvent(type="assistant_delta", payload={"text": text}).model_dump())
                    elif event_type == "delta_reasoning":
                        text = payload.get("text", "")
                        if text:
                            assistant_reasoning_parts.append(str(text))
                        await state.events.put(OrchestrationEvent(type="reasoning_delta", payload={"text": text}).model_dump())
                    elif event_type == "usage":
                        await state.events.put(OrchestrationEvent(type="usage", payload={"usage": payload.get("usage", payload)}).model_dump())
                        if provider_request_id and provider_info.get("supportsPreviousResponse"):
                            await state.events.put(OrchestrationEvent(type="conversation_state", payload={"previous_response_id": provider_request_id}).model_dump())
                    elif event_type == "citation":
                        await state.events.put(OrchestrationEvent(type="citation", payload={"citation": payload.get("citations", payload)}).model_dump())
                    elif event_type == "tool_call":
                        _merge_tool_call_deltas(tool_deltas, payload.get("tool_calls") or [])
                    elif event_type == "error":
                        logger.error(
                            "orchestration.gateway_error run_id=%s round=%s provider_request_id=%s message=%s",
                            state.run_id,
                            round_index,
                            latest_provider_request_id,
                            payload.get("message", "LLM gateway error"),
                        )
                        await state.events.put(OrchestrationEvent(type="error", payload={"message": payload.get("message", "LLM gateway error")}).model_dump())
                        return

                if not tool_deltas:
                    if provider_info.get("supportsPreviousResponse") and latest_provider_request_id:
                        await state.events.put(
                            OrchestrationEvent(type="conversation_state", payload={"previous_response_id": latest_provider_request_id}).model_dump()
                        )
                    logger.info(
                        "orchestration.round_complete run_id=%s round=%s tool_calls=0 text_len=%s reasoning_len=%s",
                        state.run_id,
                        round_index,
                        len("".join(assistant_text_parts)),
                        len("".join(assistant_reasoning_parts)),
                    )
                    await state.events.put(OrchestrationEvent(type="message_complete", payload={}).model_dump())
                    return

                assistant_tool_calls = []
                provider_managed_calls: list[dict[str, Any]] = []
                for merged in tool_deltas.values():
                    arguments = merged["function"]["arguments"] or "{}"
                    try:
                        parsed_arguments = __import__("json").loads(arguments)
                    except Exception:
                        parsed_arguments = {}
                    tool_name = str(merged["function"]["name"] or "").strip()
                    if not tool_name:
                        inferred_name = infer_tool_name_from_arguments(tools, parsed_arguments)
                        if inferred_name:
                            tool_name = inferred_name
                            logger.warning(
                                "orchestration.repaired_empty_tool_call run_id=%s round=%s inferred_name=%s payload=%s",
                                state.run_id,
                                round_index,
                                inferred_name,
                                merged,
                            )
                        else:
                            logger.warning(
                                "orchestration.ignoring_empty_tool_call run_id=%s round=%s payload=%s",
                                state.run_id,
                                round_index,
                                merged,
                            )
                            continue
                    if provider_info.get("provider") == "grok" and tool_name in PROVIDER_MANAGED_NATIVE_TOOLS:
                        provider_managed_calls.append({
                            "id": merged["id"],
                            "type": "function",
                            "function": {"name": tool_name, "arguments": arguments},
                        })
                        continue
                    assistant_tool_calls.append({
                        "id": merged["id"],
                        "type": "function",
                        "function": {"name": tool_name, "arguments": arguments},
                    })
                    await state.events.put(
                        OrchestrationEvent(
                            type="tool_call",
                            payload={
                                "id": merged["id"],
                                "name": tool_name,
                                "arguments": parsed_arguments,
                            },
                        ).model_dump()
                    )

                if provider_managed_calls and not assistant_tool_calls:
                    if provider_info.get("supportsPreviousResponse") and latest_provider_request_id:
                        await state.events.put(
                            OrchestrationEvent(type="conversation_state", payload={"previous_response_id": latest_provider_request_id}).model_dump()
                        )
                    logger.info(
                        "orchestration.round_complete_provider_managed run_id=%s round=%s provider_managed=%s",
                        state.run_id,
                        round_index,
                        [item["function"]["name"] for item in provider_managed_calls],
                    )
                    await state.events.put(OrchestrationEvent(type="message_complete", payload={}).model_dump())
                    return

                assistant_message: dict[str, Any] = {
                    "role": "assistant",
                    "content": "".join(assistant_text_parts),
                    "tool_calls": assistant_tool_calls,
                }
                if assistant_reasoning_parts:
                    assistant_message["reasoning_content"] = "".join(assistant_reasoning_parts)
                messages.append(assistant_message)
                logger.info(
                    "orchestration.round_tool_calls run_id=%s round=%s local_tools=%s provider_managed=%s",
                    state.run_id,
                    round_index,
                    [item["function"]["name"] for item in assistant_tool_calls],
                    [item["function"]["name"] for item in provider_managed_calls],
                )
                for _ in assistant_tool_calls:
                    tool_result = await state.tool_results.get()
                    content = tool_result.result if tool_result.ok else {"error": tool_result.error}
                    logger.info(
                        "orchestration.tool_result_received run_id=%s round=%s tool=%s ok=%s",
                        state.run_id,
                        round_index,
                        tool_result.name,
                        tool_result.ok,
                    )
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_result.id,
                        "content": __import__("json").dumps(content, ensure_ascii=False),
                    })

            logger.error("orchestration.max_rounds_exceeded run_id=%s", state.run_id)
            await state.events.put(OrchestrationEvent(type="error", payload={"message": "Max orchestration rounds exceeded"}).model_dump())
        except Exception as exc:
            logger.exception("orchestration.run_crashed run_id=%s error=%s", state.run_id, exc)
            try:
                await state.events.put(
                    OrchestrationEvent(
                        type="error",
                        payload={"message": f"Orchestration crashed before producing events: {exc}"},
                    ).model_dump()
                )
            except Exception:
                logger.exception("orchestration.run_crashed_failed_to_enqueue_error run_id=%s", state.run_id)

    def _on_run_done(self, run_id: str, task: asyncio.Task):
        if task.cancelled():
            logger.warning("orchestration.run_task_cancelled run_id=%s", run_id)
            return
        exc = task.exception()
        if exc:
            logger.exception("orchestration.run_task_done_with_exception run_id=%s error=%s", run_id, exc)


service = OrchestrationService()
