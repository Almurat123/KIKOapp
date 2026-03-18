from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any
import logging
import os

from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import require_auth, verify_privy_token, extract_user_id
from .db import Base, engine, get_db
from .models import ChatMessage
from .schemas import SessionCreateRequest, SessionUpdateRequest, MessageSendRequest, FeedbackRequest
from . import repository as repo
from .ws import ws_manager
from .worker import ChatWorker
from .settings import settings


def _cors_origins() -> list[str]:
    configured = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGIN") or ""
    if configured.strip():
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://kikoapp.app",
        "https://www.kikoapp.app",
    ]


app = FastAPI(title="kiko-chat-api-v2", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_client: Redis | None = None
worker: ChatWorker | None = None
worker_task: asyncio.Task | None = None
_lifecycle_lock = asyncio.Lock()
logger = logging.getLogger(__name__)


def _map_session(s) -> dict[str, Any]:
    return {
        "id": s.id,
        "title": s.title,
        "model": s.model,
        "status": s.status,
        "createdAt": s.created_at,
        "updatedAt": s.updated_at,
    }


def _map_message(m) -> dict[str, Any]:
    ts = int(m.created_at.timestamp() * 1000)
    return {
        "id": m.id,
        "sessionId": m.session_id,
        "role": m.role,
        "content": m.content or "",
        "reasoning_content": m.reasoning_content or "",
        "citations": m.citations_json,
        "usage": m.usage_json,
        "type": m.type,
        "status": m.status,
        "messageIndex": m.message_index,
        "timestamp": ts,
        "createdAt": m.created_at,
        "feedback": m.feedback,
    }


def _map_task(t) -> dict[str, Any]:
    status = t.status
    if status == "done":
        status = "completed"
    elif status == "error":
        status = "failed"
    elif status == "cancelled":
        status = "stopped"
    elif status == "queued":
        status = "pending"
    return {
        "id": t.id,
        "sessionId": t.session_id,
        "status": status,
        "model": t.model,
        "message": t.error_message,
    }


async def ensure_started():
    global redis_client, worker, worker_task
    async with _lifecycle_lock:
        if worker_task and not worker_task.done():
            return
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        worker = ChatWorker(redis_client)
        worker_task = asyncio.create_task(worker.start())


async def ensure_stopped():
    global redis_client, worker, worker_task
    async with _lifecycle_lock:
        if worker:
            await worker.stop()
        if worker_task:
            worker_task.cancel()
            worker_task = None
        worker = None
        if redis_client:
            await redis_client.aclose()
            redis_client = None


@app.on_event("startup")
async def _startup():
    await ensure_started()


@app.on_event("shutdown")
async def _shutdown():
    await ensure_stopped()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "chat-api-v2"}


@app.post("/v2/chat/sessions", dependencies=[Depends(require_auth)])
async def create_session(body: SessionCreateRequest, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user_id = extract_user_id(claims)
    s = await repo.create_session(db, user_id, body.title, body.model)
    return {"success": True, "session": _map_session(s)}


@app.get("/v2/chat/sessions", dependencies=[Depends(require_auth)])
async def list_sessions(limit: int = 50, offset: int = 0, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user_id = extract_user_id(claims)
    rows = await repo.list_sessions(db, user_id, limit=limit, offset=offset)
    return {"success": True, "sessions": [_map_session(x) for x in rows]}


@app.get("/v2/chat/sessions/{session_id}", dependencies=[Depends(require_auth)])
async def get_session(session_id: str, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user_id = extract_user_id(claims)
    s = await repo.get_session(db, session_id, user_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    msgs = await repo.get_messages(db, session_id)
    task = await repo.get_active_task(db, session_id)
    return {
        "success": True,
        "session": _map_session(s),
        "messages": [_map_message(m) for m in msgs],
        "activeTask": _map_task(task) if task else None,
    }


@app.patch("/v2/chat/sessions/{session_id}", dependencies=[Depends(require_auth)])
async def update_session(session_id: str, body: SessionUpdateRequest, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user_id = extract_user_id(claims)
    s = await repo.get_session(db, session_id, user_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    s = await repo.update_session(db, s, body.title, body.model, body.status)
    return {"success": True, "session": _map_session(s)}


@app.delete("/v2/chat/sessions/{session_id}", dependencies=[Depends(require_auth)])
async def delete_session(session_id: str, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user_id = extract_user_id(claims)
    s = await repo.get_session(db, session_id, user_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    await repo.soft_delete_session(db, s)
    return {"success": True}


@app.get("/v2/chat/sessions/{session_id}/messages", dependencies=[Depends(require_auth)])
async def get_messages(session_id: str, after: int | None = None, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user_id = extract_user_id(claims)
    s = await repo.get_session(db, session_id, user_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    msgs = await repo.get_messages(db, session_id, after=after)
    return {"success": True, "messages": [_map_message(m) for m in msgs]}


@app.post("/v2/chat/sessions/{session_id}/messages", dependencies=[Depends(require_auth)])
async def send_message(session_id: str, body: MessageSendRequest, request: Request, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    global worker
    user_id = extract_user_id(claims)
    s = await repo.get_session(db, session_id, user_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    model = (body.model or s.model or settings.DEFAULT_MODEL).strip() or settings.DEFAULT_MODEL
    user_msg = await repo.create_message(db, session_id, "user", body.content, status="complete")
    assistant_msg = await repo.create_message(db, session_id, "assistant", "", status="streaming")

    auth_header = request.headers.get("authorization", "")
    bearer_access_token = ""
    if isinstance(auth_header, str) and auth_header.lower().startswith("bearer "):
        bearer_access_token = auth_header[7:]

    merged_context = dict(body.context or {})
    if body.balance and not merged_context.get("balance"):
        merged_context["balance"] = body.balance
    if body.walletAddress and not merged_context.get("walletAddress"):
        merged_context["walletAddress"] = body.walletAddress
    if body.chainId and not merged_context.get("chainId"):
        merged_context["chainId"] = body.chainId

    ctx_wallet = body.walletAddress or (merged_context.get("walletAddress") if isinstance(merged_context, dict) else None)
    ctx_chain = body.chainId or (merged_context.get("chainId") if isinstance(merged_context, dict) else None)
    ctx_native = body.nativeBalance or (merged_context.get("nativeBalance") if isinstance(merged_context, dict) else None)
    ctx_balance = body.balance or (merged_context.get("balance") if isinstance(merged_context, dict) else None)

    tool_context = {
        "walletAddress": ctx_wallet,
        "chainId": ctx_chain,
        "toolConfig": body.toolConfig,
        "allowanceMode": body.allowanceMode,
        "nativeBalance": ctx_native,
        "balance": ctx_balance,
        "currentPage": body.currentPage,
        "pageContext": body.pageContext,
        "context": merged_context,
        "farcaster": body.farcaster or (merged_context.get("farcaster") if isinstance(merged_context, dict) else None),
        "accessToken": body.accessToken or bearer_access_token,
        "appKey": body.appKey,
        "userId": user_id,
        "sessionId": session_id,
    }
    logger.info(
        "send_message context session_id=%s user_id=%s wallet=%s chain=%s nativeBalance=%s balance_keys=%s context_keys=%s",
        session_id,
        user_id,
        ctx_wallet,
        ctx_chain,
        ctx_native,
        list((ctx_balance or {}).keys())[:12] if isinstance(ctx_balance, dict) else [],
        list((merged_context or {}).keys())[:20] if isinstance(merged_context, dict) else [],
    )
    task = await repo.create_task(db, session_id, user_msg.id, assistant_msg.id, model=model, tool_context=tool_context)
    if worker:
        await worker.enqueue(task.id, user_id)

    # emit message_start early
    await ws_manager.broadcast_event(user_id, "message_start", session_id, assistant_msg.id, {"message_id": assistant_msg.id, "task_id": task.id})

    return {
        "success": True,
        "userMessage": _map_message(user_msg),
        "assistantMessage": _map_message(assistant_msg),
        "task": _map_task(task),
    }


@app.put("/v2/chat/sessions/{session_id}/messages/{message_id}/feedback", dependencies=[Depends(require_auth)])
async def rate_message(session_id: str, message_id: str, body: FeedbackRequest, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user_id = extract_user_id(claims)
    s = await repo.get_session(db, session_id, user_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    m = await db.get(ChatMessage, message_id)
    if not m:
        raise HTTPException(status_code=404, detail="Message not found")
    m.feedback = body.feedback
    await db.commit()
    return {"success": True}


@app.get("/v2/chat/tasks/{task_id}", dependencies=[Depends(require_auth)])
async def get_task(task_id: str, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    _ = extract_user_id(claims)
    t = await repo.get_task(db, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return _map_task(t)


@app.post("/v2/chat/tasks/{task_id}/cancel", dependencies=[Depends(require_auth)])
async def cancel_task(task_id: str, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user_id = extract_user_id(claims)
    t = await repo.get_task(db, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    await repo.set_task_status(db, t, "cancelled", cancelled_by=user_id)
    await ws_manager.broadcast_event(
        user_id,
        "status",
        t.session_id,
        t.assistant_message_id,
        {"status": "stopped", "task_id": t.id, "taskId": t.id, "cancelled": True},
    )
    return {"success": True}


@app.post("/v2/chat/tasks/{task_id}/stop", dependencies=[Depends(require_auth)])
async def stop_task_compat(task_id: str, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await cancel_task(task_id, claims=claims, db=db)


@app.get("/v2/chat/messages/{message_id}/chunks", dependencies=[Depends(require_auth)])
async def get_chunks(message_id: str, after: int | None = None, claims=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    _ = extract_user_id(claims)
    chunks = await repo.get_chunks(db, message_id, after=after)
    out = []
    for c in chunks:
        out.append(
            {
                "id": c.id,
                "message_id": c.message_id,
                "chunk_index": c.chunk_index,
                "chunk_type": c.chunk_type,
                "content": c.content,
                "reasoning_content": c.reasoning_content,
                "metadata": c.metadata_json,
                "created_at": c.created_at,
            }
        )
    return {"success": True, "chunks": out}


@app.get("/v2/chat/suggestions", dependencies=[Depends(require_auth)])
async def suggestions(claims=Depends(require_auth)):
    _ = extract_user_id(claims)
    return {"success": True, "suggestions": ["What’s trending on Base?", "Analyze this token", "Check my wallet balance"]}


@app.post("/v2/chat/moderation/log", dependencies=[Depends(require_auth)])
async def moderation_log(payload: dict[str, Any], claims=Depends(require_auth)):
    _ = extract_user_id(claims)
    return {"success": True, "accepted": True, "timestamp": datetime.utcnow().isoformat() + "Z", "payload": payload}


@app.websocket("/v2/chat/ws")
async def ws_endpoint(websocket: WebSocket, token: str = Query(default="")):
    if not token:
        await websocket.close(code=1008, reason="Missing token")
        return
    try:
        claims = verify_privy_token(token) if not settings.SKIP_AUTH else {"sub": "dev-user"}
        user_id = extract_user_id(claims)
    except Exception as e:
        logger.warning("WS auth failed: %s", e)
        await websocket.close(code=1008, reason="Invalid token")
        return

    await ws_manager.register(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await ws_manager.handle_client_message(user_id, websocket, data)
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.unregister(user_id, websocket)
