# CONTEXT MEMORY
# Updated: 2026-04-23
# Author: Rowan
# Reason: the gateway schema previously forced every chat message content field
#         to plain text, which prevented current-turn multimodal social-agent
#         inputs from reaching providers that support image-aware content arrays.
#         The same permissive boundary now carries OpenAI and xAI image turns to
#         their provider adapters.
# Goal: let provider adapters receive structured message content when the
#       upstream orchestrator intentionally emits it.
# Owns: llm-gateway message/event schemas.
# Does Not Own: provider-specific feature gating, prompt assembly, or local
#               history policy.
# Design Language:
# - gateway schemas must be permissive enough for provider-safe structured content
# - provider capability checks belong in adapters/upstream prompt assembly, not schema coercion
# Document Provenance:
# - Source: OpenAI Images and Vision / Chat Completions docs
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: allowing structured multimodal `content` values in gateway requests
# - Verification: verified in docs and code
# - Source: OpenAI Images and Vision docs and xAI Image Understanding docs
# - Kind: official API doc
# - Retrieved: 2026-04-23
# - Applied To: preserving structured OpenAI/xAI image content until provider adapters shape it
# - Verification: verified in docs and code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/owner-map/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
# - /Users/almurat/KiKo/system-journal/conflicts.md

from typing import Any, Literal
from pydantic import BaseModel, Field


class LLMMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool", "developer"]
    content: Any | None = None
    name: str | None = None
    tool_call_id: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    reasoning_content: str | None = None


class GenerateRequest(BaseModel):
    model: str
    messages: list[LLMMessage]
    stream: bool = True
    metadata: dict[str, str] = Field(default_factory=dict)
    api_mode: str | None = None
    tools: list[dict[str, Any]] | None = None
    tool_context: dict[str, Any] | None = None
    enable_search: bool | None = None
    previous_response_id: str | None = None
    tool_policy: dict[str, Any] | None = None
    tool_config: dict[str, Any] | None = None
    tool_choice: Any | None = None


class GatewayEvent(BaseModel):
    event_type: Literal[
        "message_start",
        "delta_text",
        "delta_reasoning",
        "tool_call",
        "tool_progress",
        "tool_result",
        "client_action",
        "usage",
        "citation",
        "done",
        "error",
        "latency_metrics",
    ]
    provider: Literal["openai", "xai"]
    provider_request_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
