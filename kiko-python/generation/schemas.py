from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class GenerationMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool", "developer"]
    content: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None
    reasoning_content: str | None = None


class GenerationRequest(BaseModel):
    model: str
    messages: list[GenerationMessage]
    tools: list[dict[str, Any]] = Field(default_factory=list)
    provider_options: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, str] = Field(default_factory=dict)
