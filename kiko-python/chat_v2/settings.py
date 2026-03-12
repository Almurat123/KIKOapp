import os
from pathlib import Path
from dotenv import load_dotenv


_BASE_DIR = Path(__file__).resolve().parents[1]
if not os.getenv("RAILWAY_ENVIRONMENT"):
    load_dotenv(_BASE_DIR / ".env")
    load_dotenv()


def _build_database_url() -> str:
    direct = (
        os.getenv("DATABASE_URL")
        or os.getenv("DATABASE_PRIVATE_URL")
        or os.getenv("DATABASE_PUBLIC_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRESQL_URL")
    )
    if direct:
        return direct

    # Railway/managed PG plugins sometimes expose discrete PG* vars.
    pghost = os.getenv("PGHOST")
    pgport = os.getenv("PGPORT")
    pguser = os.getenv("PGUSER")
    pgpassword = os.getenv("PGPASSWORD")
    pgdatabase = os.getenv("PGDATABASE")
    if pghost and pgport and pguser and pgpassword and pgdatabase:
        return f"postgresql://{pguser}:{pgpassword}@{pghost}:{pgport}/{pgdatabase}"

    # Local default only for non-Railway.
    if os.getenv("RAILWAY_ENVIRONMENT"):
        raise RuntimeError(
            "DATABASE_URL missing in Railway env. Set DATABASE_URL (or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE)."
        )
    return "postgresql://almurat:almurat@localhost:5432/kiko_db"


def _build_redis_url() -> str:
    direct = (
        os.getenv("REDIS_URL")
        or os.getenv("REDIS_PRIVATE_URL")
        or os.getenv("REDIS_PUBLIC_URL")
    )
    if direct:
        return direct
    if os.getenv("RAILWAY_ENVIRONMENT"):
        # Allow startup in Railway without redis plugin; worker queue will still initialize against local fallback only outside Railway.
        raise RuntimeError("REDIS_URL missing in Railway env. Set REDIS_URL (or REDIS_PRIVATE_URL).")
    return "redis://localhost:6379/0"


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in ("1", "true", "yes", "on")


class Settings:
    APP_NAME = "kiko-chat-v2"
    DEBUG = _bool("DEBUG", False)

    DATABASE_URL = _build_database_url()
    REDIS_URL = _build_redis_url()

    if os.getenv("CHAT_API_PORT"):
        _port = os.getenv("CHAT_API_PORT")
    elif os.getenv("PORT"):
        _port = os.getenv("PORT")
    elif os.getenv("RAILWAY_ENVIRONMENT"):
        _port = os.getenv("PORT", "8100")
    else:
        _port = "8000"
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
    MAX_TOOL_ROUNDS = int(os.getenv("CHAT_V2_MAX_TOOL_ROUNDS", "10"))
    MAX_CONCURRENT_TASKS = int(os.getenv("CHAT_WORKER_MAX_CONCURRENCY", "24"))
    # Node parity defaults (chatWorker.ts): task=12, per-tool=3, repeat=1, failure=2
    MAX_TOOL_CALLS = int(os.getenv("CHAT_V2_MAX_TOOL_CALLS", "12"))
    MAX_TOOL_CALLS_PER_TOOL = int(os.getenv("CHAT_V2_MAX_TOOL_CALLS_PER_TOOL", "3"))
    MAX_TOOL_CALLS_PER_ROUND = int(os.getenv("CHAT_V2_MAX_TOOL_CALLS_PER_ROUND", "8"))
    MAX_TOOL_SAME_ARGS_REPEAT = int(os.getenv("CHAT_V2_MAX_TOOL_SAME_ARGS_REPEAT", "1"))
    MAX_TOOL_FAILURES_PER_TOOL = int(os.getenv("CHAT_V2_MAX_TOOL_FAILURES_PER_TOOL", "2"))
    TOOL_EXEC_TIMEOUT_SEC = int(os.getenv("CHAT_V2_TOOL_EXEC_TIMEOUT_SEC", "45"))
    CONTEXT_RECENT_WINDOW = int(os.getenv("CHAT_CONTEXT_RECENT_WINDOW", "12"))
    CONTEXT_MAX_INPUT_TOKENS = int(os.getenv("CHAT_CONTEXT_MAX_INPUT_TOKENS", "16000"))
    CONTEXT_RESERVED_OUTPUT_TOKENS = int(os.getenv("CHAT_CONTEXT_RESERVED_OUTPUT_TOKENS", "3500"))
    DEFAULT_NATIVE_PRICE_USD = float(os.getenv("CHAT_DEFAULT_NATIVE_PRICE_USD", "2000"))


settings = Settings()
