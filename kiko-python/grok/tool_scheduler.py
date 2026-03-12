import asyncio
import os
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional


@dataclass(frozen=True)
class PlannedToolCall:
    name: str
    args: dict[str, Any]


@dataclass(frozen=True)
class ExecutedToolCall:
    name: str
    payload: str
    client_action: Optional[dict]
    duration_ms: int
    error: Optional[str] = None


DEFAULT_TOOL_TIMEOUT_MS = max(0, int(os.getenv("GROK_TOOL_EXEC_TIMEOUT_MS", "20000")))


async def execute_planned_custom_tools(
    planned_calls: list[PlannedToolCall],
    *,
    execute_tool: Callable[[str, dict[str, Any], Optional[str], Optional[dict]], Awaitable[str]],
    normalize_result: Callable[[str], tuple[str, Optional[dict]]],
    auth_token: Optional[str],
    tool_context: Optional[dict],
    log: Callable[[str], None],
    per_tool_timeout_ms: Optional[int] = DEFAULT_TOOL_TIMEOUT_MS,
) -> list[ExecutedToolCall]:
    if not planned_calls:
        return []

    names = ", ".join(call.name for call in planned_calls)
    log(f"[Tool Scheduler] Executing {len(planned_calls)} planned custom tool(s) in parallel: {names}")

    async def run_one(call: PlannedToolCall) -> ExecutedToolCall:
        started_at = time.perf_counter()
        try:
            if per_tool_timeout_ms and per_tool_timeout_ms > 0:
                tool_result_data = await asyncio.wait_for(
                    execute_tool(call.name, call.args, auth_token, tool_context),
                    timeout=per_tool_timeout_ms / 1000,
                )
            else:
                tool_result_data = await execute_tool(call.name, call.args, auth_token, tool_context)
            tool_payload, client_action = normalize_result(tool_result_data)
            duration_ms = int((time.perf_counter() - started_at) * 1000)
            log(f"[Tool Scheduler] {call.name} completed in {duration_ms}ms")
            return ExecutedToolCall(
                name=call.name,
                payload=tool_payload,
                client_action=client_action,
                duration_ms=duration_ms,
            )
        except asyncio.TimeoutError:
            duration_ms = int((time.perf_counter() - started_at) * 1000)
            error_message = f"Tool {call.name} timed out after {per_tool_timeout_ms}ms"
            log(f"[Tool Scheduler] {call.name} timed out in {duration_ms}ms")
            return ExecutedToolCall(
                name=call.name,
                payload=error_message,
                client_action=None,
                duration_ms=duration_ms,
                error=error_message,
            )
        except Exception as exc:
            duration_ms = int((time.perf_counter() - started_at) * 1000)
            error_message = f"Error executing {call.name}: {exc}"
            log(f"[Tool Scheduler] {call.name} failed in {duration_ms}ms: {exc}")
            return ExecutedToolCall(
                name=call.name,
                payload=error_message,
                client_action=None,
                duration_ms=duration_ms,
                error=error_message,
            )

    return await asyncio.gather(*(run_one(call) for call in planned_calls))
