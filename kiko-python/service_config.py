from __future__ import annotations

import os


def _resolve_port() -> str:
    if os.getenv("CHAT_API_PORT"):
        return os.getenv("CHAT_API_PORT", "8000")
    if os.getenv("PORT"):
        return os.getenv("PORT", "8000")
    if os.getenv("RAILWAY_ENVIRONMENT"):
        return os.getenv("PORT", "8100")
    return "8000"


SERVICE_PORT = _resolve_port()
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")
LLM_GATEWAY_URL = os.getenv("LLM_GATEWAY_URL", f"http://127.0.0.1:{SERVICE_PORT}/llm-gateway")
TOOL_RUNTIME_URL = os.getenv("TOOL_RUNTIME_URL", f"http://127.0.0.1:{SERVICE_PORT}/tool-runtime")
