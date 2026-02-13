from typing import Any, Literal
from pydantic import BaseModel, Field


class LLMMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool", "developer"]
    content: str | None = None
    name: str | None = None
    tool_call_id: str | None = None
    tool_calls: list[dict[str, Any]] | None = None


class GenerateRequest(BaseModel):
    model: str
    messages: list[LLMMessage]
    stream: bool = True
    metadata: dict[str, str] = Field(default_factory=dict)
    tools: list[dict[str, Any]] | None = None
    tool_context: dict[str, Any] | None = None


class GatewayEvent(BaseModel):
    event_type: Literal[
        "message_start",
        "delta_text",
        "delta_reasoning",
        "tool_call",
        "tool_result",
        "usage",
        "citation",
        "done",
        "error",
        "latency_metrics",
    ]
    provider: Literal["openai", "deepseek", "xai"]
    provider_request_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
