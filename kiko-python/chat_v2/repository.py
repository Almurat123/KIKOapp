from __future__ import annotations

from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ChatSession, ChatMessage, AITask, MessageChunk
from .settings import settings


async def create_session(db: AsyncSession, user_id: str, title: str | None, model: str | None) -> ChatSession:
    session = ChatSession(
        user_id=user_id,
        title=title or "New Chat",
        model=(model or settings.DEFAULT_MODEL).strip() or settings.DEFAULT_MODEL,
        status="active",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def list_sessions(db: AsyncSession, user_id: str, limit: int = 50, offset: int = 0) -> list[ChatSession]:
    q = (
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .where(ChatSession.status != "deleted")
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = await db.execute(q)
    return list(rows.scalars())


async def get_session(db: AsyncSession, session_id: str, user_id: str) -> ChatSession | None:
    q = select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    row = await db.execute(q)
    return row.scalar_one_or_none()


async def update_session(db: AsyncSession, session: ChatSession, title: str | None, model: str | None, status: str | None) -> ChatSession:
    if title is not None:
        session.title = title
    if model is not None:
        session.model = model
    if status is not None:
        session.status = status
    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)
    return session


async def soft_delete_session(db: AsyncSession, session: ChatSession) -> None:
    session.status = "deleted"
    session.updated_at = datetime.utcnow()
    await db.commit()


async def get_messages(db: AsyncSession, session_id: str, after: int | None = None) -> list[ChatMessage]:
    q = select(ChatMessage).where(ChatMessage.session_id == session_id)
    if after is not None:
        q = q.where(ChatMessage.message_index > after)
    q = q.order_by(ChatMessage.message_index.asc())
    rows = await db.execute(q)
    return list(rows.scalars())


async def _next_message_index(db: AsyncSession, session_id: str) -> int:
    q = select(func.max(ChatMessage.message_index)).where(ChatMessage.session_id == session_id)
    res = await db.execute(q)
    mx = res.scalar_one_or_none()
    return (mx if mx is not None else -1) + 1


async def create_message(
    db: AsyncSession,
    session_id: str,
    role: str,
    content: str,
    status: str = "complete",
    msg_type: str = "text",
) -> ChatMessage:
    idx = await _next_message_index(db, session_id)
    m = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        status=status,
        type=msg_type,
        message_index=idx,
    )
    db.add(m)
    s = await db.get(ChatSession, session_id)
    if s:
        s.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(m)
    return m


async def update_message_content(
    db: AsyncSession,
    message_id: str,
    *,
    content: str | None = None,
    reasoning_content: str | None = None,
    status: str | None = None,
    usage_json: dict | None = None,
    citations_json: list | None = None,
    provider: str | None = None,
    provider_request_id: str | None = None,
    first_token_ms: int | None = None,
    end_to_end_ms: int | None = None,
    tool_trace_json: dict | None = None,
):
    msg = await db.get(ChatMessage, message_id)
    if not msg:
        return None
    if content is not None:
        msg.content = content
    if reasoning_content is not None:
        msg.reasoning_content = reasoning_content
    if status is not None:
        msg.status = status
    if usage_json is not None:
        msg.usage_json = usage_json
    if citations_json is not None:
        msg.citations_json = citations_json
    if provider is not None:
        msg.provider = provider
    if provider_request_id is not None:
        msg.provider_request_id = provider_request_id
    if first_token_ms is not None:
        msg.first_token_ms = first_token_ms
    if end_to_end_ms is not None:
        msg.end_to_end_ms = end_to_end_ms
    if tool_trace_json is not None:
        msg.tool_trace_json = tool_trace_json
    await db.commit()
    await db.refresh(msg)
    return msg


async def create_task(
    db: AsyncSession,
    session_id: str,
    user_message_id: str,
    assistant_message_id: str,
    model: str,
    tool_context: dict | None,
) -> AITask:
    task = AITask(
        session_id=session_id,
        user_message_id=user_message_id,
        assistant_message_id=assistant_message_id,
        model=model,
        status="queued",
        tool_context=tool_context,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def get_task(db: AsyncSession, task_id: str) -> AITask | None:
    return await db.get(AITask, task_id)


async def get_message(db: AsyncSession, message_id: str) -> ChatMessage | None:
    return await db.get(ChatMessage, message_id)


async def get_active_task(db: AsyncSession, session_id: str) -> AITask | None:
    q = (
        select(AITask)
        .where(AITask.session_id == session_id)
        .where(AITask.status.in_(["queued", "running"]))
        .order_by(AITask.created_at.desc())
        .limit(1)
    )
    row = await db.execute(q)
    return row.scalar_one_or_none()


async def set_task_status(db: AsyncSession, task: AITask, status: str, error_message: str | None = None, cancelled_by: str | None = None):
    task.status = status
    if status == "running":
        task.started_at = datetime.utcnow()
    if status in ("done", "error", "cancelled"):
        task.completed_at = datetime.utcnow()
    if error_message is not None:
        task.error_message = error_message
    if cancelled_by is not None:
        task.cancelled_by = cancelled_by
    await db.commit()
    await db.refresh(task)
    return task


async def add_chunk(
    db: AsyncSession,
    message_id: str,
    chunk_index: int,
    chunk_type: str,
    content: str | None = None,
    reasoning_content: str | None = None,
    metadata_json: dict | None = None,
) -> MessageChunk:
    c = MessageChunk(
        message_id=message_id,
        chunk_index=chunk_index,
        chunk_type=chunk_type,
        content=content,
        reasoning_content=reasoning_content,
        metadata_json=metadata_json,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


async def get_chunks(db: AsyncSession, message_id: str, after: int | None = None) -> list[MessageChunk]:
    q = select(MessageChunk).where(MessageChunk.message_id == message_id)
    if after is not None:
        q = q.where(MessageChunk.chunk_index > after)
    q = q.order_by(MessageChunk.chunk_index.asc())
    rows = await db.execute(q)
    return list(rows.scalars())
