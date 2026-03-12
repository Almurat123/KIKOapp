import os
import logging
import uvicorn
from dotenv import load_dotenv


# Always load env from this service directory first, regardless of cwd.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Keep internal service URLs on the same local port by default.
if not os.getenv("RAILWAY_ENVIRONMENT"):
    os.environ.setdefault("CHAT_API_PORT", "8001")

from chat_v2.app import app
from chat_v2.settings import settings

try:
    from llm_gateway.app import app as llm_gateway_app
    app.mount("/llm-gateway", llm_gateway_app)
    logger.info("Mounted llm-gateway at /llm-gateway")
except Exception as e:
    logger.error("Failed to mount llm-gateway: %s", e)

try:
    from tool_runtime.app import app as tool_runtime_app
    app.mount("/tool-runtime", tool_runtime_app)
    logger.info("Mounted tool-runtime at /tool-runtime")
except Exception as e:
    logger.error("Failed to mount tool-runtime: %s", e)

try:
    from orchestration.app import app as orchestration_app
    app.mount("/orchestration", orchestration_app)
    logger.info("Mounted orchestration at /orchestration")
except Exception as e:
    logger.error("Failed to mount orchestration: %s", e)


if __name__ == "__main__":
    # Local default: 8001. Railway: respect PORT.
    if os.getenv("RAILWAY_ENVIRONMENT"):
        port = int(os.getenv("PORT", "8001"))
    else:
        port = int(os.getenv("CHAT_API_PORT", "8001"))
    logger.info("Starting chat-api on port=%s llm_gateway=%s tool_runtime=%s", port, settings.LLM_GATEWAY_URL, settings.TOOL_RUNTIME_URL)
    uvicorn.run(app, host="0.0.0.0", port=port)
