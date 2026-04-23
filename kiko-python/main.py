"""
KiKo Python Services - Unified FastAPI Application
Combines: grok-service and moderation-service.
Optional sub-services are mounted only when explicitly enabled.
"""
import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn
from logging_setup import build_uvicorn_log_config, configure_service_logging

# Load environment variables
# First try current directory, then fallback to kiko-api/.env
load_dotenv()
if not os.getenv("RAILWAY_ENVIRONMENT") and not os.getenv("XAI_API_KEY"):
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "kiko-api", ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)

# Configure logging
configure_service_logging()
logger = logging.getLogger(__name__)


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

# Create main FastAPI app
app = FastAPI(
    title="KiKo Python Services",
    description="Unified API for Grok AI and Content Moderation",
    version="1.0.0"
)


def _rag_enabled() -> bool:
    return os.getenv("ENABLE_RAG_SERVICE", "false").strip().lower() in {"1", "true", "yes", "on"}

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check for the unified service
@app.get("/health")
async def main_health():
    return {"status": "ok", "service": "kiko-python"}


chat_v2_ensure_started = None
chat_v2_ensure_stopped = None

# Mount sub-applications
# Each service keeps its own FastAPI app, mounted as a sub-app

# Chat API v2 (new primary chat entrypoint)
try:
    from chat_v2.app import app as chat_v2_app, ensure_started as chat_v2_ensure_started, ensure_stopped as chat_v2_ensure_stopped
    app.mount("/chat-api", chat_v2_app)
    logger.info("✅ Chat v2 service mounted at /chat-api")
except Exception as e:
    logger.error(f"❌ Failed to mount Chat v2 service: {e}")

# LLM Gateway (internal)
try:
    from llm_gateway.app import app as llm_gateway_app
    app.mount("/llm-gateway", llm_gateway_app)
    logger.info("✅ LLM Gateway mounted at /llm-gateway")
except Exception as e:
    logger.error(f"❌ Failed to mount LLM Gateway: {e}")

# Tool Runtime (internal)
try:
    from tool_runtime.app import app as tool_runtime_app
    app.mount("/tool-runtime", tool_runtime_app)
    logger.info("✅ Tool Runtime mounted at /tool-runtime")
except Exception as e:
    logger.error(f"❌ Failed to mount Tool Runtime: {e}")

# Generation Service (internal)
try:
    from generation.app import app as generation_app
    app.mount("/generation", generation_app)
    logger.info("✅ Generation service mounted at /generation")
except Exception as e:
    logger.error(f"❌ Failed to mount Generation service: {e}")

# Orchestration Service (internal)
try:
    from orchestration.app import app as orchestration_app
    app.mount("/orchestration", orchestration_app)
    logger.info("✅ Orchestration service mounted at /orchestration")
except Exception as e:
    logger.error(f"❌ Failed to mount Orchestration service: {e}")

# Grok Service
try:
    from grok.router import app as grok_app
    app.mount("/grok", grok_app)
    logger.info("✅ Grok service mounted at /grok")
except Exception as e:
    logger.error(f"❌ Failed to mount Grok service: {e}")

# Moderation Service
try:
    from moderation.router import app as moderation_app
    from moderation.models import moderation_models
    # Explicitly initialize models since sub-app startup events don't auto-trigger
    moderation_models.initialize()
    app.mount("/moderation", moderation_app)
    logger.info("✅ Moderation service mounted at /moderation")
except Exception as e:
    logger.error(f"❌ Failed to mount Moderation service: {e}")

# RAG Service (disabled by default)
if _rag_enabled():
    try:
        from rag.router import app as rag_app
        app.mount("/rag", rag_app)
        logger.info("✅ RAG service mounted at /rag")
    except Exception as e:
        logger.error(f"❌ Failed to mount RAG service: {e}")
else:
    logger.info("ℹ️ RAG service disabled")

# Root compatibility path, so /v2/chat/* also works on single-port deploy.
if chat_v2_ensure_started and chat_v2_ensure_stopped:
    app.mount("/", chat_v2_app)


@app.on_event("startup")
async def _startup():
    if chat_v2_ensure_started:
        await chat_v2_ensure_started()


@app.on_event("shutdown")
async def _shutdown():
    if chat_v2_ensure_stopped:
        await chat_v2_ensure_stopped()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_config=build_uvicorn_log_config(),
    )
