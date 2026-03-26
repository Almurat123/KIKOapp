import time
from typing import Optional


def summarize_tool_names(tool_names: list[str], limit: int = 4) -> str:
    names = [str(name).strip() for name in tool_names if str(name).strip()]
    if not names:
        return "none"
    if len(names) <= limit:
        return ", ".join(names)
    visible = ", ".join(names[:limit])
    return f"{visible} +{len(names) - limit} more"


def build_stream_chunk_id(*, request_hash: int, response_id: Optional[str] = None) -> str:
    candidate = str(response_id or "").strip()
    if candidate:
        return candidate
    return f"kiko-grok-{abs(int(request_hash))}"


def build_tool_status_chunk(
    *,
    request_hash: int,
    model: str,
    status: str,
    chunk_id: Optional[str] = None,
    phase: Optional[str] = None,
    count: Optional[int] = None,
    tools: Optional[list[str]] = None,
    reason: Optional[str] = None,
) -> dict:
    payload = {
        "id": chunk_id or build_stream_chunk_id(request_hash=request_hash),
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [{
            "index": 0,
            "delta": {
                "tool_status": status
            },
            "finish_reason": None
        }],
    }
    tool_batch = {}
    if phase:
        tool_batch["phase"] = phase
    if count is not None:
        tool_batch["count"] = count
    if tools:
        tool_batch["tools"] = tools
    if reason:
        tool_batch["reason"] = reason
    if tool_batch:
        payload["tool_batch"] = tool_batch
    return payload
