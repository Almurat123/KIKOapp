from __future__ import annotations

import asyncio
import json
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Any

from fastapi import WebSocket

from .settings import settings


class WSManager:
    def __init__(self):
        self.clients: dict[str, set[WebSocket]] = defaultdict(set)
        self.session_seq: dict[str, int] = defaultdict(int)
        self.buffer: dict[str, deque[dict[str, Any]]] = defaultdict(deque)
        self.buffer_ts: dict[str, deque[datetime]] = defaultdict(deque)
        self.lock = asyncio.Lock()

    async def register(self, user_id: str, ws: WebSocket):
        await ws.accept()
        async with self.lock:
            self.clients[user_id].add(ws)

    async def unregister(self, user_id: str, ws: WebSocket):
        async with self.lock:
            if user_id in self.clients and ws in self.clients[user_id]:
                self.clients[user_id].remove(ws)
                if not self.clients[user_id]:
                    self.clients.pop(user_id, None)

    async def broadcast_event(self, user_id: str, event_type: str, session_id: str, message_id: str | None, payload: dict[str, Any]):
        async with self.lock:
            self.session_seq[session_id] += 1
            ev = {
                "event_id": str(uuid.uuid4()),
                "type": event_type,
                "session_id": session_id,
                "message_id": message_id,
                "seq": self.session_seq[session_id],
                "ts": datetime.utcnow().isoformat() + "Z",
                "payload": payload,
            }
            self._buffer(session_id, ev)
            sockets = list(self.clients.get(user_id, set()))

        payload_text = json.dumps(ev, ensure_ascii=False)
        for ws in sockets:
            try:
                await ws.send_text(payload_text)
            except Exception:
                await self.unregister(user_id, ws)

    async def handle_client_message(self, user_id: str, ws: WebSocket, data: dict[str, Any]):
        msg_type = data.get("type")
        if msg_type == "ping":
            await ws.send_text(json.dumps({"type": "pong"}))
            return
        if msg_type == "sync":
            session_id = data.get("sessionId") or data.get("session_id")
            last_seq = int(data.get("lastSeq") or data.get("last_seq") or 0)
            if not session_id:
                return
            events = self.get_buffered_after(session_id, last_seq)
            for e in events:
                await ws.send_text(json.dumps(e, ensure_ascii=False))
            await ws.send_text(json.dumps({"type": "sync_complete", "session_id": session_id, "count": len(events)}))

    def get_buffered_after(self, session_id: str, seq: int) -> list[dict[str, Any]]:
        return [e for e in self.buffer.get(session_id, deque()) if int(e.get("seq", 0)) > seq]

    def _buffer(self, session_id: str, event: dict[str, Any]):
        buf = self.buffer[session_id]
        bts = self.buffer_ts[session_id]
        now = datetime.utcnow()
        buf.append(event)
        bts.append(now)
        while len(buf) > settings.WS_BUFFER_MAX:
            buf.popleft()
            bts.popleft()
        ttl = timedelta(seconds=settings.WS_BUFFER_TTL_SEC)
        while bts and (now - bts[0]) > ttl:
            bts.popleft()
            if buf:
                buf.popleft()


ws_manager = WSManager()
