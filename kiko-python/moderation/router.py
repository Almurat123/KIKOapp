from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import uvicorn
import logging
from moderation.models import moderation_models

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="KiKo Moderation Service")

class ModerationRequest(BaseModel):
    text: str
    context: dict = {}

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing moderation models...")
    moderation_models.initialize()
    logger.info("Models ready")

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/input")
async def moderate_input(req: ModerationRequest):
    logger.info(f"Moderating input: {req.text[:50]}...")

    api_result = moderation_models.classify_input(req.text)
    is_safe = not api_result.get("flagged", False)

    return {
        "safe": is_safe,
        "checks": {
            "openai": api_result
        },
        "action": "allow" if is_safe else "block"
    }

@app.post("/output")
async def moderate_output(req: ModerationRequest):
    logger.info(f"Moderating output: {req.text[:50]}...")
    
    verification = moderation_models.verify_output(req.text)

    is_safe = verification.get("safe", True)

    return {
        "safe": is_safe,
        "verification": verification,
        "checks": {},
        "filtered_text": req.text if is_safe else "[Filtered for safety]"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
