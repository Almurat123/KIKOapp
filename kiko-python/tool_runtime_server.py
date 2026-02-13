import os
import uvicorn
from tool_runtime.app import app


if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("TOOL_RUNTIME_PORT", "8102")))
    uvicorn.run(app, host="0.0.0.0", port=port)
