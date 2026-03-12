from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class ToolDefinitionModel(BaseModel):
    name: str
    description: str
    parameters: dict[str, Any]


class HistoryMessageModel(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str = ""
    reasoningContent: str | None = None
    toolCalls: list[dict[str, Any]] | None = None
    toolCallId: str | None = None
    data: dict[str, Any] | None = None
    messageId: str | None = None


class ChatContextSnapshotModel(BaseModel):
    sessionId: str
    taskId: str
    userMessageId: str | None = None
    assistantMessageId: str | None = None
    model: str
    history: list[HistoryMessageModel]
    lastUserMessage: str
    recentToolTrace: dict[str, Any] | None = None
    confirmationState: dict[str, Any] | None = None
    runtime: dict[str, Any] = Field(default_factory=dict)
    requestedTokenAddresses: list[str] = Field(default_factory=list)
    requestedTokenSymbols: list[str] = Field(default_factory=list)
    compactedHistory: str | None = None
    historyBudget: dict[str, Any] | None = None
    previousResponseId: str | None = None
    toolDefinitions: list[ToolDefinitionModel] = Field(default_factory=list)


class StartRunRequest(BaseModel):
    snapshot: ChatContextSnapshotModel


class ToolResultModel(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    ok: bool
    result: Any = None
    error: str | None = None
    metadata: dict[str, Any] | None = None


class OrchestrationEvent(BaseModel):
    type: Literal[
        "assistant_delta",
        "reasoning_delta",
        "tool_call",
        "usage",
        "citation",
        "conversation_state",
        "message_complete",
        "error",
    ]
    payload: dict[str, Any] = Field(default_factory=dict)
