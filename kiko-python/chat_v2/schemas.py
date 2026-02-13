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
    currentPage: str | None = None
    pageContext: str | None = None
    context: dict[str, Any] | None = None


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
    ]
    session_id: str
    message_id: str | None = None
    seq: int
    ts: datetime
    payload: dict[str, Any] = Field(default_factory=dict)
