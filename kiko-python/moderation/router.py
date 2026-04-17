from fastapi import FastAPI, Depends
from pydantic import BaseModel, Field
import uvicorn
import logging
from moderation.models import moderation_models
from service_auth import require_internal_service

# CONTEXT MEMORY
# Updated: 2026-04-17
# Author: Rowan
# Reason: generated-image flows need a strict moderation endpoint that can
#         check prompt text and image URLs without changing ordinary chat's
#         existing `/input` and `/output` behavior.
# Goal: keep generated-image safety gates explicit, fail-closed, and separate
#       from normal chat moderation.
# Owns: internal moderation HTTP endpoints and request/response envelopes.
# Does Not Own: Node-side generated image policy, image storage, or chat worker
#               moderation placement.
# Design Language:
# - `/input` and `/output` remain ordinary chat-compatible text endpoints
# - `/image-generation` is the strict generated-image gate
# - generated-image moderation accepts text and image URLs in one request
# - generated-image moderation must return block on empty or failed checks
# Document Provenance:
# - Source: OpenAI Moderation guide and Moderations API OpenAPI spec
# - Kind: official API doc
# - Retrieved: 2026-04-17
# - Applied To: text + image_url moderation endpoint boundary
# - Verification: verified in docs and code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
# - /Users/almurat/KiKo/system-journal/owner-map/generated-image-safety.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-generated-image-safety-gate.md

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="KiKo Moderation Service")

class ModerationRequest(BaseModel):
    text: str
    context: dict = {}

class ImageGenerationModerationRequest(BaseModel):
    text: str = ""
    image_urls: list[str] = Field(default_factory=list)
    stage: str = "prompt"
    context: dict = Field(default_factory=dict)

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing moderation models...")
    moderation_models.initialize()
    logger.info("Models ready")

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/input", dependencies=[Depends(require_internal_service)])
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

@app.post("/image-generation", dependencies=[Depends(require_internal_service)])
async def moderate_image_generation(req: ImageGenerationModerationRequest):
    logger.info(
        "Moderating generated-image stage=%s text_len=%s image_count=%s",
        req.stage,
        len(req.text or ""),
        len(req.image_urls or []),
    )

    api_result = moderation_models.classify_image_generation(
        text=req.text,
        image_urls=req.image_urls,
    )
    is_safe = not api_result.get("flagged", True)

    return {
        "safe": is_safe,
        "checks": {
            "openai": api_result
        },
        "action": "allow" if is_safe else "block",
        "stage": req.stage,
        "strict": True
    }

@app.post("/output", dependencies=[Depends(require_internal_service)])
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
