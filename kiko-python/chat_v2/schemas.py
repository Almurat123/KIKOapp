"""Chat v2 API schemas."""

# CONTEXT MEMORY
# Updated: 2026-04-17
# Author: Rowan
# Reason: the chat v2 service needs an explicit context-contract field so the
#         Python prompt orchestrator can mirror the Node-side lean prompt
#         boundary instead of receiving an undifferentiated context blob.
# Goal: keep chat v2 requests explicit about which context slices are required
#       for the current turn while preserving backward-compatible optional
#       context payloads.
# Owns: request/response schemas for the Python chat_v2 service.
# Does Not Own: routing policy, model selection, or persistence writes.
# Design Language:
# - context contracts are explicit input, not hidden prompt lore
# - optional generic context may still be present for compatibility, but the
#   contract must name the required slices for the turn
# - schema growth should keep backward-compatible defaults
# Document Provenance:
# - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
# - Kind: repo doc
# - Retrieved: 2026-04-17
# - Applied To: explicit context contract on chat_v2 requests
# - Verification: inferred from code and plan

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


TaskStatus = Literal["queued", "running", "done", "error", "cancelled"]


class SessionCreateRequest(BaseModel):
    title: str | None = None
    model: str | None = None


class SessionUpdateRequest(BaseModel):
    title: str | None = None
    model: str | None = None
    status: str | None = None


class MessageSendRequest(BaseModel):
    content: str
    model: str | None = None
    walletAddress: str | None = None
    chainId: int | None = None
    toolConfig: dict[str, Any] | None = None
    allowanceMode: str | None = None
    nativeBalance: str | None = None
    balance: dict[str, Any] | None = None
    currentPage: str | None = None
    pageContext: str | None = None
    farcaster: dict[str, Any] | None = None
    accessToken: str | None = None
    appKey: str | None = None
    context: dict[str, Any] | None = None
    contextContract: dict[str, Any] | None = None


class FeedbackRequest(BaseModel):
    feedback: Literal["like", "dislike", "neutral", ""] | None = None


class ChatSessionOut(BaseModel):
    id: str
    title: str
    model: str
    status: str
    createdAt: datetime
    updatedAt: datetime


class ChatMessageOut(BaseModel):
    id: str
    sessionId: str
    role: str
    content: str
    reasoning_content: str = ""
    usage: dict[str, Any] | None = None
    citations: list[dict[str, Any]] | None = None
    type: str = "text"
    status: str = "complete"
    messageIndex: int = 0
    createdAt: datetime


class ChatTaskOut(BaseModel):
    id: str
    sessionId: str
    status: TaskStatus
    model: str
    message: str | None = None


class UnifiedEvent(BaseModel):
    event_id: str
    type: Literal[
        "message_start",
        "status",
        "delta_text",
        "delta_reasoning",
        "tool_call",
        "tool_result",
        "usage",
        "citation",
        "message_complete",
        "error",
        "latency_metrics",
        "client_action",
    ]
    session_id: str
    message_id: str | None = None
    seq: int
    ts: datetime
    payload: dict[str, Any] = Field(default_factory=dict)
