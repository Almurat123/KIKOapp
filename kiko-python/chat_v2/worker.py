from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from . import repository as repo
from .context_budget import context_budget_manager
from .db import SessionLocal
from .intent import parse_intent
from .prompt_orchestrator import prompt_orchestrator, skill_prompt_registry
from .settings import settings
from .ws import ws_manager


@dataclass
class TaskPayload:
    task_id: str
    user_id: str


class ChatWorker:
    def __init__(self, redis: Redis):
        self.redis = redis
        self._running = False
        self.logger = logging.getLogger(__name__)
        self.max_tool_calls = max(1, settings.MAX_TOOL_CALLS)
        self.max_tool_calls_per_tool = max(1, settings.MAX_TOOL_CALLS_PER_TOOL)
        self.max_concurrent_tasks = max(1, settings.MAX_CONCURRENT_TASKS)
        self._sem = asyncio.Semaphore(self.max_concurrent_tasks)
        self._running_tasks: set[str] = set()

    async def start(self):
        self._running = True
        while self._running:
            try:
                item = await self.redis.blpop(settings.TASK_QUEUE_KEY, timeout=1)
                if not item:
                    continue
                _, raw = item
                data = json.loads(raw)
                payload = TaskPayload(task_id=data["task_id"], user_id=data["user_id"])
                if payload.task_id in self._running_tasks:
                    continue
                self._running_tasks.add(payload.task_id)
                asyncio.create_task(self._process_with_limit(payload))
            except Exception as e:
                self.logger.exception("ChatWorker loop error: %s", e)

    async def stop(self):
        self._running = False

    async def _process_with_limit(self, payload: TaskPayload):
        async with self._sem:
            try:
                await self.process(payload)
            finally:
                self._running_tasks.discard(payload.task_id)

    async def enqueue(self, task_id: str, user_id: str):
        await self.redis.rpush(settings.TASK_QUEUE_KEY, json.dumps({"task_id": task_id, "user_id": user_id}))

    async def process(self, payload: TaskPayload):
        async with SessionLocal() as db:
            task = await repo.get_task(db, payload.task_id)
            if not task or task.status == "cancelled":
                return
            task_type = "card" if ((task.tool_context or {}).get("allowanceMode") == "instant" or ((task.tool_context or {}).get("toolConfig") or {}).get("fastSwapMode")) else "text"
            await repo.set_task_status(db, task, "running")
            await ws_manager.broadcast_event(
                payload.user_id,
                "status",
                task.session_id,
                task.assistant_message_id,
                {"status": "running", "message": "Thinking", "task_id": task.id, "taskId": task.id, "taskType": task_type},
            )
        await self._run_llm(payload)

    async def _fetch_tool_definitions(self, client: httpx.AsyncClient, headers: dict[str, str]) -> list[dict[str, Any]]:
        try:
            resp = await client.get(
                settings.TOOL_RUNTIME_URL.rstrip("/") + "/internal/v1/tool/definitions",
                headers=headers,
                timeout=15,
            )
            if resp.status_code >= 400:
                self.logger.warning("tool definitions fetch failed: %s %s", resp.status_code, resp.text[:300])
                return []
            data = resp.json()
            return list(data.get("tools", []) or [])
        except Exception as e:
            self.logger.warning("tool definitions fetch error: %s", e)
            return []

    def _merge_tool_call_deltas(self, acc: dict[str, dict[str, Any]], deltas: list[dict[str, Any]]):
        for tc in deltas:
            key = str(tc.get("id") or f"idx:{tc.get('index', len(acc))}")
            cur = acc.get(key)
            if not cur:
                cur = {
                    "id": tc.get("id") or key,
                    "type": tc.get("type") or "function",
                    "function": {"name": "", "arguments": ""},
                }
                acc[key] = cur
            fn = tc.get("function") or {}
            name = fn.get("name")
            if isinstance(name, str) and name:
                if not cur["function"]["name"]:
                    cur["function"]["name"] = name
                elif cur["function"]["name"] != name:
                    cur["function"]["name"] = name
            args = fn.get("arguments")
            if isinstance(args, str) and args:
                cur["function"]["arguments"] += args

    def _stable_stringify(self, value: Any) -> str:
        def normalize(v: Any, seen: set[int]) -> Any:
            if v is None or isinstance(v, (str, int, float, bool)):
                return v
            if isinstance(v, list):
                return [normalize(x, seen) for x in v]
            if isinstance(v, dict):
                vid = id(v)
                if vid in seen:
                    return "[Circular]"
                seen.add(vid)
                return {k: normalize(v[k], seen) for k in sorted(v.keys())}
            return str(v)

        try:
            return json.dumps(normalize(value, set()), ensure_ascii=False, sort_keys=True)
        except Exception:
            return str(value)

    def _build_tool_key(self, name: str, args: Any) -> str:
        return f"{name}:{self._stable_stringify(args)}"

    def _resolve_routing_mode(self, intent: str) -> str:
        if intent in {"TRADING", "COPY_TRADING"}:
            return "execution"
        return "thinking"

    def _build_intent_hints(self, decision: dict[str, Any] | None) -> dict[str, Any] | None:
        if not decision:
            return None
        labels = [x.get("label") for x in (decision.get("labels") or []) if isinstance(x, dict) and x.get("label")]
        conflict = decision.get("conflict") or {}
        out: dict[str, Any] = {}
        if labels:
            out["labels"] = labels
        if conflict.get("type"):
            out["conflict"] = f"{conflict.get('type')} ({', '.join(conflict.get('labels') or [])})"
        if conflict.get("question"):
            out["question"] = conflict.get("question")
        return out or None

    def _sanitize_tool_call_history(self, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        sanitized: list[dict[str, Any]] = []
        for idx, msg in enumerate(history):
            if msg.get("role") != "assistant" or not msg.get("tool_calls"):
                sanitized.append(msg)
                continue
            expected = {str(x.get("id")) for x in msg.get("tool_calls") if isinstance(x, dict) and x.get("id")}
            check_idx = idx + 1
            while check_idx < len(history) and expected:
                nxt = history[check_idx]
                if nxt.get("role") == "tool" and nxt.get("tool_call_id"):
                    expected.discard(str(nxt.get("tool_call_id")))
                    check_idx += 1
                    continue
                break
            if expected:
                sanitized.append({"role": "assistant", "content": msg.get("content") or "(Tool call interrupted)"})
            else:
                sanitized.append(msg)
        return sanitized

    async def _record_intent_trace(self, task_user_message_id: str | None, parsed_intent: Any, user_message: str):
        if not task_user_message_id:
            return
        try:
            async with SessionLocal() as db:
                msg = await repo.get_message(db, task_user_message_id)
                if not msg:
                    return
                old = msg.tool_trace_json if isinstance(msg.tool_trace_json, dict) else {}
                intent_trace = {
                    "parsedAt": datetime.utcnow().isoformat() + "Z",
                    "input": user_message,
                    "highLevel": parsed_intent.high_level,
                    "decision": parsed_intent.decision,
                    "detailed": {
                        "action": parsed_intent.detailed.get("action"),
                        "token_in": parsed_intent.detailed.get("token_in"),
                        "token_out": parsed_intent.detailed.get("token_out"),
                        "amount": parsed_intent.detailed.get("amount"),
                        "chain_id": parsed_intent.detailed.get("chain_id"),
                    },
                }
                merged = {**old, "intentTrace": intent_trace}
                await repo.update_message_content(db, task_user_message_id, tool_trace_json=merged)
        except Exception as e:
            self.logger.warning("record intent trace failed: %s", e)

    async def _execute_tool_call(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        tool_call: dict[str, Any],
        context: dict[str, Any],
        trace_state: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        fn = tool_call.get("function") or {}
        name = str(fn.get("name") or "").strip()
        args_raw = fn.get("arguments") or "{}"
        parsed_args: dict[str, Any]
        try:
            parsed = json.loads(args_raw) if isinstance(args_raw, str) else (args_raw or {})
            parsed_args = parsed if isinstance(parsed, dict) else {"_value": parsed}
        except Exception:
            parsed_args = {"_raw_arguments": str(args_raw)}

        args_key = self._build_tool_key(name, parsed_args)
        trace_state["toolCallCounts"][name] = trace_state["toolCallCounts"].get(name, 0) + 1
        total_calls = sum(trace_state["toolCallCounts"].values())
        if total_calls > self.max_tool_calls:
            trace_state["stopReasons"].append("tool_call_limit:total")
            return (
                {"role": "tool", "tool_call_id": tool_call.get("id"), "content": "Tool call limit reached."},
                {"tool": name, "tool_call_id": tool_call.get("id"), "args": parsed_args, "status": "blocked"},
            )
        if trace_state["toolCallCounts"][name] > self.max_tool_calls_per_tool:
            trace_state["stopReasons"].append(f"tool_call_limit:{name}")
            return (
                {"role": "tool", "tool_call_id": tool_call.get("id"), "content": f"Tool call limit reached for {name}."},
                {"tool": name, "tool_call_id": tool_call.get("id"), "args": parsed_args, "status": "blocked"},
            )

        trace_state["toolArgsCounts"][args_key] = trace_state["toolArgsCounts"].get(args_key, 0) + 1
        if trace_state["toolArgsCounts"][args_key] > 1:
            trace_state["blockedKeys"].add(args_key)
            trace_state["stopReasons"].append(f"tool_args_repeat:{name}")
            return (
                {"role": "tool", "tool_call_id": tool_call.get("id"), "content": "Duplicate tool arguments blocked."},
                {"tool": name, "tool_call_id": tool_call.get("id"), "args": parsed_args, "status": "blocked"},
            )

        # Use context snapshot for wallet info when available (lower latency, fewer repeated calls).
        if name == "get_wallet_info" and isinstance(context.get("__wallet_info_cache"), dict):
            cached = context["__wallet_info_cache"]
            return (
                {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id"),
                    "name": name,
                    "content": json.dumps(cached, ensure_ascii=False),
                },
                {
                    "tool": name,
                    "tool_call_id": tool_call.get("id"),
                    "args": parsed_args,
                    "result": cached,
                    "status": "cached",
                },
            )

        req = {"tool_name": name, "arguments": parsed_args, "context": context}
        try:
            resp = await client.post(
                settings.TOOL_RUNTIME_URL.rstrip("/") + "/internal/v1/tool/execute",
                headers=headers,
                json=req,
                timeout=settings.TOOL_EXEC_TIMEOUT_SEC,
            )
            if resp.status_code >= 400:
                raise RuntimeError(f"tool {name} failed HTTP {resp.status_code}: {resp.text[:400]}")
            data = resp.json()
            if not data.get("ok"):
                raise RuntimeError(data.get("error") or f"tool {name} failed")
            result = data.get("result")
            tool_msg = {
                "role": "tool",
                "tool_call_id": tool_call.get("id"),
                "name": name,
                "content": json.dumps(result, ensure_ascii=False),
            }
            trace = {
                "tool": name,
                "tool_call_id": tool_call.get("id"),
                "args": parsed_args,
                "result": result,
                "status": "success",
            }
            if isinstance(result, dict) and result.get("_final"):
                trace_state["stopReasons"].append(f"tool_final:{name}")
                trace_state["shouldExitImmediately"] = True
            return tool_msg, trace
        except Exception as exc:
            trace_state["toolFailures"][name] = trace_state["toolFailures"].get(name, 0) + 1
            if trace_state["toolFailures"][name] >= 2:
                trace_state["stopReasons"].append(f"tool_failure_limit:{name}")
            err_text = str(exc)
            tool_msg = {
                "role": "tool",
                "tool_call_id": tool_call.get("id"),
                "name": name,
                "content": f"Error: {err_text}",
            }
            trace = {
                "tool": name,
                "tool_call_id": tool_call.get("id"),
                "args": parsed_args,
                "error": err_text,
                "status": "error",
            }
            return tool_msg, trace

    async def _run_llm(self, payload: TaskPayload):
        started = time.time()
        task_id = ""
        session_id = ""
        assistant_message_id = ""
        model = "deepseek-chat"
        provider = None
        provider_request_id = None
        selected_intent = "GENERAL_CHAT"
        selected_routing_mode = "thinking"
        task_type = "text"

        content = ""
        reasoning = ""
        usage = None
        citations: list[Any] = []
        chunk_idx = 0
        first_token_ms = None
        last_flush = time.time()
        pending_content = ""
        pending_reasoning = ""
        tool_trace: list[dict[str, Any]] = []
        tool_trace_state: dict[str, Any] = {
            "mode": "thinking",
            "skillVersion": "clean",
            "toolCalls": tool_trace,
            "toolCallCounts": {},
            "toolArgsCounts": {},
            "toolFailures": {},
            "toolRepeats": {},
            "stopReasons": [],
            "blockedKeys": set(),
            "lastResultByKey": {},
            "shouldExitImmediately": False,
        }
        sent_message_start = False

        async with SessionLocal() as db:
            task = await repo.get_task(db, payload.task_id)
            if not task:
                return
            session = await repo.get_session(db, task.session_id, payload.user_id)
            if not session:
                return
            if task.status == "cancelled":
                await ws_manager.broadcast_event(
                    payload.user_id,
                    "status",
                    task.session_id,
                    task.assistant_message_id,
                    {"status": "stopped", "task_id": task.id, "taskId": task.id, "cancelled": True},
                )
                await ws_manager.broadcast_event(
                    payload.user_id,
                    "message_complete",
                    task.session_id,
                    task.assistant_message_id,
                    {"message_id": task.assistant_message_id},
                )
                return

            msgs = await repo.get_messages(db, task.session_id)
            llm_messages: list[dict[str, Any]] = []
            for m in msgs:
                if m.role not in ("system", "user", "assistant", "tool"):
                    continue
                msg: dict[str, Any] = {"role": m.role, "content": m.content}
                if m.role == "assistant" and m.reasoning_content:
                    msg["reasoning_content"] = m.reasoning_content
                llm_messages.append(msg)

            task_id = task.id
            session_id = task.session_id
            assistant_message_id = task.assistant_message_id or ""
            model = task.model
            tool_context = task.tool_context or {}
            task_type = "card" if (tool_context.get("allowanceMode") == "instant" or (tool_context.get("toolConfig") or {}).get("fastSwapMode")) else "text"
            context_balance = tool_context.get("balance") or (tool_context.get("context") or {}).get("balance")
            if tool_context.get("walletAddress") and tool_context.get("chainId") and (context_balance or tool_context.get("nativeBalance")):
                chain_name = "base" if tool_context.get("chainId") == 8453 else str(tool_context.get("chainId"))
                cached_tokens: list[dict[str, Any]] = []
                if isinstance(context_balance, dict):
                    for symbol, bal in context_balance.items():
                        cached_tokens.append({"symbol": str(symbol), "balance": str(bal)})
                tool_context["__wallet_info_cache"] = {
                    "address": tool_context.get("walletAddress"),
                    "chain": chain_name,
                    "ethBalance": str(tool_context.get("nativeBalance")) if tool_context.get("nativeBalance") is not None else None,
                    "tokens": cached_tokens,
                }

            last_user = next((m for m in reversed(llm_messages) if m.get("role") == "user"), {"content": ""})
            parsed_intent = parse_intent(str(last_user.get("content") or ""), tool_context)
            intent = str(parsed_intent.high_level.get("type") or "GENERAL_CHAT")
            routing_mode = self._resolve_routing_mode(intent)
            selected_intent = intent
            selected_routing_mode = routing_mode
            tool_trace_state["mode"] = routing_mode
            tool_trace_state["skillVersion"] = "clean" if routing_mode == "thinking" else "exec"

            user_context = {
                "userAddress": tool_context.get("walletAddress"),
                "chainId": tool_context.get("chainId"),
                "chainName": "Base" if tool_context.get("chainId") == 8453 else str(tool_context.get("chainId") or ""),
                "isWalletConnected": bool(tool_context.get("walletAddress")),
                "nativeBalance": tool_context.get("nativeBalance"),
                "currentPage": tool_context.get("currentPage"),
                "pageContext": tool_context.get("pageContext"),
                "balance": (tool_context.get("context") or {}).get("balance") or {},
                "intentHints": self._build_intent_hints(parsed_intent.decision),
            }
            system_prompt = prompt_orchestrator.get_system_prompt(model, intent, routing_mode)
            enriched_user = prompt_orchestrator.build_prompt(str(last_user.get("content") or ""), user_context, intent)
            await self._record_intent_trace(task.user_message_id, parsed_intent, str(last_user.get("content") or ""))

            # replace the latest user message with enriched content
            for idx in range(len(llm_messages) - 1, -1, -1):
                if llm_messages[idx].get("role") == "user":
                    llm_messages[idx] = {"role": "user", "content": enriched_user}
                    break
            llm_messages = self._sanitize_tool_call_history(llm_messages)
            budget = context_budget_manager.apply_budget(
                llm_messages,
                recent_window=settings.CONTEXT_RECENT_WINDOW,
                max_input_tokens=settings.CONTEXT_MAX_INPUT_TOKENS,
                reserved_output_tokens=settings.CONTEXT_RESERVED_OUTPUT_TOKENS,
            )
            llm_messages = budget.messages
            if budget.compacted_summary:
                llm_messages.insert(0, {"role": "system", "content": budget.compacted_summary})
            llm_messages.insert(0, {"role": "system", "content": system_prompt})

        async def flush_chunks(db: AsyncSession):
            nonlocal chunk_idx, pending_content, pending_reasoning
            if not assistant_message_id:
                pending_content = ""
                pending_reasoning = ""
                return
            if pending_content:
                await repo.add_chunk(db, assistant_message_id, chunk_idx, "content", content=pending_content)
                chunk_idx += 1
                pending_content = ""
            if pending_reasoning:
                await repo.add_chunk(db, assistant_message_id, chunk_idx, "reasoning", reasoning_content=pending_reasoning)
                chunk_idx += 1
                pending_reasoning = ""

        headers = {"Content-Type": "application/json"}
        if settings.INTERNAL_SERVICE_KEY:
            headers["x-service-key"] = settings.INTERNAL_SERVICE_KEY

        try:
            timeout = httpx.Timeout(connect=8, read=120, write=20, pool=8)
            async with httpx.AsyncClient(timeout=timeout) as client:
                tools = await self._fetch_tool_definitions(client, headers)
                # Skills-gated tool availability by intent/mode (Node parity behavior).
                allowed_tool_names = skill_prompt_registry.tools_for(selected_intent, selected_routing_mode)
                if allowed_tool_names:
                    allowed_tool_names.add("external_web_search")
                    tools = [t for t in tools if ((t.get("function") or {}).get("name") in allowed_tool_names)]

                completed = False
                for round_idx in range(settings.MAX_TOOL_ROUNDS):
                    await ws_manager.broadcast_event(
                        payload.user_id,
                        "status",
                        session_id,
                        assistant_message_id,
                        {
                            "status": "running",
                            "message": "Thinking" if round_idx == 0 else f"Processing tool results ({round_idx + 1}/{settings.MAX_TOOL_ROUNDS})",
                            "task_id": task_id,
                            "taskId": task_id,
                            "taskType": task_type,
                            "iteration": round_idx + 1,
                            "maxIterations": settings.MAX_TOOL_ROUNDS,
                        },
                    )
                    round_tool_deltas: dict[str, dict[str, Any]] = {}
                    round_had_done = False
                    round_assistant_content = ""
                    round_assistant_reasoning = ""

                    req: dict[str, Any] = {
                        "model": model,
                        "messages": llm_messages,
                        "stream": True,
                        "metadata": {
                            "task_id": task_id,
                            "session_id": session_id,
                            "assistant_message_id": assistant_message_id,
                            "tool_round": str(round_idx),
                        },
                    }
                    if tools:
                        req["tools"] = tools

                    async with client.stream(
                        "POST",
                        settings.LLM_GATEWAY_URL.rstrip("/") + "/internal/v1/generate",
                        headers=headers,
                        json=req,
                    ) as resp:
                        if resp.status_code >= 400:
                            txt = (await resp.aread()).decode("utf-8", errors="ignore")
                            raise RuntimeError(f"LLM gateway error HTTP {resp.status_code}: {txt[:400]}")

                        last_cancel_check = 0.0
                        async with SessionLocal() as db:
                            async for line in resp.aiter_lines():
                                if not line or not line.startswith("data: "):
                                    continue
                                now = time.time()
                                if (now - last_cancel_check) * 1000 >= settings.CANCEL_CHECK_MS:
                                    t = await repo.get_task(db, task_id)
                                    if not t or t.status == "cancelled":
                                        await ws_manager.broadcast_event(
                                            payload.user_id,
                                            "status",
                                            session_id,
                                            assistant_message_id,
                                            {"status": "stopped", "task_id": task_id, "taskId": task_id, "cancelled": True, "taskType": task_type},
                                        )
                                        await ws_manager.broadcast_event(
                                            payload.user_id,
                                            "message_complete",
                                            session_id,
                                            assistant_message_id,
                                            {"message_id": assistant_message_id},
                                        )
                                        return
                                    last_cancel_check = now

                                data = json.loads(line[6:])
                                et = data.get("event_type")
                                provider = data.get("provider") or provider
                                provider_request_id = data.get("provider_request_id") or provider_request_id
                                p = data.get("payload") or {}

                                if et == "message_start":
                                    if not sent_message_start:
                                        sent_message_start = True
                                        await ws_manager.broadcast_event(
                                            payload.user_id,
                                            "message_start",
                                            session_id,
                                            assistant_message_id,
                                            {"message_id": assistant_message_id, "task_id": task_id, "taskId": task_id},
                                        )
                                elif et == "delta_text":
                                    txt = str(p.get("text") or "")
                                    if txt:
                                        if first_token_ms is None:
                                            first_token_ms = int((time.time() - started) * 1000)
                                        content += txt
                                        round_assistant_content += txt
                                        pending_content += txt
                                        await ws_manager.broadcast_event(payload.user_id, "delta_text", session_id, assistant_message_id, {"text": txt})
                                elif et == "delta_reasoning":
                                    txt = str(p.get("text") or "")
                                    if txt:
                                        reasoning += txt
                                        round_assistant_reasoning += txt
                                        pending_reasoning += txt
                                        await ws_manager.broadcast_event(payload.user_id, "delta_reasoning", session_id, assistant_message_id, {"text": txt})
                                elif et == "tool_call":
                                    deltas = p.get("tool_calls") or []
                                    if isinstance(deltas, list):
                                        self._merge_tool_call_deltas(round_tool_deltas, deltas)
                                    await ws_manager.broadcast_event(payload.user_id, "tool_call", session_id, assistant_message_id, p)
                                elif et == "usage":
                                    usage = p.get("usage")
                                    await ws_manager.broadcast_event(payload.user_id, "usage", session_id, assistant_message_id, {"usage": usage})
                                elif et == "citation":
                                    cits = p.get("citations") or []
                                    if isinstance(cits, list):
                                        citations.extend(cits)
                                    await ws_manager.broadcast_event(payload.user_id, "citation", session_id, assistant_message_id, {"citations": cits})
                                elif et == "latency_metrics":
                                    await ws_manager.broadcast_event(payload.user_id, "latency_metrics", session_id, assistant_message_id, p)
                                elif et == "error":
                                    raise RuntimeError(p.get("message") or "LLM stream error")
                                elif et == "done":
                                    round_had_done = True
                                    break

                                if (now - last_flush) * 1000 >= settings.CHUNK_FLUSH_MS:
                                    await flush_chunks(db)
                                    last_flush = now

                    # build complete tool calls for this round
                    round_tool_calls = list(round_tool_deltas.values())
                    round_tool_calls = [tc for tc in round_tool_calls if (tc.get("function") or {}).get("name")]

                    if round_tool_calls:
                        # feed assistant tool-call turn back to model context
                        llm_messages.append(
                            {
                                "role": "assistant",
                                "content": round_assistant_content or None,
                                "tool_calls": round_tool_calls,
                            }
                        )

                        exec_context = {
                            "user_id": payload.user_id,
                            "session_id": session_id,
                            "task_id": task_id,
                            **(tool_context or {}),
                        }
                        for tc in round_tool_calls:
                            tool_msg, trace = await self._execute_tool_call(client, headers, tc, exec_context, tool_trace_state)
                            tool_trace.append(trace)
                            llm_messages.append(tool_msg)
                            await ws_manager.broadcast_event(
                                payload.user_id,
                                "tool_result",
                                session_id,
                                assistant_message_id,
                                {
                                    "tool_name": trace["tool"],
                                    "tool_call_id": trace["tool_call_id"],
                                    "result": trace.get("result"),
                                    "status": trace.get("status"),
                                },
                            )
                            async with SessionLocal() as db:
                                await repo.add_chunk(
                                    db,
                                    assistant_message_id,
                                    chunk_idx,
                                    "tool_result",
                                    metadata_json={
                                        "tool_name": trace["tool"],
                                        "tool_call_id": trace["tool_call_id"],
                                        "status": trace.get("status"),
                                    },
                                )
                                chunk_idx += 1
                        if tool_trace_state["shouldExitImmediately"]:
                            completed = True
                            break
                        if any(
                            r.startswith("tool_call_limit")
                            or r.startswith("tool_failure_limit")
                            or r.startswith("tool_args_repeat")
                            for r in tool_trace_state["stopReasons"]
                        ):
                            notice = "\n\n⚠️ Tool usage limit reached. Please refine your request and try again."
                            content += notice
                            pending_content += notice
                            await ws_manager.broadcast_event(payload.user_id, "delta_text", session_id, assistant_message_id, {"text": notice})
                            break
                        # continue next round with tool results in context
                        continue

                    # no tool calls this round: finalize
                    if round_had_done:
                        completed = True
                        break

                async with SessionLocal() as db:
                    await flush_chunks(db)
                    if not completed:
                        max_iter_notice = "\n\n⚠️ Maximum tool iterations reached. Some operations may be incomplete."
                        content += max_iter_notice
                    end_to_end = int((time.time() - started) * 1000)
                    if assistant_message_id:
                        await repo.update_message_content(
                            db,
                            assistant_message_id,
                            content=content,
                            reasoning_content=reasoning,
                            status="complete",
                            usage_json=usage,
                            citations_json=citations or None,
                            provider=provider,
                            provider_request_id=provider_request_id,
                            first_token_ms=first_token_ms,
                            end_to_end_ms=end_to_end,
                            tool_trace_json={
                                "mode": tool_trace_state.get("mode"),
                                "skillVersion": tool_trace_state.get("skillVersion"),
                                "toolCalls": tool_trace,
                                "toolCallCounts": tool_trace_state.get("toolCallCounts", {}),
                                "toolFailures": tool_trace_state.get("toolFailures", {}),
                                "toolRepeats": tool_trace_state.get("toolRepeats", {}),
                                "stopReasons": list(dict.fromkeys(tool_trace_state.get("stopReasons", []))),
                            },
                        )
                    t = await repo.get_task(db, task_id)
                    if not t:
                        return
                    await repo.set_task_status(db, t, "done")
                    await ws_manager.broadcast_event(
                        payload.user_id,
                        "status",
                        session_id,
                        assistant_message_id,
                        {"status": "done", "task_id": task_id, "taskId": task_id, "taskType": task_type},
                    )
                    await ws_manager.broadcast_event(
                        payload.user_id,
                        "message_complete",
                        session_id,
                        assistant_message_id,
                        {"message_id": assistant_message_id},
                    )

        except Exception as e:
            self.logger.exception("ChatWorker task failed: task_id=%s error=%s", task_id, e)
            async with SessionLocal() as db:
                t = await repo.get_task(db, task_id)
                if not t:
                    return
                await repo.set_task_status(db, t, "error", error_message=str(e))
                if assistant_message_id:
                    await repo.update_message_content(
                        db,
                        assistant_message_id,
                        status="error",
                        content=content,
                        reasoning_content=reasoning,
                        tool_trace_json={
                            "mode": tool_trace_state.get("mode"),
                            "skillVersion": tool_trace_state.get("skillVersion"),
                            "toolCalls": tool_trace,
                            "toolCallCounts": tool_trace_state.get("toolCallCounts", {}),
                            "toolFailures": tool_trace_state.get("toolFailures", {}),
                            "toolRepeats": tool_trace_state.get("toolRepeats", {}),
                            "stopReasons": list(dict.fromkeys(tool_trace_state.get("stopReasons", []))),
                        },
                    )
                await ws_manager.broadcast_event(
                    payload.user_id,
                    "error",
                    session_id,
                    assistant_message_id,
                    {"message": str(e), "task_id": task_id, "taskId": task_id},
                )
                await ws_manager.broadcast_event(
                    payload.user_id,
                    "status",
                    session_id,
                    assistant_message_id,
                    {"status": "failed", "error": str(e), "task_id": task_id, "taskId": task_id, "taskType": task_type},
                )
                await ws_manager.broadcast_event(
                    payload.user_id,
                    "message_complete",
                    session_id,
                    assistant_message_id,
                    {"message_id": assistant_message_id},
                )
