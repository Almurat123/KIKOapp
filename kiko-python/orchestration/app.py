from __future__ import annotations

import json
import logging

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from chat_v2.auth import require_internal_service

from .schemas import StartRunRequest, ToolResultModel
from .service import service

logger = logging.getLogger(__name__)

app = FastAPI(title="kiko-orchestration", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "orchestration"}


@app.post("/internal/v1/runs", dependencies=[Depends(require_internal_service)])
async def start_run(body: StartRunRequest):
    run_id = await service.start_run(body.snapshot)
    logger.info(
        "orchestration.start_run run_id=%s session_id=%s task_id=%s model=%s msg_len=%s",
        run_id,
        body.snapshot.sessionId,
        body.snapshot.taskId,
        body.snapshot.model,
        len(body.snapshot.lastUserMessage or ""),
    )
    return {"run_id": run_id}


@app.get("/internal/v1/runs/{run_id}/stream", dependencies=[Depends(require_internal_service)])
async def stream_run(run_id: str):
    if not service.get_state(run_id):
        raise HTTPException(status_code=404, detail="run not found")
    logger.info("orchestration.stream_open run_id=%s", run_id)

    async def event_stream():
        async for event in service.stream_events(run_id):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/internal/v1/runs/{run_id}/tool-results", dependencies=[Depends(require_internal_service)])
async def post_tool_result(run_id: str, body: ToolResultModel):
    try:
        await service.push_tool_result(run_id, body)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="run not found") from exc
    logger.info(
        "orchestration.tool_result run_id=%s tool=%s ok=%s",
        run_id,
        body.name,
        body.ok,
    )
    return {"ok": True}
