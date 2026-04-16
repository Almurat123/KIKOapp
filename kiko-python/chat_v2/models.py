import uuid
from datetime import datetime

from sqlalchemy import String, Text, DateTime, Integer, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base
from .settings import settings


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(String, default="New Chat")
    model: Mapped[str] = mapped_column(String, default=settings.DEFAULT_MODEL)
    status: Mapped[str] = mapped_column(String, default="active")
    provider: Mapped[str | None] = mapped_column(String, nullable=True)
    last_response_id: Mapped[str | None] = mapped_column(String, nullable=True)
    compaction_cursor: Mapped[str | None] = mapped_column(String, nullable=True)
    conversation_state_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text, default="")
    reasoning_content: Mapped[str] = mapped_column(Text, default="")
    usage_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    citations_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    tool_trace_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    provider: Mapped[str | None] = mapped_column(String, nullable=True)
    provider_request_id: Mapped[str | None] = mapped_column(String, nullable=True)
    stream_protocol_version: Mapped[str] = mapped_column(String, default="v1")
    first_token_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_to_end_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    type: Mapped[str] = mapped_column(String, default="text")
    status: Mapped[str] = mapped_column(String, default="complete")
    message_index: Mapped[int] = mapped_column(Integer, default=0)
    feedback: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AITask(Base):
    __tablename__ = "ai_tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    user_message_id: Mapped[str | None] = mapped_column(String, nullable=True)
    assistant_message_id: Mapped[str | None] = mapped_column(String, nullable=True)
    model: Mapped[str] = mapped_column(String)
    provider: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="queued")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cancelled_by: Mapped[str | None] = mapped_column(String, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MessageChunk(Base):
    __tablename__ = "message_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[str] = mapped_column(String, ForeignKey("chat_messages.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    chunk_type: Mapped[str] = mapped_column(String, default="content")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    reasoning_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


Index("idx_message_chunks_message_index", MessageChunk.message_id, MessageChunk.chunk_index)
