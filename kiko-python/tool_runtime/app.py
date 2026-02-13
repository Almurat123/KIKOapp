import os
import httpx
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from typing import Any

from chat_v2.auth import require_auth


app = FastAPI(title="kiko-tool-runtime", version="2.0.0")
NODE_API_URL = os.getenv("NODE_API_URL", "http://127.0.0.1:3001").rstrip("/")
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")


class ToolExecRequest(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = {}
    context: dict[str, Any] = {}
    task_id: str | None = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "tool-runtime"}


@app.get("/internal/v1/tool/definitions", dependencies=[Depends(require_auth)])
async def tool_definitions():
    headers = {"Content-Type": "application/json"}
    if INTERNAL_SERVICE_KEY:
        headers["x-service-key"] = INTERNAL_SERVICE_KEY
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"{NODE_API_URL}/internal/tools/definitions", headers=headers)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text[:600])
    data = resp.json()
    return {"ok": True, "tools": data.get("tools", [])}


@app.post("/internal/v1/tool/execute", dependencies=[Depends(require_auth)])
async def execute_tool(req: ToolExecRequest):
    headers = {"Content-Type": "application/json"}
    if INTERNAL_SERVICE_KEY:
        headers["x-service-key"] = INTERNAL_SERVICE_KEY
    payload = {"tool_name": req.tool_name, "arguments": req.arguments, "context": req.context}
    async with httpx.AsyncClient(timeout=45) as client:
        resp = await client.post(f"{NODE_API_URL}/internal/tools/execute", headers=headers, json=payload)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text[:1000])
    data = resp.json()
    return {
        "ok": bool(data.get("success", False)),
        "tool_name": req.tool_name,
        "result": data.get("result"),
        "error": data.get("error"),
    }


@app.post("/internal/v1/tool/jobs/{job_id}/result", dependencies=[Depends(require_auth)])
async def tool_job_callback(job_id: str, payload: dict[str, Any]):
    return {"ok": True, "job_id": job_id, "accepted": True, "payload": payload}
