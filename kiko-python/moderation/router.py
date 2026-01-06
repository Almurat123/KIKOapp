from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import uvicorn
import logging
from moderation.models import moderation_models
from moderation.detectors.intent_detector import intent_detector
from moderation.detectors.sensitive_filter import sensitive_filter
from moderation.detectors.code_scanner import code_scanner

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
    
    intent = intent_detector.detect(req.text)
    sensitive = sensitive_filter.filter(req.text)
    code = code_scanner.scan(req.text)
    
    is_safe = (intent["risk_level"] != "high") and (not sensitive) and (not code)
    
    return {
      "safe": is_safe,
      "checks": {
          "intent": intent,
          "sensitive": sensitive,
          "code": code
      },
      "action": "allow" if is_safe else "block"
    }

@app.post("/output")
async def moderate_output(req: ModerationRequest):
    logger.info(f"Moderating output: {req.text[:50]}...")
    
    # GPT-2 verification
    verification = moderation_models.verify_output(req.text)
    
    # Check for leaks in output (XSS, PKs)
    code = code_scanner.scan(req.text)
    sensitive = sensitive_filter.filter(req.text)
    
    # Heuristic: if perplexity is extremely high, might be hallucination or garbage
    # (Tuned values would be needed in production)
    is_safe = (not code) and (not sensitive)
    
    return {
        "safe": is_safe,
        "verification": verification,
        "checks": {
            "code": code,
            "sensitive": sensitive
        },
        "filtered_text": req.text if is_safe else "[Filtered for safety]"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
