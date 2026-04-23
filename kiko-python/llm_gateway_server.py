import os
import uvicorn
from llm_gateway.app import app
from logging_setup import build_uvicorn_log_config, configure_service_logging


configure_service_logging()


if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("LLM_GATEWAY_PORT", "8101")))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_config=build_uvicorn_log_config(),
    )
