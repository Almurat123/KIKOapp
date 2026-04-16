from __future__ import annotations

# CONTEXT MEMORY
# Updated: 2026-04-16
# Author: Rowan
# Reason: the generation service previously constrained every message content
#         field to plain text, which blocked current-turn multimodal user
#         content from social-agent ingress even though downstream providers can
#         accept structured content arrays. This boundary now also preserves
#         Kimi and Grok social-image turns until their provider adapters apply
#         the correct vendor-specific request format.
# Goal: keep the generation API schema permissive enough for provider-safe
#       multimodal current-turn content while preserving the existing tool-call
#       and reasoning envelope.
# Owns: generation-service request/response content schemas.
# Does Not Own: provider capability policy, prompt assembly, or persistence.
# Design Language:
# - schemas must not artificially collapse provider-safe structured content into strings
# - replayed history policy belongs upstream; this owner only validates payload shape
# Document Provenance:
# - Source: OpenAI Images and Vision / Chat Completions docs
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: allowing structured multimodal `content` values in generation messages
# - Verification: verified in docs and code
# - Source: NVIDIA NIM moonshotai/kimi-k2.5 inference docs and xAI Image Understanding docs
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: preserving structured Kimi/Grok image content across generation requests
# - Verification: verified in docs and code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/owner-map/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-kimi-grok-social-image-input.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
# - /Users/almurat/KiKo/system-journal/conflicts.md

from typing import Any, Literal
from pydantic import BaseModel, Field


class GenerationMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool", "developer"]
    content: Any | None = None
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None
    reasoning_content: str | None = None


class GenerationRequest(BaseModel):
    model: str
    messages: list[GenerationMessage]
    tools: list[dict[str, Any]] = Field(default_factory=list)
    provider_options: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, str] = Field(default_factory=dict)
