import json
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse, JSONResponse

from .schemas import GenerateRequest
from .adapters.openai_like import stream_generate
from chat_v2.auth import require_auth


app = FastAPI(title="kiko-llm-gateway", version="2.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "llm-gateway"}


@app.post("/internal/v1/generate", dependencies=[Depends(require_auth)])
async def generate(req: GenerateRequest):
    if not req.stream:
        # Keep API shape simple; this path can be extended later
        events = []
        async for ev in stream_generate(req):
            events.append(ev.model_dump())
            if ev.event_type in ("done", "error"):
                break
        return JSONResponse({"events": events})

    async def event_stream():
        async for ev in stream_generate(req):
            yield f"data: {json.dumps(ev.model_dump(), ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
