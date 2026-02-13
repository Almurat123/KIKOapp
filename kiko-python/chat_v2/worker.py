from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from . import repository as repo
from .db import SessionLocal
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
                await self.process(payload)
            except Exception as e:
                self.logger.exception("ChatWorker loop error: %s", e)

    async def stop(self):
        self._running = False

    async def enqueue(self, task_id: str, user_id: str):
        await self.redis.rpush(settings.TASK_QUEUE_KEY, json.dumps({"task_id": task_id, "user_id": user_id}))

    async def process(self, payload: TaskPayload):
        async with SessionLocal() as db:
            task = await repo.get_task(db, payload.task_id)
            if not task or task.status == "cancelled":
                return
            await repo.set_task_status(db, task, "running")
            await ws_manager.broadcast_event(
                payload.user_id,
                "status",
                task.session_id,
                task.assistant_message_id,
                {"status": "running", "message": "Thinking", "task_id": task.id, "taskId": task.id},
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

    async def _execute_tool_call(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        tool_call: dict[str, Any],
        context: dict[str, Any],
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

        req = {"tool_name": name, "arguments": parsed_args, "context": context}
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
        sent_message_start = False

        async with SessionLocal() as db:
            task = await repo.get_task(db, payload.task_id)
            if not task:
                return
            session = await repo.get_session(db, task.session_id, payload.user_id)
            if not session:
                return
            if task.status == "cancelled":
                return

            msgs = await repo.get_messages(db, task.session_id)
            llm_messages: list[dict[str, Any]] = []
            for m in msgs:
                if m.role not in ("system", "user", "assistant", "tool"):
                    continue
                msg: dict[str, Any] = {"role": m.role, "content": m.content}
                llm_messages.append(msg)

            task_id = task.id
            session_id = task.session_id
            assistant_message_id = task.assistant_message_id or ""
            model = task.model
            tool_context = task.tool_context or {}

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

                for round_idx in range(settings.MAX_TOOL_ROUNDS):
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
                            tool_msg, trace = await self._execute_tool_call(client, headers, tc, exec_context)
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
                                    "result": trace["result"],
                                },
                            )
                        # continue next round with tool results in context
                        continue

                    # no tool calls this round: finalize
                    if round_had_done:
                        break

                async with SessionLocal() as db:
                    await flush_chunks(db)
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
                            tool_trace_json={"toolCalls": tool_trace},
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
                        {"status": "done", "task_id": task_id, "taskId": task_id},
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
                        tool_trace_json={"toolCalls": tool_trace},
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
                    {"status": "failed", "error": str(e), "task_id": task_id, "taskId": task_id},
                )

