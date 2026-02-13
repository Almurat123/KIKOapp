import os
from pathlib import Path
from dotenv import load_dotenv


_BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_BASE_DIR / ".env")
load_dotenv()


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in ("1", "true", "yes", "on")


class Settings:
    APP_NAME = "kiko-chat-v2"
    DEBUG = _bool("DEBUG", False)

    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://almurat:almurat@localhost:5432/kiko_db")
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    if os.getenv("CHAT_API_PORT"):
        _port = os.getenv("CHAT_API_PORT")
    elif os.getenv("RAILWAY_ENVIRONMENT"):
        _port = os.getenv("PORT", "8100")
    else:
        _port = "8001"
    LLM_GATEWAY_URL = os.getenv("LLM_GATEWAY_URL", f"http://127.0.0.1:{_port}/llm-gateway")
    TOOL_RUNTIME_URL = os.getenv("TOOL_RUNTIME_URL", f"http://127.0.0.1:{_port}/tool-runtime")

    INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")

    PRIVY_APP_ID = os.getenv("PRIVY_APP_ID")
    PRIVY_JWKS_URL = os.getenv(
        "PRIVY_JWKS_URL",
        f"https://auth.privy.io/api/v1/apps/{PRIVY_APP_ID}/jwks.json" if PRIVY_APP_ID else "https://auth.privy.io/api/v1/keys",
    )
    SKIP_AUTH = _bool("SKIP_AUTH", False)

    WS_BUFFER_TTL_SEC = int(os.getenv("CHAT_V2_WS_BUFFER_TTL_SEC", "60"))
    WS_BUFFER_MAX = int(os.getenv("CHAT_V2_WS_BUFFER_MAX", "200"))

    TASK_QUEUE_KEY = os.getenv("CHAT_V2_TASK_QUEUE_KEY", "chat:v2:tasks")
    CHUNK_FLUSH_MS = int(os.getenv("CHAT_V2_CHUNK_FLUSH_MS", "800"))
    CANCEL_CHECK_MS = int(os.getenv("CHAT_V2_CANCEL_CHECK_MS", "500"))
    MAX_TOOL_ROUNDS = int(os.getenv("CHAT_V2_MAX_TOOL_ROUNDS", "4"))
    TOOL_EXEC_TIMEOUT_SEC = int(os.getenv("CHAT_V2_TOOL_EXEC_TIMEOUT_SEC", "45"))


settings = Settings()
